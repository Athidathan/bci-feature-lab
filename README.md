# The Separability Lab

An interactive teaching module for EEG feature extraction. Load epoched MNE `.fif` data, explore time-frequency power, spectra, pairwise CSP, feature distributions, and separability. The application explains features; it does not train a classifier or report accuracy.

## Run locally

From PowerShell at the project root, install dependencies and start both services with one command:

```powershell
.\run.ps1
```

To start them separately, run the backend:

```powershell
python -m uvicorn backend.app.main:app --reload --port 8000
```

Then, in a second terminal, run `cd frontend; npm install; npm run dev`. Open the Vite URL shown in that terminal. The backend starts with the bundled `user_demo` epochs. Upload another epoched `.fif` from the top bar.

## What is in the app

- Three tabs: Epochs & TF, Spectra & Spatial, and Features.
- Class toggles and a clickable EEG channel montage built from each file's metadata.
- Cached PSD, covariance, and STFT analysis, pairwise CSP topomaps, Fisher J and silhouette.
- Sample-only tutorial prompts; uploads do not show challenges.
- Export of a Python script that reproduces the selected feature-space Fisher J.

Signal units follow the file. The bundled source data triggers an amplitude warning, so the app shows raw arbitrary units instead of claiming microvolts. Missing metadata, including line frequency, is reported as missing.

## Checks

```powershell
python -m pytest backend/tests -q
cd frontend
npm run build
```

The bundled samples are `backend/data/user_demo-epo.fif` and `backend/data/physionet_mi_s01-epo.fif`. To reproduce the PhysioNet file, run `python backend/scripts/make_physionet_sample.py`; it downloads EEGMMIDB subject 1 through MNE and maps runs 4/8/12 to Left/Right Hand, and runs 6/10/14 to Both Hands/Feet. Rest epochs and imagery outside those runs are excluded. The four-class sample has no Tongue class.

More detail: [User guide](docs/USER_GUIDE.md), [Developer guide](docs/DEVELOPER_GUIDE.md), [Development log](docs/DEVLOG.md).
# bci-feature-lab
