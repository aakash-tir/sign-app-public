"""Tests for the synthetic training pipeline and the export schema."""

import json
from pathlib import Path

import numpy as np

from sign_ml.data import make_synthetic_dataset
from sign_ml.dynamic_pipeline import (
    _clip_cache_path,
    _sanitize,
    all_pool_glosses,
    resolve_vocab,
)
from sign_ml.ingest import CanonicalSample
from sign_ml.pipeline import run_synthetic_pipeline
from sign_ml.wlasl import CURATED_STARTER_GLOSSES


def test_synthetic_dataset_shapes() -> None:
    x, y, labels = make_synthetic_dataset(samples_per_class=10, seed=1)
    assert x.shape == (len(labels) * 10, 63)
    assert y.shape == (len(labels) * 10,)
    assert {int(v) for v in np.unique(y)} == set(range(len(labels)))


def test_synthetic_dataset_is_deterministic() -> None:
    a, _, _ = make_synthetic_dataset(samples_per_class=5, seed=7)
    b, _, _ = make_synthetic_dataset(samples_per_class=5, seed=7)
    np.testing.assert_array_equal(a, b)


def test_clip_cache_path_namespaces_by_source_and_sanitizes() -> None:
    # Per-clip cache keys must be source-namespaced (so WLASL "5" and MS-ASL "5"
    # never collide) and filesystem-safe, with no extension collisions between a
    # frame-based and time-based MS-ASL clip id.
    clips = Path("cache/clips")
    wlasl = CanonicalSample("yes", "wlasl", "65540", "5", "train")
    msasl = CanonicalSample("yes", "msasl", "abc_10_40", "msasl:5", "train")
    assert _clip_cache_path(clips, wlasl) == clips / "wlasl__65540.npy"
    assert _clip_cache_path(clips, msasl) == clips / "msasl__abc_10_40.npy"
    assert _clip_cache_path(clips, wlasl) != _clip_cache_path(clips, msasl)


def test_sanitize_replaces_unsafe_chars() -> None:
    assert _sanitize("abc_10_40") == "abc_10_40"  # already safe (kept verbatim)
    assert _sanitize("a/b\\c d:e") == "a_b_c_d_e"


def test_resolve_vocab_static_returns_curated_tuple() -> None:
    # A named curated vocab resolves to its static tuple without touching the
    # data dirs (so the paths passed here are never read).
    assert resolve_vocab(
        "starter", Path("nonexistent/wlasl"), Path("nonexistent/msasl")
    ) == list(CURATED_STARTER_GLOSSES)


def test_resolve_vocab_pretrain_unions_all_on_disk_glosses(tmp_path: Path) -> None:
    # P4M8: `pretrain` is the WHOLE on-disk pool — every gloss in the raw index,
    # deduped + sorted — regardless of curation. No MSASL_*.json present → WLASL only.
    wlasl_dir = tmp_path / "wlasl"
    wlasl_dir.mkdir()
    index = [
        {"gloss": "zebra", "instances": [{"video_id": "1"}, {"video_id": "2"}]},
        {"gloss": "apple", "instances": [{"video_id": "3"}]},
        {"gloss": "mango", "instances": []},  # no clips → nothing to extract → excluded
    ]
    (wlasl_dir / "WLASL_v0.3.json").write_text(json.dumps(index), encoding="utf-8")
    msasl_dir = tmp_path / "msasl"  # absent index files → contributes nothing

    glosses = all_pool_glosses(wlasl_dir, msasl_dir)
    # Sorted, deduped, every gloss with >=1 indexed clip ("mango" has none → out).
    assert glosses == ["apple", "zebra"]
    assert resolve_vocab("pretrain", wlasl_dir, msasl_dir) == glosses


def test_pipeline_trains_and_exports(tmp_path: Path) -> None:
    out = tmp_path / "model.json"
    result = run_synthetic_pipeline(model_path=out, samples_per_class=30, seed=0)

    # Synthetic clusters are separable, so the pipeline should learn them well.
    assert result["metrics"]["accuracy"] > 0.9
    assert out.exists()

    model = json.loads(out.read_text(encoding="utf-8"))
    assert model["format"] == "mlp-1"
    assert model["normalization"] == "wrist-mcp9-mirror-v1"
    assert model["inputDim"] == 63
    assert len(model["labels"]) == result["num_classes"]

    # First layer maps 63 inputs; final layer is softmax over the classes.
    first_layer = model["layers"][0]
    assert len(first_layer["W"][0]) == 63
    final_layer = model["layers"][-1]
    assert final_layer["activation"] == "softmax"
    assert len(final_layer["b"]) == result["num_classes"]
    assert len(final_layer["W"]) == result["num_classes"]
