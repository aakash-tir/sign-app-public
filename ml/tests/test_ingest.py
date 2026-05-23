"""Tests for the canonical multi-source ingest layer (P2M5).

Pure logic on tiny synthetic fixtures — no mediapipe, no real datasets.
"""

import json
from pathlib import Path

from sign_ml.ingest import (
    CanonicalSample,
    assign_signer_disjoint_splits,
    canonical_label,
    coverage_by_label,
    merge,
    split_counts,
    vocabulary,
)
from sign_ml.wlasl import WlaslAdapter


def _sample(
    label: str, signer: str | None, split: str = "train", clip: str = "c"
) -> CanonicalSample:
    return CanonicalSample(
        label=label, source="wlasl", clip_id=clip, signer_id=signer, split=split
    )


def test_canonical_label_normalizes_case_and_whitespace() -> None:
    assert canonical_label("  Thank   You ") == "thank you"
    assert canonical_label("DRINK") == "drink"


def test_canonical_label_applies_synonyms() -> None:
    synonyms = {"thanks": "thank you"}
    assert canonical_label("Thanks", synonyms) == "thank you"
    assert canonical_label("drink", synonyms) == "drink"


def test_vocabulary_and_coverage() -> None:
    samples = [_sample("yes", "1"), _sample("yes", "2"), _sample("no", "1")]
    assert vocabulary(samples) == ["no", "yes"]
    assert coverage_by_label(samples) == {"yes": 2, "no": 1}


def test_signer_disjoint_splits_have_no_leakage() -> None:
    samples = [
        _sample("g", str(signer), clip=f"{signer}-{c}")
        for signer in range(10)
        for c in range(3)
    ]
    out = assign_signer_disjoint_splits(
        samples, test_fraction=0.3, val_fraction=0.2, seed=1
    )
    splits_per_signer: dict[str | None, set[str]] = {}
    for s in out:
        splits_per_signer.setdefault(s.signer_id, set()).add(s.split)
    assert all(len(v) == 1 for v in splits_per_signer.values())  # no signer split

    counts = split_counts(out)
    assert counts["train"] + counts["val"] + counts["test"] == len(samples)
    assert counts["test"] == 9  # 3 of 10 signers * 3 clips


def test_signer_disjoint_splits_are_deterministic() -> None:
    samples = [_sample("g", str(signer), clip=str(signer)) for signer in range(8)]
    a = assign_signer_disjoint_splits(samples, seed=42)
    b = assign_signer_disjoint_splits(samples, seed=42)
    assert [s.split for s in a] == [s.split for s in b]


def test_unknown_signer_keeps_existing_split() -> None:
    samples = [_sample("g", None, split="val", clip="x")]
    out = assign_signer_disjoint_splits(samples, test_fraction=1.0)
    assert out[0].split == "val"


def test_merge_combines_adapters() -> None:
    class Fake:
        name = "fake"

        def __init__(self, samples: list[CanonicalSample]) -> None:
            self._samples = samples

        def samples(self) -> list[CanonicalSample]:
            return self._samples

    combined = merge([Fake([_sample("yes", "1")]), Fake([_sample("no", "2")])])
    assert len(combined) == 2
    assert {s.label for s in combined} == {"yes", "no"}


def test_wlasl_adapter_emits_canonical_samples(tmp_path: Path) -> None:
    metadata = [
        {
            "gloss": "thank you",
            "instances": [
                {"video_id": "1", "split": "train", "signer_id": 7, "fps": 25},
                {"video_id": "2", "split": "test", "signer_id": 8, "fps": 25},
            ],
        },
        {
            "gloss": "drink",
            "instances": [
                # video 3 is intentionally absent on disk -> excluded.
                {"video_id": "3", "split": "train", "signer_id": 7, "fps": 25},
            ],
        },
    ]
    (tmp_path / "WLASL_v0.3.json").write_text(json.dumps(metadata), encoding="utf-8")
    videos = tmp_path / "videos"
    videos.mkdir()
    for vid in ("1", "2"):
        (videos / f"{vid}.mp4").write_text("", encoding="utf-8")

    samples = WlaslAdapter(tmp_path, ["thank you", "drink"]).samples()

    assert len(samples) == 2  # drink's only clip is missing locally
    assert {s.label for s in samples} == {"thank you"}
    assert {s.signer_id for s in samples} == {"7", "8"}
    assert all(s.source == "wlasl" for s in samples)
    assert all(s.video_path is not None for s in samples)
