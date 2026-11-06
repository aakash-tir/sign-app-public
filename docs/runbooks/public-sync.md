# Public mirror: how it works and how to sync it

This repo stays **private** and is the source of truth. The public repo is a
**redacted copy of `main` with its full history**, built by
[`tools/publish_public.sh`](../../tools/publish_public.sh).

## Why a rewritten mirror

Early history contains a few personal items: a dashboard screenshot, a pasted
build log with an account ID, a personal commit email and local home-folder paths.
Instead of exposing them, the script runs `git filter-repo` over `main`:

- strips whole paths that should never have been committed;
- replaces personal strings with placeholders;
- rewrites author emails to the GitHub `noreply` address;
- then **scans every blob and every commit's metadata**, and refuses to push if any
  denied pattern is still there;
- and fails on any image, video or PDF outside `frontend/public/` and the Android
  `res/` folders. A text scan can't read a screenshot, and a screenshot is how
  the email and account ID leaked in the first place.

The rewrite is **deterministic**: the same commits always produce the same
rewritten hashes. Each sync therefore adds the new commits on top of what is
already public, and the push is a normal fast-forward with no force-push.

> Don't make the private repo itself public. Its old PRs (`refs/pull/*`) keep the
> original, unredacted commits reachable on GitHub.

## One-time setup

1. Create the config folder **outside the repo**, at `~/.config/sign-app-public/`
   (or set `SIGN_APP_PUBLIC_CONFIG`). It holds four files:

   | File | Contents |
   | --- | --- |
   | `paths.txt` | Paths to strip from every commit, one per line (e.g. `images/`). |
   | `replacements.txt` | `filter-repo --replace-text` rules: `old==>new`, or `regex:pattern==>new`. |
   | `mailmap.txt` | `Name <public@email> <private@email>`. |
   | `deny.txt` | Extended regexes. Any match fails the run. List every personal value here. |

   These files contain the very values being hidden, so they must never be committed.
2. Install `uv` (the script runs a pinned `git-filter-repo` through it if
   `git filter-repo` isn't installed).
3. Create the empty public repo on GitHub with no README or licence, so the first
   push isn't rejected as unrelated history.

## Each sync

```bash
tools/publish_public.sh                                   # dry run: rewrite + scan
PUBLIC_URL=https://github.com/<you>/<public>.git \
  tools/publish_public.sh --push                          # publish
```

Run it after merges you want published. It always clones `main` from GitHub, so
local uncommitted work never leaks.

## When something changes

- **A new personal value turns up:** add it to `replacements.txt` (and `deny.txt`).
  If it sits in a commit that's **already public**, the rewritten hashes change and
  the push is rejected as non-fast-forward. You then have to force-push the public
  repo once, which breaks anyone's clones of it. Put a value on the deny list
  before it's published, not after.
- **Contributions on the public repo:** apply them to this private repo through the
  normal issue → PR flow, then sync again. Don't merge PRs directly on the public
  repo, because the next sync would diverge from it.
