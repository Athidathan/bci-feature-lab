"""Analytic checks for the backend's EEG math."""
from pathlib import Path
import sys

import numpy as np
import pytest
from scipy.linalg import eigh
from scipy.signal import welch
from sklearn.metrics import silhouette_score

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import features as F


def test_time_features_hjorth_and_window_rounding():
    fs, freq, amplitude = 250, 10, 2.0
    x = amplitude * np.sin(2 * np.pi * freq * np.arange(1000) / fs)
    assert F.variance(x) == pytest.approx(amplitude**2 / 2, rel=1e-3)
    _, mobility, complexity = F.hjorth(x)
    assert mobility == pytest.approx(2 * np.sin(np.pi * freq / fs), rel=2e-3)
    assert complexity == pytest.approx(1.0, abs=5e-3)
    assert F.hjorth(np.full(20, 2.0)) == (0.0, 0.0, 0.0)
    assert F.window_slice(.25, .45) == (63, 113)


def test_welch_matches_scipy_and_band_power():
    rng = np.random.default_rng(0)
    x = rng.normal(size=1000)
    freqs, psd = F.welch_psd(x)
    f_ref, p_ref = welch(x, fs=250, window="hann", nperseg=250, noverlap=125, detrend="constant")
    np.testing.assert_allclose(freqs, f_ref)
    np.testing.assert_allclose(psd, p_ref)
    sine = 3 * np.sin(2 * np.pi * 10 * np.arange(1000) / 250)
    f, p = F.welch_psd(sine)
    assert F.band_power(f, p, 8, 12) == pytest.approx(4.5, rel=.15)
    assert 0 < F.band_power(f, p, 8, 12, relative=True) <= 1


def test_covariance_is_trace_normalized_symmetric_psd():
    rng = np.random.default_rng(2)
    cov = F.trial_covariance(rng.normal(size=(4, 500)))
    assert np.trace(cov) == pytest.approx(1)
    np.testing.assert_allclose(cov, cov.T)
    assert np.linalg.eigvalsh(cov).min() >= -1e-12


def test_pairwise_csp_matches_generalized_eigen_and_returns_finite_features():
    rng = np.random.default_rng(3)
    mixing = np.array([[1.0, .6], [.5, 1.0]])
    X = []
    y = []
    for label, scales in [(0, (3, 1)), (1, (1, 3))]:
        for _ in range(24):
            sources = rng.normal(size=(2, 1000)) * np.array(scales)[:, None]
            X.append(mixing @ sources)
            y.append(label)
    X, y = np.asarray(X), np.asarray(y)
    filters, vals, patterns, feature = F.pairwise_csp(X, y, 0, 1)
    covs = F.covariances(X)
    a, b = covs[y == 0].mean(0), covs[y == 1].mean(0)
    expected_vals, expected_vecs = eigh(a, a + b)
    np.testing.assert_allclose(vals, expected_vals[::-1][[0, -1]])
    np.testing.assert_allclose(filters.T @ (a + b) @ filters, np.eye(2), atol=1e-10)
    assert patterns.shape == (2, 2) and feature.shape == (48, 2)
    assert np.isfinite(feature).all()


def test_fisher_one_feature_and_scale_invariance():
    a = np.array([0., 1., 2., 3.])
    b = np.array([4., 5., 6., 7.])
    y = np.r_[np.zeros(4, int), np.ones(4, int)]
    values = np.r_[a, b]
    expected = (a.mean() - b.mean())**2 / (a.var() + b.var())
    assert F.fisher_j(values, y, 0, 1) == pytest.approx(expected, rel=1e-7)
    assert F.fisher_j(10 * values, y, 0, 1) == pytest.approx(F.fisher_j(values, y, 0, 1), rel=1e-7)


def test_silhouette_matches_sklearn_after_zscore():
    rng = np.random.default_rng(4)
    X = np.r_[rng.normal(0, 1, (12, 2)), rng.normal(2, 1, (12, 2))]
    y = np.r_[np.zeros(12, int), np.ones(12, int)]
    standardized = (X - X.mean(0)) / X.std(0)
    assert F.silhouette(X, y, 0, 1) == pytest.approx(silhouette_score(standardized, y))


def test_invalid_nonfinite_data_is_rejected():
    with pytest.raises(ValueError, match="NaN"):
        F.welch_psd(np.array([1., np.nan] * 125))
