# Sign App — Project Guide

A cross-platform **PWA that teaches American Sign Language (ASL)** by having the
learner perform signs in front of their camera and getting automatic, on-device
feedback. Runs on Windows, Android, iOS, and Linux from one React + TypeScript
codebase; a Python pipeline (build-time only) trains the recognition model.

> **This file is the documentation hub. Read the linked docs before working.**

## Documentation map

| Doc | What's in it |
| --- | --- |
| [`project-context.md`](project-context.md) | **Product spec** — modes, levels, bucket rules, UX. The "what". |
| [`docs/architecture.md`](docs/architecture.md) | **Architecture** — tech stack, repo layout, data model, data flow, hosting. |
| [`docs/recognition.md`](docs/recognition.md) | **ASL recognition & ML pipeline** — MediaPipe + classifier, datasets, risks, research sources. |
| [`docs/milestones.md`](docs/milestones.md) | **Phase 1 milestone plan** — M0–M7 (complete), branches, acceptance criteria, tests. |
| [`docs/phase2.md`](docs/phase2.md) | **Phase 2 plan** — depth & polish milestones (P2M1–P2M5) after M0–M7. |
| [`docs/phase3.md`](docs/phase3.md) | **Phase 3 plan** — accuracy & vocabulary depth (P3M1–P3M3): honest eval, reviewed-dataset expansion toward ~50 signs, landmark-space augmentation. |
| [`docs/phase4.md`](docs/phase4.md) | **Phase 4 plan** — two tracks: **discovery** (P4M1: sign **search** tab, shipped) + **accuracy** (P4M2–P4M8: lift the 18 dynamic signs below the honest 0.50 gate). |
| [`docs/phase5.md`](docs/phase5.md) | **Phase 5 plan** — the **Sentences section** (P5M1–P5M3, shipped): dedicated tab, 59-sentence bank, persisted progress, level bands (ADR-028, FR-20). |
| [`docs/phase6.md`](docs/phase6.md) | **Phase 6 plan** — the **learner app** (P6M1–P6M9, ADR-029): syllabus + teach→recall over two paths, new learner-facing look, dev mode for today's tabs, store-first packaging. |
| [`docs/decisions.md`](docs/decisions.md) | **Decision log (ADRs)** + open questions. |
| [`docs/hosting.md`](docs/hosting.md) | **Hosting** — what Cloudflare Pages is and how we deploy. |
| [`progress.md`](progress.md) | **Live status** — which milestone we're on, what's done. |
| [`rules/`](rules/) | **Coding standards** — frontend, Python, and the issue → PR → CI workflow. |
| [`../plan.md`](../plan.md) | The owner's plan. **Now holds the Phase 6 learner-app plan** (reformatted 2026-07-10); earlier phase plans live in git history + these `.claude` docs. Phase-2 per-item analysis is in [`../docs/history/phase2-analysis.md`](../docs/history/phase2-analysis.md). |
| [`../docs/`](../docs/README.md) | **Human-readable walkthrough** (architecture, ML, runtime, deployment) + [`architecture/architecture-diagram.html`](../docs/architecture/architecture-diagram.html) + [`future.md`](../docs/future.md) (backlog). |
| [`../logs/`](../logs/) | **Dated change log** — one `YYYY-MM-DD.md` per day of changes (what / why / how). |

## The 60-second summary

- **Stack:** React + TypeScript + Vite + `vite-plugin-pwa` (runtime).
  **Python** (`uv`, MediaPipe, **scikit-learn** for the static MLP + **PyTorch**
  for the dynamic model) for training only — see ADR-004.
- **Recognition:** MediaPipe Tasks Vision extracts hand/pose landmarks **on-device**,
  then a classifier labels the sign: a **hand-written JSON-weights MLP** for static
  fingerspelling (ADR-011) and an **ONNX model via `onnxruntime-web`** for dynamic
  signs (ADR-015). No video leaves the device; works offline (ADR-002).
  *(No TensorFlow/TF.js anywhere — ADR-002's original "TF.js classifier" was
  superseded by ADR-011 + ADR-015.)*
- **Scope:** MVP = fingerspelling + curated common signs; broad word-level
  recognition is research-hard and phased/accuracy-gated (ADR-007).
- **Persistence:** local-first, IndexedDB via Dexie (ADR-005).

## Working agreement (from the plan — non-negotiable)

1. Work in **milestones**, each tracked as a **GitHub issue**; each issue is a
   **branch → PR → squash-merge** into `main` (full loop in
   [`rules/workflow.md`](rules/workflow.md)).
2. A milestone merges **only when all tests pass and all quality gates are green**:
   - Python (`ml/`): `ruff format` + `ruff check` + `mypy .` + `pytest`.
   - Frontend (`frontend/`): Prettier + ESLint + `tsc --noEmit` + Vitest + Playwright.
   CI is path-filtered and PR-only: every check that started must be green; a docs-only
   PR with no checks may merge (see [`rules/workflow.md`](rules/workflow.md) → CI).
3. Every milestone ships **tests proving its features work**.
4. Keep `.claude/` docs current — especially [`progress.md`](progress.md).
5. The repo is **private**.
6. **Stop and ask the owner** for any secret/credential/account-only item (API
   keys, hosting logins, paid sign-ups, dataset auth) — never invent or assume
   them. Explain how to obtain it if the owner doesn't know.

See [`rules/workflow.md`](rules/workflow.md) for the exact branch/PR/gate steps
and the secrets/credentials policy.

## Status

**Live:** Phases 1–5 + the Phase-6 learner shell (P6M1–P6M7) are merged and deployed on
Cloudflare (Workers Static Assets): **24 fingerspelling letters + 107 dynamic signs**,
the learner app (`/` home, `/course` words, `/course/alphabet`, `/sentences`,
`/search`), and the dev tabs (`/practice`, `/learn`, `/signs`, `/camera`) behind
**Settings → Developer mode**. The Phase-4 accuracy track
is closed: every lever was explored, and P4M8 SSL came out flat.

**Next:** owner review of the new look → **P6M8** (progress & polish) → **P6M9** (store
release, owner-gated). Open work lives in [`../docs/future.md`](../docs/future.md) and
GitHub issues.

The full, authoritative status, with per-milestone PR links and the running log, is in
[`progress.md`](progress.md). Per-day reasoning since 2026-11-03 is in `../logs/`.

## Git workflow (required)
`main` is protected by rule. The repo is private on GitHub Free, so server-side branch
protection is unavailable, and these rules plus the hook are the gate:
- **Never commit directly on `main`** and never merge into it locally. Changes reach
  `main` only by merging a GitHub PR (`gh pr merge --squash --delete-branch`), and
  only when its CI is green.
- Enforced locally by `.claude/hooks/protect-main.sh` (wired as a PreToolUse hook in
  `.claude/settings.json`), which denies `git commit`/`git merge`/`git push` against
  `main`. Create the branch in its own command *before* any commit.
- Workflow: branch → commit → push the branch → open a PR → merge the PR → pull `main`.
- **Merge one PR at a time.** PRs share the day's `logs/` file and `graphify-out/`, so
  a merge can leave other open PRs conflicting. Check `gh pr view <N> --json mergeable`.
  If it's `CONFLICTING`, run `git merge origin/main` (never rebase or force-push). Log
  entries combine on their own (`logs/*.md merge=union`). Take either side of
  `graphify-out/` and rerun `graphify update .`. Then re-run the gates and wait for CI.

## Issues, PRs and CI (required)
All development is driven by GitHub issues and lands through PRs gated by CI. The full
loop is in [`rules/workflow.md`](rules/workflow.md). Follow it in every session.
- **One issue = one thing**, one PR in size. A milestone (e.g. P6M8) is a GitHub
  milestone holding several issues.
- **One PR per issue.** Branch `<type>/<issue#>-<slug>`, PR body starts `Closes #<n>`.
- **Never merge unless every CI check that started is green**
  (`gh pr checks <pr> --watch`).
- **CI is lean on Actions minutes** (`.github/workflows/`): one workflow per area
  (`frontend`, `ml`), on pull requests only (plus `workflow_dispatch`), and only when
  a file that area depends on changed. Nothing runs on the merge to `main`. Docs-only
  PRs (`docs/`, `logs/`, `graphify-out/`, `*.md`, `.claude/`) run no CI and may merge
  without checks. Don't add a `push: main` trigger or a separate follow-up PR for docs
  or the graph: each one costs a CI run.
- **Out-of-scope bugs found mid-branch become new issues**, not fixes in the current PR.

## Before every PR merge (required)
Two artifacts must be kept current, together, **in the same PR** (no separate follow-up
PR: each one costs a CI run):
1. **Knowledge graph** — run `graphify update .` on the branch once the code is final
   and commit the refreshed `graphify-out/` to that PR. This is the only refresh:
   there are no graphify git hooks.
2. **Architecture diagram** — update `docs/architecture/architecture-diagram.html`
   whenever the merged PR changed the architecture: components, stages,
   data stores/collections, external services, flows, schedules, or
   retention rules. Use the `architecture-diagram` skill's MANUAL
   workflow (hand-placed layout per its design system) and verify the
   render with a headless-browser screenshot before committing —
   auto-generated output is a draft scaffold only. Docs-only or purely
   cosmetic merges don't need a diagram update, but say so in the
   changelog entry.

**Deploys are automatic:** Cloudflare (Workers Static Assets, the successor to Pages)
builds and deploys `main` on every merge (see [`../docs/deployment.md`](../docs/deployment.md)). After a merge that touches `frontend/`, verify
the live site serves the change. Don't assume it does.

## Backlog (required)
All future work — bugs, known gaps, feature ideas, scaling items — is recorded in
`docs/future.md` (dated bullet under the matching section). When you find or defer an
issue, add it there; when one is COMPLETE, remove it — `logs/` and the PR history are
the record of finished work (no Done section). Scheduled work is a GitHub issue, not a
`future.md` bullet.

## Where things belong (required)
- `.claude/` — everything Claude reads: `CLAUDE.md`, `project-context.md`,
  `progress.md`, `rules/`, `docs/` (the working notebook: plans, ADRs, recognition
  research), project agents and skills, settings and hooks.
- `docs/` (repo root) — everything a person reads: the explanatory walkthrough,
  `architecture/` (the diagram), `future.md`, `history/`, and later `plans/`,
  `research/`, `runbooks/`.
- `logs/` — the dated record (below).
- The repo root stays clean: only `CLAUDE.md`, `README.md`, `plan.md`, the two
  workspaces (`frontend/`, `ml/`), and `tools/`.

If Claude must load it to work correctly it goes in `.claude/`; if a person reads it to
understand or operate the project it goes in `docs/`. When both are true, the full
version lives in `docs/` and `.claude/CLAUDE.md` points at it.

## Change log (required)
Every day that content is added, there is exactly **one** log file: `logs/YYYY-MM-DD.md`.
Check whether today's file exists; create it if missing, append to it otherwise. Never a
file per change, never one growing log. A day with no changes has no file.

Each entry is a `##` heading naming what was done, followed by:
**What we did** · **The reason** (root cause, for fixes) · **How it was solved**.

Write the reasoning, not the diff — git already has the code. For a fix, include the
evidence that identified the root cause (traceback, version pin, timeline). Say
explicitly when a change was docs-only or cosmetic and needed no diagram update.

## Don't commit secrets
Keep `.env`, credentials, and tokens gitignored. Never hardcode API keys in source.
Dataset credentials (MS-ASL `cookies.txt`) stay outside the repo. See
[`rules/workflow.md`](rules/workflow.md) for the stop-and-ask policy.
