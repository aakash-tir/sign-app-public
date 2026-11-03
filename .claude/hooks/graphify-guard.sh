#!/usr/bin/env bash
# Portable wrapper for graphify's PreToolUse guard ("check the knowledge graph
# before grepping/reading raw files"). Wired in .claude/settings.json as
#   bash "$CLAUDE_PROJECT_DIR/.claude/hooks/graphify-guard.sh" search|read
# Finds graphify on PATH (plus ~/.local/bin, where uv installs it) instead of a
# machine-specific absolute path, and silently does nothing when graphify isn't
# installed, so a fresh clone never sees hook errors. stdin (the hook JSON) is
# passed straight through to graphify.

export PATH="$PATH:$HOME/.local/bin"
command -v graphify >/dev/null 2>&1 || exit 0
exec graphify hook-guard "$1"
