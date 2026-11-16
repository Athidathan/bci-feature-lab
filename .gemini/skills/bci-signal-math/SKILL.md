---
name: bci-signal-math
description: Numerical contract for the Python EEG feature engine and time-frequency analysis.
---
# BCI signal math contract

The Python backend is the single source of truth for calculations. The React frontend only formats and draws backend results.

- Input epochs have variable channel sets and sample rates. Read metadata from the file; the user's sample has 22 EEG channels and 250 Hz sampling.
- Windows use sample indices rounded half-up. Time variance uses ddof=0; Hjorth mobility and complexity use successive first differences. Flatlines return zero; non-finite input raises ValueError.
- Welch PSD uses Hann, nperseg=250, noverlap=125, constant detrending, one-sided density. Integrate bands on the frequency grid with composite Simpson. Relative power divides by 4–38 Hz. Optional log is base 10 with a 1e-12 floor.
- STFT uses SciPy stft, Hann, nperseg=128, noverlap=112; retain 4–38 Hz. ERD/ERS is relative to the requested baseline. Default baseline is −0.5–0 s if fully available; otherwise use the first 0.5 s and flag it as post-cue for zero-start epochs.
- CSP is pairwise. Per-trial covariances are trace-normalized, class means form ΣA and ΣB, and filters solve eigh(ΣA, ΣA + ΣB). Sort by eigenvalue and select the top and bottom m filters. Log-variance features use the variance fraction across selected filters. Patterns are (ΣA + ΣB)w, normalized per filter.
- Fisher J is Δμᵀ(S₁ + S₂ + ridge·I)⁻¹Δμ, with ridge 1e-9·tr(S)/d + 1e-12. Silhouette uses z-scored features and Euclidean distance on the selected two classes. The app has no classifier or accuracy metrics.

Add analytical tests in Python when changing these formulas. Do not create a TypeScript math mirror.
