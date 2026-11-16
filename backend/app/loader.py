"""Load and validate epoched FIF files using MNE."""
from pathlib import Path
from uuid import uuid4

import mne
import numpy as np

from .session import Session


def _channel_positions(epochs: mne.Epochs, channels: list[str]) -> dict[str, list[float]]:
    montage = epochs.get_montage()
    if montage is None:
        return {}
    positions = montage.get_positions()["ch_pos"]
    xy = {name: np.asarray(positions[name], dtype=float)[:2] for name in channels if name in positions}
    if not xy:
        return {}
    scale = max(float(np.linalg.norm(point)) for point in xy.values()) or 1.0
    return {name: [float(v / scale) for v in point] for name, point in xy.items()}


def load_fif(path: str | Path, *, source: str = "upload", session_id: str | None = None, original_filename: str | None = None) -> Session:
    """Read EEG epochs and extract file-provided metadata and signal values."""
    file_path = Path(path)
    if file_path.suffix.lower() not in {".fif", ".fif.gz"}:
        raise ValueError("Only epoched .fif files are supported")
    if not file_path.is_file():
        raise ValueError("The selected FIF file does not exist")
    try:
        epochs = mne.read_epochs(file_path, preload=True, verbose="ERROR")
    except Exception as exc:
        raise ValueError(f"Could not read epoched FIF file: {exc}") from exc
    if len(epochs) == 0:
        raise ValueError("The FIF file contains no epochs")
    eeg_epochs = epochs.copy().pick("eeg")
    if len(eeg_epochs.ch_names) == 0:
        raise ValueError("The FIF file contains no EEG channels")
    X = eeg_epochs.get_data(units="V")
    if not np.isfinite(X).all():
        raise ValueError("EEG data contains NaN or infinite values")

    classes = []
    y = eeg_epochs.events[:, 2].astype(int, copy=True)
    for name, event_id in eeg_epochs.event_id.items():
        count = int(np.count_nonzero(y == event_id))
        classes.append({"name": str(name), "event_id": int(event_id), "count": count})

    warnings: list[str] = []
    for item in classes:
        if int(item["count"]) < 10:
            warnings.append(f"Class {item['name']} has {item['count']} trials (minimum 10 recommended).")
    p99 = float(np.percentile(np.abs(X), 99)) if X.size else 0.0
    if p99 > 500e-6:
        warnings.append("Signal amplitude looks implausible for EEG (>500 µV at the 99th percentile); values are shown in a.u. until verified.")
    line_freq = eeg_epochs.info.get("line_freq")
    if line_freq is None:
        warnings.append("Line frequency is not stored in this file.")

    return Session(
        id=session_id or str(uuid4()),
        source=source,
        original_filename=original_filename or file_path.name,
        sfreq=float(eeg_epochs.info["sfreq"]),
        tmin=float(eeg_epochs.times[0]),
        tmax=float(eeg_epochs.times[-1]),
        channels=list(eeg_epochs.ch_names),
        channel_pos=_channel_positions(eeg_epochs, list(eeg_epochs.ch_names)),
        classes=classes,
        X=X,
        y=y,
        highpass=float(eeg_epochs.info["highpass"]),
        lowpass=float(eeg_epochs.info["lowpass"]),
        line_freq=float(line_freq) if line_freq is not None else None,
        warnings=warnings,
    )
