"""Generate the dynamic-normalization golden fixture (shared TS<->Python parity).

Run from anywhere in the repo::

    uv run --project ml python -m sign_ml.golden_dynamic

Writes ``frontend/src/recognition/fixtures/dynamic-normalization.golden.json``.
Both the Vitest and pytest suites reproduce these vectors from the same inputs, so
any divergence between the two normalization implementations fails a gate.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .dynamic_normalization import (
    FRAME_FEATURE_DIM,
    POSE_LANDMARK_COUNT,
    normalize_frame,
    with_motion,
)

Point = list[float]

_FIXTURE_DIR = (
    Path(__file__).resolve().parents[3]
    / "frontend"
    / "src"
    / "recognition"
    / "fixtures"
)
FIXTURE_PATH = _FIXTURE_DIR / "dynamic-normalization.golden.json"
MOTION_FIXTURE_PATH = _FIXTURE_DIR / "dynamic-motion.golden.json"


def _pose() -> list[Point]:
    pose: list[Point] = [
        [0.5 + 0.005 * i, 0.4 + 0.006 * i, 0.002 * i]
        for i in range(POSE_LANDMARK_COUNT)
    ]
    pose[11] = [0.6, 0.5, 0.0]  # left shoulder
    pose[12] = [0.4, 0.5, 0.0]  # right shoulder
    return pose


def _degenerate_pose() -> list[Point]:
    pose = _pose()
    pose[11] = [0.5, 0.5, 0.0]
    pose[12] = [0.5, 0.5, 0.0]  # coincident shoulders -> width 0
    return pose


def _hand(offset: float = 0.0) -> list[Point]:
    hand: list[Point] = [
        [0.5 + 0.02 * i + offset, 0.5 + 0.03 * i, 0.01 * i] for i in range(21)
    ]
    hand[0] = [0.5 + offset, 0.5, 0.0]
    hand[9] = [0.8 + offset, 0.9, 0.0]
    return hand


def _to_points(points: list[Point]) -> list[dict[str, float]]:
    return [{"x": p[0], "y": p[1], "z": p[2]} for p in points]


def _case(
    name: str,
    pose: list[Point] | None,
    left: list[Point] | None,
    right: list[Point] | None,
) -> dict[str, Any]:
    return {
        "name": name,
        "pose": _to_points(pose) if pose is not None else None,
        "leftHand": _to_points(left) if left is not None else None,
        "rightHand": _to_points(right) if right is not None else None,
        "expected": [float(v) for v in normalize_frame(pose, left, right)],
    }


def build_fixture() -> dict[str, Any]:
    pose = _pose()
    left = _hand()
    right = _hand(0.05)
    cases = [
        _case("full", pose, left, right),
        _case("right_hand_only", pose, None, right),
        _case("no_pose_both_hands", None, left, right),
        _case("degenerate_shoulders", _degenerate_pose(), left, right),
        _case("empty", None, None, None),
    ]
    return {
        "description": (
            "Golden vectors for dynamic-sign frame normalization (shared TS<->Python "
            "parity). expected = normalizeFrame({pose,leftHand,rightHand}); layout = "
            "[pose 33 | left hand 63 | right hand 63 | leftPresent, rightPresent]."
        ),
        "frameFeatureDim": FRAME_FEATURE_DIM,
        "cases": cases,
    }


def _motion_case(name: str, window: list[list[float]]) -> dict[str, Any]:
    return {
        "name": name,
        "window": window,
        "expected": [[float(v) for v in row] for row in with_motion(window)],
    }


def build_motion_fixture() -> dict[str, Any]:
    """Golden vectors for the P4M4 ``withMotion`` sequence transform (small synthetic
    frames, ``F = 5`` = 3 spatial + 2 presence flags, so the fixture is readable).
    Covers: a normal sequence, a front-padded sequence (motion must stay zero across
    the padding→first-real boundary), and a fully-undetected (all-zero) frame."""
    pad = [0.0, 0.0, 0.0, 0.0, 0.0]  # padding / undetected frame (all zero)
    cases = [
        _motion_case(
            "normal",
            [
                [0.10, 0.20, 0.30, 1.0, 0.0],
                [0.15, 0.10, 0.30, 1.0, 1.0],
                [0.05, 0.40, 0.20, 0.0, 1.0],
            ],
        ),
        _motion_case(
            "front_padded",
            [pad, pad, [0.10, 0.20, 0.30, 1.0, 1.0], [0.40, 0.10, 0.30, 1.0, 1.0]],
        ),
        _motion_case(
            "gap_frame",
            [[0.10, 0.20, 0.30, 1.0, 1.0], pad, [0.40, 0.10, 0.30, 1.0, 1.0]],
        ),
    ]
    return {
        "description": (
            "Golden vectors for the P4M4 withMotion sequence transform (shared "
            "TS<->Python parity). expected = withMotion(window); appends per-frame "
            "velocity of the spatial dims (all but the 2 presence flags), zeroed for "
            "the first frame and across inactive (all-zero) frames. F_in -> 2*F_in-2."
        ),
        "cases": cases,
    }


def main() -> None:
    fixture = build_fixture()
    FIXTURE_PATH.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(fixture['cases'])} cases -> {FIXTURE_PATH}")

    motion = build_motion_fixture()
    MOTION_FIXTURE_PATH.write_text(
        json.dumps(motion, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(motion['cases'])} cases -> {MOTION_FIXTURE_PATH}")


if __name__ == "__main__":
    main()
