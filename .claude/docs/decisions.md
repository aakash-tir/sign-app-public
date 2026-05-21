# Decision Log (ADRs)

Lightweight Architecture Decision Records. Each entry: context → decision →
consequences. Status is one of `accepted`, `open`, `superseded`.

---

## ADR-001 — Sign language: ASL

- **Status:** accepted (confirmed by owner, 2026-05-20).
- **Context:** The product must target one sign language; datasets, models, and
  curriculum all depend on it.
- **Decision:** **American Sign Language (ASL)**.
- **Consequences:** Largest pool of public datasets (ASL Alphabet, WLASL) and
  pretrained references → lowest recognition risk. Other sign languages are
  out of scope (see non-goals).

## ADR-002 — Recognition: landmark-based, on-device

- **Status:** accepted.
- **Context:** Need to verify signs from the camera on Windows/Android/iOS/Linux,
  offline, privacy-preserving, low-latency, from one web codebase.
- **Decision:** **MediaPipe Tasks Vision** (hand/pose landmarks, on-device WASM)
  + a **small TF.js classifier** (MLP for static, GRU/LSTM for dynamic). *Not*
  an end-to-end RGB video model, and *not* a server-side recognizer.
- **Consequences:** Runs fully in-browser, no video leaves the device, works
  offline. Word-level accuracy is bounded by research SOTA → MVP scoped to
  fingerspelling + curated signs. See [`recognition.md`](recognition.md).

## ADR-003 — Delivery: PWA-first, single React + TS codebase

- **Status:** accepted (confirmed by owner, 2026-05-20).
- **Context:** Must reach Windows, Android, iOS, Linux from one codebase, with
  camera access.
- **Decision:** **PWA-first** — one React + TypeScript app (Vite +
  `vite-plugin-pwa`), installable on all four platforms; camera via
  `getUserMedia`.
- **Consequences:** Simplest true cross-platform path; HTTPS hosting required.
  Native wrappers (Capacitor/Tauri) explicitly deferred — can be added later over
  the same React code if a store presence or deeper native API is ever needed.

## ADR-004 — Python is build-time only (hybrid stack)

- **Status:** accepted (confirmed by owner, 2026-05-20).
- **Context:** The plan mandates `ruff format` and `mypy` (Python tools), but the
  runtime is a React app. Resolve the apparent contradiction.
- **Decision:** **Hybrid.** TypeScript/React for the runtime app; **Python only
  for the ML training & tooling pipeline** (`ml/`). `ruff` + `mypy` + `pytest`
  gate the Python; ESLint/Prettier + `tsc` + Vitest/Playwright gate the frontend.
  Recognition runs **on-device** (no Python in the request path).
- **Consequences:** Honors the plan's literal quality-gate instruction while
  keeping the runtime serverless and offline-capable. Two toolchains → monorepo
  with independent CI lanes.

## ADR-005 — Local-first persistence (IndexedDB)

- **Status:** accepted.
- **Context:** Word bank, buckets, and proficiency must persist; the app should
  work offline with no required account.
- **Decision:** **IndexedDB via Dexie**, no backend. Optional cloud sync is a
  future enhancement, not in initial scope.
- **Consequences:** Zero-backend, offline-first. Data is per-device until/unless
  sync is added.

## ADR-006 — Hosting: Cloudflare Pages

- **Status:** accepted (owner okayed Cloudflare, 2026-05-20). Set up in M7.
- **Context:** PWAs need HTTPS. The repo is private. *Private* GitHub Pages needs
  a paid GitHub plan (Pro/Team/Enterprise).
- **Decision:** **Cloudflare Pages** — free, HTTPS, builds and deploys from a
  private repo, global edge for fast asset delivery, per-PR preview deployments.
  Netlify/Vercel are equivalent fallbacks. Full explainer + setup steps in
  [`hosting.md`](hosting.md).
- **Consequences:** No paid plan needed; serverless static hosting matches the
  on-device design. We use only Pages (no Workers/D1) for now.

## ADR-007 — MVP recognition scope = fingerspelling + curated signs

- **Status:** accepted.
- **Context:** Large-vocabulary dynamic ASL recognition is research-grade
  (~75% top-1 on WLASL100; far lower on WLASL2000).
- **Decision:** MVP targets **static fingerspelling** (high accuracy) plus a
  **small curated set of dynamic signs**; broader vocabulary is a phased,
  accuracy-gated expansion (M6).
- **Consequences:** A genuinely usable product ships without solving research-hard
  recognition. UX safety valves ("I forgot" / "That's what I did") absorb residual
  recognition errors.

## ADR-008 — Practice attempt resolution: deferred commit (no revert)

- **Status:** accepted (owner, 2026-05-20).
- **Context:** "I forgot" counts as a **wrong** attempt, but "That's what I did"
  must override it to **correct**. A naive design applies the wrong-transition on
  "I forgot" and then *reverts* it on "That's what I did" — fragile, because it
  must snapshot and restore the prior bucket + streak.
- **Decision:** Model each prompted word as one **attempt** with a single terminal
  **outcome**. Apply **no** bucket change until the attempt resolves, then commit
  exactly one transition. "I forgot" only reveals the sign (pending); "That's what
  I did" sets the outcome to `correct`; advancing without it sets `wrong`.
- **Consequences:** No revert/undo logic and no prior-state snapshot; the outcome
  is a pure, easily-tested function of the attempt's events. Same observable
  behavior the owner asked for. See [`architecture.md`](architecture.md) §Attempt
  resolution model.

## ADR-009 — Levels & sentence gating

- **Status:** accepted (owner, 2026-05-20).
- **Context:** The plan says "if proficiency is good enough, use the sign in a
  sentence." Needed concrete level definitions and a concrete sentence-unlock rule.
- **Decision:**
  - **Levels:** Beginner = new, nothing known, learn from scratch one word at a
    time. Intermediate = knows some sign, basic conversation. Expert = expanding
    vocabulary, complex multi-topic conversation. Concrete vocab lists are M5
    content; the *behavior* is fixed.
  - **Per-word sentence eligibility:** a sign is usable in sentences once it
    reaches the **`confident`** bucket; sentences are composed **only** of
    confident words so they are always performable.
  - **Level gating of sentences:** Beginner = sentences **off** until the word
    bank holds **≥ 20 confident words**, then **small sentences (2–4 signs)** turn
    on. Intermediate/Expert = sentences **on from the start**.
  - **Seeding (Intermediate/Expert):** optional placement/self-assessment in M5
    lets users mark known signs as `confident`.
- **Consequences:** Sentence usage is well-defined and testable. The threshold
  (20) and beginner sentence length (2–4) are starting values, tunable in M5.

## ADR-010 — Level reassignment (non-destructive)

- **Status:** accepted (owner, 2026-05-20).
- **Context:** A user's initial level guess may be wrong; they need to move down
  (too hard) or up (too easy) without losing progress.
- **Decision:** Level is **reassignable up or down at any time** from settings,
  and the change is **non-destructive** — the word bank and all progress (buckets,
  proficiency) are preserved. Level only affects curriculum and sentence behavior.
  On change, sentence enablement is **recomputed** as
  `level ∈ {intermediate, expert}` **or** the `sentencesUnlocked` latch (set once
  confident-word count first ≥ 20). The app may *suggest* a level change from
  performance but never forces one.
- **Consequences:** Progress survives any level switch; sentence behavior follows
  the new level immediately; the beginner unlock is latched so it doesn't flap.
  Implemented in M5 (FR-13).

## ADR-011 — Static classifier: JSON-weights MLP, not TF.js (for the MVP)

- **Status:** accepted (2026-05-20). Refines ADR-002 for the static path.
- **Context:** The static fingerspelling classifier is tiny. Pulling in the full
  TensorFlow + tensorflowjs-converter toolchain (Python) plus a TF.js runtime
  (browser) is heavy and version-fragile.
- **Decision:** Train the static MLP with **scikit-learn** and export **plain
  JSON weights** (`format: "mlp-1"`); the frontend runs a small hand-written
  forward pass (dense → relu → softmax) with **no ML runtime dependency**. The
  model JSON is bundled for full offline use, and carries a `normalization` id the
  frontend asserts against (train/serve skew guard).
- **Consequences:** Tiny, zero-dependency, fully offline static recognition that
  avoids a fragile toolchain. **Dynamic** sequence models (M6) will revisit
  TF.js / onnxruntime-web, which suit larger recurrent models better.

## ADR-012 — Practice word bank = fingerspelling letters (MVP)

- **Status:** accepted (2026-05-20).
- **Context:** The spec's "word bank" holds words the user knows, shown one at a
  time to sign. But current recognition is per-letter fingerspelling (M2) — there
  is no multi-sign word recognition yet.
- **Decision:** For the MVP, the practice bank is seeded with the **24 static
  fingerspelling letters** the model knows (each letter is a practice item). The
  domain layer (buckets, selection) is word-agnostic.
- **Consequences:** Practice is fully usable now on letters; real words/glosses
  drop into the same bank once the dynamic recognizer lands (M6+), with no domain
  changes. **Routing** (React Router) landed in M5. In Learn mode the
  fingerspelling **"sentence" = a short word spelled letter-by-letter** from the
  user's confident letters (gated by ADR-009); real multi-sign sentences come
  with the dynamic recognizer.

---

## Open questions (non-blocking, revisit at the noted milestone)

| # | Question | Default assumption | Revisit |
| --- | --- | --- | --- |
| ~~Q1~~ | ~~Does pressing **"I forgot"** alone count as a *wrong* attempt?~~ | ✅ **Resolved:** yes (wrong); "That's what I did" overrides to correct, via deferred commit (ADR-008). | done |
| ~~Q2~~ | ~~"good enough" proficiency threshold to unlock sentence usage~~ | ✅ **Resolved:** sentence-eligible once `confident`; beginner sentences need ≥20 confident words (ADR-009). | done |
| ~~Q3~~ | ~~Mapping of signs → levels~~ | ✅ **Resolved:** level *behavior* fixed (ADR-009); concrete vocab lists are M5 content work. | done |
| ~~Q4~~ | ~~Final **hosting** provider (ADR-006).~~ | ✅ **Resolved:** Cloudflare Pages (ADR-006, [`hosting.md`](hosting.md)). | done |
| Q5 | Should dynamic-sign vocabulary expand past the curated set, and how far? | Gated on measured accuracy. | M6 |
