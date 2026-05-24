"""Tests for the MS-ASL adapter (tiny synthetic fixtures, no network)."""

import json
from pathlib import Path

from sign_ml.ingest import (
    CanonicalSample,
    assign_signer_disjoint_splits,
)
from sign_ml.msasl import (
    MsaslAdapter,
    MsaslClip,
    load_msasl_index,
    youtube_id_from_url,
)

# Minimal stand-in for MSASL_*.json. Covers: watch?v= and youtu.be URLs, a synonym
# (thanks -> thank you), an out-of-vocab gloss, frame-based vs time-based ids, and a
# broken URL that must be dropped.
TRAIN = [
    {
        "clean_text": "Hello",
        "url": "https://www.youtube.com/watch?v=AAAAAAAAAAA",
        "signer_id": 5,
        "start": 10,
        "end": 40,
        "start_time": 0.4,
        "end_time": 1.6,
        "fps": 25,
        "label": 0,
    },
    {
        "clean_text": "thanks",
        "url": "https://youtu.be/BBBBBBBBBBB",
        "signer_id": 7,
        "start": -1,
        "end": -1,
        "start_time": 2.0,
        "end_time": 3.5,
        "fps": 30,
        "label": 1,
    },
    {  # out of vocab — must be filtered out by the adapter
        "clean_text": "computer",
        "url": "https://www.youtube.com/watch?v=DDDDDDDDDDD",
        "signer_id": 7,
        "start": 0,
        "end": 12,
    },
    {  # unparseable URL — dropped at index load
        "clean_text": "drink",
        "url": "not-a-real-url",
        "signer_id": 9,
    },
]
VAL = [
    {
        "text": "Drink",
        "url": "https://www.youtube.com/watch?v=CCCCCCCCCCC",
        "signer_id": 5,
        "start": 1,
        "end": 20,
        "start_time": 0.0,
        "end_time": 0.8,
        "fps": 25,
    },
]


def _write_index(tmp_path: Path) -> Path:
    (tmp_path / "MSASL_train.json").write_text(json.dumps(TRAIN), encoding="utf-8")
    (tmp_path / "MSASL_val.json").write_text(json.dumps(VAL), encoding="utf-8")
    return tmp_path


def test_youtube_id_from_url_variants() -> None:
    assert (
        youtube_id_from_url("https://www.youtube.com/watch?v=abc123DEFGH")
        == "abc123DEFGH"
    )
    assert youtube_id_from_url("https://youtu.be/abc123DEFGH") == "abc123DEFGH"
    assert (
        youtube_id_from_url("https://www.youtube.com/embed/abc123DEFGH")
        == "abc123DEFGH"
    )
    assert (
        youtube_id_from_url("https://www.youtube.com/shorts/abc123DEFGH")
        == "abc123DEFGH"
    )
    assert youtube_id_from_url("not-a-real-url") is None
    assert youtube_id_from_url("") is None


def test_clip_id_frame_based_then_time_based() -> None:
    framed = MsaslClip("x", "VID", "u", 0.4, 1.6, 10, 40, 25.0, "5", "train")
    assert framed.clip_id == "VID_10_40"
    timed = MsaslClip("x", "VID", "u", 2.0, 3.5, -1, -1, 30.0, "7", "train")
    assert timed.clip_id == "VID_2.000_3.500"


def test_load_msasl_index_parses_and_drops_bad(tmp_path: Path) -> None:
    clips = load_msasl_index(_write_index(tmp_path))
    # 4 train entries minus the broken-URL one, + 1 val = 4 clips
    assert len(clips) == 4
    by_id = {c.clip_id: c for c in clips}
    assert by_id["AAAAAAAAAAA_10_40"].split == "train"
    assert (
        by_id["AAAAAAAAAAA_10_40"].signer_id == "5"
    )  # raw here; namespaced in adapter
    assert by_id["BBBBBBBBBBB_2.000_3.500"].gloss == "thanks"
    assert by_id["CCCCCCCCCCC_1_20"].split == "val"  # parsed from "text"


def test_load_msasl_index_skips_missing_split_files(tmp_path: Path) -> None:
    (tmp_path / "MSASL_train.json").write_text(json.dumps(TRAIN), encoding="utf-8")
    clips = load_msasl_index(tmp_path)  # no val/test files present
    assert all(c.split == "train" for c in clips)
    assert len(clips) == 3  # broken-URL entry dropped


def test_adapter_filters_canonical_and_namespaces_signers(tmp_path: Path) -> None:
    adapter = MsaslAdapter(
        _write_index(tmp_path),
        glosses=["hello", "thank you", "drink"],
        synonyms={"thanks": "thank you"},
    )
    samples = adapter.samples()
    labels = sorted(s.label for s in samples)
    assert labels == ["drink", "hello", "thank you"]  # "computer" filtered out

    by_label = {s.label: s for s in samples}
    assert by_label["thank you"].label == "thank you"  # synonym applied
    assert by_label["hello"].source == "msasl"
    assert by_label["hello"].signer_id == "msasl:5"  # namespaced
    assert by_label["hello"].split == "train"
    assert by_label["drink"].split == "val"
    # video_path points at where the downloader will write <clip_id>.mp4
    assert by_label["hello"].video_path == tmp_path / "videos" / "AAAAAAAAAAA_10_40.mp4"


def test_namespaced_signers_avoid_cross_source_collision() -> None:
    # WLASL signer "5" and MS-ASL signer "5" must be treated as DIFFERENT people, so a
    # signer-disjoint split can put them in different splits (no leakage merge).
    samples = [
        CanonicalSample("hello", "wlasl", "w1", "5", "train"),
        CanonicalSample("hello", "msasl", "m1", "msasl:5", "train"),
    ]
    out = assign_signer_disjoint_splits(samples, test_fraction=0.5, seed=0)
    assert {s.signer_id for s in out} == {"5", "msasl:5"}
    # two distinct signers, one dealt to test and one to train
    assert {s.split for s in out} == {"train", "test"}
