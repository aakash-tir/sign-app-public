import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { UseDynamicSignRecognition } from '../../recognition/useDynamicSignRecognition'

// Controllable stub for the dynamic recognition hook.
const mocks = vi.hoisted(() => {
  const state: UseDynamicSignRecognition = {
    videoRef: { current: null },
    canvasRef: { current: null },
    status: 'idle',
    error: null,
    trackerError: null,
    labels: [],
    prediction: null,
    target: null,
    setTarget: vi.fn(),
    accepted: false,
    start: vi.fn(),
    stop: vi.fn(),
  }
  return { state }
})

vi.mock('../../recognition/useDynamicSignRecognition', () => ({
  useDynamicSignRecognition: () => mocks.state,
}))

import { DynamicSignView } from './DynamicSignView'

beforeEach(() => {
  Object.assign(mocks.state, {
    status: 'idle',
    labels: [],
    prediction: null,
    target: null,
    accepted: false,
  })
})

describe('DynamicSignView', () => {
  it('shows the enable button when idle', () => {
    render(<DynamicSignView />)
    expect(
      screen.getByRole('button', { name: /enable camera/i }),
    ).toBeInTheDocument()
  })

  it('lists model labels and shows a prediction when the camera is on', () => {
    Object.assign(mocks.state, {
      status: 'on',
      labels: ['yes', 'no'],
      prediction: { label: 'yes', confidence: 0.82, probs: [0.82, 0.18] },
    })
    render(<DynamicSignView />)
    expect(screen.getByTestId('camera-status')).toHaveTextContent(/camera on/i)
    expect(screen.getByTestId('dynamic-target')).toBeInTheDocument()
    expect(screen.getByTestId('prediction')).toHaveTextContent('yes')
    expect(screen.getByTestId('prediction')).toHaveTextContent('82%')
  })

  it('shows an acceptance prompt once a target is chosen', () => {
    Object.assign(mocks.state, {
      status: 'on',
      labels: ['yes', 'no'],
      target: 'yes',
      accepted: true,
      prediction: { label: 'yes', confidence: 0.9, probs: [0.9, 0.1] },
    })
    render(<DynamicSignView />)
    expect(screen.getByTestId('dynamic-accepted')).toHaveTextContent(/yes/i)
  })
})
