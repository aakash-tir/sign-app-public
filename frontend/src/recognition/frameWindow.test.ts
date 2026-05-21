import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FRAME_INTERVAL_MS,
  FrameWindow,
  WINDOW_SIZE,
  shouldSampleFrame,
} from './frameWindow'
import { FRAME_FEATURE_DIM } from './dynamicNormalization'

describe('FrameWindow', () => {
  it('rejects frames of the wrong dimension', () => {
    const w = new FrameWindow(3, 2)
    expect(() => w.push([1])).toThrow()
    expect(() => w.push([1, 2, 3])).toThrow()
  })

  it('rejects a capacity below 1', () => {
    expect(() => new FrameWindow(0, 2)).toThrow()
  })

  it('counts buffered frames and caps at capacity, evicting the oldest', () => {
    const w = new FrameWindow(3, 1)
    w.push([1])
    w.push([2])
    expect(w.size).toBe(2)
    w.push([3])
    w.push([4]) // evicts [1]
    expect(w.size).toBe(3)
    expect(w.toSequence()).toEqual([[2], [3], [4]])
  })

  it('is not ready until a full window is captured', () => {
    const w = new FrameWindow(3, 1)
    expect(w.isReady).toBe(false)
    w.push([1])
    w.push([2])
    expect(w.isReady).toBe(false)
    w.push([3])
    expect(w.isReady).toBe(true)
  })

  it('front zero-pads when fewer than capacity frames exist', () => {
    const w = new FrameWindow(3, 2)
    w.push([1, 1])
    expect(w.toSequence()).toEqual([
      [0, 0],
      [0, 0],
      [1, 1],
    ])
  })

  it('returns copies, not internal references', () => {
    const w = new FrameWindow(2, 1)
    w.push([1])
    const seq = w.toSequence()
    seq[1]![0] = 999
    expect(w.toSequence()).toEqual([[0], [1]])
  })

  it('reset clears the buffer', () => {
    const w = new FrameWindow(2, 1)
    w.push([1])
    w.push([2])
    w.reset()
    expect(w.size).toBe(0)
    expect(w.isReady).toBe(false)
  })

  it('defaults to WINDOW_SIZE × FRAME_FEATURE_DIM', () => {
    const w = new FrameWindow()
    w.push(new Array(FRAME_FEATURE_DIM).fill(0))
    const seq = w.toSequence()
    expect(seq).toHaveLength(WINDOW_SIZE)
    expect(seq[0]).toHaveLength(FRAME_FEATURE_DIM)
  })
})

describe('shouldSampleFrame', () => {
  it('always samples the first frame', () => {
    expect(shouldSampleFrame(null, 0)).toBe(true)
    expect(shouldSampleFrame(null, 12345)).toBe(true)
  })

  it('samples once the interval has elapsed', () => {
    expect(shouldSampleFrame(0, 100, 33)).toBe(true)
    expect(shouldSampleFrame(0, 33, 33)).toBe(true) // boundary is inclusive
  })

  it('skips before the interval elapses', () => {
    expect(shouldSampleFrame(0, 32, 33)).toBe(false)
    expect(shouldSampleFrame(1000, 1010, 33)).toBe(false)
  })

  it('uses the default ~30 FPS interval', () => {
    expect(shouldSampleFrame(0, DEFAULT_FRAME_INTERVAL_MS)).toBe(true)
    expect(shouldSampleFrame(0, DEFAULT_FRAME_INTERVAL_MS - 0.001)).toBe(false)
  })
})
