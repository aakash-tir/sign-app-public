import { NavLink } from 'react-router-dom'
import './CoursePathSwitch.css'

/**
 * The two always-open course paths (plan §2.3): words and the alphabet.
 * Rendered on each path's list screen (not mid-session).
 */
export function CoursePathSwitch() {
  return (
    <nav className="course-path-switch" aria-label="Course paths">
      <NavLink to="/course" end>
        Words
      </NavLink>
      <NavLink to="/course/alphabet">Alphabet</NavLink>
    </nav>
  )
}
