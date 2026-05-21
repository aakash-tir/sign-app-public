/**
 * Temporal debounce for per-frame predictions. A new label must be seen for
 * `required` consecutive frames before it becomes the stable output, which cuts
 * the flicker from noisy single-frame predictions. A `null` frame (no hand /
 * below threshold) breaks the streak but keeps the last stable label.
 */
export class LabelStabilizer {
  private readonly required: number
  private stableLabel: string | null = null
  private candidate: string | null = null
  private streak = 0

  constructor(required: number) {
    if (required < 1) {
      throw new Error('required must be >= 1')
    }
    this.required = required
  }

  /** Feed one frame's accepted label (or null). Returns the current stable label. */
  push(label: string | null): string | null {
    if (label === null) {
      this.candidate = null
      this.streak = 0
      return this.stableLabel
    }
    if (label === this.candidate) {
      this.streak += 1
    } else {
      this.candidate = label
      this.streak = 1
    }
    if (this.streak >= this.required) {
      this.stableLabel = label
    }
    return this.stableLabel
  }

  get stable(): string | null {
    return this.stableLabel
  }

  reset(): void {
    this.stableLabel = null
    this.candidate = null
    this.streak = 0
  }
}
