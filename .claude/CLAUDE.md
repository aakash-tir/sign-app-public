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

**Phases 1–4 are complete/paused and deployed** — the PWA is live on Cloudflare with
**24 fingerspelling letters + 71 dynamic signs**, a per-finger overlay option, a
persistent shared camera, a redesigned UI, offline in-app sign references, and a **Search
tab**. See [`progress.md`](progress.md); Phase 2 detail in [`docs/phase2.md`](docs/phase2.md).

**✅ Phase 3 (accuracy & vocabulary depth) — all merged + deployed.** Grew the dynamic
recognizer to an **81-gloss MS-ASL ∪ WLASL model** (3583 samples / 163 signers); the
honest ≥ 0.50 gate shipped 63 signs at honest top-1 0.615. *(Superseded by Phase 4 —
now 71 signs at 0.687.)* MS-ASL fetch mechanics are in memory `msasl-download-setup`.

**✅ Phase 4 — discovery shipped; accuracy track substantially done and PAUSED
(2026-06-02).** Detail in [`docs/phase4.md`](docs/phase4.md); §6.7–6.11 in
[`docs/recognition.md`](docs/recognition.md).

- **Discovery — P4M1 Search tab** ([#26](https://github.com/aakash-tir/sign-app/pull/26)):
  type a sign → reference animation + a camera that recognizes it, else "not in the system
  yet". Exact + synonym match over the shipped signs; reuses `DynamicSignStage` +
  `SignReferencePlayer` (ADR-021, FR-19).
- **Accuracy track (P4M2–P4M7).** **The recognizer went 0.615 → 0.687 honest top-1, 63 →
  71 shipped signs, plus per-sign calibrated acceptance — all live.**
  - **P4M5 — the win** ([#29](https://github.com/aakash-tir/sign-app/pull/29)):
    **bidirectional GRU + masked attention pooling** (read the whole sign, not just the
    last timestep) → **0.687**, 71 signs. ONNX 690 KB. ADR-024, §6.9.
  - **P4M7 — runtime confidence** ([#30](https://github.com/aakash-tir/sign-app/pull/30)):
    per-sign acceptance thresholds + temperature calibration (T=1.6) + 3-window voting; no
    retrain. ADR-025, §6.10.
  - **P4M2 diagnose** ([#27](https://github.com/aakash-tir/sign-app/pull/27)): the 18 low
    signs are **under-separated, not data-starved** — which is why the modeling lever
    (P4M5) won and the cheap data/loss tweaks didn't. §6.7.
  - **P4M4 motion** ([#28](https://github.com/aakash-tir/sign-app/pull/28)) and **P4M3
    mirroring + class-weighted loss** ([#31](https://github.com/aakash-tir/sign-app/pull/31)):
    both **tested, honest-negative, not shipped** — kept as opt-in tooling. (P4M3 notably
    *proved* mirroring is parity-correct, refuting the P3M3 deferral.) ADR-022/023, §6.8/6.11.

**▶ No active task — accuracy track paused; owner to decide whether to take the P4M8
(self-supervised pretraining) big swing later.** Remaining/parked: **P4M8** SSL pretrain
(the last big lever, uncertain payoff at this data scale); **P4M6** targeted data
(low-value — data isn't the bottleneck); real multi-sign Learn sentences (ADR-012);
fingerspelling/spell-unknown search fallback + fuzzy ranking (P4M1 deferrals).
