"""Turn WLASL video clips into fixed-length normalized landmark sequences.

The MediaPipe HolisticLandmarker path is OPTIONAL and import-guarded (it is not
exercised by CI), exactly like ``extract.py`` for the static path. Install with
``uv sync --extra video`` and supply a ``holistic_landmarker.task`` model.

The pure transforms — normalizing a clip's frames and shaping them into a fixed
``WINDOW_SIZE`` window — are framework-free and unit-tested. They reuse the frozen
``dynamic_normalization`` so training features match the TS runtime (see
``.claude/docs/recognition.md`` §5.1, ADR-014).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt

from .dynamic_normalization import (
    FRAME_FEATURE_DIM,
    WINDOW_SIZE,
    normalize_frame,
)
from .wlasl import Clip

FloatArray = npt.NDArray[np.float64]

# One captured frame: (pose, left_hand, right_hand); any may be None if not seen.
Frame = tuple[
    npt.ArrayLike | None,
    npt.ArrayLike | None,
    npt.ArrayLike | None,
]


def normalize_clip(frames: list[Frame]) -> FloatArray:
    """Normalize each frame to the frozen 161-d feature → ``(T, FRAME_FEATURE_DIM)``."""
    if not frames:
        return np.zeros((0, FRAME_FEATURE_DIM), dtype=np.float64)
    rows = [normalize_frame(pose, left, right) for pose, left, right in frames]
    return np.asarray(rows, dtype=np.float64)


def to_fixed_window(seq: FloatArray, window: int = WINDOW_SIZE) -> FloatArray:
    """Shape a variable-length ``(T, F)`` sequence into exactly ``(window, F)``.

    - ``T == window`` → unchanged.
    - ``T > window``  → ``window`` evenly-spaced frames (uniform temporal sample),
      so the whole sign is represented regardless of clip length.
    - ``T < window``  → **front zero-padded**, matching the runtime ``FrameWindow``.
    """
    seq = np.asarray(seq, dtype=np.float64)
    feat = seq.shape[1] if seq.ndim == 2 and seq.shape[0] > 0 else FRAME_FEATURE_DIM
    t = seq.shape[0]
    if t == window:
        return seq
    if t > window:
        idx = np.linspace(0, t - 1, window).round().astype(np.int64)
        return seq[idx]
    pad = np.zeros((window - t, feat), dtype=np.float64)
    return np.concatenate([pad, seq], axis=0) if t > 0 else pad


def _load_holistic_detector(model_asset_path: Path) -> Any:  # pragma: no cover
    try:
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision
    except ImportError as exc:
        raise RuntimeError(
            "mediapipe is required for video extraction; "
            "install it with `uv sync --extra video`"
        ) from exc

    # IMAGE mode (per-frame, no temporal tracking): one shared detector across
    # all clips, no cross-clip tracking bleed. The runtime uses VIDEO mode, but
    # the per-frame landmark topology is identical so normalization parity holds.
    options = vision.HolisticLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(model_asset_path)),
        running_mode=vision.RunningMode.IMAGE,
    )
    return vision.HolisticLandmarker.create_from_options(options)


def _landmarks_or_none(landmarks: list[Any]) -> list[list[float]] | None:
    """MediaPipe Python returns a flat landmark list (empty if not detected)."""
    if landmarks:
        return [[p.x, p.y, p.z] for p in landmarks]
    return None


def extract_clip(
    video_path: Path,
    model_asset_path: Path,
    window: int = WINDOW_SIZE,
    max_frames: int = 64,
) -> FloatArray:  # pragma: no cover - real-data path
    """Extract one clip → ``(window, FRAME_FEATURE_DIM)`` normalized sequence.

    A **fresh detector per clip**: Holistic's internal segmentation-smoothing
    state persists across ``detect()`` calls and RET_CHECK-fails when the frame
    size changes between clips, so we don't share one detector. Holistic runs on
    at most ``max_frames`` evenly-spaced frames (decoding is cheap, inference is
    not); the result is then shaped to a fixed window.
    """
    import cv2
    import mediapipe as mp

    detector = _load_holistic_detector(model_asset_path)
    capture = cv2.VideoCapture(str(video_path))
    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    keep: set[int] | None = None
    if max_frames > 0 and total > max_frames:
        keep = {int(round(i)) for i in np.linspace(0, total - 1, max_frames)}

    frames: list[Frame] = []
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
                (
                    _landmarks_or_none(result.pose_landmarks),
                    _landmarks_or_none(result.left_hand_landmarks),
                    _landmarks_or_none(result.right_hand_landmarks),
                )
            )
        index += 1
    capture.release()
    detector.close()
    return to_fixed_window(normalize_clip(frames), window)


def extract_dataset(
    clips: list[Clip],
    videos_dir: Path,
    model_asset_path: Path,
    window: int = WINDOW_SIZE,
    max_frames: int = 64,
) -> tuple[
    FloatArray,
    npt.NDArray[np.int64],
    npt.NDArray[np.str_],
    npt.NDArray[np.str_],
    list[str],
]:  # pragma: no cover - real-data path
    """Extract all clips → ``(N, window, F)`` features, ``(N,)`` labels, ``(N,)``
    splits, ``(N,)`` signer ids (``""`` when unknown), and the sorted gloss
    vocabulary. The signer column enables signer-disjoint evaluation (ADR-019)."""
    glosses = sorted({c.gloss for c in clips})
    gloss_to_index = {g: i for i, g in enumerate(glosses)}

    features: list[FloatArray] = []
    targets: list[int] = []
    splits: list[str] = []
    signers: list[str] = []
    for n, clip in enumerate(clips, start=1):
        video_path = videos_dir / f"{clip.video_id}.mp4"
        if not video_path.exists():
            continue
        features.append(extract_clip(video_path, model_asset_path, window, max_frames))
        targets.append(gloss_to_index[clip.gloss])
        splits.append(clip.split)
        signers.append(clip.signer_id or "")
        print(f"  [{n}/{len(clips)}] {clip.gloss} ({clip.video_id})", flush=True)

    x = np.asarray(features, dtype=np.float64)
    y = np.asarray(targets, dtype=np.int64)
    s = np.asarray(splits, dtype=np.str_)
    sig = np.asarray(signers, dtype=np.str_)
    return x, y, s, sig, glosses
