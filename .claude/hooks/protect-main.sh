#!/usr/bin/env bash
# Local main-protection ruleset (GitHub rulesets need Pro on private repos, so
# this enforces the same policy inside Claude Code sessions):
#   - no direct commits on main
#   - no local merges into main
#   - no pushes to main (or while on main)
# Workflow: create a branch, push it, merge via a GitHub PR, then pull main.
# Wired up as a PreToolUse hook in .claude/settings.json.

# jq may not be installed (e.g. Git Bash on Windows) — parse the hook JSON with python.
cmd=$(python -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)
case "$cmd" in
  *"git commit"*|*"git push"*|*"git merge"*) ;;
  *) exit 0 ;;
esac

deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"protect-main: %s"}}\n' "$1"
  exit 0
}

branch=$(git branch --show-current 2>/dev/null)
if [ "$branch" = "main" ]; then
  case "$cmd" in
    *"git commit"*) deny "direct commits to main are blocked — create a branch and merge via PR" ;;
    *"git merge"*)  deny "local merges into main are blocked — merge via a GitHub PR" ;;
    *"git push"*)   deny "pushing while on main is blocked — merge via a GitHub PR, then pull" ;;
  esac
fi
# Block pushes that target main specifically ("git push origin main",
# "git push origin HEAD:main") without tripping on branch names that merely
# contain the substring "main". Scan stops at command separators (;&|).
if [[ "$cmd" =~ git[[:space:]]+push[^\;\&\|]*[[:space:]:]main([[:space:]\"\']|$) ]]; then
  deny "pushing to main is blocked — merge via a GitHub PR"
fi
exit 0
