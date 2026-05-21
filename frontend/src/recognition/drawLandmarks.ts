import { HAND_CONNECTIONS } from './types'
import type { HandObservation } from './types'

const CONNECTION_COLOR = '#22d3ee'
const LANDMARK_COLOR = '#f472b6'

/**
 * Draw the hand skeleton(s) onto a canvas. Landmark coordinates are normalized
 * [0,1] image coordinates, scaled here to the canvas dimensions.
 */
export function drawHands(
  ctx: CanvasRenderingContext2D,
  hands: readonly HandObservation[],
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height)

  for (const hand of hands) {
    const points = hand.landmarks

    ctx.lineWidth = 2
    ctx.strokeStyle = CONNECTION_COLOR
    for (const [a, b] of HAND_CONNECTIONS) {
      const p = points[a]
      const q = points[b]
      if (!p || !q) continue
      ctx.beginPath()
      ctx.moveTo(p.x * width, p.y * height)
      ctx.lineTo(q.x * width, q.y * height)
      ctx.stroke()
    }

    ctx.fillStyle = LANDMARK_COLOR
    for (const point of points) {
      ctx.beginPath()
      ctx.arc(point.x * width, point.y * height, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
