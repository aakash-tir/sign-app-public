# Sign App — How It Works

A walkthrough of how the project is built, written for someone who knows code
but wants the architecture, the machine learning, and the moving parts
explained plainly. Read these top-to-bottom or skip to whatever you're trying
to understand.

> This is the **explanatory** doc set. The shorter, milestone-tracking,
> decision-log version lives in [`../.claude/`](../.claude/CLAUDE.md) — that's
> the working notebook. These docs are the readable summary.

## The 60-second version

The Sign App is a **Progressive Web App** (PWA): a website that installs like
an app on Windows, Android, iOS, and Linux. It teaches American Sign Language
by having you perform signs in front of your camera. A small machine-learning
model running **inside your browser** decides whether you did the sign right —
no video ever leaves your device, and the whole app works offline after the
first visit.

Two halves to the project:

1. **`frontend/`** — the actual app (React + TypeScript). This is what runs in
   the browser. It owns the camera, the UI, the model, and your progress.
2. **`ml/`** — a Python pipeline that **only runs on a developer's machine** to
   train the recognition model. The output is a small model file that gets
   bundled into the frontend. Python is never on the user's critical path.

The runtime recognition pipeline is **landmark-based**, not video-based:

```
camera frame  →  MediaPipe extracts hand + body skeleton keypoints
              →  normalize the keypoints (so position/size don't matter)
              →  small neural network classifies the sign
              →  domain logic decides "correct" vs "still need practice"
```

That's the whole story. The rest is detail.

## Document map

| Doc | What you'll learn |
| --- | --- |
| [`architecture.md`](architecture.md) | The big picture. ASCII diagram of all the parts, the tech stack with one line on each choice, where every folder lives. **Start here.** |
| [`machine-learning.md`](machine-learning.md) | What is actually going on in the ML. Why landmarks instead of raw video, what models we use (a tiny MLP for letters; a GRU for words), what datasets, how training works, what accuracy we measured, and the honest caveats. |
| [`runtime.md`](runtime.md) | How the app works in the browser. Camera lifecycle, the recognition loop frame-by-frame, the "buckets" + word-selection algorithm, how progress is stored in IndexedDB, and the two modes (Learn and Practice). |
| [`deployment.md`](deployment.md) | How the app gets from the repo onto the internet. Vite, the PWA service worker, offline caching, and Cloudflare Workers — written for someone newer to web hosting. |
| [`sign-language-accuracy.xlsx`](sign-language-accuracy.xlsx) | **Per-word accuracy report** (Excel). Every trained sign with its honest accuracy, colour-coded (🟩 ≥70% · 🟨 50–70% · 🟥 <50%), marking deployed vs attempted-but-below-gate. Extensible — see its "How to update" sheet, or regenerate with [`tools/generate_accuracy_report.py`](../tools/generate_accuracy_report.py). |

## Where this docs set fits

This `docs/` folder is for **readers**. The `.claude/` folder is for **doers** —
it has the milestone plan, decision log (ADRs), open questions, and live status.
Pointers if you want them:

- [`../.claude/project-context.md`](../.claude/project-context.md) — what the
  product is supposed to do (the spec).
- [`../.claude/docs/architecture.md`](../.claude/docs/architecture.md) — the
  source for most of what you'll read in [`architecture.md`](architecture.md)
  here, with stricter referencing of decisions and milestones.
- [`../.claude/docs/recognition.md`](../.claude/docs/recognition.md) — the
  technical recognition spec; the friendlier version of it is in
  [`machine-learning.md`](machine-learning.md) here.
- [`../.claude/docs/decisions.md`](../.claude/docs/decisions.md) — Architecture
  Decision Records (ADRs). Cited from these docs where relevant.
- [`../.claude/progress.md`](../.claude/progress.md) — what's done, what's in
  progress, what's next.

## Current state at a glance

Phases 1–4 are done; the app is live at
`https://sign-app.aakashtirathdas.workers.dev`.

What ships today:

- 24 static fingerspelling letters (the alphabet minus the two motion letters
  J and Z).
- **79 dynamic word-level signs** (honest signer-disjoint top-1 **73.2%**; the
  full per-word breakdown is in
  [`sign-language-accuracy.xlsx`](sign-language-accuracy.xlsx)).
- Learn mode and Practice mode, with sentence drills gated by level
  (ADR-009), plus a **Search** tab (type a word → see how to sign it, with
  typo-tolerant suggestions and a fingerspelling fallback).
- Persistent camera across views, in-app sign reference rendered from
  landmark data, full offline capability after first load.
