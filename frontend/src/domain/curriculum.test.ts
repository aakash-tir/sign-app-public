import { describe, it, expect } from 'vitest'
import {
  curriculumSetOf,
  wordStatus,
  teachableSigns,
  isPlaceholderOnlySet,
  flattenRoute,
  routeAccess,
  learnedPool,
  sentencesBuildableFrom,
  routeConstructibility,
  stageSentenceCandidates,
  priorityWords,
  courseProgress,
  type CurriculumUnit,
} from './curriculum'
import { sentenceOf } from './sentences'

const recognized = new Set(['want', 'eat', 'drink', 'water', 'more'])

const units: readonly CurriculumUnit[] = [
  {
    id: 'u1',
    title: 'Unit 1',
    sets: [curriculumSetOf(['want', 'eat']), curriculumSetOf(['you', 'me'])],
  },
  {
    id: 'u2',
    title: 'Unit 2',
    sets: [curriculumSetOf(['drink', 'water']), curriculumSetOf(['more'])],
  },
]

const route = flattenRoute(units)

const bank = [
  sentenceOf(['want', 'eat']),
  sentenceOf(['drink', 'water']),
  sentenceOf(['want', 'drink', 'water']),
]

describe('curriculumSetOf', () => {
  it('derives a stable id from the joined signs', () => {
    expect(curriculumSetOf(['want', 'eat'])).toEqual({
      id: 'want eat',
      signs: ['want', 'eat'],
    })
  })
})

describe('wordStatus / teachableSigns / isPlaceholderOnlySet', () => {
  it('derives placeholder status from the injected recognized set', () => {
    expect(wordStatus('want', recognized)).toBe('recognized')
    expect(wordStatus('you', recognized)).toBe('placeholder')
  })

  it('teachableSigns keeps only recognized signs, in set order', () => {
    expect(
      teachableSigns(curriculumSetOf(['you', 'want']), recognized),
    ).toEqual(['want'])
  })

  it('flags placeholder-only sets', () => {
    expect(
      isPlaceholderOnlySet(curriculumSetOf(['you', 'me']), recognized),
    ).toBe(true)
    expect(
      isPlaceholderOnlySet(curriculumSetOf(['you', 'want']), recognized),
    ).toBe(false)
  })
})

describe('flattenRoute', () => {
  it('preserves unit order then set order', () => {
    expect(route.map((s) => s.id)).toEqual([
      'want eat',
      'you me',
      'drink water',
      'more',
    ])
  })
})

describe('routeAccess (linear with review, Q3/Q6)', () => {
  it('starts with the first teachable set current and the rest locked', () => {
    expect(routeAccess(route, new Set(), recognized)).toEqual([
      'current',
      'placeholder',
      'locked',
      'locked',
    ])
  })

  it('keeps completed sets reviewable and advances current past placeholders', () => {
    expect(routeAccess(route, new Set(['want eat']), recognized)).toEqual([
      'completed',
      'placeholder',
      'current',
      'locked',
    ])
  })

  it('assigns exactly one current set until the route is done', () => {
    const access = routeAccess(
      route,
      new Set(['want eat', 'drink water']),
      recognized,
    )
    expect(access).toEqual(['completed', 'placeholder', 'completed', 'current'])
    expect(access.filter((a) => a === 'current')).toHaveLength(1)
  })

  it('has no current set once every teachable set is completed', () => {
    expect(
      routeAccess(
        route,
        new Set(['want eat', 'drink water', 'more']),
        recognized,
      ),
    ).toEqual(['completed', 'placeholder', 'completed', 'completed'])
  })

  it('placeholder-only sets never block progression', () => {
    // The placeholder set sits between completed and current — never 'locked',
    // never 'current', and the route advances straight past it.
    const access = routeAccess(route, new Set(['want eat']), recognized)
    expect(access[1]).toBe('placeholder')
    expect(access[2]).toBe('current')
  })
})

describe('learnedPool', () => {
  it('collects recognized signs of completed sets only', () => {
    const pool = learnedPool(route, new Set(['want eat', 'you me']), recognized)
    expect([...pool].sort()).toEqual(['eat', 'want'])
  })
})

describe('sentencesBuildableFrom', () => {
  it('keeps only sentences fully covered by the pool', () => {
    const pool = new Set(['want', 'eat', 'drink'])
    expect(sentencesBuildableFrom(bank, pool).map((s) => s.id)).toEqual([
      'want eat',
    ])
  })
})

describe('routeConstructibility', () => {
  it('reports per-prefix whether the pool builds a bank sentence', () => {
    expect(routeConstructibility(route, bank, recognized)).toEqual([
      true, // want+eat → "want eat"
      true, // placeholder set adds nothing; pool unchanged
      true,
      true,
    ])
  })

  it('pinpoints a set that breaks the rule', () => {
    const bad = [curriculumSetOf(['more']), curriculumSetOf(['want', 'eat'])]
    expect(routeConstructibility(bad, bank, recognized)).toEqual([false, true])
  })

  it('never counts placeholder words toward the pool', () => {
    const phRoute = [curriculumSetOf(['you', 'me'])]
    const phBank = [sentenceOf(['you', 'me'])]
    expect(routeConstructibility(phRoute, phBank, recognized)).toEqual([false])
  })
})

describe('stageSentenceCandidates', () => {
  it('prefers buildable sentences that use a just-learned sign', () => {
    const pool = new Set(['want', 'eat', 'drink', 'water'])
    const picked = stageSentenceCandidates(bank, pool, ['drink', 'water'])
    expect(picked.map((s) => s.id)).toEqual(['drink water', 'want drink water'])
  })

  it('falls back to any buildable sentence when none use the new signs', () => {
    const pool = new Set(['want', 'eat', 'more'])
    const picked = stageSentenceCandidates(bank, pool, ['more'])
    expect(picked.map((s) => s.id)).toEqual(['want eat'])
  })

  it('is empty when nothing is buildable from the pool', () => {
    expect(stageSentenceCandidates(bank, new Set(['want']), ['want'])).toEqual(
      [],
    )
  })
})

describe('priorityWords', () => {
  it('lists placeholder words in route order, deduped', () => {
    const withDup: readonly CurriculumUnit[] = [
      ...units,
      {
        id: 'u3',
        title: 'Unit 3',
        sets: [curriculumSetOf(['me', 'you'])],
      },
    ]
    expect(priorityWords(withDup, recognized)).toEqual(['you', 'me'])
  })

  it('is empty when everything is recognized', () => {
    expect(
      priorityWords(
        units,
        new Set(['want', 'eat', 'you', 'me', 'drink', 'water', 'more']),
      ),
    ).toEqual([])
  })
})

describe('courseProgress (P6M8, #60)', () => {
  it('starts at zero, with placeholder-only sets left out of the totals', () => {
    const progress = courseProgress(units, new Set(), recognized)
    // u1 = [want eat] + placeholder [you me]; u2 = [drink water] + [more]
    expect(progress.setsTotal).toBe(3)
    expect(progress.setsDone).toBe(0)
    expect(progress.unitsTotal).toBe(2)
    expect(progress.unitsDone).toBe(0)
    expect(
      progress.units.map((u) => [u.unitId, u.setsDone, u.setsTotal]),
    ).toEqual([
      ['u1', 0, 1],
      ['u2', 0, 2],
    ])
  })

  it('completes a unit once every teachable set is done, ignoring placeholders', () => {
    const progress = courseProgress(units, new Set(['want eat']), recognized)
    expect(progress.units[0]).toMatchObject({ setsDone: 1, isComplete: true })
    expect(progress.units[1]).toMatchObject({ setsDone: 0, isComplete: false })
    expect(progress).toMatchObject({ setsDone: 1, unitsDone: 1 })
  })

  it('reaches 100 % with every teachable set done', () => {
    const done = new Set(['want eat', 'drink water', 'more'])
    const progress = courseProgress(units, done, recognized)
    expect(progress).toMatchObject({
      setsDone: 3,
      setsTotal: 3,
      unitsDone: 2,
      unitsTotal: 2,
    })
  })

  it('ignores stale completion ids and placeholder ids', () => {
    const done = new Set(['want', 'you me', 'gone set'])
    const progress = courseProgress(units, done, recognized)
    expect(progress.setsDone).toBe(0)
    expect(progress.unitsDone).toBe(0)
  })

  it('leaves an all-placeholder unit out of the unit totals and never completes it', () => {
    const withStub: readonly CurriculumUnit[] = [
      ...units,
      { id: 'u3', title: 'Soon', sets: [curriculumSetOf(['you', 'me'])] },
    ]
    const done = new Set(['want eat', 'drink water', 'more'])
    const progress = courseProgress(withStub, done, recognized)
    expect(progress.units[2]).toMatchObject({ setsTotal: 0, isComplete: false })
    expect(progress.unitsTotal).toBe(2)
    expect(progress.unitsDone).toBe(2)
  })

  it('handles an empty route', () => {
    expect(courseProgress([], new Set(), recognized)).toEqual({
      units: [],
      setsDone: 0,
      setsTotal: 0,
      unitsDone: 0,
      unitsTotal: 0,
    })
  })
})
