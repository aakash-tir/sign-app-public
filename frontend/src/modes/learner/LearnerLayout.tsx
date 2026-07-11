import { Outlet } from 'react-router-dom'
import './LearnerLayout.css'

/**
 * Layout route wrapping every learner surface in the learner design language
 * (Phase 6 Q7, ADR-029): its own accent + friendlier type, scoped by class so
 * the developer surfaces keep the original tokens (dev mode, Q2).
 */
export function LearnerLayout() {
  return (
    <div className="learner-theme">
      <Outlet />
    </div>
  )
}
