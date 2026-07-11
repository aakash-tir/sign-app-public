import { useEffect } from 'react'
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
import { DynamicSignView } from './modes/dynamic/DynamicSignView'
import { SearchView } from './modes/search/SearchView'
import { SentencesView } from './modes/sentences/SentencesView'
import { LearnerLayout } from './modes/learner/LearnerLayout'
import { LearnerHome } from './modes/learner/LearnerHome'
import { WordsPathView } from './modes/learner/WordsPathView'
import { AlphabetPathView } from './modes/learner/AlphabetPathView'
import { loadOverlayColorMode } from './recognition/overlayColorMode'
import { loadDevMode, useDevMode } from './devMode'
import { CameraProvider } from './recognition/cameraProvider'

function App() {
  // Hydrate persisted UI preferences once.
  useEffect(() => {
    void loadOverlayColorMode()
    void loadDevMode()
  }, [])

  const devMode = useDevMode()

  return (
    <CameraProvider>
      <BrowserRouter>
        <div className="app-shell">
          <header className="app-header">
            <h1>Sign App</h1>
            <nav className="mode-switch" aria-label="Main">
              <NavLink to="/" end>
                Home
              </NavLink>
              <NavLink to="/course">Course</NavLink>
              <NavLink to="/sentences">Sentences</NavLink>
              <NavLink to="/search">Search</NavLink>
              <NavLink to="/settings">Settings</NavLink>
              {devMode && (
                <>
                  <NavLink to="/practice">Practice</NavLink>
                  <NavLink to="/learn">Learn</NavLink>
                  <NavLink to="/signs">Signs</NavLink>
                  <NavLink to="/camera">Camera</NavLink>
                </>
              )}
            </nav>
          </header>

          <main className="app-main">
            <Routes>
              {/* The learner app (Phase 6, ADR-029) — the default surfaces. */}
              <Route element={<LearnerLayout />}>
                <Route path="/" element={<LearnerHome />} />
                <Route path="/course" element={<WordsPathView />} />
                <Route path="/course/alphabet" element={<AlphabetPathView />} />
                <Route path="/sentences" element={<SentencesView />} />
                <Route path="/search" element={<SearchView />} />
                <Route path="/settings" element={<SettingsView />} />
              </Route>

              {/* Developer surfaces (Q2): nav tabs appear in dev mode; the
                  routes stay reachable by URL either way. */}
              <Route path="/practice" element={<PracticeMode />} />
              <Route path="/learn" element={<LearnMode />} />
              <Route path="/signs" element={<DynamicSignView />} />
              <Route path="/camera" element={<CameraView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </CameraProvider>
  )
}

export default App
