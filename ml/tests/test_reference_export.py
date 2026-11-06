"""Tests for the in-app sign-reference exporter pure helpers (no real data).

The MediaPipe capture path is import-guarded and not exercised in CI; only the
deterministic clip selection and landmark rounding are unit-tested.
"""

from dataclasses import dataclass

from sign_ml.msasl import MsaslClip
from sign_ml.reference_export import (
    representative_clip,
    representative_msasl_clip,
    round_xy,
)
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


def _ms(youtube_id: str, gloss: str = "lost", start: int = 0) -> MsaslClip:
    return MsaslClip(
        gloss=gloss,
        youtube_id=youtube_id,
        url=f"https://www.youtube.com/watch?v={youtube_id}",
        start_time=0.0,
        end_time=2.0,
        start_frame=start,
        end_frame=start + 40,
        fps=25.0,
        signer_id="1",
        split="train",
    )


def test_msasl_fallback_is_deterministic_lowest_clip_id() -> None:
    clips = [_ms("zzz"), _ms("aaa"), _ms("mmm")]
    available = {c.clip_id for c in clips}
    chosen = representative_msasl_clip("lost", clips, available)
    assert chosen is not None
    assert chosen.youtube_id == "aaa"


def test_msasl_fallback_needs_a_downloaded_clip_and_matching_gloss() -> None:
    clips = [_ms("aaa"), _ms("bbb", gloss="cat")]
    assert representative_msasl_clip("lost", clips, set()) is None
    assert representative_msasl_clip("lost", clips, {clips[1].clip_id}) is None


def test_msasl_fallback_matches_after_canonical_label() -> None:
    clips = [_ms("aaa", gloss="  Lost ")]
    chosen = representative_msasl_clip("lost", clips, {clips[0].clip_id})
    assert chosen is not None
