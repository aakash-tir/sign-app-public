"""MS-ASL dataset adapter (Phase 3 / P3M2).

MS-ASL (Microsoft, ~1000 signs / ~25k clips) is cleared for **training only** under
C-UDA — train and ship the model, never the source video (ADR-016). It ships as
**annotation JSON + YouTube URLs**, not video files, so the realized set is smaller
than the headline (link rot); the actual clips are fetched by ``msasl_download.py``.

This module is **pure-Python** (no network, no mediapipe) and unit-tested: it parses
the annotation files into :class:`MsaslClip`\\ s and exposes a
:class:`~sign_ml.ingest.DatasetAdapter` (:class:`MsaslAdapter`) that yields canonical
samples conforming to the shared ingest contract. Signer ids are **namespaced**
(``msasl:<id>``) so a signer-disjoint split never confuses MS-ASL signers with
WLASL's (P3M2 deliverable; see ``.claude/docs/phase3.md``).

Annotation schema (``MSASL_{train,val,test}.json`` — a list of dicts):
``clean_text``/``text`` (gloss), ``label`` (class id), ``signer_id`` (global signer),
``url`` (YouTube), ``start_time``/``end_time`` (seconds, for the download cut),
``start``/``end`` (frames), ``fps``, ``box`` (normalized ``[y0,x0,y1,x1]``).
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .ingest import CanonicalSample, canonical_label

SOURCE = "msasl"
VIDEO_SUFFIX = ".mp4"
SPLITS = ("train", "val", "test")


@dataclass(frozen=True)
class MsaslClip:
    """One MS-ASL annotated clip (a segment of a YouTube video)."""

    gloss: str  # raw clean_text
    youtube_id: str  # parsed from the URL
    url: str
    start_time: float  # seconds (download cut start)
    end_time: float  # seconds (download cut end)
    start_frame: int  # -1 if absent
    end_frame: int  # -1 if absent
    fps: float
    signer_id: str  # MS-ASL global signer id (as string, not yet namespaced)
    split: str  # "train" | "val" | "test"

    @property
    def clip_id(self) -> str:
        """Stable per-clip id → the download filename ``<clip_id>.mp4``. Frame-based
        when frames are present (exact + readable), else time-based."""
        if self.start_frame >= 0 and self.end_frame > self.start_frame:
            return f"{self.youtube_id}_{self.start_frame}_{self.end_frame}"
        return f"{self.youtube_id}_{self.start_time:.3f}_{self.end_time:.3f}"


def youtube_id_from_url(url: str) -> str | None:
    """Extract the 11-char video id from a YouTube URL, or ``None`` if unparseable.
    Handles ``watch?v=``, ``youtu.be/``, and ``/embed|/v|/shorts`` forms."""
    if not url:
        return None
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if host.endswith("youtu.be"):
        vid = parsed.path.lstrip("/").split("/", 1)[0]
        return vid or None
    if "youtube" in host:
        query = parse_qs(parsed.query)
        if query.get("v"):
            return query["v"][0]
        parts = [p for p in parsed.path.split("/") if p]
        if len(parts) >= 2 and parts[0] in ("embed", "v", "shorts"):
            return parts[1]
    return None


def _clip_from_entry(entry: Mapping[str, object], split: str) -> MsaslClip | None:
    """Parse one annotation dict → :class:`MsaslClip`, tolerant of field-name
    variants. Returns ``None`` if the gloss or YouTube id can't be resolved."""
    gloss_raw = entry.get("clean_text") or entry.get("text") or entry.get("org_text")
    url = str(entry.get("url", ""))
    youtube_id = youtube_id_from_url(url)
    if not gloss_raw or youtube_id is None:
        return None

    def _num(key: str, default: float) -> float:
        value = entry.get(key)
        return float(value) if isinstance(value, int | float) else default

    signer = entry.get("signer_id", entry.get("signer"))
    return MsaslClip(
        gloss=str(gloss_raw),
        youtube_id=youtube_id,
        url=url,
        start_time=_num("start_time", 0.0),
        end_time=_num("end_time", 0.0),
        start_frame=int(_num("start", -1.0)),
        end_frame=int(_num("end", -1.0)),
        fps=_num("fps", 25.0),
        signer_id="unknown" if signer is None else str(signer),
        split=split,
    )


def load_msasl_index(
    data_dir: Path, splits: tuple[str, ...] = SPLITS
) -> list[MsaslClip]:
    """Flatten the ``MSASL_{split}.json`` files present under ``data_dir`` into a
    list of :class:`MsaslClip`. Missing split files are skipped (not an error)."""
    clips: list[MsaslClip] = []
    for split in splits:
        path = data_dir / f"MSASL_{split}.json"
        if not path.exists():
            continue
        entries = json.loads(path.read_text(encoding="utf-8"))
        for entry in entries:
            clip = _clip_from_entry(entry, split)
            if clip is not None:
                clips.append(clip)
    return clips


class MsaslAdapter:
    """MS-ASL as a :class:`~sign_ml.ingest.DatasetAdapter`: emits the clips whose
    **canonical** gloss is in ``glosses`` as canonical samples. ``video_path`` points
    at where ``msasl_download.py`` writes the clip (``<clip_id>.mp4``); it may not
    exist yet (download is a separate owner step). Signer ids are namespaced
    ``msasl:<id>`` so signer-disjoint splits don't collide them with other sources."""

    name = SOURCE

    def __init__(
        self,
        data_dir: Path,
        glosses: list[str],
        synonyms: Mapping[str, str] | None = None,
        splits: tuple[str, ...] = SPLITS,
    ) -> None:
        self.data_dir = Path(data_dir)
        self.glosses = list(glosses)
        self.synonyms = synonyms
        self.splits = splits

    def samples(self) -> list[CanonicalSample]:
        gloss_set = set(self.glosses)
        videos_dir = self.data_dir / "videos"
        out: list[CanonicalSample] = []
        for clip in load_msasl_index(self.data_dir, self.splits):
            label = canonical_label(clip.gloss, self.synonyms)
            if label not in gloss_set:
                continue
            out.append(
                CanonicalSample(
                    label=label,
                    source=self.name,
                    clip_id=clip.clip_id,
                    signer_id=f"{self.name}:{clip.signer_id}",
                    split=clip.split,
                    video_path=videos_dir / f"{clip.clip_id}{VIDEO_SUFFIX}",
                )
            )
        return out
