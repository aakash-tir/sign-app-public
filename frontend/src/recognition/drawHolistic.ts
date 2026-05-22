import { HAND_CONNECTIONS } from './types'
import type { Landmark } from './types'
import type { HolisticObservation } from './dynamicTypes'
import type { OverlayColorMode } from '../domain/types'
import {
  FINGER_COLORS,
  fingerOfConnection,
  fingerOfLandmark,
  isInFrame,
} from './fingerColors'

const POSE_COLOR = '#a3e635'
// Classic (default) hand overlay: uniform cyan bones + pink dots.
const CLASSIC_HAND_CONNECTION_COLOR = '#22d3ee'
const CLASSIC_HAND_LANDMARK_COLOR = '#f472b6'

// Upper-body skeleton in full BlazePose (33-point) index space.
const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [11, 12], // shoulders
  [11, 13],
  [13, 15], // left arm
  [12, 14],
  [14, 16], // right arm
  [11, 23],
  [12, 24],
  [23, 24], // torso
]

/** Draw a single hand; `classic` = uniform cyan/pink, `per-finger` = FR-14 colors. */
function drawHand(
  ctx: CanvasRenderingContext2D,
  points: readonly Landmark[],
  width: number,
  height: number,
  colorMode: OverlayColorMode,
): void {
  const perFinger = colorMode === 'per-finger'
  ctx.lineWidth = 2
  for (const connection of HAND_CONNECTIONS) {
    const p = points[connection[0]]
    const q = points[connection[1]]
    if (!p || !q || !isInFrame(p) || !isInFrame(q)) continue
    ctx.strokeStyle = perFinger
      ? FINGER_COLORS[fingerOfConnection(connection)]
      : CLASSIC_HAND_CONNECTION_COLOR
    ctx.beginPath()
    ctx.moveTo(p.x * width, p.y * height)
    ctx.lineTo(q.x * width, q.y * height)
    ctx.stroke()
  }
  for (const [index, point] of points.entries()) {
    if (!isInFrame(point)) continue
    ctx.fillStyle = perFinger
      ? FINGER_COLORS[fingerOfLandmark(index)]
      : CLASSIC_HAND_LANDMARK_COLOR
    ctx.beginPath()
    ctx.arc(point.x * width, point.y * height, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Draw the upper-body pose in a single color; off-frame segments skipped. */
function drawPose(
  ctx: CanvasRenderingContext2D,
  points: readonly Landmark[],
  width: number,
  height: number,
): void {
  ctx.lineWidth = 3
  ctx.strokeStyle = POSE_COLOR
  ctx.fillStyle = POSE_COLOR
  for (const [a, b] of POSE_CONNECTIONS) {
    const p = points[a]
    const q = points[b]
    if (!p || !q || !isInFrame(p) || !isInFrame(q)) continue
    ctx.beginPath()
    ctx.moveTo(p.x * width, p.y * height)
    ctx.lineTo(q.x * width, q.y * height)
    ctx.stroke()
  }
  for (const point of points) {
    if (!isInFrame(point)) continue
    ctx.beginPath()
    ctx.arc(point.x * width, point.y * height, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * Draw the holistic skeleton (upper-body pose + both hands) onto a canvas.
 * `colorMode` selects the hand look (classic uniform vs per-finger, FR-14); the
 * pose is always drawn in a single color.
 */
export function drawHolistic(
  ctx: CanvasRenderingContext2D,
  obs: HolisticObservation,
  width: number,
  height: number,
  colorMode: OverlayColorMode = 'classic',
): void {
  ctx.clearRect(0, 0, width, height)

  if (obs.pose) drawPose(ctx, obs.pose, width, height)

  for (const hand of [obs.leftHand, obs.rightHand]) {
    if (!hand) continue
    drawHand(ctx, hand, width, height, colorMode)
  }
}
