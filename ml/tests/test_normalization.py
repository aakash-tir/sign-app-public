"""Parity + invariant tests for the Python normalization (mirror of the TS one)."""

import json
from pathlib import Path

import numpy as np
import pytest

from sign_ml.normalization import flatten_landmarks, normalize_hand_landmarks

# The shared TS<->Python parity fixture, authored in M1 and living in the
# frontend tree. Both languages must reproduce it identically.
GOLDEN_FIXTURE = (
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "src"
    / "recognition"
    / "fixtures"
    / "normalization.golden.json"
)


def _to_xyz(points: list[dict[str, float]]) -> list[list[float]]:
    return [[p["x"], p["y"], p["z"]] for p in points]


def _sample_hand() -> list[list[float]]:
    hand = [[0.5 + 0.02 * i, 0.5 + 0.03 * i, 0.01 * i] for i in range(21)]
    hand[0] = [0.5, 0.5, 0.0]
    hand[9] = [0.8, 0.9, 0.0]
    return hand


def test_matches_shared_golden_fixture() -> None:
    fixture = json.loads(GOLDEN_FIXTURE.read_text(encoding="utf-8"))
    for case in fixture["cases"]:
        out = normalize_hand_landmarks(_to_xyz(case["input"]), case["handedness"])
        expected = np.asarray(_to_xyz(case["expected"]), dtype=np.float64)
        np.testing.assert_allclose(out, expected, atol=1e-9)


def test_wrist_maps_to_origin() -> None:
    out = normalize_hand_landmarks(_sample_hand(), "Right")
    np.testing.assert_allclose(out[0], [0.0, 0.0, 0.0], atol=1e-12)


def test_reference_distance_becomes_one() -> None:
    out = normalize_hand_landmarks(_sample_hand(), "Right")
    assert float(np.linalg.norm(out[9])) == pytest.approx(1.0, abs=1e-9)


def test_left_mirrors_x_relative_to_right() -> None:
    hand = _sample_hand()
    right = normalize_hand_landmarks(hand, "Right")
    left = normalize_hand_landmarks(hand, "Left")
    np.testing.assert_allclose(left[:, 0], -right[:, 0], atol=1e-12)
    np.testing.assert_allclose(left[:, 1:], right[:, 1:], atol=1e-12)


def test_wrong_shape_raises() -> None:
    with pytest.raises(ValueError):
        normalize_hand_landmarks([[0.0, 0.0, 0.0]], "Right")


def test_flatten_orders_xyz() -> None:
    out = flatten_landmarks([[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]])
    np.testing.assert_array_equal(out, [1.0, 2.0, 3.0, 4.0, 5.0, 6.0])
