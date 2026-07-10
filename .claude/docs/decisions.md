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

- **Status:** accepted — **but the classifier runtime below is superseded**: the
  static path became a JSON-weights MLP (**ADR-011**) and the dynamic path became
  ONNX / `onnxruntime-web` trained in PyTorch (**ADR-015**). **No TF.js or
  TensorFlow ships or trains today.** The landmark-based, on-device *principle* —
  which is what this ADR is really about — stands unchanged.
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
- **Follow-on done (P2M7):** real **multi-sign sentences** shipped as a Learn
  **"Sign sentences"** drill — short sequences of the user's confident dynamic
  signs, prompted one at a time and verified by the recognizer (or "That's what I
  did"), gated by ADR-009 like the spell drill. Framed as a sequencing exercise
  ("sign these words in order"), **not** a claim of full ASL grammar; the content
  (`content/signSentences.ts`) is small, conservative, and owner-reviewable. The
  letter-spelled "Spell words" drill remains alongside it. *(Superseded in Phase 5
  by the dedicated **Sentences** section — ADR-028; the in-Learn drill was removed.)*

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
- **Implemented (P2M4):** `ml/.../reference_export.py` extracts **one representative
  WLASL clip per shipped gloss** → raw pose+hand x,y frames →
  `frontend/public/reference/<gloss>.json` (precached for offline). `SignReferencePlayer`
  loops them via the same `drawHolistic` overlay. **Source note:** lacking a way to
  self-capture, the reference uses **WLASL-derived landmark skeletons** (not the
  source video) — abstract derived data consistent with the computational-use
  framing of ADR-016. Letters keep their existing in-app `LETTER_HINTS` text (they
  never used the external link).

## ADR-018 — Shared app-level camera (supersedes "release on unmount") for Phase 2

- **Status:** accepted (Phase 2 / P2M2, 2026-05-22). **Supersedes** the
  frontend rule "always release the camera on unmount"
  ([`../rules/frontend/react.md`](../rules/frontend/react.md)).
- **Context:** Each view owned its own `MediaStream` via `useCamera`, which
  released it on unmount (per the original rule). Because the camera views are
  separate routes, **switching tabs tore down and re-acquired the camera**, forcing
  the user to click "Enable camera" again on every view (owner's plan item #3). The
  browser already persists the camera *permission*; the friction was our per-view
  acquire/teardown, not the OS prompt.
- **Decision:** Hoist the camera to a single **`CameraProvider`** mounted **above
  the router**, owning one shared `MediaStream` + status. `useCamera` becomes a thin
  **adapter** that attaches the shared stream to the current view's `<video>` and
  exposes the shared status/controls — it **no longer calls `getUserMedia` and no
  longer stops the camera on unmount**. The stream therefore survives view switches.
  A **one-time privacy explainer** ("video never leaves your device") is shown before
  the first acquire and remembered (`profile.cameraExplainerSeen`). Manual
  enable/disable stays available in each camera view.
- **Consequences:** No re-enable on tab switch (FR-15). The camera stays on across
  routes until the user stops it (or closes the tab) — a deliberate trade for fewer
  prompts. The "release on unmount" rule is replaced by "**the provider owns the
  camera lifecycle; views attach/detach but never stop it**." **Follow-up done
  (P2M6):** the provider now releases the tracks on `visibilitychange`→hidden and
  re-acquires silently on return (battery/privacy; status stays `on`, permission
  persists so no re-prompt). Auto-resume across full reloads is still intentionally
  not done (no auto camera-on at app launch).

## ADR-019 — Accuracy gated on signer-disjoint splits (real-camera holdout optional)

- **Status:** accepted (owner, 2026-05-24). Phase 3 / P3M1. Refines ADR-007's
  accuracy-gating posture.
- **Context:** The dynamic ship gate runs on **stratified k-fold CV**
  (`stratified_folds` / `cross_validate` in `dynamic_model.py`), which splits
  **clips** — so the same signer lands in both train and test and **inflates**
  held-out accuracy (the headline ≈62% top-1 / ≈95% top-5). P2M5a already built the
  fix, `assign_signer_disjoint_splits` (`ingest.py`), but it is used only for
  *reporting*, not for *gating*. A separate question is **real-camera domain shift**
  (dataset conditions → the user's actual webcam), which no held-out dataset clip can
  fully capture.
- **Decision:** Make **signer-disjoint splits the default evaluation and the per-gloss
  ship gate** (not stratified-clip CV) — i.e. hold out **whole signers' clips** for
  testing, never random clips (random holdout re-introduces the leakage). Once MS-ASL
  is in, **prefer held-out MS-ASL signers** as the most realistic proxy — YouTube "in
  the wild" footage is closer to real use than WLASL's studio-ish clips. A
  **real-camera holdout** (self-recorded clips) is the *ideal* domain-shift check but
  is **optional and deferred** — the owner can't record clips yet, so it is **not
  required to ship** Phase 3. If/when clips exist, a harness scores them through the
  same `dynamic_extract` + frozen `dynamicNormalization` (`pose-shoulder-hands-v1`,
  161-d) and **skips cleanly when none are present**. Stratified CV is retained for
  comparison/reporting only.
- **Consequences:** The honest gate number will read **lower** than the stratified
  figure — that is the point; it predicts real use better. **Supersedes stratified-clip
  CV as the gate.** Because the gate is dataset-held-out (not the user's camera) it
  remains an **optimistic ceiling** for live accuracy; the optional real-camera
  holdout, added later, is what would close that uncertainty. Lands in **P3M1**; the
  new (lower) baseline is documented in [`recognition.md`](recognition.md) §6 and
  becomes the Phase-3 starting line.

## ADR-020 — Data augmentation in landmark space, not pixel/video space

- **Status:** accepted (owner, 2026-05-24). Phase 3 / P3M3. Refines ADR-002/ADR-013
  (landmark-based recognition).
- **Context:** The Phase-3 plan proposed *"apply modifiers like blur"* to the data.
  But recognition is **landmark-based**: MediaPipe extracts landmarks and
  `dynamicNormalization` removes scale/position, so **pixel-space augmentation
  (blur/brightness/color) is nearly invisible to the model** — and heavy blur actually
  *degrades* MediaPipe detection (uncontrolled landmark noise) while costing a full
  re-extraction per augmented video. The model **already** augments in landmark space:
  `augment_sequences` (`dynamic_model.py`) applies spatial noise (σ=0.01), random scale
  (0.9–1.1), and whole-frame dropout (0.1), preserving the trailing presence flags.
- **Decision:** Apply **all augmentation in landmark space** by extending
  `augment_sequences` — **temporal warp/resample, window/time-shift jitter, per-landmark
  dropout & jitter, small planar rotation, and handedness-aware horizontal mirroring**
  (mirroring must **swap the left/right hand feature blocks**, not merely negate x, and
  is gated behind a **per-gloss `handedness_agnostic` flag**, default off). **Pixel/video
  modifiers such as blur are explicitly out of scope.** Augmentation stays **train-time
  only**; the frozen normalization spec and golden vectors are untouched, and the
  presence flags (last two features) are preserved.
- **Consequences:** Cheaper (no video re-processing), controlled, and applied where the
  model can actually see it. Each modifier is **accepted/rejected on the ADR-019
  signer-disjoint gate** (and the real-camera holdout if/when it exists), not on
  stratified CV — augmentation that only helps stratified CV is rejected. Lands in
  **P3M3**; results documented in [`recognition.md`](recognition.md) §6.
- **Implemented (P3M3, 2026-05-24):** shipped three primitives in `dynamic_model.py`
  — `drop_landmarks` (per-joint dropout), `rotate_xy` (in-plane rotation), `time_warp`
  (end-anchored speed), all **opt-in, default off** (`augment_sequences` knobs +
  `crossval --aug`), so plain training is unchanged until tuned on P3M2 data. Prototype
  on the starter-20 signer-disjoint gate: **top-1 0.570 → 0.601** (top-5 ~flat).
  **Mirroring and time-shift were deferred**, refining this ADR: the hand normalization
  already collapses handedness (a correct mirror needs paired pose-landmark swaps +
  per-hand re-canonicalization → train/serve skew risk), and front-padded windows read
  at the last GRU timestep make naive time-shift corrupt the final frame. So Q9's
  per-gloss `handedness_agnostic` flags stay deferred too — revisit both only if a real
  need + the holdout justify the skew risk.

---

## ADR-021 — Sign search resolves against the shipped dynamic vocabulary only

- **Status:** accepted (owner, 2026-06-01). Phase 4 / P4M1 (FR-19). Builds on ADR-017
  (in-app reference from landmarks) + the M6.3 dynamic recognizer.
- **Context:** With 63 dynamic signs now shipped, a single dropdown is a poor way to
  reach a specific sign. The feature: type a sign → if it exists, show how to sign it +
  a camera that recognizes it; else say it isn't in the system yet. Two scope forks:
  (a) what counts as "in the database" — dynamic signs, fingerspelling letters, or both;
  (b) how a query matches — exact, synonym-aware, or fuzzy.
- **Decision:** Resolve search against the **shipped dynamic signs only**
  (`SHIPPED_GLOSSES`), matched by **normalize-then-synonym lookup** (lowercase, collapse
  whitespace, map common synonyms onto a shipped gloss, then exact membership). A match
  reuses the existing `SignReferencePlayer` (ADR-017) + `useDynamicSignRecognition`
  (M6.3) with the target locked to the matched gloss; a miss shows a plain
  "not in the system yet" message. **No model or data work.**
- **Consequences:** Zero recognition/ML cost — every shipped gloss already has a
  reference clip + recognizer + acceptance. Fingerspelling letters (static MLP, text
  hints, no animation) and inexact variants (`walking`, typos) report not-found. The
  frontend `SIGN_SYNONYMS` map mirrors the ingest layer's `canonical_label` synonyms so
  both speak one vocabulary; an invariant test asserts every synonym target is shipped.
- **Deferred (explicit):** fingerspelling-letter search + spell-an-unknown-word
  fallback (would reuse the Learn spell flow), and fuzzy/typo-tolerant ranking with
  autocomplete suggestions. Natural P4 follow-ups if the owner wants them.
- **Update (P4M9, 2026-06-15):** the two deferrals above are now **resolved**, still
  with **no model/data work**. (1) **Typo- + morphology-tolerant matching** —
  `matchSign` now also resolves a morphological **stem** (`walking` → `walk`,
  `books` → `book`) as a confident `found`, and surfaces **"did you mean…"
  suggestions** (Levenshtein ≤ 1–2 by length + prefix match over the shipped glosses
  and synonym keys, deduped, top 3) for a near miss. (2) **Fingerspelling fallback**
  — a true miss that is a single alphabetic word whose letters are all in the static
  model (the ASL alphabet **minus J/Z**) offers a **spell-it-out** stage that reuses
  the unified recognizer in letter mode (new pure `fingerspellLetters` +
  `FingerspellStage`). Exact/synonym behaviour and the "not in the system yet"
  message are unchanged for genuinely-absent terms. Still **deferred:** multi-word
  fingerspelling and ranked autocomplete-as-you-type.

---

## ADR-022 — Motion (velocity) features: explored, kept opt-in (not shipped)

- **Status:** explored, **not shipped** (owner, 2026-06-01). Phase 4 accuracy track /
  P4M4. Builds on the frozen per-frame normalization (ADR-013) and the P4M2 diagnosis.
- **Outcome:** Motion features **regressed the honest gate** (0.615 → 0.594; recognition.md
  §6.8) — overfitting from doubling the input dim on a small set + tiny GRU. The shipped
  model stays **positions-only**; the runtime is unchanged. The capability below is
  **retained as an opt-in toolkit** (`with_motion`/`withMotion` + shared golden parity +
  `--motion` flag, default off) so **P4M5 can re-test motion with a better temporal model
  (attention)**. The metadata is motion-aware (`featureDim` + optional `features` id) only
  when a motion model is exported; the default/shipped metadata is the 161-d contract.
- **Context:** The P4M2 diagnosis showed the 18 low signs are **under-separated**, not
  data-starved — the GRU sees **positions only** (the frozen 161-d frame), and motion
  dynamics are the documented discriminator for visually-similar signs (recognition.md
  §6.7/§6.8). The fix is to add velocity, but the frame feature vector is a **frozen,
  golden-vector-guarded** contract shared with the TS runtime — changing it risks
  train/serve skew.
- **Decision:** Append **per-frame velocity** (first difference of the spatial coords)
  to each window as a **sequence-level transform** applied identically on both sides
  (`with_motion` / `withMotion`), turning the model input from **161 → 320** dims
  (positions + velocity; the 2 presence flags are carried through, never differenced).
  Velocity is **zero on the first frame and across inactive (all-zero) frames** so the
  front-padding→first-real boundary injects no spurious spike (both sides front-pad to
  `WINDOW_SIZE` identically). **Per-frame normalization (`pose-shoulder-hands-v1`) and
  its golden fixture are unchanged;** a **new feature id `pose-shoulder-hands-motion-v1`**
  + `featureDim = 320` are recorded in the model metadata, and the runtime skew guard
  rejects a no-motion model. A **new shared golden fixture** (`dynamic-motion.golden.json`)
  is the parity contract for `with_motion`.
- **Consequences:** Build-time feature engineering on the cached landmarks (no
  re-extraction) + a small runtime transform before inference; the GRU input layer grows
  but the ONNX stays well within the on-device budget. Motion is on by default for the
  shipped model; `--no-motion` keeps a positions-only path for comparison. Accuracy
  delta + re-gate documented in recognition.md §6.8.

---

## ADR-023 — Mirroring + class-weighted loss: feasible/tested, not shipped

- **Status:** explored, **not shipped** (owner, 2026-06-02). Phase 4 / P4M3. Resolves the
  ADR-020 mirroring deferral.
- **Context:** P3M3 deferred horizontal mirroring assuming it was skew-prone under the
  handedness-collapsing hand normalization. P4M3 targeted the 10 remaining below-gate
  signs with mirroring + class-weighted loss.
- **Finding:** Mirroring **is** feasible and parity-correct — derived exactly: because the
  hand normalization is handedness-**canonical**, a mirror of a normalized frame is
  pose-pair-swap + negate-x, **swap the two hand blocks (no internal change)**, swap
  presence (unit-test-proven against normalizing a flipped capture). But on the honest
  signer-disjoint gate **neither lever helps**: mirror 0.669, class-weight 0.674,
  both 0.661 — all below the shipped **0.687** (recognition.md §6.11). Class-weight only
  *reshuffles* the tail (same 71-sign count; promotes the hardest signs but demotes 6
  currently-shipped ones at lower aggregate). Mirroring likely adds label-inconsistent
  examples for side-meaningful signs.
- **Decision:** Do **not** ship; the model stays the P4M5 BiGRU+attention (0.687, 71
  signs). Both are **kept as opt-in, tested tooling** (`--mirror`, `--class-weight`,
  default off) for future use on a larger/more-imbalanced dataset. No model/runtime change.

---

## ADR-024 — Temporal model: bidirectional GRU + masked attention pooling

- **Status:** accepted + **shipped** (owner, 2026-06-02). Phase 4 accuracy track / P4M5.
  Supersedes the M6 last-timestep read; builds on the P4M2 diagnosis.
- **Context:** The shipped GRU classified from its **last timestep**, compressing the
  whole sign into one state — and the P4M2 diagnosis found the low signs are
  **under-separated** (errors spread, not data-starved). The fix is to let the model read
  the **entire trajectory**.
- **Decision:** Reduce the GRU output sequence with **learned attention pooling** (a
  weighted sum over timesteps) instead of the last timestep, and run the GRU
  **bidirectionally**. Pooling **masks front-padding frames** (an all-zero input frame is
  padding) so the warm-up region can't dilute the context — train and serve front-pad
  identically, so this is parity-safe. `pooling={last,mean,attention}` + `bidirectional`
  are options on `build_sequence_model` (default `last` = the old behavior); the shipped
  model is `attention` + `bidirectional`, **positions-only** (motion stays off, §6.8).
- **Consequences:** Honest signer-disjoint CV **0.615 → 0.687** (+7.2 pts), **71/81 signs
  ship** (was 63; +9 promoted, `hungry` demoted at 0.33 — documented). **No runtime/spec
  change** — same 30×161 input → 81 logits, `featureDim` 161, normalization id unchanged;
  only the model graph changed. ONNX grows 315 KB → **690 KB** (bidirectional doubles the
  GRU output dim) — within the ≤ ~1.5 MB on-device budget; verified to load + infer in
  onnxruntime. Detail: recognition.md §6.9.

---

## ADR-025 — Runtime confidence: per-sign thresholds + temperature + window voting

- **Status:** accepted + **shipped** (owner, 2026-06-02). Phase 4 accuracy track / P4M7.
  Refines the M6.4 per-sign `accepts` valve; no retrain.
- **Context:** Acceptance ("Good — that's X!") used a **global 0.5** probability bar, so a
  learner performing a weak sign correctly was often never accepted; the model is also
  over-confident (raw softmax), and single-window decisions are jittery. The honest gate
  can't measure felt UX, so these are validated by tests + reasoning.
- **Decision:** (1) **Per-sign acceptance thresholds** = 25th percentile of each sign's
  calibrated true-class probability on the honest held-out folds, clamped to
  `[0.15, 0.5]` — **capped at 0.5 so acceptance is never stricter than before** (weak
  signs only get *more* forgiving). (2) **Temperature scaling** — one scalar `T` fit by
  held-out NLL (shipped `T = 1.60`), applied in `softmax(logits, T)` for honest displayed
  confidence. (3) **Multi-window voting** — average the last 3 windows' probability
  vectors before deciding. Thresholds + temperature ride in `metadata.json`; voting is
  pure runtime.
- **Consequences:** More genuine attempts at weak signs get accepted; confidence numbers
  are honest; borderline signs are steadier. **No model/normalization/spec change** (same
  ONNX, `featureDim` 161); fully backward-compatible (absent metadata → `T = 1`, global
  0.5). The ship gate (which signs are in `SHIPPED_GLOSSES`) is unchanged — it stays the
  honest CV top-1 ≥ 0.50; only the **runtime acceptance** bar is per-sign. Detail:
  recognition.md §6.10.

---

## ADR-027 — Label-smoothing loss: shipped (the P4M10 win)

- **Status:** accepted + **shipped** (owner, 2026-06-15). Phase 4 accuracy track / P4M10.
  Builds on the P4M5 BiGRU+attention model and the P4M2 diagnosis.
- **Context:** The P4M2 diagnosis found the below-gate signs are **under-separated**, not
  data-starved. The P4M3/P4M4 cheap levers (mirroring, class weight, motion) all regressed
  the honest gate. The remaining cheap, capacity-free lever not yet tried was **label
  smoothing** — softening the one-hot target so the loss stops driving logits to extremes,
  a standard regulariser for diffuse/over-confident classifiers.
- **Decision:** Train the shipped model with a **label-smoothing factor of 0.15** (a sweep
  over {0.05, 0.10, 0.15} on the honest signer-disjoint gate picked 0.15 — best aggregate
  **and** top-5). Threaded through `cross_validate`/`train_and_eval`/`run_calibrate` and the
  CLI (`--label-smoothing`, default 0.0 = unchanged). The model is re-calibrated (P4M7) under
  the same loss.
- **Consequences:** Honest signer-disjoint CV **0.687 → 0.732** (+4.5 pts), **71 → 79 signs
  ship** (+8 promoted incl. `hungry`, which P4M5 had demoted; **no demotions** — incumbents
  `need`/`thank you` dip within noise and are retained per the P2M5b no-demote-on-noise
  precedent). **No runtime/spec/size change** — loss-only build-time change; same ONNX graph,
  161-d contract, normalization id, `onnxruntime-web` runtime. The two cheap levers that
  failed (P4M3) stay opt-in tooling; this one ships. Detail: recognition.md §6.12.

---

## ADR-026 — Self-supervised masked-pose pretraining: tested, **not shipped** (P4M8)

- **Status:** tested, **honest-negative, not shipped** (2026-06-29). Phase 4 accuracy
  track / P4M8 — the last and heaviest planned lever. Closes the accuracy track.
- **Context:** The remaining "big swing" after the P4M5 model win and P4M10 label
  smoothing was **self-supervised pretraining** — learn general pose-trajectory structure
  from the full unlabeled pool, then fine-tune, to help the under-separated tail (P4M2).
  A go/no-go inventory found the on-disk pool is **15,811 sequences / ~2,200 glosses**
  (~2–2.4× the 4,680-sample labeled set after realistic extraction; high gloss diversity
  but a **small, already-covered ~100-signer WLASL pool**).
- **Decision:** Build the mechanism but isolate the SSL variable — **masked-pose
  reconstruction** pretraining of the **same BiGRU encoder** (no architecture swap),
  warm-started into the classifier via `init_gru_state`. Measure on the **same honest
  signer-disjoint gate** (ADR-019) vs a seed-matched baseline. Because a strict
  pretrain↔eval signer holdout collapses the pool to 376 clips (the labeled set already
  spans WLASL's signers), first run an **optimistic upper bound** (pretrain on the full
  pool, eval signers' unlabeled poses included): if it can't beat baseline, the honest
  version (≤ optimistic) can't either.
- **Consequences:** Optimistic-SSL **0.689** vs baseline **0.691** (seed-matched, 5-fold
  signer-disjoint, BiGRU+attention+aug+ls0.15) — **flat, within noise**, and it's the
  ceiling, so **not shipped**; the deployed model stays the P4M17 114-class 0.691 model.
  Pretraining itself converged (val recon MSE 0.052) — the mechanism works, the data
  scale doesn't pay. Like P4M3/P4M4, the tooling is **kept opt-in, default off**
  (`pretrain` stage + `train`/`crossval --init-from`). No runtime/spec/model change.
  Detail: recognition.md §6.16.

---

## ADR-028 — The Sentences section: dedicated tab, persisted progress, level bands

- **Status:** accepted + shipped (owner-approved scope, 2026-07-01). Phase 5
  (P5M1–P5M3, [`phase5.md`](phase5.md)). Supersedes the P2M7 in-Learn drill
  (ADR-012 follow-on); delivers FR-6's "tracked" and FR-20.
- **Context:** The P2M7 drill was 8 hardcoded 2-sign sequences from the ~17-sign
  era, hidden as a conditional Learn tab, untracked, with raw `Math.random`
  selection in the component and no per-word reference. The vocabulary is now 103
  shipped signs — enough for real content.
- **Decision:**
  - **Dedicated top-level `/sentences` tab** (always visible; locked/empty states
    explain instead of hiding). The in-Learn drill is **removed** — the top-level
    tab sits next to Learn, so an internal link would be redundant.
  - **Content bank** (`content/signSentences.ts`): 59 conservative gloss-order
    sequences (17 × 2-sign, 29 × 3-sign, 13 × 4-sign), shipped-glosses-only
    (test-enforced); ids = joined
    glosses (stable, derivable). Still a **sequencing exercise**, not ASL grammar
    (reaffirms ADR-012's framing).
  - **Pure domain** (`domain/sentences.ts`): eligibility = every sign `confident`
    (ADR-009) ∩ **per-level length bands** — beginner 2–3, intermediate 2–4,
    expert 3–4 (starting values, tunable); selection = injected seedable RNG
    preferring **un-completed** sentences, recycling when all done.
  - **Persisted progress** (Dexie v3 `sentences` table via `SentenceRepo`):
    `{sentenceId, timesCompleted, lastCompletedAt}` — drives the freshness bias
    and a "N of M completed" line.
  - **Verification:** one sign at a time via the dynamic recognizer's per-sign
    calibrated acceptance (ADR-025), advancing on the **rising edge** of the
    accept flag (the raw flag would double-advance); "That's what I did" valve
    (ADR-008) as always.
- **Consequences:** Sentences are a first-class, resumable practice surface that
  scales with the vocabulary; content edits that change a sentence's signs reset
  that sentence's progress (accepted — ids stay derivable). No model/runtime
  change (frontend-only phase). Detail: [`phase5.md`](phase5.md).

---

## Open questions (non-blocking, revisit at the noted milestone)

| # | Question | Default assumption | Revisit |
| --- | --- | --- | --- |
| ~~Q1~~ | ~~Does pressing **"I forgot"** alone count as a *wrong* attempt?~~ | ✅ **Resolved:** yes (wrong); "That's what I did" overrides to correct, via deferred commit (ADR-008). | done |
| ~~Q2~~ | ~~"good enough" proficiency threshold to unlock sentence usage~~ | ✅ **Resolved:** sentence-eligible once `confident`; beginner sentences need ≥20 confident words (ADR-009). | done |
| ~~Q3~~ | ~~Mapping of signs → levels~~ | ✅ **Resolved:** level *behavior* fixed (ADR-009); concrete vocab lists are M5 content work. | done |
| ~~Q4~~ | ~~Final **hosting** provider (ADR-006).~~ | ✅ **Resolved:** Cloudflare Pages (ADR-006, [`hosting.md`](hosting.md)). | done |
| ~~Q5~~ | ~~Should dynamic-sign vocabulary expand past the curated starter, and how far?~~ | ✅ **Resolved (2026-05-21):** stay at the **curated 20-sign starter** for now — accuracy is data-limited for these signs (≈193 local clips; the rest are WLASL link-rot) and expanding to WLASL100 would lower per-class accuracy. Expansion deferred until more data is available; M6.4 documents accuracy via cross-validation and gates the ship list. *(Phase 3 now does the expansion — Q6.)* | done |
| ~~Q6~~ | ~~Phase-3 vocabulary policy + size~~ | ✅ **Resolved (2026-05-24):** let the **data floor pick** the ~50 (the Phase-3 target); broader expansion toward most everyday signs comes **later**, accuracy-gated. See [`phase3.md`](phase3.md). | done |
| ~~Q7~~ | ~~Per-gloss **data floor** for Phase-3 expansion~~ | ✅ **Resolved (2026-05-24):** eligible at **≥ 12 clips / ≥ 5 signers**; preferred **≥ 20 / ≥ 8**; the **signer-disjoint top-1 ≥ 0.50** gate (ADR-019) is the final arbiter. | done |
| ~~Q8~~ | ~~Record a **real-camera holdout** to make Phase 3 measurable?~~ | ✅ **Resolved (2026-05-24):** **deferred** — owner can't record clips yet. The **signer-disjoint dataset holdout** is the gate (free, no recording); a real-camera holdout is optional and can be added later (ADR-019). | done |
| ~~Q9~~ | ~~Handedness-agnostic **mirroring** flags — author now or defer?~~ | ✅ **Resolved (2026-05-24):** defer; mirroring ships off by default, per-gloss flags authored incrementally as it's enabled (P3M3, ADR-020). | done |
