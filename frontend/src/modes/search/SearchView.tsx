import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { useDynamicSignRecognition } from '../../recognition/useDynamicSignRecognition'
import { DynamicSignStage } from '../../recognition/DynamicSignStage'
import { SignReferencePlayer } from '../../recognition/SignReferencePlayer'
import { FingerspellStage } from '../../recognition/FingerspellStage'
import { fingerspellingModel } from '../../recognition/signClassifier'
import {
  autocomplete,
  matchSign,
  type SignMatch,
} from '../../domain/signSearch'
import { fingerspellLetters } from '../../domain/fingerspell'
import './SearchView.css'

/** Letters the static fingerspelling model recognizes (the ASL alphabet − J/Z). */
const ALPHABET: ReadonlySet<string> = new Set(fingerspellingModel.labels)

const LISTBOX_ID = 'sign-search-listbox'
const optionId = (index: number) => `sign-search-option-${index}`

/**
 * Search for a sign to learn (P4M1/P4M9, FR-19). The learner types a sign; if
 * it's one of the shipped dynamic signs (exact + synonym + stem + case-insensitive
 * match, ADR-021) the app shows how to sign it (the reference animation) plus a
 * camera that recognizes that specific sign. A near miss offers "did you mean…"
 * suggestions; a true miss that can still be fingerspelled offers a spell-it-out
 * fallback. Otherwise it reports the sign isn't in the system yet.
 */
export function SearchView() {
  const recognition = useDynamicSignRecognition()
  const { setTarget } = recognition
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SignMatch | null>(null)
  const [spelling, setSpelling] = useState<string[] | null>(null)
  // As-you-type autocomplete dropdown state.
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  // Lock the recognizer's target to the matched gloss (or clear it).
  useEffect(() => {
    setTarget(result?.status === 'found' ? result.gloss : null)
  }, [result, setTarget])

  const options = useMemo(() => autocomplete(query), [query])
  const showOptions = isOpen && options.length > 0

  const runSearch = (term: string) => {
    setResult(matchSign(term))
    setSpelling(null)
    setIsOpen(false)
    setActiveIndex(-1)
  }

  const handleChange = (value: string) => {
    setQuery(value)
    setIsOpen(true)
    setActiveIndex(-1)
  }

  // Pick a suggestion (click, or Enter/arrow selection): search that exact gloss.
  const handleSuggestion = (gloss: string) => {
    setQuery(gloss)
    runSearch(gloss)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const active = options[activeIndex]
    if (showOptions && active) handleSuggestion(active)
    else runSearch(query)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!showOptions) {
        setIsOpen(true)
        return
      }
      setActiveIndex((i) => (i + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      if (!showOptions) return
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  // The word the learner could fingerspell instead, when nothing matched.
  const missLetters = useMemo(() => {
    if (result?.status !== 'not-found') return null
    return fingerspellLetters(result.query, ALPHABET)
  }, [result])

  return (
    <section className="search-view" aria-label="Search for a sign">
      <form className="sign-search-form" role="search" onSubmit={handleSubmit}>
        <label className="sign-search-label">
          Search for a sign to learn
          <div className="sign-search-combobox">
            <input
              type="search"
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => setIsOpen(false)}
              placeholder="e.g. father, thank you, help"
              data-testid="sign-search-input"
              role="combobox"
              aria-expanded={showOptions}
              aria-controls={LISTBOX_ID}
              aria-autocomplete="list"
              aria-activedescendant={
                activeIndex >= 0 ? optionId(activeIndex) : undefined
              }
              autoComplete="off"
              autoFocus
            />
            {showOptions && (
              <ul
                className="sign-search-options"
                id={LISTBOX_ID}
                role="listbox"
                data-testid="sign-search-options"
              >
                {options.map((gloss, index) => (
                  <li
                    key={gloss}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={
                      index === activeIndex
                        ? 'sign-search-option is-active'
                        : 'sign-search-option'
                    }
                    data-testid="sign-search-option"
                    // Keep focus on the input so the click lands before blur closes the list.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSuggestion(gloss)}
                  >
                    {gloss}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </label>
        <button type="submit">Search</button>
      </form>

      {result?.status === 'suggestions' && (
        <div
          className="sign-search-suggestions"
          data-testid="sign-search-suggestions"
        >
          <p role="status">“{result.query}” isn’t a sign here. Did you mean:</p>
          <div className="suggestion-chips">
            {result.suggestions.map((gloss) => (
              <button
                key={gloss}
                type="button"
                className="suggestion-chip"
                data-testid="suggestion-chip"
                onClick={() => handleSuggestion(gloss)}
              >
                {gloss}
              </button>
            ))}
          </div>
        </div>
      )}

      {result?.status === 'not-found' && (
        <div className="sign-search-missing-block">
          <p
            className="sign-search-missing"
            role="status"
            data-testid="sign-search-missing"
          >
            {result.query
              ? `“${result.query}” isn’t in the system yet.`
              : 'Type a sign to search for.'}
          </p>
          {missLetters && spelling === null && (
            <button
              type="button"
              data-testid="fingerspell-offer"
              onClick={() => setSpelling(missLetters)}
            >
              Fingerspell “{result.query}” instead
            </button>
          )}
          {spelling && (
            <FingerspellStage
              key={result.query}
              letters={spelling}
              word={result.query}
            />
          )}
        </div>
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
