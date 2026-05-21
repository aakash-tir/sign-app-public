import './App.css'
import { CameraView } from './recognition/CameraView'

function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Sign App</h1>
        <p className="tagline">
          Learn American Sign Language with your camera.
        </p>
      </header>
      <CameraView />
    </main>
  )
}

export default App
