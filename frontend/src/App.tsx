import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'
import './App.css'
import { CameraView } from './recognition/CameraView'
import { PracticeMode } from './modes/practice/PracticeMode'
import { LearnMode } from './modes/learn/LearnMode'
import { SettingsView } from './modes/settings/SettingsView'

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <h1>Sign App</h1>
          <nav className="mode-switch" aria-label="Main">
            <NavLink to="/practice">Practice</NavLink>
            <NavLink to="/learn">Learn</NavLink>
            <NavLink to="/settings">Settings</NavLink>
            <NavLink to="/camera">Camera</NavLink>
          </nav>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/practice" replace />} />
            <Route path="/practice" element={<PracticeMode />} />
            <Route path="/learn" element={<LearnMode />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/camera" element={<CameraView />} />
            <Route path="*" element={<Navigate to="/practice" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
