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

## ADR-013 — Dynamic landmark stack: MediaPipe HolisticLandmarker

- **Status:** accepted (owner-scoped for M6, 2026-05-20). Extends ADR-002 for the
  dynamic path.
- **Context:** Dynamic word-level signs need **body pose + both hands** over time,
  not just one hand's landmarks. The new `@mediapipe/tasks-vision` API offers two
  ways to get this: a single **HolisticLandmarker** (pose + hands + face) or
  manually combining a **PoseLandmarker** with **HandLandmarker(s)**. The legacy
  `@mediapipe/holistic` solution is deprecated and not part of the Tasks API.
- **Decision:** use the Tasks-Vision **HolisticLandmarker** — one model, one
  inference, consistent topology across pose + hands, and the same topology is
  available in Python for extraction. Face landmarks are captured but unused for
  now (sign meaning here is hands + pose + motion).
- **Consequences:** simpler runtime than wiring multiple landmarkers; one place to
  cache for offline. The **normalization spec** ([`recognition.md`](recognition.md)
  §5) is extended for the dynamic case (pose **shoulder-centered**, per-frame hand
  normalization, motion representation) and **frozen with new golden vectors in
  M6.1** before any training. If HolisticLandmarker proves too slow on low-end
  mobile, falling back to Pose+Hand landmarkers is possible without changing the
  normalization spec.

## ADR-014 — Dynamic dataset & vocabulary strategy

- **Status:** accepted (owner, 2026-05-20).
- **Context:** M6 needs dynamic-sign training data. **WLASL** (2,000 glosses,
  ~21k clips) is the standard set. Three sourcing options were weighed: (a) the
  *official* WLASL (a list of video URLs the user downloads — heavy **link rot**
  today); (b) a **Kaggle mirror** that hosts the actual clips; (c) a **pre-encoded
  landmark** version (landmarks already extracted). Vocabulary ambition ranged from
  a small curated set to the full WLASL100.
- **Decision:**
  - **Source:** a **Kaggle WLASL mirror** (hosts real clips → avoids link rot),
    with **our own MediaPipe extraction** rather than pre-encoded landmarks — so
    the landmark topology + normalization stay under our **golden-vector parity
    guarantee** (no train/serve skew). The owner already has a Kaggle account
    (used for the M2 ASL-Alphabet download).
  - **Vocabulary:** a **small curated starter of ~15–25 high-frequency signs**,
    **accuracy-gated**, then expand — not the full WLASL100 up front. Cheaper
    extraction, a usable slice sooner, and it honestly confronts the accuracy
    ceiling on a small set first.
  - **Provisional starter candidates** (to be confirmed against WLASL coverage +
    accuracy in M6.2/M6.4): HELLO, THANK-YOU, PLEASE, SORRY, YES, NO, GOOD, BAD,
    NAME, LEARN, HELP, EAT, DRINK, MORE, FINISH, WANT, LIKE, LOVE, FAMILY, FRIEND,
    HAPPY, SAD, GO, COME.
- **Consequences:** download + extraction compute is an **owner action** (flagged
  per [`../rules/workflow.md`](workflow.md), not assumed); dataset + `ml/models/`
  stay **gitignored**. Self-collected landmark sequences remain a fallback/supplement
  if WLASL coverage or accuracy is poor for specific signs. Vocabulary expansion
  past the starter is **Q5**, resolved with measured accuracy in M6.4 (ADR-007).

## ADR-015 — Dynamic runtime: ONNX / onnxruntime-web, trained in PyTorch

- **Status:** accepted (2026-05-21). Complements ADR-011; this is the M6 branch of
  ADR-002 ("dynamic models will revisit TF.js / onnxruntime-web").
- **Context:** ADR-011 chose a zero-dependency JSON-weights MLP for the *static*
  classifier and deferred the dynamic runtime. A recurrent sequence model (GRU over
  ~30 frames) is not a good fit for a hand-written forward pass, so it needs a real
  runtime + a build-time converter. The first plan was TF.js — but it is
  **not installable on the owner's toolchain**: `tensorflowjs` depends on
  `tensorflow-decision-forests` (no Windows wheels) and pins `tensorflow`→
  `numpy<2.2`, which conflicts with the project's `numpy>=2.4.6` (TensorFlow itself
  has the same numpy conflict).
- **Decision:** train the dynamic model in **PyTorch** and export to **ONNX**
  (`torch.onnx`); the frontend runs it with **onnxruntime-web**. PyTorch coexists
  with numpy 2.x, installs on Windows + Python 3.13, and exports ONNX natively (no
  extra converter). The static path keeps its JSON-MLP runtime unchanged.
- **Consequences:** adds an onnxruntime-web runtime dependency (lazy-loaded +
  service-worker cached for offline). Two runtimes coexist — tiny hand-written MLP
  for static, onnxruntime-web for dynamic. The exported model emits **logits**
  (softmax applied at inference) and ships with a `metadata.json` skew guard
  (labels + normalization id + window/feature shape). Training deps live in an
  optional `train` extra (`torch`, `onnx`); they never gate CI.

## ADR-016 — MS-ASL usable for training under C-UDA (Phase 2 data)

- **Status:** accepted (owner + license check, 2026-05-21). Phase 2 / P2M5.
- **Context:** Phase 2 expands the dataset (plan item #1). MS-ASL (Microsoft,
  ~1000 signs / ~25k clips) is a candidate. The owner intends to use it **only to
  train the model** — no outside-source videos shipped in the app. We needed to
  confirm the license permits this.
- **Decision:** **Use MS-ASL for training only.** MS-ASL is released under the
  **Computational Use of Data Agreement (C-UDA v1.0)**, which is purpose-built for
  ML training: training is "Computational Use" (permitted), and a trained model is a
  **"Result"** that C-UDA places **no restriction** on using/distributing — so we
  can ship the model freely. C-UDA does **not** grant the right to redistribute the
  **source videos** (separate third-party/YouTube copyright); we never do that.
- **Consequences:** Train ✅, ship the model ✅, ship MS-ASL videos/frames ❌.
  MS-ASL ships as YouTube URLs + time segments → expect **link rot** (realized set
  smaller than headline). This is an informed reading, not legal advice; revisit
  with counsel before any commercial launch. The discovery lists the owner provided
  (`yayayru/sign-language-datasets`, the GitHub topic) are indexes — each dataset
  they point to is vetted individually before use. Sources:
  [C-UDA](https://github.com/microsoft/Computational-Use-of-Data-Agreement) ·
  [MS-ASL](https://www.microsoft.com/en-us/research/project/ms-asl/).

## ADR-017 — In-app sign reference rendered from landmarks (no external sites)

- **Status:** accepted (owner, 2026-05-21). Phase 2 / P2M4. **Supersedes** the
  M6.4 external-link approach.
- **Context:** M6.4 shipped sign reference as **external links** to signasl.org
  (`content/signReference.ts`). This sends users off the app and — worse —
  **breaks the offline guarantee** M7 delivered (external links fail with no
  network). Copyright-free ASL imagery is scarce, and dataset videos (WLASL, MS-ASL)
  carry their own redistribution terms.
- **Decision:** **Render teaching visuals from landmark data** — animated landmark
  playback for dynamic signs, stills/arrows for static — instead of sourcing or
  linking external media. Prefer landmarks **we fully control** (authored reference
  poses / our own captures) over dataset-derived landmarks, to keep the content
  unambiguously ours.
- **Consequences:** Teaching content becomes **owned, offline-capable, and visually
  consistent** with the live tracker (target and attempt look alike). Removes the
  external dependency and restores offline correctness. Replaces `signReference.ts`
  external links. Avoids the licensing question entirely for in-app media (related:
  ADR-016 keeps MS-ASL to training only).

---

## Open questions (non-blocking, revisit at the noted milestone)

| # | Question | Default assumption | Revisit |
| --- | --- | --- | --- |
| ~~Q1~~ | ~~Does pressing **"I forgot"** alone count as a *wrong* attempt?~~ | ✅ **Resolved:** yes (wrong); "That's what I did" overrides to correct, via deferred commit (ADR-008). | done |
| ~~Q2~~ | ~~"good enough" proficiency threshold to unlock sentence usage~~ | ✅ **Resolved:** sentence-eligible once `confident`; beginner sentences need ≥20 confident words (ADR-009). | done |
| ~~Q3~~ | ~~Mapping of signs → levels~~ | ✅ **Resolved:** level *behavior* fixed (ADR-009); concrete vocab lists are M5 content work. | done |
| ~~Q4~~ | ~~Final **hosting** provider (ADR-006).~~ | ✅ **Resolved:** Cloudflare Pages (ADR-006, [`hosting.md`](hosting.md)). | done |
| ~~Q5~~ | ~~Should dynamic-sign vocabulary expand past the curated starter, and how far?~~ | ✅ **Resolved (2026-05-21):** stay at the **curated 20-sign starter** for now — accuracy is data-limited for these signs (≈193 local clips; the rest are WLASL link-rot) and expanding to WLASL100 would lower per-class accuracy. Expansion deferred until more data is available; M6.4 documents accuracy via cross-validation and gates the ship list. | done |
