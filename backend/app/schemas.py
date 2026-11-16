"""JSON response schemas shared by the API."""
from pydantic import BaseModel
from pydantic import ConfigDict, Field


class ClassMetadata(BaseModel):
    name: str
    event_id: int
    count: int


class SessionMetadata(BaseModel):
    id: str
    source: str
    original_filename: str
    sfreq: float
    tmin: float
    tmax: float
    n_samples: int
    channels: list[str]
    channel_pos: dict[str, list[float]]
    classes: list[ClassMetadata]
    highpass: float | None
    lowpass: float | None
    line_freq: float | None
    warnings: list[str]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TFRequest(StrictModel):
    channel: str
    classes: list[int] = Field(min_length=1)
    baseline: tuple[float, float] | None = None
    freq_range: tuple[float, float] = (4.0, 38.0)


class CSPRequest(StrictModel):
    class_a: int
    class_b: int
    channels: list[str] = Field(min_length=2)
    m: int = Field(default=1, ge=1)


class FeatureSpec(StrictModel):
    kind: str
    channel: str | None = None
    band: tuple[float, float] | None = None
    relative: bool = False
    log10: bool = False
    feature: str | None = None
    window: tuple[float, float] | None = None
    channels: list[str] | None = None
    component: int | None = None


class FeaturesRequest(StrictModel):
    specs: list[FeatureSpec] = Field(min_length=1)
    classes: list[int] | None = None
    pair: tuple[int, int]


class FeatureRankingRequest(StrictModel):
    classes: list[int] | None = None
    pair: tuple[int, int]
    channels: list[str] | None = None


class DistributionRequest(StrictModel):
    spec: FeatureSpec
    classes: list[int] | None = None
    pair: tuple[int, int]


class TopomapRequest(StrictModel):
    class_a: int
    class_b: int
    channels: list[str] = Field(min_length=2)
    filter_index: int = Field(ge=0, le=1)
