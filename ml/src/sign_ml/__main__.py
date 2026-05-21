"""CLI: train the fingerspelling model and export it for the frontend.

uv run python -m sign_ml                       # synthetic data
uv run python -m sign_ml --images <train_dir> --model <hand_landmarker.task>
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .pipeline import run_real_pipeline, run_synthetic_pipeline


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the fingerspelling model.")
    parser.add_argument(
        "--images",
        type=Path,
        help="ASL-alphabet training dir containing per-letter folders",
    )
    parser.add_argument(
        "--model",
        type=Path,
        help="Path to hand_landmarker.task (required with --images)",
    )
    parser.add_argument(
        "--per-class",
        type=int,
        default=500,
        help="Max images per class for --images (default: 500)",
    )
    args = parser.parse_args()

    if args.images is not None:
        if args.model is None:
            parser.error("--model is required when --images is given")
        result = run_real_pipeline(
            args.images, args.model, max_per_class=args.per_class
        )
    else:
        result = run_synthetic_pipeline()

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
