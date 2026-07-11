# Phase 6 — the learner app

> The owner's plan is [`../../plan.md`](../../plan.md) (reformatted; all seven
> plan-shaping questions answered 2026-07-10). This doc is the **detailed
> milestone plan**. Live status: [`../progress.md`](../progress.md). Decisions:
> **ADR-029** in [`decisions.md`](decisions.md).

## 1. Goal

Turn the developer/testing frontend into the **actual user app**: a guided,
Duolingo-style learning experience — a **syllabus** plus a **teach → recall
loop** over two always-open paths (alphabet, words) — mobile-first, on web
**and in the app stores** (a native wrap of the same React/TS codebase).

Everything the recognizer stack already does is reused, not rebuilt: 24 static
letters + 103 dynamic signs with per-sign calibrated acceptance (ADR-025), the
stick-figure `SignReferencePlayer` (P2M4), the `FingerspellStage` (P4M9), the
bucket system + "That's what I did" valve (ADR-008/-009), and the Phase-5
sentence engine. This phase is **UX + curriculum + packaging**.

## 2. Locked decisions (plan.md §6, owner, 2026-07-10)

| # | Decision |
| --- | --- |
| Q1 | **Store-first**: native packaging (Capacitor-style wrap) is in scope this phase; web/PWA keeps working |
| Q2 | Today's tabs move **behind a dev mode** setting; the learner app becomes the default |
| Q3 | **Linear with review**: batches unlock in order; learned material stays reviewable; no skipping ahead |
| Q4 | **Extend the session buckets**: per-batch recall reps on the existing engine; no wall-clock SRS this phase |
| Q5 | The alphabet path teaches the **24 verifiable letters** — J and Z wait until the recognizer can check them |
| Q6 | Not-yet-recognized words hold **placeholder slots** in the route (no teach/verify/recall) until the owner adds them |
| Q7 | A **new learner-facing look** — fresh design language; the current tokens stay for the dev mode |

## 3. Milestones

Each milestone merges to `main` (always green): the learner surfaces are
**additive and not the default until P6M7 flips the shell**, so `main` stays
shippable throughout. Branches `milestone/P6Mx-slug`; FRs/ADRs recorded per
milestone as they land; every milestone ships tests (working agreement).

### P6M1 — Syllabus + reconciliation (content + pure domain)

- `content/curriculum.ts` (owner-reviewable, like the sentence bank): ordered
  **units → sets** — word sets of 1–2, letter batches of 2–3 — designed
  **ideal-first**, then each word tagged `recognized` or `placeholder` by
  reconciling against `SHIPPED_GLOSSES` + the 24 letters (Q5/Q6).
- Pure `domain/curriculum.ts`: route traversal, the linear-with-review unlock
  rule (Q3), and the **sentence-constructibility rule** — each completed set's
  *recognized* words must make ≥ 1 sentence buildable from the pool so far.
- Emit the **priority word list** (placeholder words in route order) — the
  input queue for the next model-vocabulary expansion (MS-ASL pipeline).
- Tests: route validity (no dupes, set sizes, letters exclude J/Z), every
  `recognized` word actually shipped, constructibility holds, placeholders
  excluded from recall/constructibility.
- **Result (2026-07-10):** shipped as `content/curriculum.ts` (11 units, 62
  sets: all 103 shipped glosses + 13 placeholders) + pure `domain/curriculum.ts`
  (status derived from the injected recognized set — reconciliation can't
  drift). **Priority words** (route order): `goodbye, you, me, my, your, feel,
  deaf, when, why, today, tomorrow, morning, night`. Letters: 8 alphabetical
  batches of 3 (A–Y, no J/Z). Constructibility holds from the very first set
  (`want eat`) and the finished route builds the entire 59-sentence bank.

### P6M2 — Store-wrap feasibility spike (early — de-risks Q1)

- Wrap the **current** build in a Capacitor-style shell; prove the hard parts
  inside the Android WebView locally (emulator/device): camera
  (`getUserMedia`), MediaPipe WASM, `onnxruntime-web` inference speed.
- Map the iOS path: **iOS builds need macOS** (dev machine is Windows) — likely
  GitHub Actions macOS runners; signing waits for the owner-gated Apple account
  (P6M9).
- Deliverable: committed wrapper config + a written go/no-go findings note in
  this doc. **No store accounts yet.**
- **Result (2026-07-10): GO.** Capacitor 7 wrap committed (`capacitor.config.ts`
  + `frontend/android/`; provisional appId `com.aakashtir.signapp` — permanent
  only at first store upload, P6M9). Debug APK builds at **5.7 MB** (one fix: a
  `kotlin-bom` pin in `app/build.gradle` for duplicate kotlin-stdlib classes).
  Verified on two Android 16 emulator instances (one headless):
  - App installs + launches; the **full UI renders in the WebView** at
    `https://localhost` (secure context, so `getUserMedia` is allowed).
  - **`getUserMedia` delivers frames** — the camera feed visibly renders in the
    `<video>` element; the P2M2 privacy explainer flows exactly as on web.
  - **MediaPipe tasks-vision WASM loads (from the CDN) with a WebGL2 context
    and logs "Graph successfully started running"** — on *both* instances.
  - **onnxruntime-web loads** (WebGPU unavailable → WASM fallback, same as most
    browsers). **No JS errors** in either run.
  - **Caveat — emulator, not app:** both instances **crashed (qemu exit)
    seconds after the vision graph started**, with no preceding JS error; the
    emulator's virtual-camera + host-GL path can't sustain the load. Sustained
    recognition therefore still needs a **real-device check** (owner: USB
    debugging + `adb install
    frontend/android/app/build/outputs/apk/debug/app-debug.apk`, or run from
    Android Studio). Watch low-end-phone perf headroom at P6M7-era QA.
  - **Production TODOs surfaced:** (1) the spike pre-granted `CAMERA` via adb —
    ship an in-app native permission request before store release; (2)
    MediaPipe WASM/models load from the CDN at runtime (M7 design), so the
    native app needs network on first run — bundle them or lean on the SW cache
    for offline-native later. Build recipe: `JAVA_HOME` = Android Studio JBR
    (JDK 21), `./gradlew assembleDebug`.

### P6M3 — Recall engine (pure domain)

- The batch state machine over the existing bucket system (Q4): teach a set →
  N recall reps mixed with whole-pool recall → set complete → next set unlocks
  (Q3). "Forgot → view the sign again" is always a legal move (ADR-008 framing).
- Seeded RNG (injected), framework-free, exhaustively vitest-tested — same
  standard as `domain/sentences.ts`.

### P6M4 — Words path UI

- Teach card (stick-figure reference + "try it" camera step, **no overlay**) →
  recall drills → set-completion screen. Placeholder slots (Q6) render a
  "coming soon"-style stub and advance past — they must read as intentional,
  not broken.
- Tests: vitest (view logic) + Playwright (teach→recall flow, stubbed
  recognition).

### P6M5 — Sentence stage

- At set completion, drill sentences built **only from the learned pool**
  (reuses the Phase-5 engine + bank; the bank grows with the curriculum).

### P6M6 — Alphabet path UI

- The 24 letters (Q5) in 2–3-letter batches → whole-pool recall → the
  **spell-words** stage (reuses `FingerspellStage`).

### P6M7 — Learner app shell + the new look (Q7)

- The new design language + navigation/home ("continue where you left off");
  the learner app becomes the **default**; today's tabs move behind a **dev
  mode** setting (Q2); overlay hidden for learners (a new "off" draw mode —
  today the overlay always draws; dev mode keeps it).
- **Result (2026-07-11):** shipped. **`/` is now `LearnerHome`** ("continue where
  you left off": hero + Continue, per-path progress cards with the next set/batch,
  Sentences + Search cards). **Nav is learner-first** (Home · Course · Sentences ·
  Search · Settings); the dev tabs (Practice/Learn/Signs/Camera) appear only with
  the new **Settings → Developer mode** toggle (persisted `profile.devMode` via a
  module store mirroring `overlayColorMode`; routes stay URL-reachable either way).
  **The learner look (Q7)** is a scoped design layer (`LearnerLayout` layout route +
  `.learner-theme`): a teal identity (light + dark, contrast-checked `--on-accent`)
  over the learner surfaces only — dev surfaces keep the original indigo tokens.
  **Owner feedback folded in: "← Exit lesson"** on every session screen (words teach/
  recall/sentence-stage + letter sessions) — exits abandon the session without
  marking the set (recorded attempts stay recorded, ADR-008). e2e updated for the
  shell flip (dev surfaces via direct URL or the dev-mode toggle; the FR-15
  camera cross-tab tests re-enable the tabs since a `goto()` reload would drop the
  shared stream). Visual polish beyond this first pass = owner-review input.

### P6M8 — Progress & polish

- Visible progress (units complete, streaks); hand the P6M1 priority list to
  the model track (vocabulary expansion runs as separate model-track
  milestones, not in this phase).

### P6M9 — Store packaging + release (owner-gated)

- Icons/splash, store listings, privacy policy + camera-usage strings (an easy
  case: everything runs on-device, no video leaves the phone — ADR-002).
- **Stop-and-ask items (credentials policy):** Apple Developer Program
  (~US$99/year), Google Play Console (US$25 one-time), signing keys, and the
  review submissions themselves.

## 4. Risks / watch items

- **WebView runtime risk** (WASM, camera, ONNX perf inside the wrap) —
  **resolved GO by P6M2**: every component loads and runs in the Android
  WebView. Residual: sustained-session behavior + perf on real (esp. low-end)
  devices — the emulator can't hold the vision load (qemu crashes), so this
  moves to a real-device check.
- **iOS build environment** — Windows dev machine; needs macOS CI (GitHub
  Actions) for iOS builds; signing is owner-gated.
- **Design scope creep** (Q7 fresh look) — land tokens + shell first, refine
  iteratively; don't block functional milestones on visual polish.
- **Placeholder UX** (Q6) — placeholders must read as "coming soon", never as
  a bug; count them out of progress totals.
- **Store review friction** — camera-permission justification; write the
  on-device privacy story into the listing early.

## 5. Checklist

| Milestone | Status | Branch |
| --- | --- | --- |
| P6M1 — Syllabus + reconciliation | ☑ merged [#50](https://github.com/aakash-tir/sign-app/pull/50) | `milestone/P6M1-syllabus` |
| P6M2 — Store-wrap feasibility spike | ☑ merged [#51](https://github.com/aakash-tir/sign-app/pull/51) (squash `b41c15e`) — **GO**; real-device check = owner follow-up | `milestone/P6M2-store-spike` |
| P6M3 — Recall engine (pure domain) | ☑ merged [#52](https://github.com/aakash-tir/sign-app/pull/52) — teach → 3× recall, pool review every 3rd prompt | `milestone/P6M3-recall-engine` |
| P6M4 — Words path UI | ☑ merged [#53](https://github.com/aakash-tir/sign-app/pull/53) — `/course` route: teach → recall → complete, Dexie v4, clean learner video | `milestone/P6M4-words-path` |
| P6M5 — Sentence stage | ☑ merged [#54](https://github.com/aakash-tir/sign-app/pull/54) — shared `SentenceDrill`; also fixed the Dexie teardown flake for good | `milestone/P6M5-sentence-stage` |
| P6M6 — Alphabet path UI | ☑ merged [#55](https://github.com/aakash-tir/sign-app/pull/55) — `/course/alphabet`: 8 batches → recall → spell-words stage | `milestone/P6M6-alphabet-path` |
| P6M7 — Learner shell + new look | ◐ in progress (implemented; PR pending) | `milestone/P6M7-learner-shell` |
| P6M8 — Progress & polish | ☐ not started | `milestone/P6M8-progress` |
| P6M9 — Store release (owner-gated) | ☐ not started | `milestone/P6M9-store-release` |

Legend: ☐ not started · ◐ in progress · ☑ merged
