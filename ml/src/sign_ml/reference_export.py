"""Export compact landmark-animation reference clips for the shipped dynamic
glosses (P2M4, ADR-017).

Instead of linking out to an external ASL dictionary, the app shows an in-app
animation of each sign rendered from landmarks. This module turns **one
representative WLASL clip per gloss** into raw per-frame
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
    "good",
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
    # P2M5b additions
    "before",
    "cold",
    "tall",
    "walk",
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
) -> list[str]:  # pragma: no cover - real-data path
    """Write ``<gloss>.json`` reference clips for each gloss; return those written."""
    clips = load_wlasl_index(data_dir / "WLASL_v0.3.json")
    videos_dir = data_dir / "videos"
    available = available_video_ids(videos_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    written: list[str] = []
    for gloss in glosses:
        clip = representative_clip(gloss, clips, available)
        if clip is None:
            print(f"  skip {gloss!r}: no local clip", flush=True)
            continue
        frames = capture_raw_frames(
            videos_dir / f"{clip.video_id}.mp4", model_asset_path
        )
        frames = [f for f in frames if f["pose"] or f["leftHand"] or f["rightHand"]]
        payload: dict[str, Any] = {
            "gloss": gloss,
            "videoId": clip.video_id,
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
    args = parser.parse_args()
    print("Exporting sign reference clips…")
    names = export_references(args.data, args.model, args.out)
    print(f"Done: {len(names)} clips -> {args.out}")
