"""Single source of truth for EEG feature and separability calculations."""
import math
from typing import Literal

import numpy as np
from scipy.integrate import simpson as scipy_simpson
from scipy.linalg import eigh
from scipy.signal import welch
from sklearn.metrics import silhouette_score


def _finite(values: np.ndarray) -> np.ndarray:
    array = np.asarray(values, dtype=float)
    if not np.isfinite(array).all():
        raise ValueError("Input contains NaN or infinite values")
    return array


def round_half_up(value: float) -> int:
    return math.floor(value + 0.5)


def window_slice(t1: float, t2: float, sfreq: float = 250.0, n_samples: int | None = None) -> tuple[int, int]:
    start, stop = round_half_up(t1 * sfreq), round_half_up(t2 * sfreq)
    if n_samples is not None:
        start, stop = min(max(start, 0), n_samples), min(max(stop, 0), n_samples)
    if stop < start:
        raise ValueError("Window end must be at or after its start")
    return start, stop


def mean_amplitude(x: np.ndarray) -> float:
    a = _finite(x)
    return float(a.mean()) if a.size else 0.0


def peak_to_peak(x: np.ndarray) -> float:
    a = _finite(x)
    return float(np.ptp(a)) if a.size else 0.0


def variance(x: np.ndarray) -> float:
    a = _finite(x)
    return float(np.var(a, ddof=0)) if a.size else 0.0


def hjorth(x: np.ndarray) -> tuple[float, float, float]:
    a = _finite(x)
    activity = variance(a)
    if a.size < 2 or activity == 0:
        return activity, 0.0, 0.0
    dx = np.diff(a)
    var_dx = variance(dx)
    mobility = math.sqrt(var_dx / activity) if var_dx > 0 else 0.0
    if dx.size < 2 or var_dx == 0 or mobility == 0:
        return activity, mobility, 0.0
    complexity = math.sqrt(variance(np.diff(dx)) / var_dx) / mobility
    return activity, mobility, complexity


def time_feature(x: np.ndarray, feature: Literal["mean", "ptp", "variance", "mobility", "complexity"]) -> float:
    if feature == "mean":
        return mean_amplitude(x)
    if feature == "ptp":
        return peak_to_peak(x)
    if feature == "variance":
        return variance(x)
    if feature in {"mobility", "complexity"}:
        return hjorth(x)[1 if feature == "mobility" else 2]
    raise ValueError(f"Unknown time feature: {feature}")


def welch_psd(x: np.ndarray, sfreq: float = 250.0, nperseg: int = 250, noverlap: int = 125) -> tuple[np.ndarray, np.ndarray]:
    a = _finite(x)
    if a.shape[-1] == 0:
        raise ValueError("Cannot compute a PSD for an empty signal")
    if a.shape[-1] < nperseg:
        raise ValueError("Signal is shorter than the configured Welch segment")
    return welch(a, fs=sfreq, window="hann", nperseg=nperseg, noverlap=noverlap, detrend="constant", return_onesided=True, scaling="density", axis=-1)


def band_power(freqs: np.ndarray, psd: np.ndarray, f_low: float, f_high: float, *, relative: bool = False, log10: bool = False, total_range: tuple[float, float] = (4.0, 38.0)) -> np.ndarray:
    f, p = _finite(freqs), _finite(psd)
    if f_low > f_high:
        raise ValueError("Lower band edge must not exceed upper edge")

    def integrate(low: float, high: float) -> np.ndarray:
        idx = (f >= low) & (f <= high)
        if np.count_nonzero(idx) < 2:
            return np.zeros(p.shape[:-1], dtype=float)
        return np.asarray(scipy_simpson(p[..., idx], x=f[idx], axis=-1))

    power = integrate(f_low, f_high)
    if relative:
        total = integrate(*total_range)
        power = np.divide(power, total, out=np.zeros_like(power, dtype=float), where=total > 0)
    if log10:
        power = np.log10(np.maximum(power, 1e-12))
    return power


def trial_covariance(trial: np.ndarray, *, trace_normalize: bool = True) -> np.ndarray:
    x = _finite(trial)
    if x.ndim != 2 or x.shape[1] < 1:
        raise ValueError("A trial must have shape (channels, samples)")
    centered = x - x.mean(axis=1, keepdims=True)
    cov = centered @ centered.T / x.shape[1]
    trace = float(np.trace(cov))
    if trace_normalize and trace > 0:
        cov /= trace
    return cov


def covariances(X: np.ndarray, *, trace_normalize: bool = True) -> np.ndarray:
    x = _finite(X)
    if x.ndim != 3:
        raise ValueError("Expected X with shape (trials, channels, samples)")
    return np.stack([trial_covariance(trial, trace_normalize=trace_normalize) for trial in x])


def pairwise_csp(X: np.ndarray, y: np.ndarray, class_a: int, class_b: int, m: int = 1) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Return filters, selected eigenvalues, activation patterns, and log-variance features."""
    x = _finite(X)
    labels = np.asarray(y)
    if x.ndim != 3 or labels.shape != (x.shape[0],):
        raise ValueError("X and y must have shapes (trials, channels, samples) and (trials,)")
    ia, ib = labels == class_a, labels == class_b
    if not ia.any() or not ib.any() or class_a == class_b:
        raise ValueError("CSP requires trials from two different selected classes")
    if m < 1 or 2 * m > x.shape[1]:
        raise ValueError("CSP m must select at least one top and bottom filter")
    covs = covariances(x)
    sigma_a, sigma_b = covs[ia].mean(axis=0), covs[ib].mean(axis=0)
    composite = (sigma_a + sigma_b + sigma_a.T + sigma_b.T) / 2
    eigvals, eigvecs = eigh(sigma_a, composite, check_finite=True)
    order = np.r_[np.arange(len(eigvals) - 1, len(eigvals) - m - 1, -1), np.arange(m)]
    filters = eigvecs[:, order]
    selected_values = eigvals[order]
    patterns = composite @ filters
    norms = np.linalg.norm(patterns, axis=0)
    patterns = np.divide(patterns, norms, out=np.zeros_like(patterns), where=norms > 0)
    projected = np.einsum("fc,tcs->tfs", filters.T, x)
    variances = np.var(projected, axis=-1, ddof=0)
    totals = variances.sum(axis=1, keepdims=True)
    fractions = np.divide(variances, totals, out=np.full_like(variances, 1e-12), where=totals > 0)
    features = np.log(np.maximum(fractions, 1e-12))
    return filters, selected_values, patterns, features


def fisher_j(F: np.ndarray, y: np.ndarray, class_a: int | str, class_b: int | str) -> float:
    features = _finite(F)
    labels = np.asarray(y)
    if features.ndim == 1:
        features = features[:, None]
    if features.ndim != 2 or labels.shape != (features.shape[0],):
        raise ValueError("F and y must contain the same number of rows")
    a, b = features[labels == class_a], features[labels == class_b]
    if len(a) < 1 or len(b) < 1:
        raise ValueError("Fisher J requires samples in both classes")
    delta = a.mean(axis=0) - b.mean(axis=0)
    within = np.atleast_2d(np.cov(a, rowvar=False, ddof=0)) + np.atleast_2d(np.cov(b, rowvar=False, ddof=0))
    ridge = 1e-9 * float(np.trace(within)) / max(within.shape[0], 1) + 1e-12
    return max(float(delta @ np.linalg.solve(within + ridge * np.eye(within.shape[0]), delta)), 0.0)


def silhouette(F: np.ndarray, y: np.ndarray, class_a: int | str, class_b: int | str) -> float:
    features = _finite(F)
    labels = np.asarray(y)
    if features.ndim == 1:
        features = features[:, None]
    keep = np.isin(labels, [class_a, class_b])
    values, selected = features[keep], labels[keep]
    if len(np.unique(selected)) != 2 or len(selected) < 4 or any(np.count_nonzero(selected == c) < 2 for c in np.unique(selected)):
        raise ValueError("Silhouette requires at least two samples in each selected class")
    scale = values.std(axis=0, ddof=0)
    standardized = (values - values.mean(axis=0)) / np.where(scale > 0, scale, 1.0)
    return float(silhouette_score(standardized, selected, metric="euclidean"))
