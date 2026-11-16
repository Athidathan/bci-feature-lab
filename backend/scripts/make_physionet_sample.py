"""Download EEGMMIDB subject 1 and create four-class motor imagery epochs.

Run from the project root with:
    python backend/scripts/make_physionet_sample.py

T1/T2 have run-dependent meanings. This script maps runs 4/8/12 to left/right
hand imagery and runs 6/10/14 to both-hands/feet imagery. It excludes rest.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import mne
from mne.datasets import eegbci


ROOT = Path(__file__).resolve().parents[2]
RUNS = (4, 8, 12, 6, 10, 14)
EVENT_IDS = {"Left Hand": 1, "Right Hand": 2, "Both Hands": 3, "Feet": 4}
RUN_LABELS = {
    **{run: ("Left Hand", "Right Hand") for run in (4, 8, 12)},
    **{run: ("Both Hands", "Feet") for run in (6, 10, 14)},
}


def make_epochs(subject: int, data_path: Path) -> mne.Epochs:
    paths = eegbci.load_data(subjects=subject, runs=list(RUNS), path=data_path, update_path=False, verbose="ERROR")
    raws = []
    for run, filename in zip(RUNS, paths, strict=True):
        raw = mne.io.read_raw_edf(filename, preload=True, verbose="ERROR")
        eegbci.standardize(raw)
        raw.set_montage("standard_1005", on_missing="ignore", verbose="ERROR")
        descriptions = raw.annotations.description.tolist()
        left_label, right_label = RUN_LABELS[run]
        descriptions = [left_label if label == "T1" else right_label if label == "T2" else label for label in descriptions]
        remapped = mne.Annotations(
            onset=raw.annotations.onset,
            duration=raw.annotations.duration,
            description=descriptions,
            orig_time=raw.annotations.orig_time,
        )
        raw.set_annotations(remapped)
        raw.filter(7.0, 30.0, verbose="ERROR")
        raws.append(raw)

    combined = mne.concatenate_raws(raws, preload=True, verbose="ERROR")
    events, _ = mne.events_from_annotations(combined, event_id=EVENT_IDS, verbose="ERROR")
    epochs = mne.Epochs(
        combined,
        events,
        event_id=EVENT_IDS,
        tmin=1.0,
        tmax=4.0,
        baseline=None,
        preload=True,
        reject_by_annotation=True,
        verbose="ERROR",
    )
    if set(epochs.event_id) != set(EVENT_IDS) or min(len(epochs[name]) for name in EVENT_IDS) < 10:
        raise RuntimeError(f"Expected four well-populated imagery classes, got {epochs.event_id}")
    return epochs


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--subject", type=int, default=1)
    parser.add_argument("--output", type=Path, default=ROOT / "backend/data/physionet_mi_s01-epo.fif")
    parser.add_argument("--data-path", type=Path, default=ROOT / ".cache/physionet-eegmmidb")
    args = parser.parse_args()
    if not 1 <= args.subject <= 109:
        parser.error("--subject must be between 1 and 109")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    epochs = make_epochs(args.subject, args.data_path)
    epochs.save(args.output, overwrite=True, verbose="ERROR")
    counts = {name: len(epochs[name]) for name in EVENT_IDS}
    print(f"Saved {len(epochs)} epochs to {args.output}")
    print(f"Class counts: {counts}")
    print(f"Sampling rate: {epochs.info['sfreq']:g} Hz; channels: {len(epochs.ch_names)}")


if __name__ == "__main__":
    main()
