# Runtime — how the app actually works in the browser

> What happens between "user opens the app" and "user gets a 'correct'". The
> camera lifecycle, the recognition loop, the domain logic that interprets
> recognition events, and how progress gets stored.

This doc complements [`machine-learning.md`](machine-learning.md), which
covers *what the model does*. This one covers *how the rest of the app feeds
the model and uses its output*.

## 1. App startup

When the PWA boots, `frontend/src/main.tsx` renders `App.tsx`, which mounts a
small tower of providers above the React Router:

```
<CameraProvider>          ← owns the shared MediaStream (ADR-018)
  <Router>
    <Route /practice>     ← PracticeMode
    <Route /learn>        ← LearnMode
    <Route /signs>        ← DynamicSignView (dev/practice)
    <Route /camera>       ← CameraView (debug)
    <Route /settings>     ← SettingsView
  </Router>
</CameraProvider>
```

Key design rule: **`CameraProvider` sits above the router.** This is what
lets the camera stream survive a tab switch. Before P2M2, each route owned
its own stream, so navigating from Practice to Settings forced the user to
re-grant camera access. Now the provider holds the stream; routes just
attach.

## 2. Camera lifecycle

### One stream, shared across views

The camera is **acquired once** (the first time any view asks for it) and
released only when:

- The user manually presses "Stop camera".
- The browser tab is hidden (`visibilitychange` → `hidden`) — the stream is
  released to save battery and turn the privacy LED off. On return it's
  re-acquired silently (the *permission* persists; only the *stream*
  releases).
- The app fully reloads.

It does **not** release when a view unmounts. This was a deliberate
supersession of the original "release on unmount" rule (see ADR-018).

### How a view attaches

A view calls `useCamera()` (in `recognition/useCamera.ts`), which returns a
callback ref. The view passes that ref to its `<video>` element; the hook
wires the shared `MediaStream` into that element. The hook **never calls
`getUserMedia` or `stop()`** — those are the provider's job.

```tsx
function PracticeMode() {
  const videoRef = useCamera();           // ← shared stream goes here
  // ... recognition hook reads videoRef and runs the loop
  return <video ref={videoRef} playsInline muted />;
}
```

### One-time privacy explainer

The first time the user enables the camera, a short modal explains that video
never leaves the device. Acknowledgement is persisted in the user profile
(`cameraExplainerSeen`) so subsequent enables are silent.

## 3. The recognition loop

Each mode's view uses a recognition hook. There are three, but in practice
only one runs at a time per view:

| Hook | What it does |
| --- | --- |
| `useSignRecognition` | Letters only — static MLP. |
| `useDynamicSignRecognition` | Words only — GRU on a 30-frame window. |
| `useUnifiedSignRecognition` | Both — picks the right path per prompted word. This is what Practice + Learn use. |

The loop, simplified, looks like this:

```ts
// Pseudocode of useUnifiedSignRecognition's per-frame work.
async function tick(now) {
  // Throttle: skip if it's been less than ~33ms since the last detect call.
  if (now - lastDetect < FRAME_INTERVAL_MS) {
    scheduleNextFrame(); return;
  }
  lastDetect = now;

  // 1. Detect landmarks from the current video frame.
  //    Static path uses HandLandmarker; dynamic uses HolisticLandmarker.
  const result = await detector.detect(videoEl, now);

  // 2. Draw the overlay (skeleton on top of the video) and run the right
  //    classifier.
  if (mode === 'static') {
    drawHands(canvas, result.hands, colorMode);
    const features = normalizeHandLandmarks(result.hands[0]);
    const { label, confidence } = mlp.classify(features);
    debounceStatic.push(label, confidence);
  } else {
    drawHolistic(canvas, result, colorMode);
    const features = normalizeHolisticFrame(result);
    frameWindow.push(features);                            // 30-frame buffer
    if (frameWindow.full()) {
      const { label, confidence } = await onnx.classify(frameWindow.array());
      debounceDynamic.push(label, confidence);
    }
  }

  // 3. If debounce says we've seen N consecutive agreeing high-confidence
  //    frames, emit { label, confidence } upward. This is what the mode UI
  //    reads.
  scheduleNextFrame();
}
```

A few details that matter:

- **Throttling to ~30 FPS.** We don't run the model on every animation frame
  (60 FPS on most monitors). The dynamic model was trained on 30-frame
  windows captured at ~30 FPS, so matching that cadence keeps train/serve
  consistent. It also halves CPU on a 60 Hz display.
- **Detectors are app-lifetime singletons.** Initialization is expensive
  (loading WASM and model files). We cache them so view switches don't
  re-initialize.
- **Debounce.** Recognition is noisy frame-to-frame. The `debounce` module
  requires N consecutive agreeing high-confidence frames before emitting an
  event. This converts a 95th-percentile-confident-once-per-second stream
  into reliable single events.

## 4. The domain layer

Recognition emits `{label, confidence}`. The *meaning* of that event — does
it count as "correct"? what happens next? — lives in `src/domain/`, which is
**pure TypeScript with no React, no DB, no camera**.

### 4.1 Attempts and outcomes

Every prompted word is a single **attempt** with a single terminal
**outcome** (`correct` or `wrong`). Crucially, **no bucket change happens
until the attempt resolves** (ADR-008, the *deferred commit* model).

This avoids the classic "apply on action, undo on override" bug where the
state mutation has to be reversed. Instead, the outcome is a **pure function
of the attempt's events**:

```
prompted word X displayed
├─ recognition matches X (above threshold, debounced)            → correct
├─ user pressed "I forgot" alone, then advanced                  → wrong
└─ user pressed "I forgot" then "That's what I did"              → correct
```

Exactly one transition is committed when the attempt resolves.

### 4.2 Buckets

Every word in the user's word bank lives in one of two buckets:

- **`need-practice`** — still learning. New words start here.
- **`confident`** — mastered.

Transitions (in `domain/buckets.ts`):

| Current bucket | Outcome | Next state |
| --- | --- | --- |
| `need-practice` | `correct` | streak += 1; promote to `confident` at streak = 3 |
| `need-practice` | `wrong` | streak = 0, stay `need-practice` |
| `confident` | `correct` | stay `confident` |
| `confident` | `wrong` | demote to `need-practice`, streak = 0 |

That's it. The promotion-at-3 rule is the simplest spaced-repetition surface
that still requires consistent recall, and the demote-on-wrong rule
guarantees mistakes resurface.

### 4.3 The practice selection algorithm

Goal: pick the next word to drill, with a **1:2 bias toward `need-practice`**
and **no repeat within the last 10 displayed words**.

```ts
// domain/selection.ts (simplified)
function pickNextWord(bank, recentWordIds /* last ≤10 */, rng) {
  let eligible = bank.filter(w => !recentWordIds.includes(w.id));
  if (eligible.length === 0) {
    // Bank is ≤10 words; shrink the window to "just don't repeat the very
    // last one"
    eligible = bank.filter(w => w.id !== recentWordIds.last());
  }

  // 1/3 confident, 2/3 need-practice (constrained to non-empty buckets)
  const bucket = weightedChoice(rng, {
    'need-practice': 2,
    'confident': 1,
  });

  const candidates = eligible.filter(w => w.bucket === bucket);
  const fallback   = candidates.length ? candidates : eligible;
  const next = pickRandom(rng, fallback);

  recentWordIds.pushFront(next.id);
  if (recentWordIds.length > 10) recentWordIds.pop();
  return next;
}
```

Why this is in a pure function with an injected `rng`:

1. **Deterministic tests.** A long seeded run can assert the 1:2 ratio holds
   on average (over a long enough sequence; not strictly alternating).
2. **Edge cases are testable.** Bank with <3 words; bank with words in only
   one bucket; bank with exactly 10 words; long runs. All covered by Vitest.
3. **No `Math.random()` directly.** The rule "no `Math.random` in domain
   code; inject the RNG" is the cheap way to make all of this
   reproducible.

### 4.4 Levels

The user's level (`beginner` / `intermediate` / `expert`) controls
**curriculum and sentence behavior**, not the word bank itself. Switching
level is **non-destructive** — your progress isn't touched. See
`domain/levels.ts` and ADR-009 / ADR-010 for the rules.

Sentence behavior summary:

- **Beginner:** sentences **off** until the user has ≥ 20 confident words.
  After that they unlock (and the unlock is "latched" — it doesn't flap if
  the count later dips).
- **Intermediate / Expert:** sentences **on from the start**, drawn only
  from confident words.

## 5. Persistence — Dexie / IndexedDB

All progress is local. The only "backend" is the browser's IndexedDB.

`data/db.ts` defines the Dexie schema; `data/wordBankRepo.ts` is the
**repository** — the only place in the app that reads or writes IndexedDB.
Components and hooks call `WordBankRepo` methods; they never see Dexie
directly.

The stored shapes (roughly):

```ts
type Bucket = 'need-practice' | 'confident';

interface Word {
  id: string;        // stable, e.g. 'letter:A' or 'sign:family'
  gloss: string;     // display label
  level: 'beginner' | 'intermediate' | 'expert';
}

interface WordProgress {
  wordId: string;
  bucket: Bucket;
  needPracticeStreak: number;  // → confident at 3
  timesSeen: number;
  lastSeenAt: number;
}

interface UserProfile {
  level: 'beginner' | 'intermediate' | 'expert';
  sentencesUnlocked: boolean;     // latched once ≥20 confident
  cameraExplainerSeen: boolean;
  overlayColorMode: 'classic' | 'per-finger';
}
```

This data is **per device** (IndexedDB is per origin per browser, not
shared). Cloud sync is an explicit future enhancement, not in scope.

## 6. The two modes

### Practice mode (`modes/practice/PracticeMode.tsx`)

The drill loop. Picks a word via the selection algorithm, prompts the user
to sign it, watches the recognizer, and on resolution commits a bucket
transition + persists it. The full state machine:

```
SHOW_WORD ─ user signs ─►  RECOGNIZED ─► commit "correct", next word
   │
   └─ "I forgot" ────────►  REVEAL ─► "That's what I did" ─► commit "correct"
                                  └── "Next" ─────────────► commit "wrong"
```

The "reveal" state shows the in-app sign-reference clip (rendered from
landmark data, not external video — see ADR-017) so the user can compare
what they did to what's right.

### Learn mode (`modes/learn/LearnMode.tsx`)

Guided acquisition. The user is taken through new signs one at a time: see
the reference, try it on camera, get "Good job" feedback. Once the user has
enough confident words, the level-appropriate sentence drills become
available:

- **Spell words** — fingerspelling drill that spells a small word
  letter-by-letter using the user's confident letters.
- **Sign sentences** — a sequence of confident dynamic signs prompted one
  at a time (P2M7; small, owner-reviewable list in
  `content/signSentences.ts`).

Both are gated by the same level/proficiency rules as everything else.

## 7. Drawing and overlays

While recognition runs, an overlay canvas sits on top of the `<video>` and
draws the detected skeleton. Two draw functions:

- **`drawLandmarks.ts`** (`drawHands`) — single-hand overlay for the static
  path. Dots for landmarks, lines for bones.
- **`drawHolistic.ts`** (`drawHolistic`) — full-body overlay for the
  dynamic path. Pose chain + both hands.

Both honor a user-toggleable `overlayColorMode` setting:

- **`classic`** — pink dots, blue bones (default).
- **`per-finger`** — each finger gets a distinct color from a colorblind-safe
  Okabe-Ito palette; palm/wrist are neutral. Useful for noticing finger
  positions while learning.

Both modes also drop landmarks that fall outside the frame (the off-frame
guard in `fingerColors.ts`) to avoid the "stray lines shooting to the
corner" artifact when MediaPipe extrapolates an unseen joint.

## 8. The "unified" recognizer

One subtle thing worth flagging: Practice and Learn don't switch detectors
per prompt. A single Holistic detector runs continuously, and the unified
hook picks the right *classifier* per prompted word:

- If the prompt is a letter (`isDynamicGloss(prompted) === false`), feed the
  detected hand to the static MLP.
- If the prompt is a word, feed the windowed pose+hands feature to the
  dynamic GRU.

Why: switching detectors per prompt would cause noticeable lag (each detector
needs to warm up). Running Holistic continuously and reusing its hand
landmarks for the static MLP costs almost nothing extra and makes the user
experience seamless.

## 9. Where to read deeper

- The detection-and-debounce mechanism — `recognition/debounce.ts` and its
  test, plus the per-hook tests.
- The selection algorithm and bucket transitions — `domain/selection.test.ts`
  and `domain/buckets.test.ts`. These are the most thoroughly unit-tested
  parts of the codebase.
- The camera ownership story end-to-end — `recognition/cameraProvider.tsx` +
  `recognition/cameraContext.ts` + `useCamera.ts` + ADR-018.
- The repository pattern — `data/wordBankRepo.ts` + `wordBankRepo.test.ts`
  (uses `fake-indexeddb` so the test suite can round-trip without a real
  browser).
