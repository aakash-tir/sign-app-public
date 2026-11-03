# Workflow rules — issues, git, PRs, CI, quality gates

The non-negotiable process from the plan, brought in line with the owner's other
projects (Nova, Skillbook) on 2026-11-03. Every change, whether a feature, fix, chore,
or docs, is driven by a GitHub issue and lands through its own PR. A PR merges only
when every CI check that started is green. Milestone definitions:
[`../docs/milestones.md`](../docs/milestones.md) and the phase plans in `../docs/`.

## Repository

- **Private** GitHub repository `aakash-tir/sign-app`. Default branch `main`, which is
  always green and always shippable (Cloudflare auto-deploys it).
- GitHub Free has no branch protection on private repos, so the gate is these rules
  plus the local `.claude/hooks/protect-main.sh` hook (denies commit/merge/push on
  `main`).

## Secrets, credentials & external accounts — STOP and ask

When a step needs something **only the owner can provide or authorize**, and that
must never be invented, guessed, or committed, **stop and ask the owner** before
proceeding. Do **not** fabricate realistic-looking placeholder values, and do
**not** continue as if the secret already exists.

This includes (non-exhaustive):

- API keys / tokens / client secrets (third-party services, model APIs, etc.).
- Cloud/hosting logins & deploy credentials (Cloudflare account, GitHub auth).
- Account creation or paid sign-ups (e.g. Google Play / App Store developer
  accounts), OAuth app registration, domain purchases.
- Signing keys (Android keystore), certificates, environment secrets, dataset
  licenses/downloads that sit behind authentication (MS-ASL `cookies.txt`).

How to ask:

1. Name exactly what's needed and **why** (which issue/milestone is blocked).
2. Say where it will live (e.g. a local untracked `.env`) and the **exact name**
   expected (e.g. `VITE_FOO_KEY`).
3. If the owner doesn't know how to obtain it, **explain how to get it** step by
   step. Keep it beginner-friendly, since the owner is new to some infra and hosting.
4. Wait for the value/authorization before continuing that step. Meanwhile, carry on
   with any other unblocked work.

Handling: keep secrets in untracked env files (`.env*` in `.gitignore`); use the
hosting provider's / CI's **encrypted secrets store** for deploys. Never print
full secret values in logs, commits, or chat.

## Invariants

- **One issue = one thing.** A single problem or deliverable, one PR in size. If an
  issue bundles several things, split it into child issues before writing code.
- **Milestones mirror the phase plans** (`P6M8`, `P6M9`, …) as GitHub milestones, each
  holding one or more issues.
- **One PR per issue.** Branch `<type>/<issue#>-<slug>` (types: feat, fix, chore,
  docs, test, refactor). The PR body starts with `Closes #<n>`. Never fold a second
  issue in. *(The older `milestone/PXMY-slug` branches and phase integration branches
  are retired. A multi-issue milestone is just several PRs into `main`.)*
- **Never merge unless every CI check that started is green**, verified in-session
  with `gh pr checks <pr> --watch`. Pending, failing, cancelled, or "it passed
  locally" all mean don't merge. A docs-only PR starts no checks and may merge.
- **Never commit to `main`.** Create the branch in its own command *before* any
  commit; the protect-main hook checks the branch when a command starts.
- **Out-of-scope findings become new issues, not fixes.** A bug or gap unrelated to
  the current issue, or too big for its PR, gets `gh issue create` (type label,
  milestone if obvious, evidence, acceptance criteria) and a line under "Follow-ups
  filed" in the PR. Unscheduled ideas go in `docs/future.md` instead.
- **No green, no next.** If CI can't be made green after a few honest attempts, or
  the fix needs an owner decision, stop: label the issue `needs-decision` or
  `blocked`, comment why, and report. Never leave a red PR merged.
- **Model changes are gated by numbers.** A PR that retrains or re-exports a model
  records the dataset, the subset, and the measured honest (signer-disjoint) accuracy
  in `.claude/docs/recognition.md`. Vocabulary only grows past the gate (ADR-007,
  ADR-019).

## The loop

1. **Sync:** `git checkout main && git pull --ff-only`. The tree must be clean.
2. **Pick:** `gh issue list --state open --json number,title,milestone,labels`. Take
   the lowest milestone, then the lowest number, skipping `blocked` /
   `needs-decision`, unless the owner named an issue or milestone. Read it fully
   with `gh issue view <n> --comments`.
3. **Branch:** `git checkout -b <type>/<n>-<slug>` (its own command).
4. **Solve: code ⇄ test** until the local gates below pass. Write tests that can
   fail. Add today's `logs/` entry (what / why / how), update the architecture
   diagram if the architecture changed, update `docs/future.md` and
   `.claude/progress.md`. Once the code is final, run `graphify update .` and commit
   `graphify-out/` in this same PR.
5. **PR:** commit `<type>: <summary> (#<n>)`, `git push -u origin HEAD`, then
   `gh pr create` using the PR template (`Closes #<n>` first).
6. **CI ⇄ fix:** `gh pr checks <pr> --watch` (only the workflows whose paths the PR
   touched start). If anything is red, run `gh run view <run> --log-failed`, fix it on
   the same branch, push, and watch again.
7. **Merge on all-green only**, one PR at a time: check
   `gh pr view <pr> --json mergeable`, then
   `gh pr merge <pr> --squash --delete-branch`, then
   `git checkout main && git pull --ff-only`, and confirm the issue closed.
8. **Verify the deploy** when `frontend/` changed: the Cloudflare build for
   `main` succeeded and the live site serves the change.
9. **Next issue.** Repeat until the agreed scope is done, then report: issues closed
   (with PR links), issues filed, anything stopped and why.

## Quality gates (every PR, before merge)

Run locally **and** in CI.

**Frontend (`frontend/`):**
`npm run format && npm run lint && npm run typecheck && npm run test && npm run test:e2e`
(Prettier check · ESLint, no warnings · `tsc -b` · Vitest · Playwright)

**Python ML (`ml/`):**
`uv run ruff format --check . && uv run ruff check . && uv run mypy . && uv run pytest`

## CI

- GitHub Actions has **one workflow per area**: `.github/workflows/frontend.yml` and
  `.github/workflows/ml.yml`. Both run **on pull requests only** (plus
  `workflow_dispatch`), never on `push` to `main`, to save Actions minutes.
- Each has a workflow-level `paths:` filter, so only the lanes a PR touches start.
  `ml` also runs when `frontend/src/recognition/fixtures/` changes, because the parity
  tests read the shared golden vectors.
- Docs-only changes (`docs/`, `logs/`, `graphify-out/`, `.claude/`, `*.md`) start no CI.
- Keep ML tests on tiny fixtures. `gh pr checks` lists only the checks that started.

## Writing issues

- **Title:** imperative, one thing ("Add a streak to the learner home").
- **Body:** Context · Scope (In / Out) · Acceptance criteria (checkboxes) · Notes /
  Evidence. Use the templates in `.github/ISSUE_TEMPLATE/`.
- **Labels:** one type (`feature`, `bug`, `chore`, `docs`, `test`), plus `area:*`
  (`area:frontend`, `area:ml`, `area:learner`, `area:store`) where useful, plus
  `needs-decision` / `blocked` when relevant.

## Commits

- Clear, imperative messages: `<type>: <summary> (#<n>)`, naming the milestone where
  relevant (e.g. `feat: P6M8 streak on the learner home (#61)`).
- Keep the branch focused on its issue; avoid scope creep.
