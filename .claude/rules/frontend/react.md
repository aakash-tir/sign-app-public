# Frontend rules — React + TypeScript

Applies to `frontend/`. Architecture context: [`../../docs/architecture.md`](../../docs/architecture.md).

## Language & types

- **TypeScript strict** (`strict: true`, `noUncheckedIndexedAccess: true`). No
  `any` — use `unknown` + narrowing. `tsc --noEmit` must pass (gate).
- Prefer `type` aliases for domain models; keep them in `src/domain/`.

## Components

- **Function components + hooks** only.
- Keep components presentational; push logic into `src/domain/` (pure TS) or hooks.
- One component per file; colocate component-specific styles/tests.
- Name event handlers `handleX`; name boolean props/state `isX`/`hasX`.

## Domain logic must stay pure

- Bucket transitions, the practice selection algorithm, and proficiency rules live
  in `src/domain/` as **pure, framework-free functions** with **seedable RNG**
  (no `Math.random` directly — inject it) so they are deterministically testable.
- React/Zustand/Dexie are thin layers *around* this core, never inside it.

## State & data

- **Zustand** for app/UI state; keep stores small and selector-based.
- **Dexie/IndexedDB** access only through repository modules in `src/data/`.
  Components never touch IndexedDB directly.

## Recognition layer

- All camera + MediaPipe + classifier code lives in `src/recognition/` — the
  static JSON-MLP (`mlpClassifier.ts`) and the dynamic ONNX runtime
  (`onnxDynamicClassifier.ts`, `onnxruntime-web`). There is no TF.js.
- The **camera is owned by the app-level `CameraProvider`** (one shared
  `MediaStream`, mounted above the router) — see **ADR-018**. Views attach/detach
  the shared stream via `useCamera`/`useCameraContext` but **never call
  `getUserMedia` or stop the stream on unmount**; only `stop()` (user action) or app
  teardown releases the device. *(This supersedes the original "always release the
  camera on unmount" rule.)* MediaPipe **detectors** are still closed on unmount.
- Recognition emits `{ label, confidence }`; the **threshold + debounce** decision
  lives in domain/recognition glue, not in UI components.
- Mirror the normalization spec exactly (see [`../../docs/recognition.md`](../../docs/recognition.md) §5); changes require updating the golden-vector fixtures on both TS and Python sides.

## Styling & a11y

- Mobile-first, responsive (phone + desktop).
- Respect camera/permission states with clear UI; never hard-crash on denied
  permission.

## Quality gates (must pass before PR merge)

- `prettier --check` · `eslint` (no warnings) · `tsc --noEmit` · `vitest` ·
  `playwright test`.

## Testing

- **Vitest** for domain logic and adapters (fast, deterministic, seeded RNG).
- **Playwright** for component/e2e flows; stub recognition with a fake model so
  tests are deterministic and don't need a real camera.
- Every milestone adds tests proving its features (see milestones doc).
