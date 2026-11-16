# Development log

## Stage 0 — cleanup and skeleton

- Gate: `python -m pip install -r backend/requirements.txt` — passed (all declared packages installed or already satisfied).
- Gate: `npm install` — passed (up to date). npm reported 47 audit findings: 11 moderate, 23 high, 13 critical; no audit fix was applied.
- Removed the legacy synthetic dataset generator/JSON data, TypeScript math mirror, parity/smoke scripts, Lab 1–4 views, and legacy upload/export helpers listed in the build plan.
- Added the FastAPI dependency set and backend package skeleton.
- Preserved the user's untracked source file `subject_01_train_ica-epo.fif`.

## Stage 1 — loader and session

- Gate: `python -m pytest backend/tests/test_loader.py -q` — 3 passed.
- Gate: `/api/session` under the FastAPI lifespan — HTTP 200; 288 epochs, classes Left Hand/Right Hand/Feet/Tongue (72 each), 22 EEG channels, 250 Hz, 1000 samples, 0.0–3.996 s.
- File metadata reports high-pass 4 Hz, low-pass 38 Hz, and missing line frequency. The loader reports the implausible amplitude as an informational warning and does not label it in µV.
- `python -c` lifespan probe — returned the metadata above. Starlette's test client must be used as a context manager to run startup in this environment.

## Stage 2 — math

- Gate: `python -m pytest backend/tests -q` — 14 passed, 1 Starlette test-client deprecation warning.
- Verified Welch against SciPy, time features against analytic sine behavior, covariance symmetry/PSD, pairwise CSP against `scipy.linalg.eigh`, Fisher and silhouette against direct references, and STFT/ERD fallback behavior.
- A test found that a baseline ending at zero was incorrectly accepted when the epoch starts at zero. Updated default-baseline selection to require the full −0.5–0 s range; zero-start data now uses 0–0.5 s and marks the post-cue fallback.
- Updated `.gemini/skills/bci-signal-math/SKILL.md` to document the backend-only math contract.

## Stage 3 — precompute and endpoints

- Gate: `python -m pytest backend/tests -q` — 19 passed, 1 Starlette test-client deprecation warning.
- Source-file load plus all caches measured at 1.42 s (including FIF loading); cached transform computation was 1.10 s.
- Cache sizes measured: PSD 887,040 bytes, covariance 557,568 bytes, float16 TF power 13,787,136 bytes; combined 15,231,744 bytes (about 14.5 MiB).
- MNE PNG topomap render: 100.3 ms cold, 45.9 ms warm. Kept the plan's default option A.
- Added analysis, upload, sample loading, candidates, distribution, topomap, and metrics routes. The active session changes only after an upload has loaded and precomputed successfully.
- The PSD route uses the cached 4–38 Hz slice (35 one-Hz bins); the STFT cache is float16.

## Stage 4 — frontend shell

- Gate: `cd frontend && npm run build` — passed (strict TypeScript check and Vite production build).
- The active sample is available through the API, and the app receives its generated class and channel metadata.
- Added typed backend request wrappers, dataset selector, `.fif` upload progress/error handling, class toggles, montage selection, metadata warnings, and the three-tab shell.
- Removed the legacy parity/smoke npm scripts and unused tsx dependency. npm audit now reports 3 findings (1 low, 1 moderate, 1 high); no dependency audit fix was applied.
- Browser interaction and visual acceptance have not yet been performed.

## Stage 5 — seven analysis views

- Gate: `npm run build` — passed (strict TypeScript and Vite production bundle).
- Gate: `python -m pytest backend/tests -q` — 19 passed, 1 Starlette test-client deprecation warning.
- Playwright Chromium checks on the sample and on an uploaded `.fif`: TF rendered four class panels; PSD and both MNE topomaps rendered; ranking returned 200 candidate features; selecting the top five rendered four class distributions and the trial heatmap; no browser errors were recorded.
- Dropping one of four classes updated the app to 216 trials and changed the kept class count to 3/4.
- Added Python per-feature Fisher scores and a cached feature-ranking route for the Fisher ranking view.
- Views share the app shell and chart styling, so they were committed as one stage-level change instead of seven partial commits.
- The second bundled PhysioNet demo remains pending the event/run mapping decision.

## Stage 6 — formulas and challenges

- Gate: `npm run build` — passed. KaTeX rendered 8 formulas with `throwOnError: true`; hover on TF outlined the matching view.
- Gate: browser challenge on `user_demo` completed; upload session showed no challenge bar. No browser errors were recorded.
- Tuned the tutorial against the real sample: Right Hand vs Feet ranks CP3 mu relative at Fisher J = 2.796. The challenge threshold is J ≥ 2 for that selected feature.
- Added challenge data separately from view code. The challenge is limited to the bundled `user_demo` sample; uploaded datasets do not show it.
- Fixed bundled-sample loading to fall back to the original project-root FIF while the planned demo copy is not yet present. API test now covers that route.
- The PhysioNet challenge still awaits the run/event mapping decision.

## Stage 7 — export and bundling (in progress)

- Copied the user's source FIF to `backend/data/user_demo-epo.fif` without changing the original. Copy size: 25,367,923 bytes (24.19 MiB); SHA-256 matches the root source.
- The sample loader keeps the original source filename in API metadata.
- Export API test runs the generated `.py` and checks its Fisher J against the API value. Browser download test also matched the UI display exactly at six decimals.
- User confirmed the four-class mapping: runs 4/8/12 T1/T2 → Left/Right Hand; runs 6/10/14 T1/T2 → Both Hands/Feet.
- Added `backend/scripts/make_physionet_sample.py`; downloaded subject 1, mapped annotations per run, filtered 7–30 Hz, and saved 1–4 s epochs. The resulting FIF is 11,098,029 bytes with 90 epochs (23/22/21/24), 64 EEG channels, 160 Hz; source downloads are ignored under `.cache/`.
- Added a PhysioNet sample challenge for the Both Hands/Feet pair. The bundled values tune CSP component 1 to Fisher J = 7.458 (challenge threshold J ≥ 5).
- Added API coverage for the sample's class labels/counts and updated user/developer docs. PhysioNet's run-specific event semantics and lack of a Tongue class are described in the UI's sample description and docs.
- Gate: `python -m pytest backend/tests -q` — 22 passed, 1 Starlette test-client deprecation warning. Generated exports reproduce the UI Fisher J to six decimals for both bundles; PhysioNet exports now default to their own bundled FIF.
- Bundle sizes: user sample 25,367,923 bytes; PhysioNet sample 11,098,029 bytes; combined 36,465,952 bytes (34.78 MiB).

## Stage 8 — documentation and acceptance (in progress)

- Rewrote README, user guide, and developer guide for the backend-driven app. Added `run.ps1` to install dependencies and launch both services with one command.
- Gate: `npm run build` — passed (TypeScript and Vite production build). Playwright acceptance on PhysioNet rendered all seven views (4 TF panels, PSD, 2 CSP topomaps, ranking, scatter, distributions, heatmap) with no browser errors; the Both Hands/Feet challenge completed. Earlier acceptance covered all views on the user sample and upload flow, with no browser errors.
- User confirmed acceptance of the final app and docs on 2026-11-16; Stage 8 gate passed.

## UI rebuild (layout, views, colour scale)
- Layout: one left rail (classes, CSP pair, channels, file info) and one scrolling main area; three numbered stages; collapsed formula dock; slim challenge strip (samples only). Removed the right-hand preview column and nested headings.
- Epochs: single-trial waveform moved into the stage with a trial navigator; time-frequency maps as small multiples.
- Spectra: PSD legend toggles classes; mu and beta controls stacked; CSP captions state which filter favours which class.
- Features: ranked list as master list; detail tabs for two features, distributions, and trial heatmap. Default scatter axes pair the top feature with the best non-CSP feature (CSP components 1 and 2 trade off by construction).
- Channels split into "CSP channels" (montage multi-select) and "channel for TF and spectra" (dropdown). Labels hidden on dense maps.
- Display band follows the file's filter (PhysioNet 7–30 Hz). Backend cache still 4–38 Hz.
- ERD/ERS colour scale: fixed symmetric ±50 % (the range most ERD/ERS papers use), neutral dark at zero, values beyond the scale clipped and counted in the hint.
- Baseline warning now states the actual baseline window and that the file has no pre-cue data when that is the case.
- requirements.txt: added httpx (the API tests need it).
- Verification: backend pytest 22 passed; tsc and vite build pass; headless Chromium checks for both samples, class toggles, stage switching, and challenges with no errors other than blocked Google Fonts.
