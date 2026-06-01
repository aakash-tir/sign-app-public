# Phase 4 — Discovery & Navigation

> **Phases 1–3 are complete and deployed.** The app is live with 24 fingerspelling
> letters + **63 dynamic signs** (see [`../progress.md`](../progress.md)). Phases 1–3
> were about *building* the recognizer and making it *accurate*. Phase 4 is about
> **letting the learner find what they want to learn** — the vocabulary is now big
> enough (63 signs) that browsing a single dropdown is no longer enough.
>
> Kept **separate from** [`milestones.md`](milestones.md) (phase 1),
> [`phase2.md`](phase2.md), and [`phase3.md`](phase3.md).

## P4M1 — Sign search tab

**Goal.** A new top-level **Search** tab where the learner types the sign they want
to learn. If that sign is in the app's vocabulary, show **how to sign it** (the
reference animation) and a **camera that recognizes that specific sign** so they can
practice it. If it isn't, tell them plainly that it isn't in the system yet.

This is the owner's feature request, verbatim intent: *"search up the sign they want
to learn. If it exists as a sign in the database, pull up the sign and the camera for
that sign. If not, show a message saying the sign is not in the system yet. A new
tab."*

### Scope decisions (owner-confirmed)

| Decision | Choice | Why it matters |
| --- | --- | --- |
| **What counts as "in the database"** | **Dynamic signs only** — the **63** `SHIPPED_GLOSSES` | Each shipped gloss already has (a) a bundled reference clip in `frontend/public/reference/<gloss>.json`, (b) live recognition via the ONNX model, and (c) per-sign acceptance — all wired in `DynamicSignView`. So search reuses everything; **no model or data work**. Fingerspelling letters (static MLP, text hints, no animation) are **out of scope** and resolve to "not in the system yet". |
| **Match logic** | **Exact + synonyms + case-insensitive** | Normalize case/whitespace, then map common synonyms (`thanks`→`thank you`, `hi`→`hello`) onto canonical glosses. Mirrors the ML ingest layer's `canonical_label` + synonym idea (`ml/src/sign_ml/ingest.py:52`), so the frontend speaks the same vocabulary. "Not in the system" only fires when the term is genuinely absent. |

> **ADR-021** (to record on implementation): Sign search resolves against the
> **shipped dynamic vocabulary only**, matched by normalize-then-synonym lookup.
> Rationale: zero model/data cost, reuses the P2M4 reference + M6.3 recognizer;
> letters and fuzzy ranking are explicitly deferred (see *Future / deferred*).

### Architecture — reuse, don't rebuild

The feature is a **new entry point** over existing parts. Nothing in the recognition
or ML layers changes.

```
SearchView (/search, new tab)
  ├─ search box  ──▶ matchSign(query)          [pure domain, src/domain/]
  │                     ├─ found  → gloss
  │                     └─ not found → message
  ├─ found:
  │     ├─ SignReferencePlayer(gloss)          [existing — P2M4, no camera needed]
  │     └─ DynamicSignStage  ───────────────┐  [extracted from DynamicSignView]
  │           uses useDynamicSignRecognition │  [existing — M6.3]
  │           setTarget(gloss) on match      │  recognizes the searched sign
  └─ not found:
        "“<query>” isn’t in the system yet."
```

**Key reuse:**
- `useDynamicSignRecognition` (camera + Holistic + ONNX window classifier + per-sign
  `accepted`) — already exposes `setTarget(gloss)`. Search just locks the target to
  the matched gloss instead of offering a dropdown.
- `SignReferencePlayer` — renders the looping landmark animation, **independent of the
  camera**, so the "how to sign it" reference shows immediately (even offline / before
  the user enables the camera).
- The reference clips and recognizer are already precached for offline use.

### Work items

**1. Pure matcher (domain, framework-free, seeded-deterministic per `react.md`).**
- `frontend/src/domain/signSearch.ts`
  - `type SignMatch = { status: 'found'; gloss: string } | { status: 'not-found'; query: string }`
  - `matchSign(query: string, glosses?: readonly string[]): SignMatch`
    1. normalize: `trim().toLowerCase()`, collapse internal whitespace.
    2. apply synonym map → canonical term.
    3. membership test against `glosses` (default `SHIPPED_GLOSSES`).
  - No React, no I/O — fully unit-testable.

**2. Frontend synonym map.**
- `frontend/src/content/signSynonyms.ts`: `SIGN_SYNONYMS: Record<string, string>`,
  every value a member of `SHIPPED_GLOSSES`. Seed with obvious everyday synonyms
  (`thanks→thank you`, `hi→hello`, `mum/mom→mother`*, `dad→father`, `bye→…`*) —
  *only ship entries whose target is actually shipped*; drop the rest. Mirrors
  `ingest.py` synonyms so both sides agree.

**3. SearchView + route + tab.**
- `frontend/src/modes/search/SearchView.tsx` (+ `SearchView.css` if needed):
  controlled search input (`handleSearch` on submit/`onChange`); on `found`, render
  `SignReferencePlayer` + the recognition stage with `target` locked to the gloss;
  on `not-found`, render the "isn’t in the system yet" message (`role="status"`).
  Encourage-camera affordance: reference shows first, "Enable camera to practice"
  reveals the live stage.
- `frontend/src/App.tsx`: add `<NavLink to="/search">Search</NavLink>` (after Signs)
  and `<Route path="/search" element={<SearchView />} />`.

**4. Extract a shared recognition stage (small refactor, avoids duplication).**
- `frontend/src/recognition/DynamicSignStage.tsx`: the camera `<video>`/overlay
  `<canvas>` + status/controls + prediction + acceptance block, parameterized by the
  `useDynamicSignRecognition` result and a "fixed target" flag. `DynamicSignView`
  (dropdown) and `SearchView` (locked target) both render it. Keeps the two views
  thin and DRY. *(If this balloons, fall back to SearchView using the hook directly —
  the markup is small.)*

**5. Docs & product spec.**
- Register **FR-19** (sign search) in `project-context.md`; add the **Search** mode
  to the modes list.
- Record **ADR-021** in `decisions.md`.
- Update `CLAUDE.md` doc map + status and `progress.md` on merge.

### Tests (part of the deliverable)

- **Vitest — `domain/signSearch.test.ts`:** found (exact), found (case/whitespace
  variants), found (synonym), not-found (absent term), synonym targets are all
  shipped, empty/whitespace query → not-found. Seeded/deterministic, no RNG needed.
- **Vitest — `modes/search/SearchView.test.tsx`:** mock `useDynamicSignRecognition`;
  (a) typing a known gloss renders the reference (`data-testid="sign-reference"`) and
  calls `setTarget` with that gloss; (b) typing gibberish renders the "not in the
  system yet" message and does **not** set a target.
- **Playwright — `frontend/e2e/search.spec.ts`:** stub the model (as `dynamic.spec.ts`
  does), navigate to the **Search** tab; search a known sign → reference visible;
  search a nonsense term → not-in-system message. Mirrors the existing per-tab e2e
  pattern.

### Acceptance criteria

1. A **Search** tab is reachable from the main nav and routes to `/search`.
2. Searching a shipped sign (e.g. `father`, or a synonym like `thanks`) shows its
   reference animation and, on enabling the camera, recognizes that specific sign
   (acceptance lights up when performed).
3. Searching a term not in the vocabulary (e.g. `xyzzy`, or an unshipped word like
   `walking`) shows a clear "**“<query>” isn’t in the system yet**" message and no
   camera/reference.
4. Matching is case-insensitive, whitespace-tolerant, and synonym-aware.
5. All gates green: `prettier --check` · `eslint` · `tsc --noEmit` · `vitest` ·
   `playwright`. (No `ml/` changes ⇒ ml lane unaffected, but it must stay green.)

### Out of scope / deferred (future milestones)

- **Fingerspelling letters & spell-an-unknown-word fallback** — letters use the static
  recognizer and have no animation; a "fingerspell it letter-by-letter" fallback for
  unknown words could reuse the LearnMode spell flow. Deferred (owner chose
  dynamic-only for P4M1).
- **Fuzzy / typo-tolerant ranking + autocomplete suggestions** — owner chose exact +
  synonyms; a ranked suggestion list ("did you mean…") is a natural follow-up.
- **Adding new signs from search misses** — capturing "not in the system" queries to
  prioritize future vocabulary growth (analytics) is a possible later idea; the app is
  local-first and offline, so this would need a deliberate design.

## Phase 4 checklist

| Milestone | Theme | Status | Branch |
| --- | --- | --- | --- |
| P4M1 — Sign search tab | discovery | ◐ planned | `milestone/P4M1-sign-search` |

Legend: ☐ planned · ◐ in progress / scoping · ☑ merged.
