/**
 * Empty-state shown inside a camera stage while the camera is off, so the stage
 * reads as "ready to start" rather than a broken black box (P2M3).
 */
export function CameraPlaceholder() {
  return (
    <div className="camera-placeholder" data-testid="camera-placeholder">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M2 7.5A2.5 2.5 0 0 1 4.5 5h2l1.2-1.6a1 1 0 0 1 .8-.4h7a1 1 0 0 1 .8.4L17.5 5h2A2.5 2.5 0 0 1 22 7.5v9A2.5 2.5 0 0 1 19.5 19h-15A2.5 2.5 0 0 1 2 16.5v-9Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle
          cx="12"
          cy="12"
          r="3.2"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
      <span>Camera is off</span>
    </div>
  )
}
