import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { CameraProvider } from './cameraProvider'
import { useCameraContext } from './cameraContext'
import { SignAppDB } from '../data/db'
import { WordBankRepo } from '../data/wordBankRepo'

function TestConsumer() {
  const { status, start, stop } = useCameraContext()
  return (
    <div>
      <span data-testid="status">{status}</span>
      <button onClick={start}>start</button>
      <button onClick={stop}>stop</button>
    </div>
  )
}

let counter = 0
let database: SignAppDB
let repo: WordBankRepo
let track: { stop: ReturnType<typeof vi.fn> }
let getUserMedia: ReturnType<typeof vi.fn>

beforeEach(async () => {
  database = new SignAppDB(`test-camera-${++counter}`)
  await database.open()
  repo = new WordBankRepo(database)
  track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] } as unknown as MediaStream
  getUserMedia = vi.fn().mockResolvedValue(stream)
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  })
})

afterEach(async () => {
  cleanup()
  await database.delete()
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    configurable: true,
  })
})

// Let the provider's async load of `cameraExplainerSeen` settle.
async function flushProfileLoad() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('CameraProvider', () => {
  it('shows the one-time explainer before the first enable, then turns on', async () => {
    render(
      <CameraProvider repo={repo}>
        <TestConsumer />
      </CameraProvider>,
    )
    fireEvent.click(screen.getByText('start'))

    expect(await screen.findByTestId('camera-explainer')).toBeInTheDocument()
    expect(getUserMedia).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('camera-explainer-continue'))
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('on'),
    )
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('camera-explainer')).toBeNull()
  })

  it('skips the explainer once it has been acknowledged (persisted)', async () => {
    await repo.setCameraExplainerSeen(true)
    render(
      <CameraProvider repo={repo}>
        <TestConsumer />
      </CameraProvider>,
    )
    await flushProfileLoad()

    fireEvent.click(screen.getByText('start'))
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('on'),
    )
    expect(screen.queryByTestId('camera-explainer')).toBeNull()
  })

  it('stop() turns the camera off and releases the device', async () => {
    await repo.setCameraExplainerSeen(true)
    render(
      <CameraProvider repo={repo}>
        <TestConsumer />
      </CameraProvider>,
    )
    await flushProfileLoad()

    fireEvent.click(screen.getByText('start'))
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('on'),
    )

    fireEvent.click(screen.getByText('stop'))
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('idle'),
    )
    expect(track.stop).toHaveBeenCalled()
  })

  it('releases the camera when the tab is hidden and resumes when visible', async () => {
    await repo.setCameraExplainerSeen(true)
    render(
      <CameraProvider repo={repo}>
        <TestConsumer />
      </CameraProvider>,
    )
    await flushProfileLoad()
    fireEvent.click(screen.getByText('start'))
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('on'),
    )
    expect(getUserMedia).toHaveBeenCalledTimes(1)

    // Tab hidden → release the device, but stay logically "on".
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(track.stop).toHaveBeenCalled()
    expect(screen.getByTestId('status')).toHaveTextContent('on')

    // Tab visible again → re-acquire silently (no second explainer/prompt).
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2))
    expect(screen.queryByTestId('camera-explainer')).toBeNull()
  })
})
