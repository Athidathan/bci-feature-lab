"""In-memory active dataset session."""
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from .schemas import SessionMetadata


@dataclass
class Session:
    id: str
    source: str
    original_filename: str
    sfreq: float
    tmin: float
    tmax: float
    channels: list[str]
    channel_pos: dict[str, list[float]]
    classes: list[dict[str, int | str]]
    X: np.ndarray
    y: np.ndarray
    highpass: float | None
    lowpass: float | None
    line_freq: float | None
    warnings: list[str] = field(default_factory=list)
    cache: dict[str, Any] = field(default_factory=dict)

    def metadata(self) -> SessionMetadata:
        return SessionMetadata(
            id=self.id,
            source=self.source,
            original_filename=self.original_filename,
            sfreq=self.sfreq,
            tmin=self.tmin,
            tmax=self.tmax,
            n_samples=int(self.X.shape[2]),
            channels=self.channels,
            channel_pos=self.channel_pos,
            classes=self.classes,
            highpass=self.highpass,
            lowpass=self.lowpass,
            line_freq=self.line_freq,
            warnings=self.warnings,
        )


active_session: Session | None = None


def set_active(session: Session) -> None:
    global active_session
    active_session = session


def get_active() -> Session:
    if active_session is None:
        raise RuntimeError("No EEG dataset is loaded")
    return active_session
