import { useEffect, useState, type FormEvent } from 'react'
import { useDynamicSignRecognition } from '../../recognition/useDynamicSignRecognition'
import { DynamicSignStage } from '../../recognition/DynamicSignStage'
import { SignReferencePlayer } from '../../recognition/SignReferencePlayer'
import { matchSign, type SignMatch } from '../../domain/signSearch'
import './SearchView.css'

/**
 * Search for a sign to learn (P4M1, FR-19). The learner types a sign; if it's one
 * of the shipped dynamic signs (exact + synonym + case-insensitive match, ADR-021)
 * the app shows how to sign it (the reference animation) plus a camera that
 * recognizes that specific sign. Otherwise it reports the sign isn't in the system
 * yet. The reference renders without the camera, so "how to sign it" is visible
 * (and works offline) before the learner enables their camera.
 */
export function SearchView() {
  const recognition = useDynamicSignRecognition()
  const { setTarget } = recognition
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SignMatch | null>(null)

  // Lock the recognizer's target to the matched gloss (or clear it).
  useEffect(() => {
    setTarget(result?.status === 'found' ? result.gloss : null)
  }, [result, setTarget])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setResult(matchSign(query))
  }

  return (
    <section className="search-view" aria-label="Search for a sign">
      <form className="sign-search-form" role="search" onSubmit={handleSubmit}>
        <label className="sign-search-label">
          Search for a sign to learn
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. father, thank you, help"
            data-testid="sign-search-input"
            autoFocus
          />
        </label>
        <button type="submit">Search</button>
      </form>

      {result?.status === 'not-found' && (
        <p
          className="sign-search-missing"
          role="status"
          data-testid="sign-search-missing"
        >
          {result.query
            ? `“${result.query}” isn’t in the system yet.`
            : 'Type a sign to search for.'}
        </p>
      )}

      {result?.status === 'found' && (
        <div className="sign-search-result">
          <p role="status" data-testid="sign-search-found">
            Here’s how to sign “{result.gloss}”. Enable the camera to practice
            it.
          </p>
          <SignReferencePlayer gloss={result.gloss} />
          <DynamicSignStage
            recognition={recognition}
            ariaLabel={`Practice the sign “${result.gloss}”`}
            showReference={false}
          />
        </div>
      )}
    </section>
  )
}
