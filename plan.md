# Plan — Phase 6: the learner app

> The owner's plan for the next phase, reformatted and grounded against the live
> system (2026-07-10). Earlier plans that lived in this file (Phase 2) are in git
> history; their outcomes are recorded in `.claude/docs/` + `.claude/progress.md`.
> The detailed milestone plan is [`.claude/docs/phase6.md`](.claude/docs/phase6.md)
> — all plan-shaping questions (Q1–Q7, §6) were asked and answered 2026-07-10.
> The working agreement applies throughout: milestone branch → PR → squash-merge,
> all gates green, tests with every milestone.

## 1. Goal

Everything shipped so far (Practice / Learn / Sentences / Signs / Search) is a
**developer testing surface**. This phase builds the **actual user app**:
user-friendly, and it *guides* the learner — a **syllabus** plus a
**Duolingo-style teach-and-recall loop**, rather than self-directed drills.

- **Mobile-first, works on web too — and ships to the app stores** *(decided,
  Q1)*. The PWA covers web + installable mobile today (ADR-003); this phase
  **adds native packaging** (a Capacitor-style WebView wrap around the same
  codebase) so the learner app has store presence. Store accounts and fees are
  owner-gated — see §5 item 9.
- This is a big phase; it ships in parts (§5), each its own milestone.

## 2. The learning system

### 2.1 Learning route (the syllabus)

- A curated **order of words to learn** — the backbone the whole app follows.
- **Design the ideal route first, ignoring today's recognizer vocabulary** — use
  whatever words a good beginner syllabus needs.
- **Then reconcile** against the live system (24 letters + 103 dynamic signs):
  every curriculum word the recognizer doesn't know gets **flagged**, and the
  flagged list becomes the **top-priority queue for the next vocabulary
  expansion** (the proven MS-ASL download → retrain → honest-gate pipeline,
  Phases 3–4). Flagged words keep their ideal position in the route as
  **placeholder slots** *(decided, Q6)*: shown where they would be taught, but
  not taught, verified, or drawn into recall until the owner adds them later.
- **Order words so sentences come early:** each completed set should make at
  least one sentence constructible from the pool learned so far — this is
  test-enforceable in the pure domain (see §2.3 path 2).

### 2.2 Teach → recall loop

- **Teach** a small batch, then **recall** it several times, mixed into recall
  from the **whole learned pool** — e.g. teach 2 words, then prompt them
  repeatedly among older words.
- **Forgetting is fine:** the learner can re-view the sign's reference at any
  time and try again.
- The pool **expands** as batches complete; recall keeps drawing from everything
  learned so far.
- Grounding: the pure-domain bucket system (`need-practice`/`confident`,
  selection algorithm, "That's what I did" valve — ADR-008/-009) is the natural
  engine to extend, not replace *(decided, Q4: extend the session buckets — no
  wall-clock spaced repetition this phase)*.

### 2.3 Two paths, both open at all times

1. **Alphabet path** — learn letters **2–3 at a time**; recall draws from the
   whole learned letter pool; after the alphabet, move on to **spelling words
   with signs**.
   - Grounding: the static recognizer verifies **24 letters — J and Z are motion
     letters it can't check**, so the path **teaches those 24** and leaves J/Z
     out until the recognizer can verify them *(decided, Q5)*. The
     `FingerspellStage` (P4M9) already does letter-by-letter word spelling.
2. **Words path** — learn words **1–2 at a time** with the same recall system;
   after a set completes, **use those words in sentences** (built only from the
   learned pool — which is why §2.1 orders words for constructibility). Then the
   next set, and repeat the format.
   - Grounding: the Phase-5 sentence engine (per-sign camera verification,
     persisted progress, 59-sentence bank) is reusable as-is; the bank grows
     alongside the syllabus.

## 3. Presentation

- **Sign reference:** keep the current **stick-figure animation**
  (`SignReferencePlayer`, rendered from landmarks — P2M4) for "how to sign X".
  **Videos of a person signing come later** — build the reference slot so a
  video drops in without reworking the flow.
- **Learner camera view:** clean video only — **no landmark/skeleton overlay**
  drawn for users. (Today the overlay always draws and Settings only picks its
  colors, so an "off" mode is new work. Keep the overlay reachable for
  developers/debugging.)
- **Visual design:** a **new learner-facing look** *(decided, Q7)* — its own
  design language, built fresh for learners rather than evolving the current
  dev-surface tokens (those stay for the dev mode).

## 4. Out of scope (this phase)

- Recording/sourcing real sign videos — the stick figure stands in; only the
  swap-in slot is designed now.
- Growing the recognizer vocabulary itself — this phase *produces* the priority
  list; training stays on the model track.
- Accounts / cloud sync — persistence stays local-first (ADR-005) unless
  re-decided.

## 5. Suggested build order

1. **Syllabus content + reconciliation** — draft the ideal route
   (owner-reviewable content file), flag not-yet-recognized words, emit the
   priority list for the model track.
2. **Store-wrap feasibility spike** (early — de-risks the Q1 decision) — wrap
   the *current* build in a Capacitor-style shell and prove the hard parts
   inside the iOS/Android WebViews: camera (`getUserMedia`), MediaPipe WASM, and
   `onnxruntime-web`. Local builds/emulators only; no store accounts needed yet.
3. **Recall engine (pure domain)** — the batch state machine: teach → recall
   reps → pool integration; seeded RNG; fully unit-tested.
4. **Words path UI** — teach card (reference + try it) → recall drills → set
   completion.
5. **Sentence stage** — wire the Phase-5 engine in at set completion.
6. **Alphabet path UI** — letter batches → pool recall → spell-words stage.
7. **Learner app shell** — new navigation/home ("continue where you left off"),
   overlay hidden for learners, today's tabs behind a dev mode (Q2).
8. **Progress & polish** — visible progress/streaks; hand the priority list to
   the model track.
9. **Store packaging + release** — icons/splash, store listings, privacy policy
   + camera-usage strings (an easy case to make: everything runs on-device, no
   video leaves the phone). **Owner-gated per the credentials policy:** Apple
   Developer Program (~US$99/year), Google Play Console (US$25 one-time),
   signing keys, and the review submissions themselves — stop-and-ask items.

## 6. Decisions — all questions answered (owner, 2026-07-10)

Per the plan's own rule — questions before code. All seven were asked and
answered; new questions raised mid-milestone follow the same rule.

- **Q1 Platform → store-first now.** Native app-store distribution is in scope
  for this phase: wrap the same React/TS codebase (web/PWA keeps working).
  Threaded into the plan as the early feasibility spike (§5 item 2), the closing
  packaging/release milestone (§5 item 9), and owner-gated store accounts/fees.
- **Q2 Current dev frontend → hide behind a dev mode.** The learner app becomes
  *the* app; today's tabs stay reachable via a hidden developer setting for
  exercising the recognizer.
- **Q3 Progression → linear with review.** Batches unlock in order; everything
  already learned stays reviewable anytime; no skipping ahead.
- **Q4 Recall → extend the session buckets.** Keep the deterministic
  `need-practice`/`confident` engine and add per-batch recall reps; no
  wall-clock spaced repetition this phase.

- **Q5 J and Z → teach the 24 verifiable letters.** J and Z (motion letters the
  static recognizer can't check) are left out for now; they join the route once
  the recognizer can verify them.
- **Q6 Flagged words → placeholder slots.** Not-yet-recognized words keep their
  ideal position in the route, but the slot renders a placeholder instead of a
  teach step — no teaching, no verification, excluded from recall and from the
  sentence-constructibility rule — until the owner adds them later (model-track
  expansion).
- **Q7 Visual design → a new learner-facing look.** The learner app gets its own
  design language, built fresh rather than evolving the current dev-surface
  tokens (which stay for the dev mode).
