import test from 'node:test'
import assert from 'node:assert/strict'
import { campaignMonths, isHebrewLeapYear, quotaMonth } from '../../src/lib/hebrewYear.js'
import { currentReportingMonth, nextShabbosMevorchim } from '../../src/lib/shabbosMevorchim.js'
import { earliestMedalWhen } from '../../src/lib/medalWhen.js'
import { quotaFor } from '../../src/data/ladders.js'
import { buildTraining, streakMissions } from '../../src/lib/trainingBoard.js'
import { streakFromMissions } from '../../src/lib/streaks.js'

const noon = (iso) => new Date(`${iso}T12:00:00Z`)

test('5784 and 5787 are leap years; 5785 is not', () => {
  // Cross-checked with Intl's Hebrew calendar:
  // 5784-02-10 civil is 1 Adar I 5784; 5785-03-01 is 1 Adar 5785; 5787-02-08 is 1 Adar I 5787.
  assert.equal(isHebrewLeapYear(5784), true)
  assert.equal(isHebrewLeapYear(5787), true)
  assert.equal(isHebrewLeapYear(5782), true)
  assert.equal(isHebrewLeapYear(5785), false)
  assert.equal(isHebrewLeapYear(5786), false)
  assert.equal(isHebrewLeapYear(5788), false)
})

test('a leap year lists Adar I then Adar II; a plain year lists one Adar', () => {
  const leap = campaignMonths(5787)
  const plain = campaignMonths(5785)
  assert.equal(leap.length, 13)
  assert.equal(plain.length, 12)
  assert.deepEqual(leap.slice(4, 8), ['Shvat', 'Adar I', 'Adar II', 'Nissan'])
  assert.deepEqual(plain.slice(4, 7), ['Shvat', 'Adar', 'Nissan'])
  assert.equal(plain.includes('Adar I'), false)
  assert.equal(plain.includes('Adar II'), false)
  assert.deepEqual(campaignMonths(5784), leap)
})

test('Adar I and Adar II keep separate records and both use the Adar quota', () => {
  const reports = {}
  reports['Adar I'] = 40
  reports['Adar II'] = 22
  assert.equal(reports['Adar I'], 40)
  assert.equal(reports['Adar II'], 22)
  assert.equal(quotaMonth('Adar I'), 'Adar')
  assert.equal(quotaMonth('Adar II'), 'Adar')
  assert.equal(quotaMonth('Adar'), 'Adar')
  const adar = quotaFor('3', 'Adar', 8)
  assert.deepEqual(quotaFor('3', 'Adar I', 8), adar)
  assert.deepEqual(quotaFor('3', 'Adar II', 8), adar)
  assert.equal(quotaFor('3', 'Nissan', 8).v === adar.v, false)
})

test('the reporting month names Adar I and Adar II on the real calendar', () => {
  // 20 Feb 2027 is during Adar I 5787 (Adar II begins 10 Mar 2027).
  assert.equal(currentReportingMonth(noon('2027-02-20')), 'Adar I')
  // 20 Mar 2027 is during Adar II 5787 (Nissan begins 8 Apr 2027).
  assert.equal(currentReportingMonth(noon('2027-03-20')), 'Adar II')
  // 5784, the previous leap year.
  assert.equal(currentReportingMonth(noon('2024-02-20')), 'Adar I')
  assert.equal(currentReportingMonth(noon('2024-03-20')), 'Adar II')
  // 5785 is not a leap year: one Adar, never Adar I.
  assert.equal(currentReportingMonth(noon('2025-03-15')), 'Adar')
  const upcoming = nextShabbosMevorchim(noon('2027-02-01'))
  assert.equal(upcoming.monthEn, 'Adar I')
})

test('medal timing counts Adar I and Adar II as two missions, and one Adar otherwise', () => {
  assert.equal(earliestMedalWhen(1, 'Shvat', 5787), 'Shvat 5787')
  assert.equal(earliestMedalWhen(2, 'Shvat', 5787), 'Adar I 5787')
  assert.equal(earliestMedalWhen(3, 'Shvat', 5787), 'Adar II 5787')
  assert.equal(earliestMedalWhen(4, 'Shvat', 5787), 'Nissan 5787')
  assert.equal(earliestMedalWhen(2, 'Shvat', 5784), 'Adar I 5784')
  assert.equal(earliestMedalWhen(3, 'Shvat', 5785), 'Nissan 5785')
  assert.equal(earliestMedalWhen(2, 'Adar', 5785), 'Nissan 5785')
})

test('a streak counts Adar I and Adar II as consecutive missions', () => {
  const months = ['Shvat', 'Adar I', 'Adar II', 'Nissan'].map((month) => ({
    month, met: true, reported: true,
  }))
  const streak = streakFromMissions(streakMissions({ months, historyMonths: [] }))
  assert.equal(streak.current, 4)
  assert.equal(streak.best, 4)

  const broken = [
    { month: 'Shvat', met: true, reported: true },
    { month: 'Adar I', met: false, reported: true },
    { month: 'Adar II', met: true, reported: true },
  ]
  assert.equal(streakFromMissions(streakMissions({ months: broken })).current, 1)
})

test('the training board shows both Adars only on leap-year grades', () => {
  const keys = (board, grade) => board.boards.find((b) => b.grade === grade).missions.map((m) => m.key)

  const leap = buildTraining({ grade: '4', ladder: 8, year: 5787, months: [], history: {} })
  // Grade 4 in 5787 is a leap year. Grade 2 that year was 5785, which is not.
  // Grade 1 was 5784, which is.
  assert.deepEqual(keys(leap, '4').filter((k) => k.startsWith('Adar')), ['Adar I', 'Adar II'])
  assert.deepEqual(keys(leap, '2').filter((k) => k.startsWith('Adar')), ['Adar'])
  assert.deepEqual(keys(leap, '1').filter((k) => k.startsWith('Adar')), ['Adar I', 'Adar II'])
  const adar1 = leap.boards.find((b) => b.grade === '4').missions.find((m) => m.key === 'Adar I')
  const adar2 = leap.boards.find((b) => b.grade === '4').missions.find((m) => m.key === 'Adar II')
  assert.equal(adar1.heb, 'אדר א׳')
  assert.equal(adar2.heb, 'אדר ב׳')
  assert.equal(adar1.quota, quotaFor('4', 'Adar', 8).v)
  assert.equal(adar2.quota, adar1.quota)

  const plain = buildTraining({ grade: '3', ladder: 8, year: 5785, months: [], history: {} })
  assert.deepEqual(keys(plain, '3').filter((k) => k.startsWith('Adar')), ['Adar'])
  assert.equal(plain.boards.find((b) => b.grade === '3').missions.find((m) => m.key === 'Adar').heb, 'אדר')
})

test('leap-year Adar marks do not overwrite each other on the board', () => {
  const board = buildTraining({
    grade: '3',
    ladder: 8,
    year: 5787,
    months: [
      { month: 'Adar I', met: true, reported: true, quota: 40 },
      { month: 'Adar II', met: false, reported: true, said: 10 },
    ],
  })
  const row = board.boards.find((b) => b.grade === '3')
  const first = row.missions.find((m) => m.key === 'Adar I')
  const second = row.missions.find((m) => m.key === 'Adar II')
  assert.equal(first.met, true)
  assert.equal(second.met, false)
  assert.equal(second.record, true)
  assert.equal(row.done, 1)
})
