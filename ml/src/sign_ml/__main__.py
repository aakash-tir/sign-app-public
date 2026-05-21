"""CLI: train the fingerspelling model and export it for the frontend.

uv run python -m sign_ml            # synthetic data -> frontend model JSON
"""

from __future__ import annotations

import json

from .pipeline import run_synthetic_pipeline


def main() -> None:
    result = run_synthetic_pipeline()
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
