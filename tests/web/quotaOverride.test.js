import test from 'node:test'
import assert from 'node:assert/strict'
import { medalState } from '../../src/lib/medals.js'
import { kapitlachInTotals } from '../../src/lib/overEntry.js'
import { rankForMedals } from '../../src/lib/decisions.js'
import { streakFromMissions } from '../../src/lib/streaks.js'
import {
  QUOTA_ADJUSTED_LABEL,
  adjustClassTotals,
  applyOverridesToMonths,
  effectiveKapQuota,
  metKap,
  overrideAccessStatus,
  quotaForMonth,
} from '../../src/lib/quotaOverride.js'

const cheshvanToday = 18
const override = { originalQuota: 10, overriddenQuota: 5, reason: 'short entry', undoneAt: null }

test('an override completes that month only and leaves the next month alone', () => {
  const months = applyOverridesToMonths([
    { month: 'Cheshvan', quota: 10, todayLadderQuota: cheshvanToday, said: 5, reported: true },
    { month: 'Kislev', quota: 12, said: 4, reported: true },
  ], { Cheshvan: override })

  assert.equal(months[0].quota, 5)
  assert.equal(months[0].met, true)
  assert.equal(months[0].quotaAdjusted, true)
  assert.equal(months[0].originalQuota, 10)
  assert.equal(months[1].quota, 12)
  assert.equal(months[1].met, false)
  assert.equal(months[1].quotaAdjusted, false)
})

test('Cheshvan priced from today\'s ladder still yields to the override', () => {
  const priced = quotaForMonth({
    month: 'Cheshvan',
    engineQuota: 10,
    todayLadderQuota: cheshvanToday,
    override,
  })
  assert.equal(priced.quota, 5)
  assert.equal(priced.quotaAdjusted, true)
  const kislev = quotaForMonth({ month: 'Kislev', engineQuota: 12, todayLadderQuota: 20, override: null })
  assert.equal(kislev.quota, 12, 'a non-Cheshvan month does not take the today-ladder figure')
})

test('undo restores the month', () => {
  const months = applyOverridesToMonths([
    { month: 'Cheshvan', quota: 10, todayLadderQuota: cheshvanToday, said: 5, reported: true },
  ], { Cheshvan: { ...override, undoneAt: '2026-11-11T10:00:00Z' } })
  assert.equal(months[0].quota, cheshvanToday)
  assert.equal(months[0].met, false)
  assert.equal(months[0].quotaAdjusted, false)
})

test('another school\'s commander is 403; HQ and the home base are allowed', () => {
  assert.equal(overrideAccessStatus({ kind: 'school', schoolId: 89 }, 90), 403)
  assert.equal(overrideAccessStatus({ type: 'admin', auth: 'school', schoolIds: [89] }, 90), 403)
  assert.equal(overrideAccessStatus({ kind: 'school', schoolId: 89 }, 89), 200)
  assert.equal(overrideAccessStatus({ kind: 'super', schoolId: null }, 90), 200)
  assert.equal(overrideAccessStatus({ type: 'kid', id: 2 }, 89), 403)
  assert.equal(overrideAccessStatus(null, 89), 403)
})

test('class totals, perfect platoon, streak, medal, and rank follow the override', () => {
  const totals = adjustClassTotals([
    { id: 1, quota: 10, said: 10 },
    { id: 2, quota: cheshvanToday, said: 5 },
  ], { 2: override })
  assert.equal(totals.quota, 15)
  assert.equal(totals.met, 2)
  assert.equal(totals.perfect, true)
  assert.equal(totals.pctMet, 100)

  const missions = applyOverridesToMonths([
    { month: 'Tishrei', quota: 10, said: 10, reported: true },
    { month: 'Cheshvan', quota: 10, todayLadderQuota: cheshvanToday, said: 5, reported: true },
  ], { Cheshvan: override }).map((month) => ({
    met: month.met,
    record: month.reported,
  }))
  const streak = streakFromMissions(missions)
  assert.equal(streak.best, 2)
  assert.equal(streak.current, 2)

  const before = medalState(17)
  const after = medalState(18)
  assert.equal(rankForMedals(before.earnedCount), 'Soldier')
  assert.equal(rankForMedals(after.earnedCount), 'Sergeant')
  assert.equal(QUOTA_ADJUSTED_LABEL, 'quota adjusted by base commander')
})

test('a flagged amount that does not count is not the quota the override adopts', () => {
  const soldier = {
    reports: { Kislev: 5 },
    flag: {
      month: 'Kislev',
      status: 'flagged',
      counts: false,
      priorReported: true,
      priorKapitlach: 5,
      kapitlach: 200,
    },
  }
  const said = kapitlachInTotals(soldier, 'Kislev')
  assert.equal(said, 5)
  const eff = effectiveKapQuota(10, { originalQuota: 10, overriddenQuota: said, undoneAt: null })
  assert.equal(eff.quota, 5)
  assert.equal(metKap(eff.quota, said, true), true)
  assert.notEqual(eff.quota, 200)

  const onlyFlagged = kapitlachInTotals({
    reports: {},
    flag: { month: 'Kislev', status: 'flagged', counts: false, priorReported: false, kapitlach: 200 },
  }, 'Kislev')
  assert.equal(onlyFlagged, 0)
  assert.equal(metKap(10, onlyFlagged, false), false)
})
