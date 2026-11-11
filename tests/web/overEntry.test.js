import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { GRADES, MONTHS, QUOTA } from '../../src/data/ladders.js'
import {
  OVER_ENTRY_CONFIG,
  OVER_ENTRY_CONFIRM,
  OVER_ENTRY_NO,
  OVER_ENTRY_YES,
  amountLabel,
  applySoldierReport,
  countsInPublicTotals,
  kapitlachInTotals,
  missionCounts,
  planReport,
  reviewSoldier,
  thresholdLabel,
} from '../../src/lib/overEntry.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const CONFIRM = "Are you sure this is correct? It will be flagged to your base commander and to HQ, and it's being sent in a duch to the Rebbe."

test('the confirm copy and buttons are the review warning', () => {
  assert.equal(OVER_ENTRY_CONFIRM, CONFIRM)
  assert.equal(OVER_ENTRY_YES, 'Yes, submit')
  assert.equal(OVER_ENTRY_NO, 'No, go back and fix')
  assert.equal(OVER_ENTRY_CONFIG.flaggedCountsBeforeReview, false)

  const page = read('src/pages/KidDashboard.jsx')
  assert.match(page, /OVER_ENTRY_CONFIRM/)
  assert.match(page, /OVER_ENTRY_YES/)
  assert.match(page, /OVER_ENTRY_NO/)
  assert.match(page, /data-over-entry-confirm/)
  assert.match(page, /flagConfirmed: true/)
})

test('per-grade caps are the ladder top and twice that grade’s top minutes', () => {
  for (const grade of GRADES) {
    let maxKap = 0
    let maxMin = 0
    for (const month of MONTHS) {
      for (const cell of Object.values(QUOTA[grade][month])) {
        maxKap = Math.max(maxKap, cell.v)
        maxMin = Math.max(maxMin, cell.m)
      }
    }
    assert.equal(OVER_ENTRY_CONFIG.grades[grade].ladderTopKapitlach, maxKap, grade)
    assert.equal(OVER_ENTRY_CONFIG.grades[grade].minutes, maxMin * 2, grade)
  }
})

test('the client asks before a Pre-1A 150 and does not treat confirm as optional', () => {
  const held = planReport({ grade: 'pre1a', kapitlach: 150, minutes: 10, quotaKap: 2, quotaMin: 10, flagConfirmed: false })
  assert.equal(held.action, 'confirm')
  assert.equal(held.writeMark, false)
  assert.equal(held.line.kapitlach, 46)

  const flagged = planReport({ grade: 'Pre-1A', kapitlach: 150, minutes: 10, quotaKap: 2, quotaMin: 10, flagConfirmed: true })
  assert.equal(flagged.action, 'flag')
  assert.equal(flagged.writeMark, false)
  assert.equal(flagged.counts, false)

  const onTheLine = planReport({ grade: 'pre1a', kapitlach: 46, minutes: 170, quotaKap: 2, quotaMin: 10 })
  assert.equal(onTheLine.action, 'save')

  const steep = planReport({ grade: 'pre1a', kapitlach: 93, minutes: 10, quotaKap: 46, quotaMin: 80 })
  assert.equal(steep.action, 'confirm')
  assert.equal(steep.line.kapitlach, 92)

  const minutes = planReport({ grade: '1', kapitlach: 5, minutes: 181, quotaKap: 4, quotaMin: 20, flagConfirmed: true })
  assert.equal(minutes.action, 'flag')
  assert.deepEqual(minutes.reasons, ['minutes'])
})

test('a flagged report stays out of totals, missions, and Perfect Platoon until accepted', () => {
  assert.equal(countsInPublicTotals('flagged'), false)
  assert.equal(countsInPublicTotals('accepted'), true)
  assert.equal(countsInPublicTotals(null), true)

  const mate = { reports: { Cheshvan: 10 }, minutesByMonth: { Cheshvan: 20 }, flag: null }
  const kid = { id: 's9', name: 'Avi S.', reports: {}, minutesByMonth: {}, flag: null }
  const saved = applySoldierReport(kid, {
    month: 'Cheshvan',
    grade: 'pre1a',
    kapitlach: 150,
    minutes: 12,
    quotaKap: 2,
    quotaMin: 10,
    flagConfirmed: true,
    kidName: 'Avi S.',
    at: '2026-11-10T18:30:00.000Z',
  })
  assert.equal(saved.error, null)
  assert.equal(saved.plan.action, 'flag')
  assert.equal(kid.reports.Cheshvan, undefined)
  assert.equal(kapitlachInTotals(kid, 'Cheshvan'), 0)
  assert.equal(missionCounts(kid, 'Cheshvan', 2), false)
  assert.equal(kapitlachInTotals(mate, 'Cheshvan') + kapitlachInTotals(kid, 'Cheshvan'), 10)
  assert.equal(kid.flag.decisions[0].action, 'flagged')
  assert.equal(kid.flag.decisions[0].actorName, 'Avi S.')
  assert.equal(kid.flag.decisions[0].at, '2026-11-10T18:30:00.000Z')
  assert.equal(amountLabel(kid.flag), '150 kapitlach · 12 min')
  assert.equal(thresholdLabel(kid.flag), '46 kapitlach')

  const accepted = reviewSoldier(kid, 'accept', { type: 'admin', id: 1, name: 'HQ Command' }, '2026-11-11T15:04:00.000Z')
  assert.equal(accepted.ok, true)
  assert.equal(accepted.decision.actorName, 'HQ Command')
  assert.equal(accepted.decision.action, 'accepted')
  assert.equal(accepted.decision.at, '2026-11-11T15:04:00.000Z')
  assert.equal(kid.reports.Cheshvan, 150)
  assert.equal(kapitlachInTotals(kid, 'Cheshvan'), 150)
  assert.equal(missionCounts(kid, 'Cheshvan', 2), true)
  assert.equal(countsInPublicTotals(kid.flag.status), true)
})

test('remove voids the flagged amount and restores the prior value, or leaves the month uncounted', () => {
  const withPrior = {
    id: 's2',
    name: 'Levi K.',
    reports: { Cheshvan: 4 },
    minutesByMonth: { Cheshvan: 10 },
    flag: null,
  }
  applySoldierReport(withPrior, {
    month: 'Cheshvan', grade: 'pre1a', kapitlach: 150, minutes: 30,
    quotaKap: 2, quotaMin: 10, flagConfirmed: true, at: '2026-11-10T12:00:00.000Z',
  })
  assert.equal(kapitlachInTotals(withPrior, 'Cheshvan'), 4)
  const removed = reviewSoldier(withPrior, 'remove', { type: 'admin', name: 'Base Commander' }, '2026-11-11T16:00:00.000Z')
  assert.equal(removed.ok, true)
  assert.equal(removed.countedKapitlach, 4)
  assert.equal(removed.notCounted, false)
  assert.equal(withPrior.reports.Cheshvan, 4)
  assert.equal(kapitlachInTotals(withPrior, 'Cheshvan'), 4)
  assert.equal(removed.decision.actorName, 'Base Commander')
  assert.equal(removed.decision.action, 'removed')

  const fresh = { id: 's3', name: 'Chaya M.', reports: {}, minutesByMonth: {}, flag: null }
  applySoldierReport(fresh, {
    month: 'Cheshvan', grade: '1', kapitlach: 150, minutes: 20,
    quotaKap: 5, quotaMin: 20, flagConfirmed: true,
  })
  const cleared = reviewSoldier(fresh, 'remove', { type: 'admin', name: 'HQ Command' }, '2026-11-11T16:05:00.000Z')
  assert.equal(cleared.notCounted, true)
  assert.equal(cleared.countedKapitlach, 0)
  assert.equal(Object.prototype.hasOwnProperty.call(fresh.reports, 'Cheshvan'), false)
  assert.equal(kapitlachInTotals(fresh, 'Cheshvan'), 0)
  assert.equal(missionCounts(fresh, 'Cheshvan', 5), false)
})

test('an accepted decision can be removed and a removed decision can be accepted', () => {
  const kid = { id: 's4', name: 'Dovid R.', reports: { Cheshvan: 4 }, minutesByMonth: { Cheshvan: 10 }, flag: null }
  applySoldierReport(kid, {
    month: 'Cheshvan', grade: 'pre1a', kapitlach: 150, minutes: 25,
    quotaKap: 2, quotaMin: 10, flagConfirmed: true, at: '2026-11-10T12:00:00.000Z',
  })
  const accepted = reviewSoldier(kid, 'accept', { type: 'admin', id: 9, name: 'HQ Command' }, '2026-11-11T15:04:00.000Z')
  assert.equal(accepted.ok, true)
  assert.equal(kid.reports.Cheshvan, 150)
  assert.equal(kid.minutesByMonth.Cheshvan, 25)
  assert.equal(kapitlachInTotals(kid, 'Cheshvan'), 150)

  const removed = reviewSoldier(kid, 'remove', { type: 'admin', id: 9, name: 'HQ Command' }, '2026-11-11T16:00:00.000Z')
  assert.equal(removed.ok, true)
  assert.equal(removed.status, 'removed')
  assert.equal(removed.countedKapitlach, 4)
  assert.equal(kid.reports.Cheshvan, 4)
  assert.equal(kid.minutesByMonth.Cheshvan, 10)
  assert.equal(kapitlachInTotals(kid, 'Cheshvan'), 4)
  assert.equal(kid.flag.decisions.at(-1).action, 'removed')

  const again = reviewSoldier(kid, 'remove', { type: 'admin', name: 'HQ Command' }, '2026-11-11T16:10:00.000Z')
  assert.equal(again.ok, false)

  const reaccepted = reviewSoldier(kid, 'accept', { type: 'admin', id: 3, name: 'Base Commander' }, '2026-11-11T17:00:00.000Z')
  assert.equal(reaccepted.ok, true)
  assert.equal(reaccepted.status, 'accepted')
  assert.equal(kid.reports.Cheshvan, 150)
  assert.equal(kid.minutesByMonth.Cheshvan, 25)
  assert.equal(kapitlachInTotals(kid, 'Cheshvan'), 150)
  assert.equal(missionCounts(kid, 'Cheshvan', 2), true)
  assert.equal(reaccepted.decision.actorName, 'Base Commander')
  assert.equal(reaccepted.decision.action, 'accepted')
  assert.equal(reviewSoldier(kid, 'accept', { type: 'admin', name: 'HQ Command' }).ok, false)

  const fresh = { id: 's5', name: 'Chaya M.', reports: {}, minutesByMonth: {}, flag: null }
  applySoldierReport(fresh, {
    month: 'Cheshvan', grade: '1', kapitlach: 150, minutes: 20,
    quotaKap: 5, quotaMin: 20, flagConfirmed: true,
  })
  reviewSoldier(fresh, 'accept', { type: 'admin', name: 'HQ Command' }, '2026-11-11T18:00:00.000Z')
  const cleared = reviewSoldier(fresh, 'remove', { type: 'admin', name: 'HQ Command' }, '2026-11-11T18:05:00.000Z')
  assert.equal(cleared.ok, true)
  assert.equal(cleared.notCounted, true)
  assert.equal(Object.prototype.hasOwnProperty.call(fresh.reports, 'Cheshvan'), false)
  assert.equal(kapitlachInTotals(fresh, 'Cheshvan'), 0)
})

test('the admin queue shows kid, class, amount, threshold, and the two decisions', () => {
  const page = read('src/pages/AdminDashboard.jsx')
  assert.match(page, /data-flag-queue/)
  assert.match(page, /Accept/)
  assert.match(page, /Remove/)
  assert.match(page, /Remove instead/)
  assert.match(page, /Accept instead/)
  assert.match(page, /thresholdLabel/)
  assert.match(page, /amountLabel/)
  assert.match(page, /getFlagQueue/)
  assert.match(page, /reviewFlag/)
})
