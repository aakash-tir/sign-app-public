/**
 * Minimal recording stand-in for a `CanvasRenderingContext2D`, used to unit-test
 * the overlay draw functions without a real canvas. It records the color in
 * effect at each `stroke()` / `fill()` so tests can assert per-finger coloring,
 * plus call counts for the off-frame skip guard.
 */
export interface RecordingCanvas {
  ctx: CanvasRenderingContext2D
  calls: {
    clearRect: number
    /** strokeStyle in effect at each stroke() call, in order. */
    strokes: string[]
    /** fillStyle in effect at each fill() call, in order. */
    fills: string[]
    /** [x, y, radius] for each arc() call. */
    arcs: Array<[number, number, number]>
  }
}

export function createRecordingCanvas(): RecordingCanvas {
  const calls: RecordingCanvas['calls'] = {
    clearRect: 0,
    strokes: [],
    fills: [],
    arcs: [],
  }
  let strokeStyle = ''
  let fillStyle = ''

  const ctx = {
    lineWidth: 0,
    get strokeStyle(): string {
      return strokeStyle
    },
    set strokeStyle(value: string) {
      strokeStyle = value
    },
    get fillStyle(): string {
      return fillStyle
    },
    set fillStyle(value: string) {
      fillStyle = value
    },
    clearRect(): void {
      calls.clearRect++
    },
    beginPath(): void {},
    moveTo(): void {},
    lineTo(): void {},
    stroke(): void {
      calls.strokes.push(strokeStyle)
    },
    arc(x: number, y: number, radius: number): void {
      calls.arcs.push([x, y, radius])
    },
    fill(): void {
      calls.fills.push(fillStyle)
    },
  }

  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}
