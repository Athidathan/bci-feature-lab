"""STFT power and baseline-normalized ERD/ERS calculations."""
import numpy as np
from scipy.signal import stft


def stft_power(X: np.ndarray, sfreq: float, tmin: float = 0.0, *, nperseg: int = 128, noverlap: int = 112, freq_range: tuple[float, float] = (4.0, 38.0)) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    x = np.asarray(X, dtype=float)
    if x.ndim < 1 or x.shape[-1] < nperseg:
        raise ValueError("Input must have at least nperseg samples on its final axis")
    if not np.isfinite(x).all():
        raise ValueError("Input contains NaN or infinite values")
    freqs, times, z = stft(x, fs=sfreq, window="hann", nperseg=nperseg, noverlap=noverlap, detrend=False, return_onesided=True, boundary="zeros", padded=True, axis=-1)
    keep = (freqs >= freq_range[0]) & (freqs <= freq_range[1])
    return freqs[keep], times + tmin, np.abs(z[..., keep, :]) ** 2


def erd_ers(power: np.ndarray, times: np.ndarray, *, baseline: tuple[float, float] | None = None) -> tuple[np.ndarray, tuple[float, float], bool]:
    """Convert trial × frequency × time power into mean ERD/ERS percent."""
    p, t = np.asarray(power, dtype=float), np.asarray(times, dtype=float)
    if p.ndim < 3 or p.shape[-1] != t.size:
        raise ValueError("Power must have trial and frequency axes followed by the time axis")
    if not np.isfinite(p).all() or not np.isfinite(t).all():
        raise ValueError("Power and times must be finite")
    used_fallback = False
    if baseline is None:
        candidate = (-0.5, 0.0)
        if t.min() <= candidate[0] and t.max() >= candidate[1]:
            baseline = candidate
        else:
            baseline = (float(t.min()), min(float(t.min()) + 0.5, float(t.max())))
            used_fallback = True
    mask = (t >= baseline[0]) & (t <= baseline[1])
    if not mask.any():
        raise ValueError("Baseline window does not overlap the available TF time range")
    baseline_mean = p[..., mask].mean(axis=-1).mean(axis=0)
    task_mean = p.mean(axis=0)
    relative = np.divide(task_mean - baseline_mean[..., None], baseline_mean[..., None], out=np.zeros_like(task_mean), where=baseline_mean[..., None] > 0) * 100.0
    return relative, baseline, used_fallback
