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
**24 fingerspelling letters + 103 dynamic signs**, a per-finger overlay option, a
persistent shared camera, a redesigned UI, offline in-app sign references, and a **Search
tab** (typo/stem-tolerant with a fingerspelling fallback + as-you-type autocomplete, P4M9/P4M11). See
[`progress.md`](progress.md); Phase 2 detail in [`docs/phase2.md`](docs/phase2.md).

**✅ Phase 3 (accuracy & vocabulary depth) — all merged + deployed.** Grew the dynamic
recognizer to an **81-gloss MS-ASL ∪ WLASL model** (3583 samples / 163 signers); the
honest ≥ 0.50 gate shipped 63 signs at honest top-1 0.615. *(Superseded by Phase 4 —
now 71 signs at 0.687.)* MS-ASL fetch mechanics are in memory `msasl-download-setup`.

**✅ Phase 4 — discovery shipped; accuracy track ongoing.** Detail in
[`docs/phase4.md`](docs/phase4.md); §6.7–6.15 in [`docs/recognition.md`](docs/recognition.md).

- **Discovery — P4M1 Search tab** ([#26](https://github.com/aakash-tir/sign-app/pull/26))
  + **P4M9 search UX** ([#33](https://github.com/aakash-tir/sign-app/pull/33)):
  type a sign → reference animation + a camera that recognizes it, else "not in the system
  yet". Exact + synonym + **stem + typo-tolerant suggestions**, with a **fingerspelling
  fallback** for spellable misses; reuses `DynamicSignStage` + `SignReferencePlayer`
  (ADR-021, FR-19). P4M9 resolved the P4M1 fuzzy/fingerspell deferrals (frontend-only).
  **P4M11 search autocomplete** adds an as-you-type ranked combobox dropdown (pure
  `autocomplete()` ranker: prefix → substring → fuzzy; keyboard-navigable), resolving
  the last P4M9 deferral (frontend-only).
- **Accuracy + vocabulary track (P4M2–P4M17).** **The recognizer grew from 63 → 103
  shipped signs with per-sign calibrated acceptance — all live.** (Aggregate honest CV
  peaked at 0.732 over the 81-class model; it's 0.691 over the current 114-class model —
  more classes are a harder task, not a regression.)
  - **P4M17 — drop the 3 confusers** ([#42](https://github.com/aakash-tir/sign-app/pull/42)):
    P4M16's new `dance`/`paper`/`slow` were stealing probability mass from shipped signs.
    Dropping them as *trained* classes (→ **114 classes, 103 published**) restored
    `stand` 0.47→0.63 and `car` 0.43→0.57; `school` 0.42→0.49 (improved, kept — grandfathered).
    No new demotions. Re-calibrated **T=0.80**. ADR-019 gate, §6.15.
  - **P4M16 — MS-ASL download → 100+ signs**: fetched 36 everyday glosses, trained a
    117-gloss model; the honest gate cleared 27 new → **79 + 27 = 106 published signs**
    (aggregate 0.696 over 117; the original 79 hold at 0.718; no demotions). Needed a
    download fix first (yt-dlp-ejs + Deno for YouTube's n-challenge, [#40](https://github.com/aakash-tir/sign-app/pull/40)). §6.14, docs/reaching-100-signs.md.
  - **P4M10 — label smoothing** ([#34](https://github.com/aakash-tir/sign-app/pull/34)): a label-smoothing loss (0.15)
    lifted honest CV **0.687 → 0.732**, **71 → 79 signs, no demotions** (`hungry` recovers).
    Loss-only, no runtime/spec/size change. ADR-027, §6.12.
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

- **P4M8 — SSL pretraining: tested, honest-negative, NOT shipped** (2026-06-29, ADR-026,
  §6.16): the last/heaviest lever. Built the full masked-pose mechanism (pretrain the **same**
  BiGRU encoder, no arch swap) + extracted the **full on-disk pool (15,811 seq / ~2,200
  glosses)**. A strict pretrain↔eval signer holdout collapses the pool to 376 clips, so ran the
  **optimistic upper bound** (full pool): **0.689 vs 0.691 baseline — flat, the ceiling → shelve.**
  Tooling kept opt-in. **This closes the Phase-4 accuracy track** — every lever explored.

**▶ No active task — P4M11 (search autocomplete) merged ([#45](https://github.com/aakash-tir/sign-app/pull/45))
+ deployed, resolving the last P4M9 deferral (frontend-only). P4M8 tested-negative closed the
accuracy track.**
Remaining/parked: push `school` back over 0.50 (find its new confuser via `diagnose`, then
drop/fetch — low priority, it's published); **P4M6** targeted data (low-value — data isn't the
bottleneck); real multi-sign Learn sentences (ADR-012).
