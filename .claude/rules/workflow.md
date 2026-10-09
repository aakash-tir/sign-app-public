# Workflow rules — git, PRs, CI, quality gates

The non-negotiable process from the plan. Milestone definitions:
[`../docs/milestones.md`](../docs/milestones.md).

## Repository

- **Private** GitHub repository (created in M0).
- Default branch: `main`. `main` is always green and always shippable.

## Secrets, credentials & external accounts — STOP and ask

When a step needs something **only the owner can provide or authorize** — and that
must never be invented, guessed, or committed — **stop and ask the owner** before
proceeding. Do **not** fabricate realistic-looking placeholder values, and do
**not** continue as if the secret already exists.

This includes (non-exhaustive):

- API keys / tokens / client secrets (third-party services, model APIs, etc.).
- Cloud/hosting logins & deploy credentials (Cloudflare account, GitHub auth,
  Netlify/Vercel tokens).
- Account creation or paid sign-ups, OAuth app registration, domain purchases.
- Signing keys, certificates, environment secrets, dataset licenses/downloads
  that sit behind authentication.

How to ask:

1. Name exactly what's needed and **why** (which milestone/step is blocked).
2. Say where it will live (e.g. a local untracked `.env`) and the **exact name**
   expected (e.g. `VITE_FOO_KEY`).
3. If the owner doesn't know how to obtain it, **explain how to get it** step by
   step — keep it beginner-friendly (the owner is new to some infra/hosting).
4. Wait for the value/authorization before continuing that step; meanwhile,
   proceed with any other unblocked work if possible.

Handling: keep secrets in untracked env files (`.env*` in `.gitignore`); use the
hosting provider's / CI's **encrypted secrets store** for deploys. Never print
full secret values in logs, commits, or chat.

## Branch → PR → squash-merge (per milestone)

1. Branch from `main`: **`milestone/MX-short-slug`** (e.g.
   `milestone/M1-camera-landmarks`).
2. Do the milestone's work on that branch, with tests.
3. Open a **PR into `main`** with a summary of the milestone (what shipped, how
   it was tested, any decisions/open-question resolutions).
4. Merge **only via squash-merge**, and **only when all gates are green** (below).
5. **Before merge, in the same PR** (the PR number is known once it's open), update
   [`../progress.md`](../progress.md) (status + PR link) and any affected docs. Never a
   separate follow-up doc-sync PR or push: each one costs a CI run.

> The owner has granted permission to make code edits and merge the PRs — but the
> green-gates rule is absolute: never merge red.

## Quality gates (every milestone, before merge)

Run locally **and** in CI (for the lanes whose files changed). A milestone is not done
until all pass.

**Frontend (`frontend/`):**
- `prettier --check .`
- `eslint .` (no warnings)
- `tsc --noEmit`
- `vitest run`
- `playwright test`

**Python ML (`ml/`):**
- `ruff format --check .`
- `ruff check .`
- `mypy .`
- `pytest`

## CI

- GitHub Actions runs **two independent lanes**, one workflow each
  (`.github/workflows/frontend.yml`, `ml.yml`).
- **CI is lean on Actions minutes**: the lanes run on pull requests only (into `main`
  or `milestone/**`), and only when a file that lane depends on changed (`frontend/`,
  or `ml/` plus the shared parity fixtures in `frontend/src/recognition/fixtures/`).
  Nothing runs on the merge to `main`. Docs-only PRs (`docs/`, `.claude/`, `*.md`) run
  no CI and may merge without checks.
- Any other PR is mergeable only when **every check that started** is green;
  `gh pr checks` lists only those.
- Cache `node_modules` / `uv` env for speed; keep ML tests on tiny fixtures.

## Tests are part of the deliverable

- Each milestone **must** add tests that prove its features work (see acceptance
  criteria per milestone). "Done" without tests is not done.
- Prefer fast, deterministic tests (seeded RNG, stubbed recognition/model).

## Commits

- Clear, imperative commit messages. Reference the milestone (e.g. `M3: ...`).
- Keep the branch focused on its milestone; avoid scope creep across milestones.
