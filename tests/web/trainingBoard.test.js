import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTraining } from '../../src/lib/trainingBoard.js'
import { quotaFor } from '../../src/data/ladders.js'

// Find a grade that actually has differing quotas on two ladders, so the test
// asserts a real difference rather than a coincidence.
function cell(board, grade, occKey) {
  const b = board.boards.find((x) => String(x.grade) === String(grade))
  return b?.missions.find((m) => m.key === occKey) || null
}

test('a not-done mission shows the last DONE ladder quota, not the current ladder', () => {
  // Soldier is on ladder 5 now, but last completed a mission on ladder 8.
  const grade = '3'
  const cheshvanL8 = quotaFor(grade, 'Cheshvan', 8)
  const cheshvanL5 = quotaFor(grade, 'Cheshvan', 5)
  assert.ok(cheshvanL8 && cheshvanL5 && cheshvanL8.v !== cheshvanL5.v, 'need two ladders whose Cheshvan quota differs')

  const board = buildTraining({
    grade,
    ladder: 5, // current ladder
    // Current-grade completion comes from live month records; history supplies
    // the ladder it was done on. Tishrei met on ladder 8, Cheshvan not done.
    months: [{ month: 'Tishrei', met: true, reported: true }],
    history: { [grade]: { Tishrei: 8 } },
  })

  const tishrei = cell(board, grade, 'Tishrei')
  const cheshvan = cell(board, grade, 'Cheshvan')

  assert.equal(tishrei.met, true)
  assert.equal(tishrei.ladder, 8)
  assert.equal(tishrei.quota, quotaFor(grade, 'Tishrei', 8).v, 'done mission keeps its own ladder quota')

  assert.equal(cheshvan.met, false)
  assert.equal(cheshvan.quota, cheshvanL8.v, 'not-done mission inherits the last done ladder (8), not current (5)')
  assert.notEqual(cheshvan.quota, cheshvanL5.v)
})

test('with no prior done mission, a not-done mission falls back to the current ladder', () => {
  const grade = '3'
  const onL5 = quotaFor(grade, 'Tishrei', 5)
  const board = buildTraining({
    grade,
    ladder: 5,
    months: [],
    history: {}, // nothing ever done
  })
  const tishrei = cell(board, grade, 'Tishrei')
  assert.equal(tishrei.met, false)
  assert.equal(tishrei.quota, onL5.v, 'no prior done → current ladder quota')
})

test('blanks BEFORE the first completion borrow that first done ladder, not the current one', () => {
  // Chaya's shape: did Pre-1A's Kislev on ladder 12, now sits on ladder 9. The
  // untouched Pre-1A Tishrei/Cheshvan should show ladder 12 (what she was on),
  // not the steeper current ladder 9.
  const tishreiL12 = quotaFor('pre1a', 'Tishrei', 12)
  const tishreiL9 = quotaFor('pre1a', 'Tishrei', 9)
  assert.ok(tishreiL12 && tishreiL9 && tishreiL12.v !== tishreiL9.v)

  const board = buildTraining({
    grade: '8',
    ladder: 9, // current ladder
    months: [],
    history: { pre1a: { Kislev: 12 } }, // first-ever completion was on ladder 12
  })
  const tishrei = cell(board, 'pre1a', 'Tishrei') // comes before Kislev, not done
  assert.equal(tishrei.met, false)
  assert.equal(tishrei.quota, tishreiL12.v, 'leading blank borrows the first done ladder (12)')
  assert.notEqual(tishrei.quota, tishreiL9.v)

  const kislev = cell(board, 'pre1a', 'Kislev')
  assert.equal(kislev.met, true)
  assert.equal(kislev.ladder, 12)
})

test('the last done ladder carries across grades to later blank missions', () => {
  // Done on ladder 9 in grade 1; grade 2 entirely blank; current ladder is 5.
  const onL9 = quotaFor('2', 'Tishrei', 9)
  const onL5 = quotaFor('2', 'Tishrei', 5)
  assert.ok(onL9 && onL5 && onL9.v !== onL5.v)

  const board = buildTraining({
    grade: '5',
    ladder: 5,
    months: [],
    history: { 1: { Elul: 9 } },
  })
  const g2Tishrei = cell(board, '2', 'Tishrei')
  assert.equal(g2Tishrei.met, false)
  assert.equal(g2Tishrei.quota, onL9.v, 'grade-2 blank inherits grade-1 done ladder (9)')
})

test('a Cheshvan override wins over today\'s ladder quota', () => {
  const grade = '3'
  const today = quotaFor(grade, 'Cheshvan', 5)
  const board = buildTraining({
    grade,
    ladder: 5,
    months: [{
      month: 'Cheshvan',
      met: true,
      reported: true,
      quotaAdjusted: true,
      quota: 5,
      said: 5,
    }],
    history: {},
  })
  const cheshvan = cell(board, grade, 'Cheshvan')
  assert.equal(cheshvan.met, true)
  assert.equal(cheshvan.quota, 5)
  assert.notEqual(cheshvan.quota, today.v)
})
