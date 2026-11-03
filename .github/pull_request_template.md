Closes #<!-- the one issue this PR solves -->

## What changed
<!-- One or two sentences. Name the milestone if this is milestone work (e.g. "P6M8: progress & polish"). -->

## Why
<!-- The problem from the issue. -->

## How it was tested
<!-- New/changed tests, and manual checks (device, browser, camera, offline?). New behaviour needs a test that would fail without it. -->
- [ ] Frontend gate: `cd frontend && npm run format && npm run lint && npm run typecheck && npm run test && npm run test:e2e`
- [ ] ML gate (if `ml/` changed): `cd ml && uv run ruff format --check . && uv run ruff check . && uv run mypy . && uv run pytest`
- [ ] Normalization changed? Golden-vector fixtures regenerated and both sides pass

## Follow-ups filed
<!-- Out-of-scope bugs/gaps found while working, as new issues (#n). "None" is fine. -->

## Before merge
- [ ] This PR solves exactly one issue
- [ ] **Every CI check that started is green** (`gh pr checks --watch`). Never merge on pending or red. A docs-only PR starts no checks and may merge
- [ ] Today's `logs/YYYY-MM-DD.md` entry written (what / why / how)
- [ ] Knowledge graph refreshed in this PR: `graphify update .`, commit `graphify-out/` (never a separate follow-up PR)
- [ ] Architecture diagram: updated `docs/architecture/architecture-diagram.html`, **or** this PR didn't change the architecture (say so in the log entry)
- [ ] `docs/future.md` updated: completed items removed, newly found gaps added
- [ ] `.claude/progress.md` status updated if a milestone moved
