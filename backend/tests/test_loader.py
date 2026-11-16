"""Loader checks using the bundled source epochs."""
from pathlib import Path
import sys

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.loader import load_fif


SAMPLE = Path(__file__).resolve().parents[2] / "subject_01_train_ica-epo.fif"


def test_loads_file_metadata_and_warns_about_missing_or_implausible_metadata():
    session = load_fif(SAMPLE, source="sample", session_id="test")
    assert session.id == "test"
    assert session.source == "sample"
    assert session.sfreq == 250
    assert session.X.shape == (288, 22, 1000)
    assert [(c["name"], c["event_id"], c["count"]) for c in session.classes] == [
        ("Left Hand", 0, 72), ("Right Hand", 1, 72), ("Feet", 2, 72), ("Tongue", 3, 72)
    ]
    assert session.line_freq is None
    assert any("amplitude" in w for w in session.warnings)
    assert any("Line frequency" in w for w in session.warnings)
    assert len(session.channels) == 22
    assert all(max(abs(v) for v in xy) <= 1 for xy in session.channel_pos.values())


def test_rejects_non_fif_and_missing_paths(tmp_path):
    with pytest.raises(ValueError, match="Only epoched"):
        load_fif(tmp_path / "epochs.edf")
    with pytest.raises(ValueError, match="does not exist"):
        load_fif(tmp_path / "missing-epo.fif")


def test_rejects_non_finite_signal(monkeypatch, tmp_path):
    import app.loader as loader

    class FakeEpochs:
        event_id = {"A": 1}
        events = np.array([[0, 0, 1]])
        info = {"sfreq": 250, "highpass": 4, "lowpass": 38, "line_freq": 50}
        times = np.array([0.0, 0.004])
        ch_names = ["C3"]

        def copy(self): return self
        def pick(self, _: str): return self
        def __len__(self): return 1
        def get_montage(self): return None
        def get_data(self, **_: object): return np.array([[[0.0, np.nan]]])

    monkeypatch.setattr(loader.mne, "read_epochs", lambda *a, **k: FakeEpochs())
    file_path = tmp_path / "bad-epo.fif"
    file_path.touch()
    with pytest.raises(ValueError, match="NaN or infinite"):
        load_fif(file_path)
