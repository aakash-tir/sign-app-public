"""Sign App ML pipeline (build-time only).

Trains the ASL recognition model from hand/pose landmarks and exports it for
the on-device frontend. The real pipeline (extract / train / export / eval)
lands in M2 — see ../.claude/docs/recognition.md.
"""

__version__ = "0.0.0"


def package_name() -> str:
    """Return the package name. Placeholder until M2 adds the real pipeline."""
    return "sign-ml"
