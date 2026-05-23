"""WLASL dataset adapter — parse the canonical metadata, select a curated gloss
subset, and report how many clips are actually available locally.

Pure-Python (no mediapipe/TF), so it is fully unit-tested in CI. The heavy
landmark extraction that turns the selected clips into training arrays lives in
``dynamic_extract.py`` (mediapipe, optional). See ``.claude/docs/recognition.md``
and ADR-014.

Canonical source is ``WLASL_v0.3.json``: a list of ``{gloss, instances: [...]}``
where each instance carries a ``video_id`` (the clip is ``<video_id>.mp4``), a
dataset ``split``, and trim ``frame_start``/``frame_end`` (``-1`` = last frame).
"""

from __future__ import annotations

import json
from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from .ingest import CanonicalSample, canonical_label

VIDEO_SUFFIX = ".mp4"

# Curated dynamic-sign starter (ADR-014). Chosen for everyday usefulness AND
# measured local clip coverage — every gloss below had >=7 downloaded clips when
# selected (see the coverage report). Provisional: the final shipped set is gated
# on per-gloss accuracy in M6.4 (Q5). "hello" was dropped (only 4 local clips).
CURATED_STARTER_GLOSSES: tuple[str, ...] = (
    "drink",
    "go",
    "help",
    "yes",
    "no",
    "good",
    "bad",
    "like",
    "want",
    "finish",
    "family",
    "more",
    "learn",
    "eat",
    "happy",
    "sad",
    "please",
    "thank you",
    "sorry",
    "love",
)

# P2M5b vocabulary expansion. We screened 12 everyday high-coverage glosses; only
# these four cleared the per-gloss accuracy gate with margin in 5-fold CV (walk
# 0.91, tall 0.69, cold 0.67, before 0.62 in the 24-gloss model). The other eight
# (who/what/mother/man/dog/computer/bed/apple) scored < 0.45 and were dropped so
# they don't drag down the existing signs — local WLASL coverage is ~10–16 clips
# per gloss, which caps accuracy (recognition.md §6.1).
EXPANSION_GLOSSES: tuple[str, ...] = (
    "before",
    "cold",
    "tall",
    "walk",
)

EXPANDED_GLOSSES: tuple[str, ...] = CURATED_STARTER_GLOSSES + EXPANSION_GLOSSES


@dataclass(frozen=True)
class Clip:
    """One WLASL clip instance for one gloss."""

    gloss: str
    video_id: str
    split: str  # "train" | "val" | "test"
    frame_start: int
    frame_end: int  # -1 means "to the last frame"
    fps: int
    signer_id: str | None = None  # who performed it (for signer-disjoint splits)


@dataclass(frozen=True)
class GlossCoverage:
    """How many of a gloss's clips are present on disk."""

    gloss: str
    total: int  # instances listed in the metadata
    available: int  # of those, how many <video_id>.mp4 exist locally

    @property
    def missing(self) -> int:
        return self.total - self.available


def load_wlasl_index(metadata_path: Path) -> list[Clip]:
    """Flatten ``WLASL_v0.3.json`` into a list of :class:`Clip`."""
    raw = json.loads(metadata_path.read_text(encoding="utf-8"))
    clips: list[Clip] = []
    for entry in raw:
        gloss = str(entry["gloss"])
        for inst in entry.get("instances", []):
            signer = inst.get("signer_id")
            clips.append(
                Clip(
                    gloss=gloss,
                    video_id=str(inst["video_id"]),
                    split=str(inst.get("split", "train")),
                    frame_start=int(inst.get("frame_start", 1)),
                    frame_end=int(inst.get("frame_end", -1)),
                    fps=int(inst.get("fps", 25)),
                    signer_id=None if signer is None else str(signer),
                )
            )
    return clips


def available_video_ids(videos_dir: Path) -> set[str]:
    """Set of ``video_id``s for which ``<video_id>.mp4`` exists in ``videos_dir``."""
    return {p.stem for p in videos_dir.glob(f"*{VIDEO_SUFFIX}")}


def clips_by_gloss(clips: list[Clip]) -> dict[str, list[Clip]]:
    grouped: dict[str, list[Clip]] = defaultdict(list)
    for clip in clips:
        grouped[clip.gloss].append(clip)
    return dict(grouped)


def coverage_for(
    glosses: list[str],
    clips: list[Clip],
    available: set[str],
) -> list[GlossCoverage]:
    """Per-gloss available/total clip counts, in the given gloss order."""
    grouped = clips_by_gloss(clips)
    report: list[GlossCoverage] = []
    for gloss in glosses:
        gloss_clips = grouped.get(gloss, [])
        n_available = sum(1 for c in gloss_clips if c.video_id in available)
        report.append(GlossCoverage(gloss, len(gloss_clips), n_available))
    return report


def select_clips(
    glosses: list[str],
    clips: list[Clip],
    available: set[str],
    splits: set[str] | None = None,
) -> list[Clip]:
    """Clips for the chosen glosses whose video exists locally (optionally
    filtered to ``splits``)."""
    gloss_set = set(glosses)
    selected = [c for c in clips if c.gloss in gloss_set and c.video_id in available]
    if splits is not None:
        selected = [c for c in selected if c.split in splits]
    return selected


def load_class_list(class_list_path: Path) -> list[str]:
    """Glosses from ``wlasl_class_list.txt`` (``<class_id>\\t<gloss>`` per line),
    ordered by class id."""
    indexed: list[tuple[int, str]] = []
    for line in class_list_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        class_id, gloss = line.split("\t", 1)
        indexed.append((int(class_id), gloss.strip()))
    indexed.sort()
    return [gloss for _id, gloss in indexed]


class WlaslAdapter:
    """WLASL as a :class:`~sign_ml.ingest.DatasetAdapter` (P2M5): emits locally
    available clips for the chosen glosses as canonical samples (with signer ids,
    so signer-disjoint splits work). A new dataset plugs in the same way."""

    name = "wlasl"

    def __init__(
        self,
        data_dir: Path,
        glosses: list[str],
        synonyms: Mapping[str, str] | None = None,
    ) -> None:
        self.data_dir = Path(data_dir)
        self.glosses = list(glosses)
        self.synonyms = synonyms

    def samples(self) -> list[CanonicalSample]:
        clips = load_wlasl_index(self.data_dir / "WLASL_v0.3.json")
        videos_dir = self.data_dir / "videos"
        available = available_video_ids(videos_dir)
        selected = select_clips(self.glosses, clips, available)
        return [
            CanonicalSample(
                label=canonical_label(clip.gloss, self.synonyms),
                source=self.name,
                clip_id=clip.video_id,
                signer_id=clip.signer_id,
                split=clip.split,
                video_path=videos_dir / f"{clip.video_id}{VIDEO_SUFFIX}",
            )
            for clip in selected
        ]
