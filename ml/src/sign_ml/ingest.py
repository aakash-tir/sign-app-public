"""Canonical, multi-source ingest layer (P2M5).

The plan's item #1 is "expand the dataset" — but first "make sure we have a good
normalization layer ... before introducing new data." Because the model trains on
**landmarks** (not pixels), what must be standardized across sources is the
**output contract**, not image size (see ``../../output.md`` §1):

- a **canonical label vocabulary** (source glosses normalized + synonym-mapped),
- **signer-disjoint splits** (a signer's clips never straddle train/test — this is
  what otherwise inflates held-out accuracy; see ``recognition.md`` notes), and
- **source provenance** so coverage and licensing stay auditable (ADR-016).

A new dataset (e.g. MS-ASL) then plugs in by implementing a small
:class:`DatasetAdapter` that yields :class:`CanonicalSample`\\ s; the heavy
landmark extraction stays in ``dynamic_extract.py``. This module is pure-Python
and unit-tested (no mediapipe / no network).
"""

from __future__ import annotations

import random
import re
from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Protocol

SPLITS = ("train", "val", "test")


@dataclass(frozen=True)
class CanonicalSample:
    """One clip conformed to the training contract, regardless of its source."""

    label: str  # canonical gloss
    source: str  # dataset name, e.g. "wlasl", "msasl"
    clip_id: str  # source-local identifier
    signer_id: str | None  # enables signer-disjoint splits (None if unknown)
    split: str  # "train" | "val" | "test"
    video_path: Path | None = None  # resolved local clip, if available


class DatasetAdapter(Protocol):
    """A source of canonical samples. Implement one per dataset (WLASL, MS-ASL…)."""

    name: str

    def samples(self) -> list[CanonicalSample]: ...


def canonical_label(raw: str, synonyms: Mapping[str, str] | None = None) -> str:
    """Normalize a source gloss to the canonical vocabulary.

    Lowercase, collapse internal whitespace, strip ends, then apply an optional
    synonym map (e.g. ``{"thanks": "thank you"}``) so equivalent glosses from
    different datasets land on one label.
    """
    normalized = re.sub(r"\s+", " ", raw.strip().lower())
    if synonyms:
        return synonyms.get(normalized, normalized)
    return normalized


def merge(adapters: Iterable[DatasetAdapter]) -> list[CanonicalSample]:
    """Flatten all adapters' samples into one list (source provenance retained)."""
    out: list[CanonicalSample] = []
    for adapter in adapters:
        out.extend(adapter.samples())
    return out


def vocabulary(samples: Iterable[CanonicalSample]) -> list[str]:
    """Sorted unique canonical labels present."""
    return sorted({s.label for s in samples})


def coverage_by_label(samples: Iterable[CanonicalSample]) -> dict[str, int]:
    """Clip count per canonical label."""
    counts: dict[str, int] = defaultdict(int)
    for sample in samples:
        counts[sample.label] += 1
    return dict(counts)


def assign_signer_disjoint_splits(
    samples: Sequence[CanonicalSample],
    test_fraction: float = 0.2,
    val_fraction: float = 0.0,
    seed: int = 0,
) -> list[CanonicalSample]:
    """Reassign ``split`` so each **signer** falls entirely in one split.

    Whole signers — not individual clips — are dealt to test / val / train, so the
    same person never appears in both training and evaluation (which would inflate
    held-out accuracy). Deterministic for a given ``seed``. Samples whose
    ``signer_id`` is ``None`` keep their existing split (the source's own).
    """
    signers = sorted({s.signer_id for s in samples if s.signer_id is not None})
    rng = random.Random(seed)
    rng.shuffle(signers)

    n = len(signers)
    n_test = int(round(n * test_fraction))
    n_val = int(round(n * val_fraction))
    test_signers = set(signers[:n_test])
    val_signers = set(signers[n_test : n_test + n_val])

    def split_for(sample: CanonicalSample) -> str:
        if sample.signer_id is None:
            return sample.split
        if sample.signer_id in test_signers:
            return "test"
        if sample.signer_id in val_signers:
            return "val"
        return "train"

    return [replace(s, split=split_for(s)) for s in samples]


def split_counts(samples: Iterable[CanonicalSample]) -> dict[str, int]:
    """How many samples landed in each split."""
    counts: dict[str, int] = {s: 0 for s in SPLITS}
    for sample in samples:
        counts[sample.split] = counts.get(sample.split, 0) + 1
    return counts


def main() -> None:  # pragma: no cover - CLI on real data
    """Report canonical coverage + a signer-disjoint split over the current
    sources — proves the ingest layer works before any new dataset is added."""
    import argparse

    # Lazy import keeps this module source-agnostic (wlasl imports ingest).
    from .wlasl import CURATED_STARTER_GLOSSES, WlaslAdapter

    parser = argparse.ArgumentParser(description=main.__doc__)
    parser.add_argument("--data", type=Path, default=Path("data/wlasl"))
    parser.add_argument("--test-fraction", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    adapter = WlaslAdapter(args.data, list(CURATED_STARTER_GLOSSES))
    samples = assign_signer_disjoint_splits(
        merge([adapter]), test_fraction=args.test_fraction, seed=args.seed
    )
    vocab = vocabulary(samples)
    coverage = coverage_by_label(samples)
    signers = len({s.signer_id for s in samples if s.signer_id is not None})
    print(
        f"sources=[{adapter.name}] samples={len(samples)} "
        f"labels={len(vocab)} signers={signers}"
    )
    print(f"signer-disjoint split: {split_counts(samples)}")
    print("per-label coverage:")
    for label in vocab:
        print(f"  {label:12s} {coverage.get(label, 0):3d}")


if __name__ == "__main__":  # pragma: no cover
    main()
