"""Real-data path: extract normalized landmark features from ASL-alphabet images.

OPTIONAL and NOT exercised by CI. Requires the ``images`` extra
(``uv sync --extra images``) and a downloaded ``hand_landmarker.task`` model.
Expects ``images_dir/<LETTER>/<image>.jpg`` layout (e.g. the Kaggle ASL Alphabet
dataset). Downloading that dataset needs Kaggle credentials — see
``../../.claude/docs/recognition.md``. Wire this in once the dataset is available.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt

from .normalization import flatten_landmarks, normalize_hand_landmarks

FloatArray = npt.NDArray[np.float64]
IntArray = npt.NDArray[np.int64]

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}


def _load_detector(model_asset_path: Path) -> Any:
    try:
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise RuntimeError(
            "mediapipe is required for image extraction; "
            "install it with `uv sync --extra images`"
        ) from exc

    options = vision.HandLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(model_asset_path)),
        running_mode=vision.RunningMode.IMAGE,
        num_hands=1,
    )
    detector = vision.HandLandmarker.create_from_options(options)
    return detector, mp


def extract_dataset(
    images_dir: Path,
    model_asset_path: Path,
    labels: list[str] | None = None,
) -> tuple[FloatArray, IntArray, list[str]]:  # pragma: no cover - real-data path
    """Detect, normalize and flatten landmarks for every labeled image."""
    detector, mp = _load_detector(model_asset_path)
    class_dirs = sorted(p for p in images_dir.iterdir() if p.is_dir())
    names = labels if labels is not None else [p.name for p in class_dirs]

    features: list[FloatArray] = []
    targets: list[int] = []
    for class_index, name in enumerate(names):
        class_dir = images_dir / name
        if not class_dir.is_dir():
            continue
        for image_path in sorted(class_dir.iterdir()):
            if image_path.suffix.lower() not in IMAGE_SUFFIXES:
                continue
            image = mp.Image.create_from_file(str(image_path))
            result = detector.detect(image)
            if not result.hand_landmarks:
                continue
            landmarks = [[p.x, p.y, p.z] for p in result.hand_landmarks[0]]
            handedness = result.handedness[0][0].category_name
            features.append(
                flatten_landmarks(normalize_hand_landmarks(landmarks, handedness))
            )
            targets.append(class_index)

    detector.close()
    x = np.asarray(features, dtype=np.float64)
    y = np.asarray(targets, dtype=np.int64)
    return x, y, list(names)
