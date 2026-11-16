"""FastAPI analysis API. The frontend only renders responses from this module."""
import base64
import json
from io import BytesIO
from contextlib import asynccontextmanager
from pathlib import Path
from tempfile import NamedTemporaryFile
from time import perf_counter

import mne
import numpy as np
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .features import band_power, pairwise_csp, time_feature, window_slice, fisher_j, silhouette
from .loader import load_fif
from .precompute import precompute
from .schemas import CSPRequest, DistributionRequest, FeatureRankingRequest, FeatureSpec, FeaturesRequest, SessionMetadata, TFRequest, TopomapRequest
from .session import get_active, set_active
from .tf import erd_ers

ROOT = Path(__file__).resolve().parents[2]


@asynccontextmanager
async def lifespan(_: FastAPI):
    demo = ROOT / "backend" / "data" / "user_demo-epo.fif"
    if not demo.exists():
        demo = ROOT / "subject_01_train_ica-epo.fif"
    if demo.exists():
        started = perf_counter()
        session = load_fif(demo, source="sample", session_id="user_demo", original_filename="subject_01_train_ica-epo.fif")
        session.cache["timing"] = precompute(session)
        session.cache["timing"]["load_and_precompute_seconds"] = perf_counter() - started
        set_active(session)
    yield


app = FastAPI(title="The Separability Lab API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_error(_, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": "Request failed", "detail": str(exc.detail)})


def require_session():
    try:
        return get_active()
    except RuntimeError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def validate_class_ids(session, ids: list[int]) -> None:
    known = {int(item["event_id"]) for item in session.classes}
    unknown = set(ids) - known
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown class event id(s): {sorted(unknown)}")


def validate_channels(session, names: list[str]) -> list[int]:
    unknown = set(names) - set(session.channels)
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown channel(s): {sorted(unknown)}")
    if not names:
        raise HTTPException(status_code=400, detail="Select at least one EEG channel")
    return [session.channels.index(name) for name in names]


def _csp(session, class_a: int, class_b: int, channels: list[str], m: int = 1):
    validate_class_ids(session, [class_a, class_b])
    indices = validate_channels(session, channels)
    key = (class_a, class_b, tuple(channels), m)
    if key not in session.cache.setdefault("csp", {}):
        session.cache["csp"][key] = pairwise_csp(session.X[:, indices, :], session.y, class_a, class_b, m)
    return session.cache["csp"][key]


def _feature_values(session, spec: FeatureSpec, pair: tuple[int, int]) -> np.ndarray:
    cache = session.cache.setdefault("feature_values", {})
    cache_key = (spec.model_dump_json(), pair)
    if cache_key in cache:
        return cache[cache_key]
    if spec.kind == "band_power":
        if spec.channel is None or spec.band is None:
            raise HTTPException(status_code=400, detail="Band power needs a channel and band")
        index = validate_channels(session, [spec.channel])[0]
        values = band_power(session.cache["freqs"], session.cache["psd"][:, index, :], *spec.band, relative=spec.relative, log10=spec.log10)
        cache[cache_key] = values
        return values
    if spec.kind == "time":
        if spec.channel is None or spec.feature is None or spec.window is None:
            raise HTTPException(status_code=400, detail="Time features need a channel, feature, and time window")
        index = validate_channels(session, [spec.channel])[0]
        start, stop = window_slice(*spec.window, session.sfreq, session.X.shape[2])
        if stop <= start:
            raise HTTPException(status_code=400, detail="Time window contains no samples")
        try:
            values = np.asarray([time_feature(trial, spec.feature) for trial in session.X[:, index, start:stop]])
            cache[cache_key] = values
            return values
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    if spec.kind == "csp":
        if spec.component not in (0, 1):
            raise HTTPException(status_code=400, detail="CSP component must be 0 or 1")
        channels = spec.channels or session.channels
        try:
            values = _csp(session, pair[0], pair[1], channels)[3][:, spec.component]
            cache[cache_key] = values
            return values
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    raise HTTPException(status_code=400, detail=f"Unknown feature kind: {spec.kind}")


def _feature_key(spec: FeatureSpec) -> str:
    if spec.kind == "band_power":
        band_name = "mu" if spec.band == (8.0, 12.0) else "beta" if spec.band == (13.0, 30.0) else f"{spec.band[0]}-{spec.band[1]}Hz"
        return f"{spec.channel} {band_name} {'relative' if spec.relative else 'absolute'}{' log10' if spec.log10 else ''}"
    if spec.kind == "time":
        return f"{spec.channel} {spec.feature} {spec.window[0]}–{spec.window[1]}s"
    return f"CSP component {int(spec.component) + 1} ({pair_label(spec)})"


def pair_label(spec: FeatureSpec) -> str:
    return "selected pair"


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/session", response_model=SessionMetadata)
def session_metadata() -> SessionMetadata:
    return require_session().metadata()


@app.get("/api/session/epoch")
def epoch_signal(trial: int = 0, channels: list[str] = Query(min_length=1, max_length=2)) -> dict:
    """Return the requested channels from one epoch for the signal workbench panel."""
    session = require_session()
    if trial < 0 or trial >= len(session.y):
        raise HTTPException(status_code=400, detail=f"Trial index must be between 0 and {len(session.y) - 1}")
    indices = validate_channels(session, channels)
    return {
        "trial": trial,
        "event_id": int(session.y[trial]),
        "channels": channels,
        "sfreq": session.sfreq,
        "tmin": session.tmin,
        "times": (session.tmin + np.arange(session.X.shape[2]) / session.sfreq).tolist(),
        "values": session.X[trial, indices, :].tolist(),
    }


@app.get("/api/samples")
def samples() -> list[dict[str, str | bool]]:
    items: list[dict[str, str | bool]] = []
    user_path = ROOT / "backend" / "data" / "user_demo-epo.fif"
    if not user_path.exists():
        user_path = ROOT / "subject_01_train_ica-epo.fif"
    if user_path.exists():
        items.append({"id": "user_demo", "title": "User EEG sample", "description": "Bundled epoched EEG from the project source file.", "has_challenges": True})
    physionet_path = ROOT / "backend" / "data" / "physionet_mi_s01-epo.fif"
    if physionet_path.exists():
        items.append({"id": "physionet_mi_s01", "title": "PhysioNet MI · subject 1", "description": "Left/right hand and both-hands/feet imagery; 90 epochs.", "has_challenges": True})
    return items


def _load_sample(sample_id: str):
    paths = {
        "user_demo": ROOT / "backend" / "data" / "user_demo-epo.fif",
        "physionet_mi_s01": ROOT / "backend" / "data" / "physionet_mi_s01-epo.fif",
    }
    path = paths.get(sample_id)
    if sample_id == "user_demo" and path is not None and not path.is_file():
        path = ROOT / "subject_01_train_ica-epo.fif"
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail=f"Bundled sample '{sample_id}' is unavailable")
    started = perf_counter()
    session = load_fif(path, source="sample", session_id=sample_id, original_filename="subject_01_train_ica-epo.fif" if sample_id == "user_demo" else None)
    session.cache["timing"] = precompute(session)
    session.cache["timing"]["load_and_precompute_seconds"] = perf_counter() - started
    set_active(session)
    return session.metadata()


@app.post("/api/samples/{sample_id}/load", response_model=SessionMetadata)
def load_sample(sample_id: str) -> SessionMetadata:
    return _load_sample(sample_id)


@app.post("/api/upload", response_model=SessionMetadata)
async def upload(file: UploadFile = File(...)) -> SessionMetadata:
    filename = file.filename or ""
    if not filename.lower().endswith(".fif"):
        raise HTTPException(status_code=400, detail="Only epoched .fif files are supported")
    tmp_name = None
    try:
        with NamedTemporaryFile(suffix=".fif", delete=False) as tmp:
            tmp.write(await file.read())
            tmp_name = tmp.name
        started = perf_counter()
        candidate = load_fif(tmp_name, source="upload")
        candidate.cache["timing"] = precompute(candidate)
        candidate.cache["timing"]["load_and_precompute_seconds"] = perf_counter() - started
        candidate.original_filename = Path(filename).name
        set_active(candidate)
        return candidate.metadata()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        await file.close()
        if tmp_name:
            Path(tmp_name).unlink(missing_ok=True)


@app.get("/api/session/psd")
def psd(channel: str, classes: list[int] | None = Query(default=None)) -> dict:
    session = require_session()
    index = validate_channels(session, [channel])[0]
    selected = classes or [int(item["event_id"]) for item in session.classes]
    validate_class_ids(session, selected)
    rows = []
    for event_id in selected:
        mask = session.y == event_id
        cls = next(item for item in session.classes if item["event_id"] == event_id)
        rows.append({"event_id": event_id, "name": cls["name"], "mean_psd": session.cache["psd"][mask, index].mean(axis=0).tolist()})
    return {"channel": channel, "freqs": session.cache["freqs"].tolist(), "series": rows}


@app.post("/api/session/tf")
def tf_map(request: TFRequest) -> dict:
    session = require_session()
    channel_idx = validate_channels(session, [request.channel])[0]
    validate_class_ids(session, request.classes)
    if request.freq_range[0] > request.freq_range[1]:
        raise HTTPException(status_code=400, detail="Invalid frequency range")
    freqs = session.cache["tf_freqs"]
    frequency_mask = (freqs >= request.freq_range[0]) & (freqs <= request.freq_range[1])
    if not frequency_mask.any():
        raise HTTPException(status_code=400, detail="Frequency range does not overlap the cached TF bins")
    times = session.cache["tf_times"]
    panels = []
    baseline_used = request.baseline
    fallback = False
    for event_id in request.classes:
        mask = session.y == event_id
        power = session.cache["tf_power"][mask, channel_idx, :, :][:, frequency_mask, :].astype("float32")
        try:
            result, actual_baseline, was_fallback = erd_ers(power, times, baseline=request.baseline)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        baseline_used, fallback = actual_baseline, fallback or was_fallback
        cls = next(item for item in session.classes if item["event_id"] == event_id)
        panels.append({"event_id": event_id, "name": cls["name"], "erd_ers": result.tolist()})
    warnings = []
    if fallback and baseline_used is not None:
        start, end = baseline_used
        warnings.append(f"This file has no pre-cue data (epochs start at {session.tmin:g} s). The default baseline is {start:g}–{end:g} s, after the cue, so ERD/ERS shows change relative to early task activity. Choose another baseline if needed.")
    return {"channel": request.channel, "freqs": freqs[frequency_mask].tolist(), "times": times.tolist(), "baseline": baseline_used, "warnings": warnings, "panels": panels}


@app.post("/api/session/csp")
def csp(request: CSPRequest) -> dict:
    session = require_session()
    try:
        filters, eigenvalues, patterns, features = _csp(session, request.class_a, request.class_b, request.channels, request.m)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"class_a": request.class_a, "class_b": request.class_b, "channels": request.channels, "filters": filters.tolist(), "eigenvalues": eigenvalues.tolist(), "patterns": patterns.tolist(), "features": features.tolist()}


def _candidates(session, pair: tuple[int, int], csp_channels: list[str]) -> list[FeatureSpec]:
    specs = []
    for channel in session.channels:
        for band in ((8.0, 12.0), (13.0, 30.0)):
            for relative in (False, True):
                specs.append(FeatureSpec(kind="band_power", channel=channel, band=band, relative=relative))
        for feature in ("mean", "ptp", "variance", "mobility", "complexity"):
            specs.append(FeatureSpec(kind="time", channel=channel, feature=feature, window=(0.5, 1.5)))
    validate_class_ids(session, list(pair))
    for component in (0, 1):
        specs.append(FeatureSpec(kind="csp", channels=csp_channels, component=component))
    return specs


@app.get("/api/session/feature-candidates")
def feature_candidates(class_a: int, class_b: int, channels: list[str] | None = Query(default=None)) -> dict:
    session = require_session()
    return {"features": [{"key": _feature_key(spec), "spec": spec.model_dump()} for spec in _candidates(session, (class_a, class_b), channels or session.channels)]}


@app.post("/api/session/features")
def features(request: FeaturesRequest) -> dict:
    session = require_session()
    validate_class_ids(session, [*request.pair, *(request.classes or [])])
    selected = request.classes or [int(item["event_id"]) for item in session.classes]
    if not set(request.pair).issubset(set(selected)):
        raise HTTPException(status_code=400, detail="The Fisher pair must be included in the selected classes")
    keep = np.isin(session.y, selected)
    columns, keys = [], []
    for spec in request.specs:
        values = _feature_values(session, spec, request.pair)
        columns.append(values[keep])
        keys.append(_feature_key(spec))
    matrix = np.column_stack(columns)
    labels = session.y[keep]
    try:
        fisher = fisher_j(matrix, labels, *request.pair)
        sil = silhouette(matrix, labels, *request.pair)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    scores = [fisher_j(matrix[:, index], labels, *request.pair) for index in range(matrix.shape[1])]
    return {"keys": keys, "values": matrix.tolist(), "labels": labels.tolist(), "classes": [item for item in session.classes if item["event_id"] in selected], "pair": list(request.pair), "fisher_j": fisher, "fisher_scores": scores, "silhouette": sil}


@app.post("/api/session/feature-ranking")
def feature_ranking(request: FeatureRankingRequest) -> dict:
    session = require_session()
    validate_class_ids(session, [*request.pair, *(request.classes or [])])
    selected = request.classes or [int(item["event_id"]) for item in session.classes]
    if not set(request.pair).issubset(selected):
        raise HTTPException(status_code=400, detail="The Fisher pair must be included in the selected classes")
    specs = _candidates(session, request.pair, request.channels or session.channels)
    keep = np.isin(session.y, selected)
    labels = session.y[keep]
    keys, scores = [], []
    for spec in specs:
        values = _feature_values(session, spec, request.pair)[keep]
        keys.append(_feature_key(spec))
        scores.append(fisher_j(values, labels, *request.pair))
    order = np.argsort(scores)[::-1]
    return {"features": [{"key": keys[i], "spec": specs[i].model_dump(), "fisher_j": float(scores[i])} for i in order]}


@app.post("/api/session/distributions")
def distributions(request: DistributionRequest) -> dict:
    session = require_session()
    selected = request.classes or [int(item["event_id"]) for item in session.classes]
    validate_class_ids(session, [*selected, *request.pair])
    if not set(request.pair).issubset(set(selected)):
        raise HTTPException(status_code=400, detail="The Fisher pair must be included in the selected classes")
    values = _feature_values(session, request.spec, request.pair)
    return {"key": _feature_key(request.spec), "classes": [{"event_id": event_id, "name": next(c["name"] for c in session.classes if c["event_id"] == event_id), "values": values[session.y == event_id].tolist()} for event_id in selected]}


@app.post("/api/session/topomap")
def topomap(request: TopomapRequest) -> dict:
    session = require_session()
    if len(request.channels) < 4:
        raise HTTPException(status_code=400, detail="Topomap rendering requires at least four channels")
    try:
        _, _, patterns, _ = _csp(session, request.class_a, request.class_b, request.channels)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if any(name not in session.channel_pos for name in request.channels):
        raise HTTPException(status_code=400, detail="Topomap requires montage positions for every selected channel")
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    positions = np.asarray([session.channel_pos[name] for name in request.channels])
    fig, ax = plt.subplots(figsize=(3.2, 3.2), dpi=100)
    mne.viz.plot_topomap(patterns[:, request.filter_index], positions, axes=ax, show=False, contours=0, cmap="RdBu_r")
    buffer = BytesIO()
    fig.savefig(buffer, format="png", transparent=True, bbox_inches="tight", pad_inches=.03)
    plt.close(fig)
    image = base64.b64encode(buffer.getvalue()).decode("ascii")
    return {"filter_index": request.filter_index, "class_a": request.class_a, "class_b": request.class_b, "png_base64": image}


@app.get("/api/session/metrics")
def cache_metrics() -> dict:
    """Development-only cache footprint and precompute timing for the active session."""
    session = require_session()
    return {"timing": session.cache.get("timing", {}), "cache_bytes": {key: int(value.nbytes) for key, value in session.cache.items() if hasattr(value, "nbytes")}}


@app.get("/api/session/export", response_class=PlainTextResponse)
def export_python(class_a: int, class_b: int, classes: list[int] = Query(min_length=1), specs: str = Query(...)) -> PlainTextResponse:
    session = require_session()
    validate_class_ids(session, [class_a, class_b, *classes])
    if class_a == class_b or not {class_a, class_b}.issubset(set(classes)):
        raise HTTPException(status_code=400, detail="Choose two different classes included in the selected class set")
    try:
        payload = json.loads(specs)
        if not isinstance(payload, list) or not payload:
            raise ValueError("At least one feature specification is required")
        parsed_specs = [FeatureSpec.model_validate(item) for item in payload]
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid feature specifications: {exc}") from exc
    if len(parsed_specs) > 20:
        raise HTTPException(status_code=400, detail="Export supports up to 20 selected features")
    default_fif = f"backend/data/{session.id}-epo.fif" if session.source == "sample" else None
    code = f'''"""Reproduce the selected feature-space Fisher J.

Run from the project root:
  python separability_reproduction.py --fif path/to/epochs-epo.fif
"""
import argparse
import sys
from pathlib import Path

import numpy as np

PROJECT = Path.cwd()
if not (PROJECT / "backend" / "app").is_dir():
    PROJECT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT / "backend"))
from app.features import fisher_j
from app.loader import load_fif
from app.main import _feature_values
from app.precompute import precompute
from app.schemas import FeatureSpec

FEATURE_SPECS = {repr([item.model_dump() for item in parsed_specs])}
CLASS_IDS = {repr(classes)}
PAIR = {repr([class_a, class_b])}
DEFAULT_FIF = {repr(default_fif)}

parser = argparse.ArgumentParser()
parser.add_argument("--fif", type=Path, default=Path(DEFAULT_FIF) if DEFAULT_FIF else None)
args = parser.parse_args()
if args.fif is None:
    parser.error("pass --fif with the epoched FIF file to analyze")

session = load_fif(args.fif, source="sample" if DEFAULT_FIF else "upload")
precompute(session)
specs = [FeatureSpec.model_validate(item) for item in FEATURE_SPECS]
keep = np.isin(session.y, CLASS_IDS)
matrix = np.column_stack([_feature_values(session, spec, tuple(PAIR))[keep] for spec in specs])
score = fisher_j(matrix, session.y[keep], PAIR[0], PAIR[1])
print("Fisher J: " + format(score, ".6f"))
'''
    return PlainTextResponse(code, headers={"Content-Disposition": 'attachment; filename="separability_reproduction.py"'})
