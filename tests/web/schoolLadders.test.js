import test from 'node:test'
import assert from 'node:assert/strict'
import { LADDERS } from '../../src/data/ladders.js'
import { easiestLadder, hardestLadder, ladderMenu, stepLadder } from '../../src/lib/general613.js'
import { ladderAdvice } from '../../src/lib/ladderAdvice.js'
import { quotaFor } from '../../src/data/ladders.js'
import { hiddenForScope, hiddenLadderList, ladderIsOpen, ladderOnForScope, openLadders } from '../../src/lib/schoolLadders.js'

test('every ladder is on until a school turns some off', () => {
  assert.deepEqual(openLadders('4', null), LADDERS)
  assert.deepEqual(openLadders('4', []), LADDERS)
  assert.deepEqual(hiddenLadderList([5, 6, 99, '6']), [5, 6])
})

test('hidden ladders drop out of the picker and the commander menu', () => {
  const hidden = [5, 6, 7]
  assert.deepEqual(openLadders('3', hidden), [12, 11, 10, 9, 8])
  assert.equal(ladderIsOpen(5, hidden), false)
  assert.equal(ladderIsOpen(8, hidden), true)
  assert.equal(easiestLadder('3', hidden), 12)
  assert.equal(hardestLadder('3', hidden), 8)
  assert.deepEqual(ladderMenu('3', 'Kislev', 'Tishrei', hidden).map((row) => row.ladder), [12, 11, 10, 9, 8])
  assert.equal(stepLadder('3', 8, 'harder', hidden), 8)
  assert.equal(stepLadder('3', 9, 'harder', hidden), 8)
})

test('a ladder suggestion steps over a hidden ladder to the next one that is on', () => {
  const grade = '3'
  const names = ['Tishrei', 'Cheshvan', 'Kislev']
  const months = names.map((month) => ({
    month,
    said: quotaFor(grade, month, 6).v,
    reported: true,
  }))
  const advice = ladderAdvice({
    grade,
    ladder: 8,
    months,
    hiddenLadders: [7],
  })
  assert.equal(advice?.kind, 'harder')
  assert.equal(advice?.ladder, 6)
  assert.notEqual(advice?.ladder, 7)
})

test('the closest ladder setting wins and the default is on', () => {
  assert.equal(ladderOnForScope(8, [], null, null), true)
  assert.equal(ladderOnForScope(5, [5], null, null), false)
  assert.equal(ladderOnForScope(5, [5], { 5: true }, null), true)
  assert.equal(ladderOnForScope(6, [], [{ ladder: 6, enabled: false }], null), false)
  assert.equal(ladderOnForScope(6, [5], { 5: true, 6: false }, { 6: true }), true)
  assert.equal(ladderOnForScope(5, [], { 5: true }, { 5: false }), false)
  assert.deepEqual(hiddenForScope([5], { 5: true, 6: false }, { 6: true }), [])
  assert.deepEqual(hiddenForScope([5], { 5: true, 6: false }, null), [6])
  assert.deepEqual(hiddenForScope([5], { 5: true, 6: false }, { 5: false }), [6, 5])
  assert.deepEqual(openLadders('4', hiddenForScope([5], { 5: true }, { 5: false })), [12, 11, 10, 9, 8, 7, 6])
})

test('the demo shows school, class, and child ladder switches', async () => {
  const { ROSTER, schoolHiddenLadders, hiddenLaddersForChild, demoLadderSettings } = await import('../../src/data/demo.js')
  const sample = ROSTER.find((school) => school.id === 'sample-cheder')
  const ones = sample.classes.find((cls) => cls.id === 'sample-cheder-1')
  assert.equal(ones.kids[0].id, 'sample-k-1')
  assert.deepEqual(schoolHiddenLadders('sample-cheder'), [5])
  assert.deepEqual(hiddenLaddersForChild('sample-cheder', 'sample-cheder-4-boys', 'sample-k-9'), [5])
  assert.deepEqual(hiddenLaddersForChild('sample-cheder', 'sample-cheder-1', 'sample-k-1'), [])
  assert.deepEqual(hiddenLaddersForChild('sample-cheder', 'sample-cheder-1', 'sample-k-3'), [6])
  assert.deepEqual(hiddenLaddersForChild('sample-cheder', 'sample-cheder-1', 'sample-k-2'), [6, 5])
  assert.deepEqual(hiddenLaddersForChild('cheder-menachem-sample', 'cheder-menachem-sample-c1', 's1001'), [5])
  assert.deepEqual(hiddenLaddersForChild('cheder-menachem-sample', 'cheder-menachem-sample-c2', 's1099'), [])
  const settings = demoLadderSettings('sample-cheder')
  assert.equal(settings.classes.some((cls) => cls.id === 'sample-cheder-1' && cls.name), true)
  assert.equal(settings.children.every((child) => !Object.prototype.hasOwnProperty.call(child, 'name')), true)
  assert.equal(settings.children.some((child) => child.id === 'sample-k-1'), true)
})
