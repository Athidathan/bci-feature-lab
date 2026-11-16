"""Expensive per-session transforms, computed once at load time."""
from time import perf_counter

from .features import covariances, welch_psd
from .session import Session
from .tf import stft_power


def precompute(session: Session) -> dict[str, float]:
    started = perf_counter()
    freqs, psd = welch_psd(session.X, sfreq=session.sfreq)
    keep = (freqs >= 4.0) & (freqs <= 38.0)
    freqs, psd = freqs[keep], psd[..., keep]
    cov = covariances(session.X)
    tf_freqs, tf_times, tf_power = stft_power(session.X, session.sfreq, session.tmin)
    tf_power = tf_power.astype("float16")
    session.cache.update(
        freqs=freqs,
        psd=psd.astype("float32"),
        cov=cov.astype("float32"),
        tf_freqs=tf_freqs,
        tf_times=tf_times,
        tf_power=tf_power,
    )
    return {
        "seconds": perf_counter() - started,
        "psd_bytes": float(session.cache["psd"].nbytes),
        "cov_bytes": float(session.cache["cov"].nbytes),
        "tf_bytes": float(tf_power.nbytes),
        "total_cache_bytes": float(session.cache["psd"].nbytes + session.cache["cov"].nbytes + tf_power.nbytes),
    }
