import test from 'node:test'
import assert from 'node:assert/strict'
import { campaignMonths, PLAIN_MONTHS } from '../../src/lib/hebrewYear.js'
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

function score(months, extra = {}) {
  return streakFromMissions(streakMissions({ months, historyMonths: [], ...extra }))
}

test('no months yet is a streak of zero', () => {
  assert.deepEqual(streakFromMissions([]), { current: 0, best: 0 })
  assert.deepEqual(streakFromMissions(null), { current: 0, best: 0 })
  assert.deepEqual(streakFromMissions(undefined), { current: 0, best: 0 })
  assert.deepEqual(score([]), { current: 0, best: 0 })
  assert.deepEqual(score(undefined), { current: 0, best: 0 })
})

test('one finished month is a streak of one, and one miss is zero', () => {
  assert.deepEqual(score([done('Tishrei')]), { current: 1, best: 1 })
  assert.deepEqual(score([missed('Tishrei')]), { current: 0, best: 0 })
  assert.deepEqual(score(PLAIN_MONTHS.map((month) => missed(month))), { current: 0, best: 0 })
})

test('a report that is short of the quota is a miss, same as nothing reported', () => {
  const short = { month: 'Cheshvan', met: false, reported: true }
  const streak = score([done('Tishrei'), short, done('Kislev'), done('Teves')])
  assert.equal(streak.current, 2)
  assert.equal(streak.best, 2)
})

test('a month they finished still counts when the reported flag was left off', () => {
  const streak = score([
    { month: 'Tishrei', met: true, reported: false },
    { month: 'Cheshvan', met: true, reported: false },
  ])
  assert.deepEqual(streak, { current: 2, best: 2 })
})

test('two missed months in a row do not join the runs on either side', () => {
  const streak = score([
    ...PLAIN_MONTHS.slice(0, 4).map((month) => done(month)),
    missed('Shvat'),
    missed('Adar'),
    ...['Nissan', 'Iyar', 'Sivan'].map((month) => done(month)),
  ])
  assert.equal(streak.current, 3)
  assert.equal(streak.best, 4)
})

test('alternating months never build a streak longer than one', () => {
  const months = PLAIN_MONTHS.map((month, i) => (i % 2 === 0 ? done(month) : missed(month)))
  assert.deepEqual(score(months), { current: 0, best: 1 })
  months.push(done('extra'))
  assert.deepEqual(score(months), { current: 1, best: 1 })
})

test('when the latest run is the longest, longest stays equal to current', () => {
  const streak = score([
    done('Tishrei'),
    done('Cheshvan'),
    missed('Kislev'),
    ...['Teves', 'Shvat', 'Adar', 'Nissan'].map((month) => done(month)),
  ])
  assert.equal(streak.current, 4)
  assert.equal(streak.best, 4)
  assert.ok(streak.best >= streak.current)
})

test('a full leap year of finished months is thirteen, and a plain year is twelve', () => {
  assert.equal(score(campaignMonths(5787).map((month) => done(month))).current, 13)
  assert.equal(score(campaignMonths(5786).map((month) => done(month))).current, 12)
})

test('the only month, still open and not finished, does not start a streak', () => {
  assert.deepEqual(score([
    missed('Tishrei', { isCurrent: true, reportOpen: true }),
  ]), { current: 0, best: 0 })
})

test('an open month after a miss does not bring the old streak back', () => {
  const streak = score([
    ...['Tishrei', 'Cheshvan', 'Kislev'].map((month) => done(month)),
    missed('Teves', { isCurrent: false, reportOpen: false }),
    missed('Shvat', { isCurrent: true, reportOpen: true }),
  ])
  assert.equal(streak.current, 0)
  assert.equal(streak.best, 3)
})

test('a closed report window makes the current month a miss', () => {
  const streak = score([
    done('Tishrei'),
    done('Cheshvan'),
    { month: 'Kislev', met: false, reported: true, isCurrent: true, reportOpen: false },
  ])
  assert.equal(streak.current, 0)
  assert.equal(streak.best, 2)
})

test('a current month with no reportOpen flag is still open, and a past month is not', () => {
  const open = score([
    done('Tishrei'),
    missed('Cheshvan', { isCurrent: true }),
  ])
  assert.equal(open.current, 1)

  const past = score([
    done('Tishrei'),
    missed('Cheshvan', { isCurrent: false, reportOpen: true }),
    done('Kislev'),
  ])
  assert.equal(past.current, 1)
  assert.equal(past.best, 1)
})

test('a finished month counts after the window has closed', () => {
  const streak = score([
    done('Tishrei'),
    done('Cheshvan', { isCurrent: true, reportOpen: false }),
  ])
  assert.deepEqual(streak, { current: 2, best: 2 })
})

test('a holiday named without the holiday flag, and one at the end, does not break the months', () => {
  const between = score([
    done('Tishrei'),
    { month: 'Rosh Hashana', met: false, reported: false },
    { month: 'Yom Kippur', met: false, reported: false },
    done('Cheshvan'),
  ])
  assert.deepEqual(between, { current: 2, best: 2 })

  const atEnd = score([
    done('Tishrei'),
    done('Cheshvan'),
    { month: 'Yom Kippur', met: false, reported: false },
  ])
  assert.deepEqual(atEnd, { current: 2, best: 2 })
})

test('a row that only says what they said, with no met flag, is not a finished month', () => {
  const streak = streakFromMissions([
    { met: true, record: true },
    { said: 4, record: true },
    { met: true, record: true },
  ])
  assert.deepEqual(streak, { current: 1, best: 1 })
})

test('Elul done and Tishrei done is one streak across the new year', () => {
  const streak = streakFromMissions(streakMissions({
    grade: '1',
    ladder: 8,
    year: 5786,
    yearStart: 'Tishrei',
    missionHistory: { pre1a: { Elul: 8 } },
    months: [done('Tishrei')],
  }))
  assert.deepEqual(streak, { current: 2, best: 2 })
})

test('a missed Elul stops the streak at the new year', () => {
  const streak = streakFromMissions(streakMissions({
    grade: '1',
    ladder: 8,
    year: 5786,
    yearStart: 'Tishrei',
    missionHistory: { pre1a: { Av: 8 } },
    months: [done('Tishrei'), done('Cheshvan')],
  }))
  assert.deepEqual(streak, { current: 2, best: 2 })
})

test('Adar I and Adar II are two months in a prior leap year', () => {
  // Grade 2 in 5788 sits after grade 1 in 5787, which is a leap year.
  const joined = streakFromMissions(streakMissions({
    grade: '2',
    ladder: 8,
    year: 5788,
    yearStart: 'Tishrei',
    missionHistory: { 1: { Shvat: 5, 'Adar I': 5, 'Adar II': 5 } },
    months: [],
  }))
  assert.equal(joined.current, 0)
  assert.equal(joined.best, 3)

  const split = streakFromMissions(streakMissions({
    grade: '2',
    ladder: 8,
    year: 5788,
    yearStart: 'Tishrei',
    missionHistory: { 1: { Shvat: 5, 'Adar II': 5 } },
    months: [],
  }))
  assert.equal(split.best, 1)
})

test('a plain year does not turn an Adar I mark into an extra month', () => {
  const streak = streakFromMissions(streakMissions({
    grade: '1',
    ladder: 8,
    year: 5786,
    yearStart: 'Tishrei',
    missionHistory: { pre1a: { Adar: 4, 'Adar I': 9, 'Adar II': 9 } },
    months: [],
  }))
  assert.equal(streak.current, 0)
  assert.equal(streak.best, 1)
})

test('an explicit prior year is used as given and is not added again from history', () => {
  const streak = streakFromMissions(streakMissions({
    grade: '1',
    ladder: 8,
    year: 5786,
    yearStart: 'Tishrei',
    historyMonths: [done('Elul')],
    missionHistory: { pre1a: Object.fromEntries(PLAIN_MONTHS.map((month) => [month, 8])) },
    months: [done('Tishrei')],
  }))
  assert.deepEqual(streak, { current: 2, best: 2 })
})
