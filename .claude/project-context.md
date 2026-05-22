# Product Specification — Sign App

> Canonical product spec. Derived from [`../plan.md`](../plan.md) and the
> clarifying decisions recorded in [`docs/decisions.md`](docs/decisions.md).
> For *how* it is built, see [`docs/architecture.md`](docs/architecture.md).

## 1. Vision

A cross-platform app that **teaches American Sign Language (ASL)** by having the
learner perform signs in front of their device camera and getting immediate,
automatic feedback on whether they did it correctly. It runs on **Windows,
Android, iOS, and Linux** from a single codebase, fully **on-device** (no video
ever leaves the device) and **offline-capable** after first load.

## 2. Target users

People who want to learn ASL through active recall and physical practice rather
than passive video watching. No assumption of prior signing knowledge.

## 3. Platforms

| Platform | Delivery |
| --- | --- |
| Android | Installable PWA (Add to Home Screen) |
| iOS | Installable PWA (Safari → Add to Home Screen) |
| Windows | Installable PWA (Chrome/Edge) or browser |
| Linux | Installable PWA (Chrome/Edge) or browser |

A single React + TypeScript PWA serves all four. See
[`docs/decisions.md`](docs/decisions.md) (ADR-003).

## 4. Difficulty levels

Three levels. A level sets the learner's assumed starting point, the
vocabulary/curriculum, and whether **sentences** are used (see §5.1).

| Level | Assumed user | Curriculum focus | Sentences |
| --- | --- | --- | --- |
| **Beginner** | New to sign language; knows nothing. Everything is learned from scratch. | Fingerspelling/alphabet + high-frequency foundational everyday signs, taught one word at a time. | **Off at first.** Turn on **small sentences (2–4 signs)** once the word bank is big enough — **≥ 20 confident words** (see §5.1). |
| **Intermediate** | Knows some sign language; can hold a basic conversation. | Broader conversational vocabulary, common phrases, everyday topics. | **On from the start** (small→medium), built only from words the user knows. |
| **Expert** | Wants to expand vocabulary; can hold complex conversations across several topics. | Advanced and topic-specific vocabulary across multiple domains; idiomatic usage. | **On from the start**, including longer/complex, multi-topic sentences. |

**Seeding existing knowledge (Intermediate/Expert):** because these users already
know signs, M5 provides an optional quick **self-assessment/placement** where they
mark signs they already know (added to the word bank as `confident`) so sentences
have material to draw on immediately. Without it, the app still teaches the
level's curriculum with sentences enabled as words become `confident`.

**Changing level (any time):** the user can **reassign their level up or down at
any time** from settings — drop back to a lower level if the initial choice felt
too hard, or move up if it felt too easy. This is **non-destructive**: the word
bank and all progress (buckets, proficiency) are **preserved**, because level
controls curriculum and sentence behavior, not what you've already learned.
Sentence behavior re-evaluates against the new level immediately (see §5.1). The
app may also *suggest* a level change from performance, but the user is always in
control. See ADR-010 in [`docs/decisions.md`](docs/decisions.md).

The concrete sign→level vocabulary lists are curriculum/content work in M5; the
level *behavior* above is fixed (ADR-009 in [`docs/decisions.md`](docs/decisions.md)).

## 5. Modes

There are two modes: **Learn** and **Practice**.

### 5.1 Learn mode

Guided acquisition of new signs.

Flow per sign:

1. **Show** the sign (reference animation/video/diagram) together with its
   **meaning** (the word/gloss).
2. Prompt the user to **copy** the sign.
3. **Verify** with the camera whether the sign was performed correctly.
4. If correct → **"Good job"** feedback.
5. **Sentence usage** (when enabled for the level — see §4): once the user is
   proficient with a sign, present it **used in a sentence** and track that the
   user copies it correctly.

**Sentence rules (decided — ADR-009):**

- A sign becomes **eligible for sentences** once it reaches the **`confident`**
  bucket (mastered = answered correctly 3× while in need-practice). This is the
  "good enough proficiency" gate.
- Sentences are built **only from words the user already knows** (`confident`
  words), so every sentence is performable.
- **Whether sentences are used at all** depends on the level:
  - **Beginner:** sentences are **off** until the word bank **first** reaches
    **≥ 20 confident words**; then **small sentences (2–4 signs)** turn on and
    stay on (the unlock is **latched**, so it won't flap if the count later dips).
  - **Intermediate / Expert:** sentences are **on from the start** (drawing on
    confident words; see the placement option in §4).

> The threshold (20) and beginner sentence length (2–4) are the chosen starting
> values and may be tuned in M5 based on testing. See ADR-009 in
> [`docs/decisions.md`](docs/decisions.md).

### 5.2 Practice mode

Spaced, recall-based drilling of already-known words.

- There is a **word bank** containing every word the user knows.
- A word is **displayed on screen**; the user must **sign it**.
- If correct → show **"Correct"** and advance to the next word.

#### Buckets

Every word is in exactly one of two buckets:

- **need-practice**
- **confident**

Rules:

- New words start in **need-practice**.
- A wrong answer puts/keeps the word in **need-practice**.
- A word in **need-practice** answered **correctly 3 times** is promoted to
  **confident**. (See selection/counter semantics in
  [`docs/architecture.md`](docs/architecture.md) §Data model.)
- A word in **confident** answered **wrong** is demoted to **need-practice**.

#### No "incorrect" screen

There is never a failure/incorrect screen. Instead:

- The user may press **"I forgot"** → the app **shows the sign**.
- On that reveal screen there is a **"That's what I did"** button.
  - This exists because the **camera sometimes fails to capture a correct
    sign**. Pressing it means: **treat this attempt as correct** (counts toward
    promotion just like a camera-verified correct answer).

> **Decided (owner, 2026-05-20):** pressing **"I forgot"** alone *does* count as a
> **wrong** attempt; pressing **"That's what I did"** afterward makes the attempt
> **correct** instead. Implemented via **deferred commit (no revert)** — the
> attempt's outcome is committed exactly once, at resolution. See
> [`docs/architecture.md`](docs/architecture.md) §Attempt resolution model and
> ADR-008 in [`docs/decisions.md`](docs/decisions.md).

#### Word selection algorithm (Practice)

- Draw from the **whole word bank**, regardless of bucket.
- Bias toward **need-practice** at a **1:2 ratio** (for every 1 confident word
  shown, show 2 need-practice words), on average.
- **No-repeat window:** the same word must not reappear **within 10 displayed
  words**, *unless* the word bank has 10 or fewer words total (then the window
  shrinks to "as large as possible").

Precise algorithm and edge cases are specified in
[`docs/architecture.md`](docs/architecture.md) §Practice selection algorithm.

## 6. Functional requirements summary (traceable)

| ID | Requirement |
| --- | --- |
| FR-1 | App runs as an installable PWA on Windows, Android, iOS, Linux. |
| FR-2 | Camera capture works on all target platforms with permission handling. |
| FR-3 | On-device recognition of ASL signs from the camera (no upload). |
| FR-4 | Three difficulty levels gate available content. |
| FR-5 | Learn mode: show sign + meaning → copy → verify → "Good job". |
| FR-6 | Learn mode: sentences gated by level (+ ≥20-confident-words for beginner), built from `confident` words, tracked. |
| FR-7 | Practice mode: display word, verify signed answer, advance on correct. |
| FR-8 | Two buckets (need-practice / confident) with the promotion/demotion rules. |
| FR-9 | "I forgot" reveals the sign; "That's what I did" overrides to correct. |
| FR-10 | Practice selection: 1:2 confident:need-practice, no repeat within 10. |
| FR-11 | Word-bank state persists locally across sessions. |
| FR-12 | Works offline after first load. |
| FR-13 | User can reassign their level (up or down) any time; progress is preserved and sentence behavior recomputes. |
| | **Phase 2 (depth & polish — see [`docs/phase2.md`](docs/phase2.md)):** |
| FR-14 | Hand-tracking overlay color is **user-selectable in Settings**: *Default* (classic pink dots / blue bones) or *Per-finger* (each finger a distinct, colorblind-safe color; palm/wrist neutral). Persisted; visualization only, no recognition change. *(P2M1)* |
| FR-15 | Camera permission persists across views via one shared stream; one-time privacy explainer; user can disable/enable manually. *(P2M2)* |
| FR-16 | Redesigned, accessible UI: WCAG-AA contrast, clear hierarchy, responsive, no broken-looking empty states. *(P2M3)* |
| FR-17 | In-app sign reference rendered from landmark data — no external sites; works offline. *(P2M4)* |
| FR-18 | New datasets ingest through a canonical normalization layer (canonical labels, fixed window, signer-disjoint splits) before training. *(P2M5)* |

These IDs are referenced from the milestone acceptance criteria in
[`docs/milestones.md`](docs/milestones.md) (phase 1) and
[`docs/phase2.md`](docs/phase2.md) (phase 2).

## 7. Non-goals (initial scope)

- Two-way translation / sign-to-text dictation of free conversation.
- Multiplayer / social features.
- Server-side accounts or cloud sync (local-first; cloud sync is a possible
  later enhancement).
- Sign languages other than ASL (BSL, ISL, Auslan, etc.).
