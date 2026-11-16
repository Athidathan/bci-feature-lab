# User guide

## Start the app

Run the backend from the project root:

```powershell
python -m uvicorn backend.app.main:app --reload --port 8000
```

Then, in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the frontend URL printed by Vite.

## Choose a dataset

The bundled `User EEG sample` loads when the backend starts. The sample menu also includes PhysioNet EEGMMIDB subject 1: Left Hand and Right Hand imagery from runs 4/8/12, plus Both Hands and Feet imagery from runs 6/10/14. T1/T2 event meanings depend on the run, so the bundle script maps them before epoching. The dataset has no Tongue imagery class. To use your own recording, choose **Upload .fif** and select an epoched MNE FIF file. The upload becomes active only after the backend has loaded and prepared it successfully. On failure, the current dataset stays selected and an error appears in the top bar.

The app displays event classes from the file with their trial counts. Toggle classes to include or remove them from the analysis. Choose the two classes for pairwise CSP and Fisher comparisons using the **CSP pair** controls.

Select one or more electrodes on the montage. The current channel is highlighted in yellow and drives the single-channel TF and PSD views. The selected channel set drives CSP. Files without montage coordinates can still be loaded, but topomaps need at least four positioned channels.

## Explore the views

### Epochs & TF

The time-frequency view shows the percent change in power relative to a baseline window. Blue indicates reduced power (ERD); red indicates increased power (ERS). Adjust the baseline and frequency range with the sliders. If the epoch does not include −0.5 to 0 seconds, the default uses the first 0.5 seconds and displays a warning.

### Spectra & Spatial

The PSD view shows the average Welch spectrum for each kept class at the current channel. The default display is logarithmic. Move the mu and beta band edges with the sliders. CSP topomaps display the pairwise activation patterns for the selected classes.

### Features

The Fisher ranking scores candidate channel/band and time features for the selected pair. Select features to view their class distributions and the trial-by-feature heatmap. Use the scatter selectors to compare two candidate features; its meter reports Fisher J and silhouette for that pair.

Feature calculations run in Python. The distribution view uses a display-only Gaussian KDE. The heatmap z-scores each feature column for display.

## Warnings and units

Warnings are informational. They can report fewer than ten trials in a class, implausible signal amplitude, or missing line-frequency metadata. These warnings do not prevent exploration.

Values stay in the units recorded in the FIF file. If amplitudes look implausible, the app labels signal values as arbitrary units and does not convert them to microvolts. The app assumes uploads are already preprocessed and ICA-cleaned per the project decision; it does not inspect or certify ICA status.

## Export

Open **Features** and choose two feature axes. Select **Export .py** to download a script that loads the same FIF and prints Fisher J. Run it from the project root:

```powershell
python separability_reproduction.py
```

For an uploaded file, provide its path:

```powershell
python separability_reproduction.py --fif path\to\epochs-epo.fif
```

The bundled sample can use the default path. Export output prints Fisher J rounded to the six decimal places shown by the UI. Both bundled samples have tutorial challenges; uploads do not.
