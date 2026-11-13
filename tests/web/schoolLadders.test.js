import test from 'node:test'
import assert from 'node:assert/strict'
import { LADDERS } from '../../src/data/ladders.js'
import { easiestLadder, hardestLadder, ladderMenu, stepLadder } from '../../src/lib/general613.js'
import { ladderAdvice } from '../../src/lib/ladderAdvice.js'
import { quotaFor } from '../../src/data/ladders.js'
import { hiddenLadderList, ladderIsOpen, openLadders } from '../../src/lib/schoolLadders.js'

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
