"""Tests for the in-app sign-reference exporter pure helpers (no real data).

The MediaPipe capture path is import-guarded and not exercised in CI; only the
deterministic clip selection and landmark rounding are unit-tested.
"""

from dataclasses import dataclass

from sign_ml.reference_export import representative_clip, round_xy
from sign_ml.wlasl import Clip


@dataclass
class FakePoint:
    x: float
    y: float
    z: float = 0.0


def test_round_xy_rounds_and_drops_z() -> None:
    pts = [FakePoint(0.123456, 0.987654, 0.5), FakePoint(0.5, 0.25)]
    assert round_xy(pts, decimals=3) == [[0.123, 0.988], [0.5, 0.25]]


def test_round_xy_none_and_empty() -> None:
    assert round_xy(None) is None
    assert round_xy([]) is None


def _clip(video_id: str, gloss: str = "yes") -> Clip:
    return Clip(
        gloss=gloss,
        video_id=video_id,
        split="train",
        frame_start=1,
        frame_end=-1,
        fps=25,
    )


def test_representative_clip_is_deterministic_lowest_id() -> None:
    clips = [_clip("64280"), _clip("10010"), _clip("99999")]
    available = {"64280", "10010", "99999"}
    chosen = representative_clip("yes", clips, available)
    assert chosen is not None
    assert chosen.video_id == "10010"


def test_representative_clip_skips_unavailable() -> None:
    clips = [_clip("64280")]
    assert representative_clip("yes", clips, available=set()) is None
    assert representative_clip("missing", clips, available={"64280"}) is None
