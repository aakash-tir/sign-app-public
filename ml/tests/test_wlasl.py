"""Tests for the WLASL metadata adapter (tiny synthetic fixtures, no real data)."""

import json
from pathlib import Path

from sign_ml.wlasl import (
    DOWNLOAD_GLOSSES,
    ONDISK_GLOSSES,
    VOCAB50_GLOSSES,
    VOCAB100_GLOSSES,
    VOCAB136_GLOSSES,
    VOCAB_DL_GLOSSES,
    Clip,
    available_video_ids,
    clips_by_gloss,
    coverage_for,
    load_class_list,
    load_wlasl_index,
    select_clips,
)


def test_vocab_expansion_lists_are_consistent() -> None:
    """vocab100/136/dl are disjoint extensions of vocab50; no duplicate glosses."""
    assert len(VOCAB100_GLOSSES) == len(VOCAB50_GLOSSES) + len(ONDISK_GLOSSES)
    assert len(VOCAB136_GLOSSES) == len(VOCAB100_GLOSSES) + len(DOWNLOAD_GLOSSES)
    # vocab_dl (the P4M16 training set) = vocab50 + download, minus the on-disk flops
    assert len(VOCAB_DL_GLOSSES) == len(VOCAB50_GLOSSES) + len(DOWNLOAD_GLOSSES)
    assert not (set(VOCAB_DL_GLOSSES) & set(ONDISK_GLOSSES))
    # the on-disk and download additions are new (not already in vocab50/100)
    assert not (set(ONDISK_GLOSSES) & set(VOCAB50_GLOSSES))
    assert not (set(DOWNLOAD_GLOSSES) & set(VOCAB100_GLOSSES))
    # no duplicates anywhere
    for vocab in (VOCAB100_GLOSSES, VOCAB136_GLOSSES, VOCAB_DL_GLOSSES):
        assert len(set(vocab)) == len(vocab)


# Minimal stand-in for WLASL_v0.3.json: two glosses, three instances.
SAMPLE_METADATA = [
    {
        "gloss": "hello",
        "instances": [
            {
                "video_id": "001",
                "split": "train",
                "frame_start": 1,
                "frame_end": -1,
                "fps": 25,
            },
            {
                "video_id": "002",
                "split": "val",
                "frame_start": 5,
                "frame_end": 40,
                "fps": 30,
            },
        ],
    },
    {
        "gloss": "thank you",
        "instances": [
            {
                "video_id": "003",
                "split": "train",
                "frame_start": 1,
                "frame_end": -1,
                "fps": 25,
            },
        ],
    },
]


def _write_metadata(tmp_path: Path) -> Path:
    p = tmp_path / "WLASL_v0.3.json"
    p.write_text(json.dumps(SAMPLE_METADATA), encoding="utf-8")
    return p


def _videos_dir(tmp_path: Path, ids: list[str]) -> Path:
    d = tmp_path / "videos"
    d.mkdir()
    for vid in ids:
        (d / f"{vid}.mp4").write_bytes(b"")
    (d / "notes.txt").write_bytes(b"")  # ignored: not an mp4
    return d


def test_load_wlasl_index_flattens_instances(tmp_path: Path) -> None:
    clips = load_wlasl_index(_write_metadata(tmp_path))
    assert len(clips) == 3
    assert clips[0] == Clip("hello", "001", "train", 1, -1, 25)
    assert clips[1].frame_end == 40
    assert {c.gloss for c in clips} == {"hello", "thank you"}


def test_available_video_ids_only_counts_mp4(tmp_path: Path) -> None:
    d = _videos_dir(tmp_path, ["001", "003"])
    assert available_video_ids(d) == {"001", "003"}


def test_clips_by_gloss_groups(tmp_path: Path) -> None:
    grouped = clips_by_gloss(load_wlasl_index(_write_metadata(tmp_path)))
    assert len(grouped["hello"]) == 2
    assert len(grouped["thank you"]) == 1


def test_coverage_reports_available_and_missing(tmp_path: Path) -> None:
    clips = load_wlasl_index(_write_metadata(tmp_path))
    available = available_video_ids(_videos_dir(tmp_path, ["001", "003"]))
    cov = {c.gloss: c for c in coverage_for(["hello", "thank you"], clips, available)}
    assert cov["hello"].total == 2
    assert cov["hello"].available == 1  # only 001 present (002 missing)
    assert cov["hello"].missing == 1
    assert cov["thank you"].available == 1


def test_select_clips_filters_to_local_and_split(tmp_path: Path) -> None:
    clips = load_wlasl_index(_write_metadata(tmp_path))
    available = available_video_ids(_videos_dir(tmp_path, ["001", "002", "003"]))

    chosen = select_clips(["hello"], clips, available)
    assert {c.video_id for c in chosen} == {"001", "002"}

    train_only = select_clips(["hello"], clips, available, splits={"train"})
    assert {c.video_id for c in train_only} == {"001"}


def test_select_clips_excludes_missing_videos(tmp_path: Path) -> None:
    clips = load_wlasl_index(_write_metadata(tmp_path))
    available = available_video_ids(_videos_dir(tmp_path, ["001"]))  # 002, 003 absent
    chosen = select_clips(["hello", "thank you"], clips, available)
    assert {c.video_id for c in chosen} == {"001"}


def test_load_class_list_orders_by_id(tmp_path: Path) -> None:
    p = tmp_path / "wlasl_class_list.txt"
    p.write_text("2\tcomputer\n0\tbook\n1\tdrink\n", encoding="utf-8")
    assert load_class_list(p) == ["book", "drink", "computer"]
