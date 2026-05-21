import { HAND_CONNECTIONS } from './types'
import type { Landmark } from './types'
import type { HolisticObservation } from './dynamicTypes'

const POSE_COLOR = '#a3e635'
const HAND_CONNECTION_COLOR = '#22d3ee'
const HAND_LANDMARK_COLOR = '#f472b6'

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

function drawPoints(
  ctx: CanvasRenderingContext2D,
  points: readonly Landmark[],
  width: number,
  height: number,
  radius: number,
): void {
  for (const p of points) {
    ctx.beginPath()
    ctx.arc(p.x * width, p.y * height, radius, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawConnections(
  ctx: CanvasRenderingContext2D,
  points: readonly Landmark[],
  connections: ReadonlyArray<readonly [number, number]>,
  width: number,
  height: number,
): void {
  for (const [a, b] of connections) {
    const p = points[a]
    const q = points[b]
    if (!p || !q) continue
    ctx.beginPath()
    ctx.moveTo(p.x * width, p.y * height)
    ctx.lineTo(q.x * width, q.y * height)
    ctx.stroke()
  }
}

/** Draw the holistic skeleton (upper-body pose + both hands) onto a canvas. */
export function drawHolistic(
  ctx: CanvasRenderingContext2D,
  obs: HolisticObservation,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height)

  if (obs.pose) {
    ctx.lineWidth = 3
    ctx.strokeStyle = POSE_COLOR
    ctx.fillStyle = POSE_COLOR
    drawConnections(ctx, obs.pose, POSE_CONNECTIONS, width, height)
    drawPoints(ctx, obs.pose, width, height, 3)
  }

  for (const hand of [obs.leftHand, obs.rightHand]) {
    if (!hand) continue
    ctx.lineWidth = 2
    ctx.strokeStyle = HAND_CONNECTION_COLOR
    drawConnections(ctx, hand, HAND_CONNECTIONS, width, height)
    ctx.fillStyle = HAND_LANDMARK_COLOR
    drawPoints(ctx, hand, width, height, 3)
  }
}
