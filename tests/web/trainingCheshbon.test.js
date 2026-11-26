import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { campaignMonths } from '../../src/lib/hebrewYear.js'
import { buildTraining, trainingCheshbon } from '../../src/lib/trainingBoard.js'
import { streakFromMissions } from '../../src/lib/streaks.js'
import { medalState } from '../../src/lib/medals.js'

// Grade 6 in 5787 (a leap year), ladder 5. The page that reported
// "88 earned · 87 missions" had these section totals: three leap grades
// (13) and four plain grades (12). 88 was a lifetime sum, not the Done boxes.
const SKIPS = {
  pre1a: ['Iyar'],
  1: ['Teves', 'Sivan', 'Av'],
  2: ['Tishrei', 'Cheshvan', 'Kislev', 'Teves', 'Shvat'],
  3: ['Tammuz'],
  4: ['Cheshvan', 'Tammuz'],
  5: ['Tishrei', 'Teves'],
}

function gradeNum(g) {
  return g === 'pre1a' ? 0 : Number(g)
}

function markMonths(year, skip) {
  const row = {}
  for (const month of campaignMonths(year)) {
    if (skip.includes(month)) continue
    row[month] = 10
  }
  return row
}

function sholemBoard() {
  const year = 5787
  const history = {}
  for (const g of ['pre1a', '1', '2', '3', '4', '5']) {
    history[g] = markMonths(year - (6 - gradeNum(g)), SKIPS[g])
  }
  // A full history for the current grade, and a grade past the ladder.
  // Neither may add a Done box on top of the live months.
  history['6'] = markMonths(5787, [])
  history['8'] = markMonths(5789, [])
  return buildTraining({
    grade: '6',
    ladder: 5,
    year,
    history,
    months: [
      { month: 'Tishrei', met: false, reported: true },
      { month: 'Cheshvan', met: true, reported: true },
      { month: 'Kislev', met: true, reported: true },
    ],
  })
}

test('a leap year with misses keeps earned within the ladder and equal to the sections', () => {
  const board = sholemBoard()
  const tally = trainingCheshbon(board)
  const expect = {
    pre1a: [11, 12],
    1: [10, 13],
    2: [7, 12],
    3: [12, 13],
    4: [10, 12],
    5: [10, 12],
    6: [2, 13],
  }
  for (const [grade, [done, total]] of Object.entries(expect)) {
    const section = tally.sections.find((s) => s.grade === grade)
    assert.equal(section.done, done, `${grade} done`)
    assert.equal(section.total, total, `${grade} total`)
  }
  const doneSum = tally.sections.reduce((n, s) => n + s.done, 0)
  const totalSum = tally.sections.reduce((n, s) => n + s.total, 0)
  assert.equal(tally.earned, doneSum)
  assert.equal(tally.total, totalSum)
  assert.equal(tally.earned, 62)
  assert.equal(tally.total, 87)
  assert.equal(tally.earned <= tally.total, true)
  assert.equal(board.done, tally.earned)
  assert.equal(board.total, tally.total)
  // The lifetime figure that used to sit on the headline is not this count.
  assert.equal(tally.earned === 88, false)
})

test('one stored Adar on a leap year is Adar II only, not two missions', () => {
  // Grade 2 in 5783, so 1st grade was 5782, a leap year. Past grades read history.
  const board = buildTraining({
    grade: '2',
    ladder: 2,
    year: 5783,
    months: [],
    history: { 1: { Adar: 8 } },
  })
  const row = board.boards.find((b) => b.grade === '1')
  assert.equal(row.total, 13)
  assert.equal(row.missions.find((m) => m.key === 'Adar I').met, false)
  assert.equal(row.missions.find((m) => m.key === 'Adar II').met, true)
  assert.equal(row.done, 1)
  const tally = trainingCheshbon(board)
  assert.equal(tally.earned <= tally.total, true)
  assert.equal(tally.earned, tally.sections.reduce((n, s) => n + s.done, 0))
})

test('medals and streaks still follow the same boxes, and a miss is not earned', () => {
  const board = buildTraining({
    grade: '3',
    ladder: 3,
    year: 5787,
    months: [
      { month: 'Adar I', met: true, reported: true },
      { month: 'Adar II', met: false, reported: true },
      { month: 'Nissan', met: true, reported: true },
    ],
  })
  const row = board.boards.find((b) => b.grade === '3')
  assert.equal(row.total, 13)
  assert.equal(row.done, 2)
  const tally = trainingCheshbon(board)
  assert.equal(tally.earned <= tally.total, true)

  const medal = medalState(tally.earned)
  assert.equal(medal.missions, tally.earned)
  assert.equal(medal.missions <= tally.total, true)
  // The medal board still takes the lifetime total it is given. The ladder
  // cheshbon does not replace that input, and it does not grow past the boxes.
  assert.equal(medalState(88).missions, 88)
  assert.equal(medalState(88).earnedCount > medal.earnedCount, true)

  // A box with no saved report is not a miss. Only a recorded line is a streak step.
  const streak = streakFromMissions(row.missions.filter((m) => m.record).map((m) => ({
    met: m.met,
    record: true,
    holiday: !!m.holiday,
  })))
  assert.equal(row.missions.filter((m) => m.met).length, row.done)
  assert.equal(streak.current, 1)
  assert.equal(streak.best, 1)
  assert.equal(streak.best <= row.done, true)
})

test('the training card headline and headers use the section sums', () => {
  const src = readFileSync(new URL('../../src/components/TehillimTraining.jsx', import.meta.url), 'utf8')
  assert.match(src, /trainingCheshbon\(board\)/)
  assert.match(src, /\{earned\} earned · \{total\} missions on this ladder/)
  assert.match(src, /\{g\.done\} out of \{g\.total\}/)
  assert.equal(src.includes('missionsTotal'), false)
  assert.equal(src.includes('{g.done} checked'), false)
})
