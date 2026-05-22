import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { useCamera } from './useCamera'
import { CameraContext, type CameraContextValue } from './cameraContext'

const fakeStream = {} as MediaStream

const onValue: CameraContextValue = {
  stream: fakeStream,
  status: 'on',
  error: null,
  start: () => {},
  stop: () => {},
}

function Inner({ showVideo }: { showVideo: boolean }) {
  const { videoRef } = useCamera()
  return showVideo ? <video ref={videoRef} data-testid="v" /> : null
}

function Harness({ showVideo }: { showVideo: boolean }) {
  return (
    <CameraContext.Provider value={onValue}>
      <Inner showVideo={showVideo} />
    </CameraContext.Provider>
  )
}

afterEach(cleanup)

describe('useCamera', () => {
  it('attaches the shared stream to a video present from the start', () => {
    const { getByTestId } = render(<Harness showVideo={true} />)
    expect((getByTestId('v') as HTMLVideoElement).srcObject).toBe(fakeStream)
  })

  it('attaches the stream to a video that mounts AFTER the stream is on (Learn loading gate)', () => {
    const { rerender, queryByTestId } = render(<Harness showVideo={false} />)
    expect(queryByTestId('v')).toBeNull()

    rerender(<Harness showVideo={true} />)
    const video = queryByTestId('v') as HTMLVideoElement
    expect(video.srcObject).toBe(fakeStream)
  })
})
