# Phase 5 — the Sentences section

> **Owner-approved scope (2026-07-01):** promote sentences from the minimal P2M7
> Learn drill to a **first-class, top-level Sentences section** with **persisted
> per-sentence progress**. This delivers the "real multi-sign Learn sentences"
> parked item (ADR-012 follow-on, FR-6) properly, now that the vocabulary is big
> enough (103 shipped signs) to build real content.
>
> Kept separate from [`milestones.md`](milestones.md) (phase 1),
> [`phase2.md`](phase2.md), [`phase3.md`](phase3.md), and [`phase4.md`](phase4.md).

## Why now

The P2M7 drill was honest for its era but is now badly under-scaled:

- **8 hardcoded 2-sign sequences** drawn from the original ~17-sign vocabulary —
  the app now ships **103 dynamic signs**, so the content ignores ~90% of what a
  learner can actually sign.
- **No level behavior.** ADR-009/§4 of the spec want beginner *small* (2–4)
  sentences and longer material for intermediate/expert; today everything is 2
  signs for everyone.
- **Not tracked.** FR-6 says sentences are "tracked"; today nothing persists — a
  learner can't see what they've completed and selection can't prefer new material.
- **Selection isn't domain-pure.** The drill picks with raw `Math.random` inside
  `LearnMode` — the frontend rules require selection algorithms to live in
  `src/domain/` with seedable RNG.
- **No reference animation** for the current word in the sequence (the single-sign
  Learn drill has one; the sentence drill doesn't), and it's buried as a
  conditional tab inside Learn rather than being a visible destination.

## What ships (scope)

A **`/sentences` route + nav tab** ("Sentences"). The learner sees a sentence —
short, conservative gloss-order sequences ("sign these words in order", explicitly
**not** a claim of full ASL grammar, per ADR-012) — with the current word
highlighted, its **reference animation**, and a camera that verifies each sign in
order (per-sign calibrated acceptance, ADR-025, with the "That's what I did"
valve, ADR-008). Completing a sentence records progress (Dexie) and offers the
next one, **preferring sentences not yet completed**. Gating is unchanged:
`sentencesEnabled` (ADR-009 — intermediate/expert always; beginner behind the
latched ≥20-confident unlock) and every sentence's signs must all be `confident`.
Locked/empty states explain what to do instead of hiding the tab.

**Non-goals:** ASL grammar/syntax instruction, continuous multi-sign recognition
(each sign is verified individually — the recognizer is single-sign), new model or
data work (frontend-only phase), sentence authoring UI.

→ **ADR-028** (Sentences section: dedicated tab, persisted progress, level-aware
lengths) records the decisions; **FR-20** enters the spec's requirement table.

## Branch & merge plan (owner-requested)

An **integration branch** holds the phase; each sub-milestone is a branch off it
with a PR back into it (all quality gates green per PR). The final PR merges the
integration branch into `main` (squash), which auto-deploys.

```
main ──▶ milestone/P5-sentences                 (integration branch, this plan doc)
           ├──▶ milestone/P5M1-sentence-domain   (content bank + pure domain)
           ├──▶ milestone/P5M2-sentence-progress (Dexie repo + schema bump)
           └──▶ milestone/P5M3-sentences-view    (route + nav + UI + e2e)
           └──(docs sync) ──▶ PR → main (squash-merge when green) → deploy verify
```

P5M1 → P5M2 → P5M3 run in sequence (each builds on the previous). Docs
(ADR-028, FR-20, progress.md, CLAUDE.md) sync on the integration branch before
the final merge.

---

## P5M1 — Sentence content bank + pure domain

**Goal.** Real content over the 103-sign vocabulary and a domain module that owns
eligibility + selection (seeded, testable), replacing the ad-hoc logic in
`LearnMode`.

**What.**

- `content/signSentences.ts` → a structured bank: `{ id, signs }` where `id` is
  the joined gloss string (stable, derivable, unique — tested). Target **~50
  sentences**, lengths **2–4**, using **only shipped glosses** so every sentence
  is verifiable. Conservative, owner-reviewable gloss-order phrases (needs,
  family, feelings, questions, daily life).
- New pure `domain/sentences.ts`:
  - `eligibleSentences(bank, confident, level)` — all-signs-confident (ADR-009)
    ∩ level length band: **beginner 2–3, intermediate 2–4, expert 3–4** (within
    the ADR-009 "small = 2–4" beginner band; a tunable starting point recorded in
    ADR-028).
  - `pickSentence(eligible, completedIds, rng)` — seedable RNG (injected, per
    frontend rules; no `Math.random` in domain), **prefers un-completed**
    sentences, falls back to completed ones when everything's done, avoids
    immediately repeating the current sentence when an alternative exists.
- `LearnMode`'s drill keeps working (it can consume the new bank shape) — the UI
  move happens in P5M3.

**Tests (vitest).** Content invariants (every sign ∈ `SHIPPED_GLOSSES`, lengths
2–4, unique ids, no duplicate sequences); eligibility (confidence + level bands);
selection (deterministic under a seeded rng, prefers un-completed, fallback +
no-immediate-repeat behavior).

## P5M2 — Persisted sentence progress (FR-6 "tracked")

**Goal.** Completions survive reloads; selection and UI can use them.

**What.** Dexie **schema version bump** adding a `sentenceProgress` table
(`{ sentenceId, timesCompleted, lastCompletedAt }`); a `SentenceRepo` in
`src/data/` (components never touch IndexedDB directly, per rules) with
`recordCompletion`, `allProgress`, `completedIds`. Existing data untouched by
the migration.

**Tests (vitest, fake-indexeddb).** Repo round-trip (record → read back,
increment on repeat), migration smoke (old DB opens cleanly with the new
version), `completedIds` shape.

## P5M3 — The Sentences section (route + UI + e2e)

**Goal.** The visible feature.

**What.**

- `modes/sentences/SentencesView` + `/sentences` route + **"Sentences" nav tab**
  (App.tsx), placed after Learn.
- Flow: load profile/bank/progress via repos → domain picks a sentence → show
  the word sequence with the **current word highlighted**, the current word's
  `SignReferencePlayer`, and the camera stage (dynamic recognizer with
  `setTarget` = current word, per-sign acceptance ADR-025). Correct (or
  "That's what I did", ADR-008) → advance; sentence done → 🎉 +
  `recordCompletion` → offer the next. Skip button. A progress line
  ("N of M sentences completed").
- **Gating & empty states:** sentences locked (beginner below the latch) → an
  explainer with the confident-word count and what unlocks it; unlocked but no
  eligible sentence → point the learner at Learn/Practice to build confidence.
  The tab itself is always visible (no hidden nav).
- **Learn cleanup:** the P2M7 "Sign sentences" drill inside Learn is **removed**
  (the top-level Sentences tab sits right next to Learn, so an internal link
  would be redundant; the letter-spelling "Spell words" drill stays).

**Tests.** Vitest component tests (stubbed recognition, fake repos): render
gates, highlight/advance on accept, valve advance, completion recorded, empty
states. Playwright e2e: nav → locked explainer (fresh profile) and an unlocked
flow with a stubbed recognizer (as in existing e2e).

## Final — docs + integration merge

ADR-028 + FR-20 + progress.md + CLAUDE.md status; full gates on the integration
branch (both lanes); PR `milestone/P5-sentences` → `main`, squash-merge when
green; verify the Cloudflare deploy.

## Phase 5 checklist

| Milestone | Status | Branch |
| --- | --- | --- |
| Plan doc (this file) | ☑ on the integration branch | `milestone/P5-sentences` |
| P5M1 — Content bank + pure domain | ☑ merged [#46](https://github.com/aakash-tir/sign-app/pull/46) — 57-sentence bank + `domain/sentences.ts` (eligibility, level bands, seeded selection) | `milestone/P5M1-sentence-domain` |
| P5M2 — Persisted sentence progress | ☑ merged [#47](https://github.com/aakash-tir/sign-app/pull/47) — Dexie v3 `sentences` table + `SentenceRepo` (incl. v2→v3 migration test) | `milestone/P5M2-sentence-progress` |
| P5M3 — Sentences section UI + e2e | ☑ merged [#48](https://github.com/aakash-tir/sign-app/pull/48) — `/sentences` tab, per-sign verify + valve, progress line, gating states; in-Learn drill removed | `milestone/P5M3-sentences-view` |
| Docs + merge to main + deploy | ☑ this PR | `milestone/P5-sentences` → `main` |

## Decisions to record on completion

- **ADR-028** — Sentences section: dedicated top-level tab; persisted
  per-sentence progress; level-aware length bands (beginner 2–3 / intermediate
  2–4 / expert 3–4, tunable); selection = seeded RNG preferring un-completed;
  sequencing exercise, not grammar (reaffirms ADR-012's framing).
- **FR-20** — A **Sentences** tab presents short sequences of the learner's
  confident signs with per-sign camera verification, a reference animation for
  the current sign, level-gated availability (ADR-009), and locally persisted
  completion progress.
