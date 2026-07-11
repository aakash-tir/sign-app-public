import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DynamicSignStage } from '../../recognition/DynamicSignStage'
import { SignReferencePlayer } from '../../recognition/SignReferencePlayer'
import type { UseDynamicSignRecognition } from '../../recognition/useDynamicSignRecognition'
import type { SignSentence } from '../../domain/sentences'
import './SentencesView.css'

interface SentenceDrillProps {
  /** The sentence to perform. **Key the component uniquely per drill run**
   * (e.g. a round counter + `sentence.id`) so each run remounts the drill and
   * resets its word index — the same sentence can be picked twice in a row. */
  sentence: SignSentence
  /** Live recognition state — shared with the parent's camera surface. */
  recognition: UseDynamicSignRecognition
  /**
   * Fires when the learner advances past the last word (recognizer accept or
   * the valve). Parents guard their own side effects against double-fire.
   */
  onComplete: () => void
  /**
   * Parent-controlled done flag: chips render all-done and `feedback` replaces
   * the camera stage (the Sentences tab keeps the chips visible under its
   * "next sentence" feedback).
   */
  isDone?: boolean
  feedback?: ReactNode
  /** Extra action (e.g. a Skip button) rendered beside the valve. */
  secondaryAction?: ReactNode
  /** `false` on learner surfaces — clean video, no landmark overlay (Phase 6 §3). */
  showOverlay?: boolean
}

/**
 * The per-word sentence drill (Phase 5, ADR-028) — sentence chips with the
 * current word highlighted, its stick-figure reference, the shared recognition
 * stage, and the "That's what I did" valve (ADR-008). One word at a time,
 * advancing on the per-sign calibrated accept's **rising edge** (ADR-025).
 * Extracted from `SentencesView` (P6M5) so the learner course's sentence
 * stage reuses the exact same drill.
 */
export function SentenceDrill({
  sentence,
  recognition,
  onComplete,
  isDone = false,
  feedback,
  secondaryAction,
  showOverlay = true,
}: SentenceDrillProps) {
  const { setTarget, accepted } = recognition
  const [index, setIndex] = useState(0)

  // Lock the recognizer's target to the current word of the sequence.
  const currentSign =
    !isDone && index < sentence.signs.length
      ? (sentence.signs[index] ?? null)
      : null
  useEffect(() => {
    setTarget(currentSign)
  }, [currentSign, setTarget])

  // Advance one word: next word in the sequence, or completion.
  const advance = useCallback(() => {
    if (isDone) return
    const next = index + 1
    if (next >= sentence.signs.length) onComplete()
    else setIndex(next)
  }, [isDone, index, sentence.signs.length, onComplete])

  // The recognizer accepted the current word (per-sign bar, ADR-025) → advance.
  // Rising-edge only: after an advance the hook resets `accepted` on the new
  // target, but that reset lands a render later — without the edge guard the
  // still-true flag would advance a second time and skip a word.
  const prevAcceptedRef = useRef(false)
  useEffect(() => {
    const wasAccepted = prevAcceptedRef.current
    prevAcceptedRef.current = accepted
    if (accepted && !wasAccepted && currentSign !== null) advance()
  }, [accepted, currentSign, advance])

  return (
    <>
      <div className="sentence-words" data-testid="sentence-words">
        {sentence.signs.map((sign, i) => (
          <span
            key={`${sign}-${i}`}
            data-testid="sentence-word"
            className={
              i < index || isDone
                ? 'sentence-word done'
                : i === index
                  ? 'sentence-word current'
                  : 'sentence-word'
            }
          >
            {sign}
          </span>
        ))}
      </div>

      {isDone ? (
        feedback
      ) : (
        <>
          {currentSign && (
            <div className="sentences-reference">
              <SignReferencePlayer gloss={currentSign} />
            </div>
          )}
          <DynamicSignStage
            recognition={recognition}
            ariaLabel={`Sign the word “${currentSign ?? ''}”`}
            showReference={false}
            showOverlay={showOverlay}
          />
          <div className="sentences-actions">
            <button
              type="button"
              data-testid="sentence-got-it"
              onClick={advance}
            >
              That&apos;s what I did
            </button>
            {secondaryAction}
          </div>
        </>
      )}
    </>
  )
}
