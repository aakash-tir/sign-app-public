#!/usr/bin/env bash
# Build the redacted public mirror of this repo's `main`, keeping its history.
#
#   tools/publish_public.sh            # dry run: rewrite + leak scan, no push
#   tools/publish_public.sh --push     # also push `main` to $PUBLIC_URL (fast-forward only)
#
# The rewrite is a deterministic `git filter-repo` pass: the same input always gives
# the same commit hashes, so each run fast-forwards the public repo. All personal
# values live in a config folder OUTSIDE the repo (never commit it):
#
#   $SIGN_APP_PUBLIC_CONFIG (default ~/.config/sign-app-public/)
#     paths.txt         paths to strip from every commit, one per line
#     replacements.txt  filter-repo --replace-text rules (literal or regex:)
#     mailmap.txt       author/committer email rewrites
#     deny.txt          extended regexes; any match in any blob or commit fails the run
#
# Full runbook: docs/runbooks/public-sync.md
set -euo pipefail

CONFIG="${SIGN_APP_PUBLIC_CONFIG:-$HOME/.config/sign-app-public}"
SOURCE_URL="${SOURCE_URL:-https://github.com/aakash-tir/sign-app.git}"
PUBLIC_URL="${PUBLIC_URL:-}"
WORKDIR="${WORKDIR:-$(mktemp -d)}"
FILTER_REPO_VERSION="2.47.0"

PUSH=0
case "${1:-}" in
  --push) PUSH=1 ;;
  "") ;;
  *) echo "usage: $0 [--push]" >&2; exit 2 ;;
esac

for f in paths.txt replacements.txt mailmap.txt deny.txt; do
  [[ -s "$CONFIG/$f" ]] || { echo "missing or empty config file: $CONFIG/$f" >&2; exit 1; }
done
if [[ $PUSH -eq 1 && -z "$PUBLIC_URL" ]]; then
  echo "--push needs PUBLIC_URL (e.g. https://github.com/<you>/<public-repo>.git)" >&2
  exit 1
fi

filter_repo() {
  if git filter-repo --version >/dev/null 2>&1; then
    git filter-repo "$@"
  else
    uv tool run --from "git-filter-repo==$FILTER_REPO_VERSION" git-filter-repo "$@"
  fi
}

REPO="$WORKDIR/mirror"
rm -rf "$REPO"
echo "==> cloning main from $SOURCE_URL into $REPO"
git clone --quiet --single-branch --branch main --no-tags "$SOURCE_URL" "$REPO"
cd "$REPO"
before=$(git rev-list --count HEAD)

path_args=()
while IFS= read -r p || [[ -n "$p" ]]; do
  p="${p%$'\r'}"
  [[ -z "$p" || "$p" == \#* ]] && continue
  path_args+=(--path "$p")
done < "$CONFIG/paths.txt"

echo "==> rewriting history"
filter_repo --force --invert-paths "${path_args[@]}" \
  --replace-text "$CONFIG/replacements.txt" \
  --mailmap "$CONFIG/mailmap.txt" >"$WORKDIR/filter-repo.log" 2>&1 \
  || { cat "$WORKDIR/filter-repo.log" >&2; exit 1; }
after=$(git rev-list --count HEAD)

echo "==> scanning every commit and blob for denied patterns"
deny="$WORKDIR/deny.txt"
tr -d '\r' <"$CONFIG/deny.txt" | grep -v -e '^#' -e '^$' >"$deny"
fail=0
if git log --format='%an%n%ae%n%cn%n%ce%n%B' | LC_ALL=C grep -aqiE -f "$deny"; then
  echo "LEAK: commit metadata or a message matches deny.txt" >&2
  fail=1
fi
blob="$WORKDIR/blob.tmp"
while read -r type sha path; do
  [[ "$type" == "blob" ]] || continue
  git cat-file blob "$sha" >"$blob"
  if LC_ALL=C grep -aqiE -f "$deny" "$blob"; then
    echo "LEAK: $path ($sha)" >&2
    fail=1
  fi
done < <(git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(rest)')
# Text scans can't read pixels: a screenshot can show an email or account ID and still
# pass deny.txt. So any image/video/PDF outside the known app-asset folders fails the
# run; review it, then strip it via paths.txt or add its folder to MEDIA_ALLOW.
MEDIA_ALLOW='^(frontend/public/|frontend/android/app/src/main/res/)'
stray=$(git log --all --name-only --format= \
  | grep -iE '\.(png|jpe?g|gif|webp|bmp|heic|tiff?|mp4|mov|webm|avi|pdf)$' \
  | grep -vE "$MEDIA_ALLOW" | sort -u || true)
if [[ -n "$stray" ]]; then
  echo "LEAK?: media files outside the asset folders (review them by eye):" >&2
  echo "$stray" | sed 's/^/  /' >&2
  fail=1
fi
for p in "${path_args[@]}"; do
  [[ "$p" == "--path" ]] && continue
  if git log --all --name-only --format= | grep -q "^${p}"; then
    echo "LEAK: stripped path still present: $p" >&2
    fail=1
  fi
done
if [[ $fail -ne 0 ]]; then
  echo "Scan failed; nothing was pushed. Mirror left at $REPO for inspection." >&2
  exit 1
fi
if [[ "$before" != "$after" ]]; then
  echo "note: commit count changed $before -> $after (a commit only touched stripped paths)"
fi

head=$(git rev-parse HEAD)
echo "==> clean: $after commits, HEAD $head"

if [[ $PUSH -eq 1 ]]; then
  echo "==> pushing main to $PUBLIC_URL (fast-forward only)"
  git push "$PUBLIC_URL" HEAD:refs/heads/main
else
  echo "Dry run: nothing pushed. Re-run with --push and PUBLIC_URL set to publish."
fi
