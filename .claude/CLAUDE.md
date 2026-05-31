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
| [`docs/decisions.md`](docs/decisions.md) | **Decision log (ADRs)** + open questions. |
| [`docs/hosting.md`](docs/hosting.md) | **Hosting** — what Cloudflare Pages is and how we deploy. |
| [`progress.md`](progress.md) | **Live status** — which milestone we're on, what's done. |
| [`rules/`](rules/) | **Coding standards** — frontend, Python, and git/CI workflow. |
| [`../plan.md`](../plan.md) | The owner's plan. **Now holds the Phase 2 plan**; per-item analysis is in [`../output.md`](../output.md). (M0–M7 intent lives in these `.claude` docs.) |

## The 60-second summary

- **Stack:** React + TypeScript + Vite + `vite-plugin-pwa` (runtime).
  **Python** (`uv`, MediaPipe, TF/Keras) for training only — see ADR-004.
- **Recognition:** MediaPipe Tasks Vision extracts hand/pose landmarks **on-device**,
  a small **TF.js** classifier labels the sign. No video leaves the device; works
  offline (ADR-002).
- **Scope:** MVP = fingerspelling + curated common signs; broad word-level
  recognition is research-hard and phased/accuracy-gated (ADR-007).
- **Persistence:** local-first, IndexedDB via Dexie (ADR-005).

## Working agreement (from the plan — non-negotiable)

1. Work in **milestones**; each milestone is a **branch → PR → squash-merge** into
   `main`.
2. A milestone merges **only when all tests pass and all quality gates are green**:
   - Python (`ml/`): `ruff format` + `ruff check` + `mypy .` + `pytest`.
   - Frontend (`frontend/`): Prettier + ESLint + `tsc --noEmit` + Vitest + Playwright.
3. Every milestone ships **tests proving its features work**.
4. Keep `.claude/` docs current — especially [`progress.md`](progress.md).
5. The repo is **private**.
6. **Stop and ask the owner** for any secret/credential/account-only item (API
   keys, hosting logins, paid sign-ups, dataset auth) — never invent or assume
   them. Explain how to obtain it if the owner doesn't know.

See [`rules/workflow.md`](rules/workflow.md) for the exact branch/PR/gate steps
and the secrets/credentials policy.

## Status

**Phase 1 (M0–M7) and Phase 2 (depth & polish) are both complete and deployed** —
the PWA is live on Cloudflare with 24 fingerspelling letters + 20 dynamic signs,
per-finger overlay option, a persistent shared camera, a redesigned UI, and offline
in-app sign references. See [`progress.md`](progress.md); Phase 2 detail in
[`docs/phase2.md`](docs/phase2.md).

**🚧 Phase 3 (accuracy & vocabulary depth) — P3M1, P3M2, P3M3 merged; P3M2c (vocab50)
done, PR pending.** The dynamic recognizer was grown to an **81-gloss MS-ASL ∪ WLASL
model** (P3M2c: 3583 samples / 163 signers) trained with P3M3 augmentation — honest
signer-disjoint CV **top-1 0.615**. The honest ≥ 0.50 gate ships **63 dynamic signs**
(up from 20: all 20 retained + 43 new incl. `thank you`), alongside 24 fingerspelling
letters. ONNX 315 KB. Detail: [`docs/recognition.md`](docs/recognition.md) §6.6.

**▶ Active next task: land P3M2c — run all gates (ml + frontend), open the PR for
`milestone/P3M2c-vocab50`, squash-merge, and verify the live Cloudflare deploy** (compare
live `model.onnx` sha256 to local; check content, not status codes). MS-ASL fetch
mechanics + the ffmpeg-on-PATH fix are in memory `msasl-download-setup`.

**Parked for the future** (no work in progress): real multi-sign Learn sentences
beyond the shipped drill (ADR-012); continuous-sign data for sentence content.
