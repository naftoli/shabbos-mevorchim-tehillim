import test from 'node:test'
import assert from 'node:assert/strict'
import { PLAIN_MONTHS } from '../../src/lib/hebrewYear.js'
import { streakFromMissions } from '../../src/lib/streaks.js'
import { streakMissions } from '../../src/lib/trainingBoard.js'

const done = (month, extra = {}) => ({ month, met: true, reported: true, ...extra })
const missed = (month, extra = {}) => ({ month, met: false, reported: false, ...extra })

test('current streak stops at the first missed month; longest keeps the earlier run', () => {
  const months = [
    ...PLAIN_MONTHS.slice(0, 10).map((month) => done(month)),
    missed('Av'),
    ...PLAIN_MONTHS.slice(0, 8).map((month) => done(month)),
  ]
  const streak = streakFromMissions(streakMissions({ months, historyMonths: [] }))
  assert.equal(streak.current, 8)
  assert.equal(streak.best, 10)
})

test('a missed latest month makes the current streak 0 and leaves the longest run', () => {
  const months = [
    ...PLAIN_MONTHS.slice(0, 10).map((month) => done(month)),
    missed('Av', { isCurrent: true, reportOpen: false }),
  ]
  const streak = streakFromMissions(streakMissions({ months, historyMonths: [] }))
  assert.equal(streak.current, 0)
  assert.equal(streak.best, 10)
})

test('the month still open for reporting is not a miss yet', () => {
  const months = [
    ...PLAIN_MONTHS.slice(0, 8).map((month) => done(month)),
    missed('Sivan', { isCurrent: true, reportOpen: true }),
  ]
  const streak = streakFromMissions(streakMissions({ months, historyMonths: [] }))
  assert.equal(streak.current, 8)
  assert.equal(streak.best, 8)
})

test('a month already met while the report is still open counts', () => {
  const months = [
    done('Tishrei'),
    done('Cheshvan', { isCurrent: true, reportOpen: true }),
  ]
  const streak = streakFromMissions(streakMissions({ months, historyMonths: [] }))
  assert.equal(streak.current, 2)
  assert.equal(streak.best, 2)
})

test('a holiday with no record does not break the monthly streak', () => {
  const months = [
    done('Tishrei'),
    { month: 'Rosh Hashana', met: false, reported: false, holiday: true },
    { month: 'Yom Kippur', met: false, reported: false, holiday: true },
    done('Cheshvan'),
  ]
  const streak = streakFromMissions(streakMissions({ months, historyMonths: [] }))
  assert.equal(streak.current, 2)
  assert.equal(streak.best, 2)
})

test('a holiday they did counts, and one they reported short of quota breaks', () => {
  const doneHoliday = streakFromMissions(streakMissions({
    months: [done('Tishrei'), { month: 'Rosh Hashana', met: true, reported: true, holiday: true }],
    historyMonths: [],
  }))
  assert.equal(doneHoliday.current, 2)

  const short = streakFromMissions(streakMissions({
    months: [
      done('Tishrei'),
      { month: 'Rosh Hashana', met: false, reported: true, holiday: true },
      done('Cheshvan'),
    ],
    historyMonths: [],
  }))
  assert.equal(short.current, 1)
  assert.equal(short.best, 1)
})

test('longest streak reaches back through earlier grades', () => {
  // Pre-1A in 5785: ten months done, then Av and Elul missed.
  // Grade 1 in 5786: eight months done, and Sivan still open.
  const priorDone = Object.fromEntries(PLAIN_MONTHS.slice(0, 10).map((month) => [month, 8]))
  const elapsed = [
    ...PLAIN_MONTHS.slice(0, 8).map((month) => done(month)),
    missed('Sivan', { isCurrent: true, reportOpen: true }),
  ]
  const streak = streakFromMissions(streakMissions({
    grade: '1',
    ladder: 8,
    year: 5786,
    yearStart: 'Tishrei',
    missionHistory: { pre1a: priorDone },
    months: elapsed,
  }))
  assert.equal(streak.current, 8)
  assert.equal(streak.best, 10)
})
