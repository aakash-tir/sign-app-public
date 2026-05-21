import { useState } from 'react'
import './App.css'
import { CameraView } from './recognition/CameraView'
import { PracticeMode } from './modes/practice/PracticeMode'

type Mode = 'practice' | 'camera'

function App() {
  const [mode, setMode] = useState<Mode>('practice')

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Sign App</h1>
        <p className="tagline">
          Learn American Sign Language with your camera.
        </p>
        <nav className="mode-switch" aria-label="Mode">
          <button
            type="button"
            aria-pressed={mode === 'practice'}
            onClick={() => setMode('practice')}
          >
            Practice
          </button>
          <button
            type="button"
            aria-pressed={mode === 'camera'}
            onClick={() => setMode('camera')}
          >
            Camera
          </button>
        </nav>
      </header>

      {mode === 'practice' ? <PracticeMode /> : <CameraView />}
    </main>
  )
}

export default App
