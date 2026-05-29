"""Download MS-ASL clips for the chosen glosses -> ``data/msasl/videos/``.

MS-ASL ships as YouTube URLs + time segments (ADR-016), so the clips are fetched
with **yt-dlp** (lazy-imported, optional ``--extra msasl``; needs **ffmpeg** on PATH
for the segment cut). This is an **owner action**: large, network-bound, and
rate-limited, and many URLs are dead/private/region-locked (link rot) - those are
**skipped**, not fatal, and a realized-coverage report is written so the vocabulary
is gated on what we actually got, not the headline counts.

Only the *source video* is restricted (never shipped); training on it and shipping
the model is permitted under C-UDA (ADR-016).

  uv sync --extra msasl   # installs yt-dlp; ffmpeg must be installed separately
  uv run python -m sign_ml.msasl_download --data data/msasl --vocab expanded
"""

from __future__ import annotations

import argparse
import json
import shutil
from collections import defaultdict
from pathlib import Path
from typing import Any

from .ingest import canonical_label
from .msasl import SPLITS, MsaslClip, load_msasl_index
from .wlasl import CURATED_STARTER_GLOSSES, EXPANDED_GLOSSES

VOCABS = {"starter": CURATED_STARTER_GLOSSES, "expanded": EXPANDED_GLOSSES}
DATA_DIR = Path("data/msasl")
# Cap fetched resolution: we only extract landmarks, so small files are plenty and
# keep the download light. Container-agnostic on purpose -- many YouTube videos are
# only available as DASH/HLS (webm/m4v) and the strict `ext=mp4` filter rejected them
# even though ffmpeg can transcode to mp4 at merge time.
FORMAT = (
    "bestvideo[height<=480]+bestaudio/best[height<=480]/"
    "bestvideo[height<=720]+bestaudio/best[height<=720]/best"
)

# YouTube blocks the default `web` client for many videos under bot detection;
# falling back through mobile/android clients unblocks a large fraction.
PLAYER_CLIENTS = ["web", "mweb", "android", "ios"]


def _load_yt_dlp() -> Any:  # pragma: no cover - optional heavy dep
    try:
        import yt_dlp
    except ImportError as exc:
        raise RuntimeError(
            "yt-dlp is required to download MS-ASL clips; install it with "
            "`uv sync --extra msasl` (and ensure ffmpeg is on PATH)"
        ) from exc
    return yt_dlp


def download_clip(
    clip: MsaslClip,
    videos_dir: Path,
    cookies_browser: str | None = None,
    cookies_file: Path | None = None,
    sleep: float = 0.0,
    ffmpeg_location: str | None = None,
) -> bool:  # pragma: no cover - network
    """Fetch ``[start_time, end_time]`` of the clip's YouTube video → ``<clip_id>.mp4``.
    Returns ``True`` on success; ``False`` for any failure (dead/private/region-locked
    link, format error) so one bad URL never aborts the run.

    ``cookies_browser`` (e.g. ``"chrome"``) makes yt-dlp authenticate using the
    browser's logged-in YouTube cookies — far higher rate limits, the practical fix
    for bulk-download throttling. The browser must be **closed** (yt-dlp locks the
    cookie store). On Windows + Chromium browsers (Chrome/Edge/Brave) this is broken
    by App-Bound Encryption (yt-dlp #10927); use ``cookies_file`` instead — a Netscape
    cookies.txt exported via a browser extension (e.g. "Get cookies.txt LOCALLY"),
    which bypasses ABE entirely. ``sleep`` adds a random ``[sleep, 2*sleep]`` pause
    before each download to look less bot-like (set 1-3 s for bulk runs)."""
    yt_dlp = _load_yt_dlp()
    options: dict[str, Any] = {
        "outtmpl": str(videos_dir / f"{clip.clip_id}.%(ext)s"),
        "format": FORMAT,
        "merge_output_format": "mp4",
        "download_ranges": yt_dlp.utils.download_range_func(
            None, [(clip.start_time, clip.end_time)]
        ),
        "force_keyframes_at_cuts": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "retries": 5,
        "fragment_retries": 5,
        "ignoreerrors": False,
        "extractor_args": {"youtube": {"player_client": PLAYER_CLIENTS}},
    }
    if cookies_browser:
        options["cookiesfrombrowser"] = (cookies_browser,)
    if cookies_file:
        options["cookiefile"] = str(cookies_file)
    if ffmpeg_location:
        options["ffmpeg_location"] = ffmpeg_location
    if sleep > 0.0:
        options["sleep_interval"] = sleep
        options["max_sleep_interval"] = sleep * 2
        options["sleep_interval_requests"] = 1
    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            ydl.download([clip.url])
    except Exception:
        return False
    return (videos_dir / f"{clip.clip_id}.mp4").exists()


def run_download(
    data_dir: Path,
    glosses: list[str],
    synonyms: dict[str, str] | None = None,
    splits: tuple[str, ...] = SPLITS,
    max_per_gloss: int | None = None,
    skip_existing: bool = True,
    cookies_browser: str | None = None,
    cookies_file: Path | None = None,
    sleep: float = 0.0,
    ffmpeg_location: str | None = None,
) -> dict[str, dict[str, int]]:  # pragma: no cover - network/real-data path
    """Download every targeted clip and report realized per-gloss coverage.

    Targeted = clips whose **canonical** gloss is in ``glosses``. Already-present
    files are kept (resumable). Writes ``coverage.json`` (attempted / downloaded /
    distinct signers per gloss) and returns it.
    """
    videos_dir = data_dir / "videos"
    videos_dir.mkdir(parents=True, exist_ok=True)
    gloss_set = set(glosses)

    targeted: dict[str, list[MsaslClip]] = defaultdict(list)
    for clip in load_msasl_index(data_dir, splits):
        label = canonical_label(clip.gloss, synonyms)
        if label in gloss_set:
            targeted[label].append(clip)

    report: dict[str, dict[str, int]] = {}
    print(f"Downloading MS-ASL clips for {len(gloss_set)} glosses -> {videos_dir}")
    for gloss in sorted(gloss_set):
        clips = targeted.get(gloss, [])
        if max_per_gloss is not None:
            clips = clips[:max_per_gloss]
        signers: set[str] = set()
        downloaded = 0
        for clip in clips:
            dest = videos_dir / f"{clip.clip_id}.mp4"
            if (skip_existing and dest.exists()) or download_clip(
                clip,
                videos_dir,
                cookies_browser=cookies_browser,
                cookies_file=cookies_file,
                sleep=sleep,
                ffmpeg_location=ffmpeg_location,
            ):
                downloaded += 1
                signers.add(clip.signer_id)
        report[gloss] = {
            "attempted": len(clips),
            "downloaded": downloaded,
            "signers": len(signers),
        }
        print(
            f"  {gloss:14s} {downloaded:3d}/{len(clips):3d} clips, "
            f"{len(signers)} signers"
        )

    (data_dir / "coverage.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    total = sum(r["downloaded"] for r in report.values())
    print(f"\nRealized: {total} clips across {len(gloss_set)} target glosses")
    print(f"Coverage report -> {data_dir / 'coverage.json'}")
    return report


def main() -> None:  # pragma: no cover - CLI
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DATA_DIR)
    parser.add_argument("--vocab", choices=sorted(VOCABS), default="expanded")
    parser.add_argument(
        "--glosses",
        type=str,
        default=None,
        help="comma-separated canonical glosses (overrides --vocab)",
    )
    parser.add_argument("--max-per-gloss", type=int, default=None)
    parser.add_argument(
        "--no-skip-existing",
        action="store_true",
        help="re-download clips even if the file already exists",
    )
    parser.add_argument(
        "--cookies-from-browser",
        choices=["chrome", "edge", "firefox", "brave", "opera", "chromium", "vivaldi"],
        default=None,
        help="authenticate via the browser's YouTube cookies (browser must be CLOSED)",
    )
    parser.add_argument(
        "--cookies",
        type=Path,
        default=None,
        help=(
            "path to a Netscape cookies.txt (export via a browser extension, e.g. "
            "'Get cookies.txt LOCALLY'). Use this on Windows + Chromium browsers "
            "where --cookies-from-browser is blocked by App-Bound Encryption."
        ),
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.0,
        help="seconds to sleep before each clip (jittered to 2x); set 1-3 for bulk",
    )
    parser.add_argument(
        "--ffmpeg-location",
        type=str,
        default=None,
        help=(
            "path to an ffmpeg binary (or its dir) when ffmpeg is not on PATH. If "
            "omitted and ffmpeg is missing, falls back to the imageio-ffmpeg bundled "
            "binary when that package is installed."
        ),
    )
    args = parser.parse_args()

    ffmpeg_location = args.ffmpeg_location
    if ffmpeg_location is None and shutil.which("ffmpeg") is None:
        try:
            import imageio_ffmpeg

            ffmpeg_location = imageio_ffmpeg.get_ffmpeg_exe()
            print(f"Using bundled ffmpeg: {ffmpeg_location}")
        except ImportError:
            pass

    if args.glosses:
        glosses = [canonical_label(g) for g in args.glosses.split(",") if g.strip()]
    else:
        glosses = [canonical_label(g) for g in VOCABS[args.vocab]]

    run_download(
        args.data,
        glosses,
        max_per_gloss=args.max_per_gloss,
        skip_existing=not args.no_skip_existing,
        cookies_browser=args.cookies_from_browser,
        cookies_file=args.cookies,
        sleep=args.sleep,
        ffmpeg_location=ffmpeg_location,
    )


if __name__ == "__main__":  # pragma: no cover
    main()
