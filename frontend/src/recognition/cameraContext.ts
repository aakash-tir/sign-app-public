import { createContext, useContext } from 'react'

export type CameraStatus = 'idle' | 'starting' | 'on' | 'error'

export interface CameraContextValue {
  /** The single shared MediaStream, or null when the camera is off. */
  stream: MediaStream | null
  status: CameraStatus
  error: string | null
  /** Request the camera; shows the one-time privacy explainer first if needed. */
  start: () => void
  /** Turn the shared camera off (releases the device). */
  stop: () => void
}

const noop = (): void => {}

export const CameraContext = createContext<CameraContextValue>({
  stream: null,
  status: 'idle',
  error: null,
  start: noop,
  stop: noop,
})

/** Access the app-level shared camera (see ADR-018). */
export function useCameraContext(): CameraContextValue {
  return useContext(CameraContext)
}
