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
  priorityWords,
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
