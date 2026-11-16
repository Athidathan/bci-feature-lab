"""End-to-end checks for cached analysis routes."""
from pathlib import Path
import sys
import json
import subprocess

import numpy as np
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_samples_and_session(client):
    assert client.get("/api/health").json() == {"ok": True}
    assert client.get("/api/samples").status_code == 200
    metadata = client.get("/api/session").json()
    assert len(metadata["classes"]) == 4
    assert len(metadata["channels"]) == 22
    loaded = client.post("/api/samples/user_demo/load")
    assert loaded.status_code == 200, loaded.text
    assert loaded.json()["id"] == "user_demo"
    assert loaded.json()["source"] == "sample"
    assert loaded.json()["original_filename"] == "subject_01_train_ica-epo.fif"
    signal = client.get("/api/session/epoch", params=[("trial", "0"), ("channels", "C3"), ("channels", "C4")])
    assert signal.status_code == 200
    assert signal.json()["channels"] == ["C3", "C4"]
    assert len(signal.json()["values"]) == 2
    assert len(signal.json()["values"][0]) == 1000
    assert client.get("/api/session/epoch", params={"trial": "9999", "channels": "C3"}).status_code == 400


def test_physionet_sample_loads_four_run_mapped_imagery_classes(client):
    listed = client.get("/api/samples").json()
    sample = next(item for item in listed if item["id"] == "physionet_mi_s01")
    assert sample["has_challenges"] is True
    loaded = client.post("/api/samples/physionet_mi_s01/load")
    assert loaded.status_code == 200, loaded.text
    metadata = loaded.json()
    assert metadata["classes"] == [
        {"name": "Left Hand", "event_id": 1, "count": 23},
        {"name": "Right Hand", "event_id": 2, "count": 22},
        {"name": "Both Hands", "event_id": 3, "count": 21},
        {"name": "Feet", "event_id": 4, "count": 24},
    ]
    assert metadata["sfreq"] == 160.0
    assert len(metadata["channels"]) == 64
    client.post("/api/samples/user_demo/load")


def test_psd_tf_csp_features_and_distribution(client):
    psd = client.get("/api/session/psd", params=[("channel", "C3"), ("classes", "0"), ("classes", "1")])
    assert psd.status_code == 200
    assert len(psd.json()["series"]) == 2
    assert len(psd.json()["freqs"]) == 35

    tf = client.post("/api/session/tf", json={"channel": "C3", "classes": [0, 1], "baseline": None, "freq_range": [8, 12]})
    assert tf.status_code == 200, tf.text
    assert len(tf.json()["panels"]) == 2
    assert np.isfinite(np.asarray(tf.json()["panels"][0]["erd_ers"])).all()
    assert tf.json()["warnings"]

    csp = client.post("/api/session/csp", json={"class_a": 0, "class_b": 1, "channels": ["C3", "Cz", "C4", "Pz"], "m": 1})
    assert csp.status_code == 200, csp.text
    assert len(csp.json()["features"]) == 288
    assert np.isfinite(np.asarray(csp.json()["features"])).all()

    spec = {"kind": "band_power", "channel": "C3", "band": [8, 12], "relative": True}
    payload = {"specs": [spec], "classes": [0, 1], "pair": [0, 1]}
    features = client.post("/api/session/features", json=payload)
    assert features.status_code == 200, features.text
    assert len(features.json()["values"]) == 144
    assert np.isfinite(features.json()["fisher_j"])
    assert len(features.json()["fisher_scores"]) == 1
    distribution = client.post("/api/session/distributions", json={"spec": spec, "classes": [0, 1], "pair": [0, 1]})
    assert distribution.status_code == 200
    assert [len(item["values"]) for item in distribution.json()["classes"]] == [72, 72]


def test_feature_candidates_topomap_and_validation(client):
    candidates = client.get("/api/session/feature-candidates", params={"class_a": 0, "class_b": 1})
    assert candidates.status_code == 200
    assert len(candidates.json()["features"]) == 200
    ranking = client.post("/api/session/feature-ranking", json={"classes": [0, 1], "pair": [0, 1], "channels": ["C3", "Cz", "C4", "Pz"]})
    assert ranking.status_code == 200, ranking.text
    assert len(ranking.json()["features"]) == 200
    assert ranking.json()["features"][0]["fisher_j"] >= ranking.json()["features"][-1]["fisher_j"]
    image = client.post("/api/session/topomap", json={"class_a": 0, "class_b": 1, "channels": ["C3", "Cz", "C4", "Pz"], "filter_index": 0})
    assert image.status_code == 200, image.text
    assert image.json()["png_base64"].startswith("iVBOR")
    assert client.get("/api/session/psd", params={"channel": "UNKNOWN"}).status_code == 400
    bad_csp = client.post("/api/session/csp", json={"class_a": 0, "class_b": 88, "channels": ["C3", "Cz"]})
    assert bad_csp.status_code == 400


def test_rejects_non_fif_upload_without_replacing_session(client):
    before = client.get("/api/session").json()["id"]
    response = client.post("/api/upload", files={"file": ("bad.edf", b"not fif", "application/octet-stream")})
    assert response.status_code == 400
    assert client.get("/api/session").json()["id"] == before


def test_upload_loads_with_trial_count_warnings(client, tmp_path):
    import mne

    info = mne.create_info(["C3", "C4"], sfreq=100, ch_types="eeg")
    info.set_montage("standard_1020")
    data = np.random.default_rng(0).normal(scale=1e-5, size=(4, 2, 300))
    events = np.array([[i * 400, 0, 1 if i < 2 else 2] for i in range(4)])
    epochs = mne.EpochsArray(data, info, events=events, event_id={"A": 1, "B": 2}, verbose="ERROR")
    path = tmp_path / "few-epo.fif"
    epochs.save(path, overwrite=True, verbose="ERROR")
    response = client.post("/api/upload", files={"file": (path.name, path.read_bytes(), "application/octet-stream")})
    assert response.status_code == 200, response.text
    assert any("minimum 10" in warning for warning in response.json()["warnings"])


def test_exported_python_reproduces_ui_fisher_j(client, tmp_path):
    loaded = client.post("/api/samples/user_demo/load")
    assert loaded.status_code == 200, loaded.text
    spec = {"kind": "band_power", "channel": "C3", "band": [8, 12], "relative": True}
    feature_response = client.post("/api/session/features", json={"specs": [spec], "classes": [1, 2], "pair": [1, 2]})
    assert feature_response.status_code == 200, feature_response.text
    params = [
        ("class_a", "1"), ("class_b", "2"), ("classes", "1"), ("classes", "2"),
        ("specs", json.dumps([spec])),
    ]
    exported = client.get("/api/session/export", params=params)
    assert exported.status_code == 200, exported.text
    script = tmp_path / "reproduce.py"
    script.write_text(exported.text, encoding="utf-8")
    project = Path(__file__).resolve().parents[2]
    run = subprocess.run([sys.executable, str(script)], cwd=project, capture_output=True, text=True, check=True)
    reproduced = float(run.stdout.strip().split(":")[-1])
    assert reproduced == pytest.approx(round(feature_response.json()["fisher_j"], 6), abs=1e-12)


def test_physionet_export_uses_its_own_bundled_fif(client, tmp_path):
    loaded = client.post("/api/samples/physionet_mi_s01/load")
    assert loaded.status_code == 200, loaded.text
    spec = {"kind": "band_power", "channel": "C3", "band": [8, 12], "relative": True}
    features = client.post("/api/session/features", json={"specs": [spec], "classes": [3, 4], "pair": [3, 4]})
    assert features.status_code == 200, features.text
    exported = client.get("/api/session/export", params=[
        ("class_a", "3"), ("class_b", "4"), ("classes", "3"), ("classes", "4"),
        ("specs", json.dumps([spec])),
    ])
    assert exported.status_code == 200, exported.text
    assert "backend/data/physionet_mi_s01-epo.fif" in exported.text
    script = tmp_path / "reproduce_physionet.py"
    script.write_text(exported.text, encoding="utf-8")
    project = Path(__file__).resolve().parents[2]
    run = subprocess.run([sys.executable, str(script)], cwd=project, capture_output=True, text=True, check=True)
    reproduced = float(run.stdout.strip().split(":")[-1])
    assert reproduced == pytest.approx(round(features.json()["fisher_j"], 6), abs=1e-12)
