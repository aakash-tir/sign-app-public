import { describe, it, expect } from 'vitest'
import { toHolisticObservation } from './holisticDetector'

type ResultArg = Parameters<typeof toHolisticObservation>[0]

describe('toHolisticObservation', () => {
  it('takes the first detected group for each part', () => {
    const result = {
      poseLandmarks: [[{ x: 1, y: 2, z: 3 }]],
      leftHandLandmarks: [[{ x: 4, y: 5, z: 6 }]],
      rightHandLandmarks: [[{ x: 7, y: 8, z: 9 }]],
    } satisfies ResultArg
    const obs = toHolisticObservation(result)
    expect(obs.pose).toEqual([{ x: 1, y: 2, z: 3 }])
    expect(obs.leftHand).toEqual([{ x: 4, y: 5, z: 6 }])
    expect(obs.rightHand).toEqual([{ x: 7, y: 8, z: 9 }])
  })

  it('returns null for an absent or empty group', () => {
    const result = {
      poseLandmarks: [],
      leftHandLandmarks: [[]],
      rightHandLandmarks: [[{ x: 1, y: 1, z: 1 }]],
    } satisfies ResultArg
    const obs = toHolisticObservation(result)
    expect(obs.pose).toBeNull()
    expect(obs.leftHand).toBeNull()
    expect(obs.rightHand).not.toBeNull()
  })

  it('strips extra landmark fields (e.g. visibility) down to x,y,z', () => {
    const result = {
      poseLandmarks: [[{ x: 1, y: 2, z: 3, visibility: 0.9 }]],
      leftHandLandmarks: [],
      rightHandLandmarks: [],
    } as unknown as ResultArg
    const obs = toHolisticObservation(result)
    expect(Object.keys(obs.pose![0]!).sort()).toEqual(['x', 'y', 'z'])
  })
})
