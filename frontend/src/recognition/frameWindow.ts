import { FRAME_FEATURE_DIM } from './dynamicNormalization'

/** Frames per inference window (~1s at ~30 FPS). Tunable; matches the trainer. */
export const WINDOW_SIZE = 30

/** Target sampling cadence (~30 FPS) so capture rate is device-independent. */
export const DEFAULT_FRAME_INTERVAL_MS = 1000 / 30

/**
 * Should we sample a frame now? Pure helper so the capture loop stays device- and
 * `requestAnimationFrame`-rate independent: sample only once `intervalMs` has
 * elapsed since the last accepted sample (`null` = nothing sampled yet).
 */
export function shouldSampleFrame(
  lastSampleMs: number | null,
  nowMs: number,
  intervalMs: number = DEFAULT_FRAME_INTERVAL_MS,
): boolean {
  return lastSampleMs === null || nowMs - lastSampleMs >= intervalMs
}

/**
 * Fixed-capacity ring of frame feature vectors. Holds the most recent
 * `capacity` frames; once `capacity` have been pushed it is `isReady` and
 * {@link toSequence} returns exactly that many frames. Before then,
 * {@link toSequence} **front zero-pads** so the output shape is always
 * `capacity × frameDim` — the trainer pads identically.
 *
 * Pure and framework-free → deterministically unit-testable (no camera).
 */
export class FrameWindow {
  private readonly capacity: number
  private readonly frameDim: number
  private frames: number[][] = []

  constructor(
    capacity: number = WINDOW_SIZE,
    frameDim: number = FRAME_FEATURE_DIM,
  ) {
    if (capacity < 1) {
      throw new Error('capacity must be >= 1')
    }
    this.capacity = capacity
    this.frameDim = frameDim
  }

  /** Append one frame (must have exactly `frameDim` values); evicts the oldest. */
  push(frame: number[]): void {
    if (frame.length !== this.frameDim) {
      throw new Error(
        `Expected frame of length ${this.frameDim}, got ${frame.length}`,
      )
    }
    this.frames.push(frame)
    if (this.frames.length > this.capacity) {
      this.frames.shift()
    }
  }

  /** Number of real frames currently buffered (≤ capacity). */
  get size(): number {
    return this.frames.length
  }

  /** True once a full window has been captured. */
  get isReady(): boolean {
    return this.frames.length >= this.capacity
  }

  /**
   * The window as a `capacity × frameDim` matrix (copy). When fewer than
   * `capacity` real frames exist, all-zero frames are prepended so older
   * positions read as "no signal".
   */
  toSequence(): number[][] {
    const pad = this.capacity - this.frames.length
    if (pad <= 0) {
      return this.frames.map((f) => [...f])
    }
    const padding = Array.from({ length: pad }, () =>
      new Array<number>(this.frameDim).fill(0),
    )
    return [...padding, ...this.frames.map((f) => [...f])]
  }

  reset(): void {
    this.frames = []
  }
}
