"""Export compact landmark-animation reference clips for the shipped dynamic
glosses (P2M4, ADR-017).

Instead of linking out to an external ASL dictionary, the app shows an in-app
animation of each sign rendered from landmarks. This module turns **one
representative WLASL clip per gloss** (falling back to a local MS-ASL clip for the
MS-ASL-download glosses WLASL doesn't cover, #67) into raw per-frame
``{pose, leftHand, rightHand}`` (x, y only — the overlay renderer ignores z),
downsampled and rounded, and writes ``frontend/public/reference/<gloss>.json`` so
the reference works fully offline.

The MediaPipe path is import-guarded/optional, exactly like ``dynamic_extract``;
the pure helpers (clip selection, landmark rounding) are unit-tested in CI. The
generated JSON files are committed artifacts (like the bundled ONNX model) — CI
does not re-run extraction.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any, Protocol

import numpy as np

from .dynamic_extract import _load_holistic_detector
from .ingest import canonical_label
from .msasl import MsaslClip, load_msasl_index
from .wlasl import Clip, available_video_ids, load_wlasl_index, select_clips

# A short loop reads well as a reference; keep files tiny.
REFERENCE_FRAMES = 24
COORD_DECIMALS = 3

# Shipped dynamic glosses — keep in sync with
# frontend/src/content/dynamicVocab.ts (SHIPPED_GLOSSES).
SHIPPED_GLOSSES: tuple[str, ...] = (
    "drink",
    "go",
    "help",
    "yes",
    "no",
    "want",
    "finish",
    "family",
    "more",
    "learn",
    "eat",
    "sad",
    "please",
    "sorry",
    "love",
    "cold",
    "walk",
    # P3M2: promoted under the honest signer-disjoint gate (MS-ASL u WLASL)
    "like",
    "bad",
    "happy",
    # P3M2c (vocab50): 43 new signs cleared the honest >=0.50 gate on the 81-gloss
    # augmented model. Keep in sync with frontend dynamicVocab.ts SHIPPED_GLOSSES.
    "thank you",
    "hello",
    "name",
    "fine",
    "friend",
    "father",
    "sister",
    "brother",
    "boy",
    "baby",
    "teacher",
    "student",
    "doctor",
    "sit",
    "stand",
    "see",
    "know",
    "think",
    "understand",
    "need",
    "write",
    "read",
    "play",
    "work",
    "forget",
    "water",
    "milk",
    "book",
    "school",
    "house",
    "computer",
    "bathroom",
    "what",
    "where",
    "how",
    "again",
    "now",
    "day",
    "big",
    "hot",
    "tired",
    "black",
    # P4M5 (temporal model): BiGRU + attention pooling re-gate (>=0.50) — 9 new signs
    # clear it; `hungry` demoted. Keep in sync with frontend dynamicVocab.ts.
    "money",
    "woman",
    "girl",
    "man",
    "car",
    "good",
    "run",
    "nice",
    "who",
    # P4M10 (label smoothing): 8 new signs cleared the honest >=0.50 gate on the
    # label-smoothed model (CV 0.687 -> 0.732). No demotions.
    "hungry",
    "sleep",
    "mother",
    "before",
    "come",
    "tall",
    "small",
    "white",
    # P4M16 (MS-ASL download): 27 of 36 fetched everyday glosses cleared the honest
    # >=0.50 gate on the 117-gloss model. No demotions. recognition.md 6.14.
    "live",
    "shoes",
    "home",
    "apple",
    "sick",
    "spring",
    "fish",
    "yellow",
    "time",
    "orange",
    "sandwich",
    "meet",
    "blue",
    "hurt",
    "brown",
    "wrong",
    "red",
    "sign",
    "grandfather",
    "grandmother",
    "pink",
    "bus",
    "beautiful",
    "purple",
    # #67: unpublished trained glosses the TCN (#66) lifted over the honest >=0.50
    # gate. `lost` has no local WLASL clip, so its reference is from MS-ASL.
    "cat",
    "draw",
    "lost",
    "same",
)


class _Point(Protocol):
    x: float
    y: float


def round_xy(
    landmarks: Sequence[_Point] | None, decimals: int = COORD_DECIMALS
) -> list[list[float]] | None:
    """A flat MediaPipe landmark list → ``[[x, y], ...]`` rounded, or ``None``."""
    if not landmarks:
        return None
    return [[round(p.x, decimals), round(p.y, decimals)] for p in landmarks]


def representative_clip(
    gloss: str, clips: list[Clip], available: set[str]
) -> Clip | None:
    """Pick one locally-available clip for ``gloss``, deterministically (lowest
    ``video_id``), so re-running the exporter reproduces the same reference."""
    candidates = sorted(
        select_clips([gloss], clips, available), key=lambda c: c.video_id
    )
    return candidates[0] if candidates else None


def representative_msasl_clip(
    gloss: str, clips: list[MsaslClip], available: set[str]
) -> MsaslClip | None:
    """Fallback for glosses with no local WLASL clip (MS-ASL-download glosses such
    as ``lost``, #67): the downloaded MS-ASL clip with the lowest ``clip_id``, so the
    choice is deterministic too. Glosses are matched after ``canonical_label``."""
    candidates = sorted(
        (
            c
            for c in clips
            if canonical_label(c.gloss) == gloss and c.clip_id in available
        ),
        key=lambda c: c.clip_id,
    )
    return candidates[0] if candidates else None


def capture_raw_frames(
    video_path: Path,
    model_asset_path: Path,
    max_frames: int = REFERENCE_FRAMES,
) -> list[dict[str, list[list[float]] | None]]:  # pragma: no cover - real-data path
    """Holistic-detect ``max_frames`` evenly-spaced frames → raw x,y landmark
    frames (``pose`` / ``leftHand`` / ``rightHand``; any may be ``None``)."""
    import cv2
    import mediapipe as mp

    detector = _load_holistic_detector(model_asset_path)
    capture = cv2.VideoCapture(str(video_path))
    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    keep: set[int] | None = None
    if max_frames > 0 and total > max_frames:
        keep = {int(round(i)) for i in np.linspace(0, total - 1, max_frames)}

    frames: list[dict[str, list[list[float]] | None]] = []
    index = 0
    while True:
        ok, bgr = capture.read()
        if not ok:
            break
        if keep is None or index in keep:
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = detector.detect(image)
            frames.append(
                {
                    "pose": round_xy(result.pose_landmarks),
                    "leftHand": round_xy(result.left_hand_landmarks),
                    "rightHand": round_xy(result.right_hand_landmarks),
                }
            )
        index += 1
    capture.release()
    detector.close()
    return frames


def export_references(
    data_dir: Path,
    model_asset_path: Path,
    out_dir: Path,
    glosses: tuple[str, ...] = SHIPPED_GLOSSES,
    msasl_dir: Path | None = None,
) -> list[str]:  # pragma: no cover - real-data path
    clips = load_wlasl_index(data_dir / "WLASL_v0.3.json")
    videos_dir = data_dir / "videos"
    available = available_video_ids(videos_dir)
    msasl_clips: list[MsaslClip] = []
    msasl_available: set[str] = set()
    if msasl_dir is not None and (msasl_dir / "videos").is_dir():
        msasl_clips = load_msasl_index(msasl_dir)
        msasl_available = {p.stem for p in (msasl_dir / "videos").glob("*.mp4")}
    out_dir.mkdir(parents=True, exist_ok=True)

    written: list[str] = []
    for gloss in glosses:
        clip = representative_clip(gloss, clips, available)
        if clip is not None:
            video_path, video_id = videos_dir / f"{clip.video_id}.mp4", clip.video_id
        else:
            ms = representative_msasl_clip(gloss, msasl_clips, msasl_available)
            if ms is None:
                print(f"  skip {gloss!r}: no local clip", flush=True)
                continue
            assert msasl_dir is not None
            video_path = msasl_dir / "videos" / f"{ms.clip_id}.mp4"
            video_id = f"msasl:{ms.clip_id}"
        frames = capture_raw_frames(video_path, model_asset_path)
        frames = [f for f in frames if f["pose"] or f["leftHand"] or f["rightHand"]]
        payload: dict[str, Any] = {
            "gloss": gloss,
            "videoId": video_id,
            "frames": frames,
        }
        (out_dir / f"{gloss}.json").write_text(
            json.dumps(payload, separators=(",", ":")), encoding="utf-8"
        )
        written.append(gloss)
        print(f"  wrote {gloss}.json ({len(frames)} frames)", flush=True)
    return written


if __name__ == "__main__":  # pragma: no cover
    import argparse

    parser = argparse.ArgumentParser(description="Export in-app sign reference clips")
    parser.add_argument("--data", type=Path, default=Path("data/wlasl"))
    parser.add_argument(
        "--model", type=Path, default=Path("models/holistic_landmarker.task")
    )
    parser.add_argument(
        "--out", type=Path, default=Path("../frontend/public/reference")
    )
    parser.add_argument(
        "--msasl", type=Path, default=Path("data/msasl"), help="MS-ASL fallback"
    )
    parser.add_argument(
        "--only", nargs="+", help="export just these shipped glosses (default: all)"
    )
    args = parser.parse_args()
    glosses = tuple(args.only) if args.only else SHIPPED_GLOSSES
    unknown = sorted(set(glosses) - set(SHIPPED_GLOSSES))
    if unknown:
        parser.error(f"not in SHIPPED_GLOSSES: {unknown}")
    print("Exporting sign reference clips…")
    names = export_references(args.data, args.model, args.out, glosses, args.msasl)
    print(f"Done: {len(names)} clips -> {args.out}")
