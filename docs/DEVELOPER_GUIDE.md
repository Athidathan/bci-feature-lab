# Developer guide

## Architecture

- `backend/app/loader.py` reads epoched FIF files with MNE, checks finite EEG samples, and extracts classes, channels, montage positions, sample rate, filter metadata, and warnings.
- `backend/app/session.py` holds the active in-memory session and cached arrays.
- `backend/app/precompute.py` calculates Welch PSD, trace-normalized trial covariance, and STFT power once per load. STFT power is stored as float16.
- `backend/app/features.py` contains the time features, band power, pairwise generalized-eigenvector CSP, Fisher J, and silhouette calculations.
- `backend/app/tf.py` contains the STFT and baseline-relative ERD/ERS calculations.
- `backend/app/main.py` validates requests, serves JSON, and keeps raw trial-by-channel-by-sample arrays out of API responses.
- `frontend/src/api/client.ts` defines typed fetch wrappers. React views format the API output; numerical signal and separability calculations stay in Python.

One active session is supported per backend process. Sample and upload loading precompute caches before replacing the active session.

## Development commands

Backend:

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --reload --port 8000
python -m pytest backend/tests -q
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
npm run build
```

Vite proxies `/api` to `http://localhost:8000`.

## API routes

- `GET /api/health`, `GET /api/samples`, `POST /api/samples/{id}/load`
- `POST /api/upload`, `GET /api/session`, `GET /api/session/epoch`
- `GET /api/session/psd`, `POST /api/session/tf`
- `POST /api/session/csp`, `GET /api/session/feature-candidates`
- `POST /api/session/feature-ranking`, `POST /api/session/features`
- `POST /api/session/distributions`, `POST /api/session/topomap`
- `GET /api/session/export`

Request models reject unknown fields. Unknown classes and channels return HTTP 400. Upload errors leave the prior active session intact. The export route returns a Python script for the requested features and class pair.

## Math and display rules

The numerical contract is in `.gemini/skills/bci-signal-math/SKILL.md`. In short: use the file's metadata; time windows round half-up; Welch uses 250/125 Hann segments; relative power uses the stored 4–38 Hz filter range; pairwise CSP solves `eigh(ΣA, ΣA + ΣB)`; Fisher J includes the specified ridge; silhouette uses z-scored features.

Do not add a TypeScript copy of feature math or any classification/accuracy code. Display-only calculations include KDE curves, plot coordinates, and heatmap color scaling.

The visual rules are in `.gemini/skills/3b1b-visual-pedagogy/SKILL.md`: Space Grotesk, JetBrains Mono, KaTeX, 1px rules, and the cyan/green/yellow/red palette. Avoid gradients, card grids, and drop shadows.

## Bundled data

`backend/data/user_demo-epo.fif` is a byte-for-byte copy of the project source `subject_01_train_ica-epo.fif`. The original source remains at the project root; metadata retains its original filename. Signal amplitudes in this file are implausible, so views use arbitrary units pending verification.

`backend/scripts/make_physionet_sample.py` reproducibly downloads EEGMMIDB subject 1 and writes `backend/data/physionet_mi_s01-epo.fif`. It maps T1/T2 in imagery runs 4/8/12 to Left Hand/Right Hand and in runs 6/10/14 to Both Hands/Feet, then creates 1–4 second epochs after 7–30 Hz filtering. It excludes rest; this dataset has no Tongue class. The bundled result contains 90 epochs (class counts 23/22/21/24), 64 EEG channels at 160 Hz. Run `python backend/scripts/make_physionet_sample.py` from the project root to rebuild it. The app has a sample-only tutorial for the Both Hands/Feet pair.

## Tests

The backend suite covers analytical math, loader validation, API routes, upload failure handling, and exported-script reproduction. The user file integration case expects 288 epochs, four event classes with 72 trials each, 22 EEG channels, 250 Hz, and a 0–3.996 s time range.
