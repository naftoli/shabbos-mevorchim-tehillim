import test from 'node:test'
import assert from 'node:assert/strict'
import { compareClassLabels, sortClasses, sortPlatoons } from '../../src/lib/classOrder.js'
import { rankByRace } from '../../src/lib/schoolRace.js'

const LABELS = [
  '12-A',
  '2nd Grade',
  'Pre-1A',
  '10th Grade',
  '1-Boys',
  'pre1a',
  'P1A',
  '1st Grade A',
  '1st Grade',
  'Pre1a-Boys',
  '4-boys',
  '4-Boys',
  '3-Boys',
  'Nursery',
]

test('Pre-1A leads and numbered grades stay in grade order', () => {
  const ordered = [...LABELS].sort(compareClassLabels)
  assert.deepEqual(ordered, [
    'P1A',
    'Pre-1A',
    'pre1a',
    'Pre1a-Boys',
    '1-Boys',
    '1st Grade',
    '1st Grade A',
    '2nd Grade',
    '3-Boys',
    '4-Boys',
    '4-boys',
    '10th Grade',
    '12-A',
    'Nursery',
  ])
})

test('a formatted class name keeps its grade after the number is dropped', () => {
  const ordered = ['Bet Bet', '4-boys', 'Aleph Aleph', 'Pre-1A', 'א א', '1 Aleph Bet', 'Ches Yud'].sort(compareClassLabels)
  assert.deepEqual(ordered, [
    'Pre-1A',
    'Aleph Aleph',
    '1 Aleph Bet',
    'א א',
    'Bet Bet',
    '4-boys',
    'Ches Yud',
  ])
})

test('a name with no grade number uses the grade field, and Pre-1A still leads', () => {
  const rows = sortClasses([
    { id: 4, name: '3-Boys', grade: '3' },
    { id: 3, name: 'כיתה א', grade: '2' },
    { id: 2, name: '1', grade: '1' },
    { id: 1, name: 'Pre-1A', grade: 'pre1a' },
  ])
  assert.deepEqual(rows.map((row) => row.name), ['Pre-1A', '1', 'כיתה א', '3-Boys'])
})

test('a class row uses the name a person sees, and the same grade keeps section order', () => {
  const rows = sortClasses([
    { id: 30, name: '12-A', grade: '12' },
    { id: 20, name: '1-B', grade: '1' },
    { id: 10, name: 'Pre-1A', grade: 'pre1a' },
    { id: 21, name: '1-A', grade: '1' },
    { id: 11, className: 'Pre-1A-A', grade: 'pre1a' },
  ])
  assert.deepEqual(rows.map((row) => row.name || row.className), [
    'Pre-1A',
    'Pre-1A-A',
    '1-A',
    '1-B',
    '12-A',
  ])
})

test('platoons stay grouped by school, with Pre-1A first inside the school', () => {
  const rows = sortPlatoons([
    { school: 'Sample Cheder', classId: 3, className: '12-A' },
    { school: 'Other Base', classId: 1, className: '1-A' },
    { school: 'Sample Cheder', classId: 1, className: 'Pre-1A' },
    { school: 'Sample Cheder', classId: 2, className: '2-Boys' },
  ])
  assert.deepEqual(rows.map((row) => `${row.school} ${row.className}`), [
    'Other Base 1-A',
    'Sample Cheder Pre-1A',
    'Sample Cheder 2-Boys',
    'Sample Cheder 12-A',
  ])
})

test('a score ranking still follows the score when Pre-1A would lead a grade list', () => {
  const rows = [
    { name: 'Pre-1A', pctMet: 10, met: 1 },
    { name: '1-Boys', pctMet: 90, met: 9 },
    { name: '2-Boys', pctMet: 90, met: 4 },
  ]
  assert.deepEqual(rankByRace(rows).map((row) => row.name), ['1-Boys', '2-Boys', 'Pre-1A'])
  assert.deepEqual(sortClasses(rows).map((row) => row.name), ['Pre-1A', '1-Boys', '2-Boys'])
})
