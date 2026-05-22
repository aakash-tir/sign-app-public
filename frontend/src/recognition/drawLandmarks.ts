import { HAND_CONNECTIONS } from './types'
import type { HandObservation } from './types'
import type { OverlayColorMode } from '../domain/types'
import {
  FINGER_COLORS,
  fingerOfConnection,
  fingerOfLandmark,
  isInFrame,
} from './fingerColors'

// Classic (default) overlay: uniform cyan bones + pink dots.
const CLASSIC_CONNECTION_COLOR = '#22d3ee'
const CLASSIC_LANDMARK_COLOR = '#f472b6'

/**
 * Draw the hand skeleton(s) onto a canvas. `colorMode` selects the look:
 * `classic` (uniform cyan/pink) or `per-finger` (each finger its own color,
 * FR-14). Coordinates are normalized [0,1] image coordinates, scaled to the
 * canvas; off-frame points/bones are skipped in both modes.
 */
export function drawHands(
  ctx: CanvasRenderingContext2D,
  hands: readonly HandObservation[],
  width: number,
  height: number,
  colorMode: OverlayColorMode = 'classic',
): void {
  ctx.clearRect(0, 0, width, height)
  const perFinger = colorMode === 'per-finger'

  for (const hand of hands) {
    const points = hand.landmarks

    ctx.lineWidth = 2
    for (const connection of HAND_CONNECTIONS) {
      const p = points[connection[0]]
      const q = points[connection[1]]
      if (!p || !q || !isInFrame(p) || !isInFrame(q)) continue
      ctx.strokeStyle = perFinger
        ? FINGER_COLORS[fingerOfConnection(connection)]
        : CLASSIC_CONNECTION_COLOR
      ctx.beginPath()
      ctx.moveTo(p.x * width, p.y * height)
      ctx.lineTo(q.x * width, q.y * height)
      ctx.stroke()
    }

    for (const [index, point] of points.entries()) {
      if (!isInFrame(point)) continue
      ctx.fillStyle = perFinger
        ? FINGER_COLORS[fingerOfLandmark(index)]
        : CLASSIC_LANDMARK_COLOR
      ctx.beginPath()
      ctx.arc(point.x * width, point.y * height, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
