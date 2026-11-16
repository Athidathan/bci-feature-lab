"""Checks for STFT parameters and baseline normalization."""
from pathlib import Path
import sys

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.tf import erd_ers, stft_power


def test_stft_frequency_and_time_axes():
    fs = 250
    X = np.zeros((2, 3, 1000))
    X[:, :, 300:600] = np.sin(2 * np.pi * 10 * np.arange(300) / fs)
    freqs, times, power = stft_power(X, fs, tmin=0)
    assert power.shape[:3] == (2, 3, len(freqs))
    assert power.shape[-1] == len(times)
    assert freqs.min() >= 4 and freqs.max() <= 38
    assert np.diff(freqs).mean() == pytest.approx(fs / 128)


def test_erd_ers_uses_first_half_second_baseline_for_zero_start_epoch():
    times = np.arange(0, 1.01, .1)
    power = np.ones((2, 1, len(times)))
    power[:, :, times <= .5] = 2
    power[:, :, times > .5] = 1
    erds, baseline, used_fallback = erd_ers(power, times)
    assert baseline == (0.0, .5)
    assert used_fallback is True
    assert erds[0, -1] == pytest.approx(-50)


def test_erd_rejects_unavailable_baseline():
    with pytest.raises(ValueError, match="does not overlap"):
        erd_ers(np.ones((2, 1, 3)), np.array([0., .1, .2]), baseline=(-1., -.5))
