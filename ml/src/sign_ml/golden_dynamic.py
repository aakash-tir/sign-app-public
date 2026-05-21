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
)

Point = list[float]

FIXTURE_PATH = (
    Path(__file__).resolve().parents[3]
    / "frontend"
    / "src"
    / "recognition"
    / "fixtures"
    / "dynamic-normalization.golden.json"
)


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


def main() -> None:
    fixture = build_fixture()
    FIXTURE_PATH.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(fixture['cases'])} cases -> {FIXTURE_PATH}")


if __name__ == "__main__":
    main()
