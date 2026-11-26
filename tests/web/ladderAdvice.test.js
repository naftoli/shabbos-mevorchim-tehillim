import test from 'node:test'
import assert from 'node:assert/strict'
import { quotaFor } from '../../src/data/ladders.js'
import { cueInviteGentler, cueInviteHarder } from '../../src/lib/commanderCues.js'
import { GENTLER_LADDER_MISSES, LADDER_INVITE_MONTHS } from '../../src/lib/decisions.js'
import { ladderAdvice } from '../../src/lib/ladderAdvice.js'

// 3rd grade, ladder 8. Ladder 7 is the next step up (more kapitlach).
// Ladder 9 is one step down. Ladder 10 is two steps down.
const grade = '3'
const ladder = 8
const names = ['Tishrei', 'Cheshvan', 'Kislev', 'Teves', 'Shvat', 'Adar']

function quota(month, which) {
  return quotaFor(grade, month, which).v
}

function months(saidFor, extra) {
  return names.filter((month) => saidFor(month) != null).map((month) => ({
    month,
    said: saidFor(month),
    reported: true,
    ...(extra ? extra(month) : {}),
  }))
}

function advise(saidFor, extra, opts = {}) {
  return ladderAdvice({
    grade,
    ladder,
    months: months(saidFor, extra),
    ...opts,
  })
}

const recent = (fn) => (month) => (names.slice(0, 3).includes(month) ? fn(month) : null)

test('up: three months at the next ladder suggest one ladder up', () => {
  assert.equal(LADDER_INVITE_MONTHS, 3)
  const advice = advise(recent((month) => quota(month, ladder - 1)))
  assert.deepEqual(advice, { kind: 'harder', ladder: ladder - 1, months: 3 })
  assert.equal(cueInviteHarder(), "For three months straight you've done more than your ladder asks. Would you like to move up to a faster ladder? Totally your call — staying put is perfectly fine too.")
})

test('up: saying more than this ladder, but not the next one, stays put', () => {
  const advice = advise(recent((month) => quota(month, ladder) + 1))
  assert.equal(advice, null)
})

test('up: two months at the next ladder are not enough', () => {
  const advice = advise((month) => {
    if (month === 'Tishrei') return quota(month, ladder)
    if (month === 'Cheshvan' || month === 'Kislev') return quota(month, ladder - 1)
    return null
  })
  assert.equal(advice, null)
})

test('down: three months that match the next gentler ladder suggest one ladder down', () => {
  assert.equal(GENTLER_LADDER_MISSES, 3)
  const advice = advise(recent((month) => quota(month, ladder + 1)))
  assert.deepEqual(advice, { kind: 'gentler', ladder: ladder + 1, months: 3 })
  assert.equal(
    cueInviteGentler(advice.ladder),
    "The last few months, what you've been saying fits Ladder 9 really well. Want to try that ladder? It's a gentler step, every kapitel still counts, and staying where you are is perfectly fine.",
  )
})

test('down: an amount that matches two ladders down still moves only one step', () => {
  const advice = advise(recent((month) => quota(month, ladder + 2)))
  assert.equal(advice?.ladder, ladder + 1)
  assert.notEqual(advice?.ladder, ladder + 2)
  assert.equal(advice?.kind, 'gentler')
})

test('down: two short months are not enough', () => {
  const advice = advise((month) => {
    if (month === 'Tishrei') return quota(month, ladder)
    if (month === 'Cheshvan' || month === 'Kislev') return quota(month, ladder + 1)
    return null
  })
  assert.equal(advice, null)
})

test('neither: on quota, or only a little short, suggests nothing', () => {
  assert.equal(advise(recent((month) => quota(month, ladder))), null)
  // One kapitel under is still closer to this ladder than to the next gentler one.
  assert.equal(advise(recent((month) => quota(month, ladder) - 1)), null)
})

test('neither direction is suggested at the same time', () => {
  const downThenUp = advise((month) => (
    names.slice(0, 3).includes(month) ? quota(month, ladder + 1) : quota(month, ladder - 1)
  ))
  assert.equal(downThenUp.kind, 'harder')
  assert.equal(downThenUp.ladder, ladder - 1)
  assert.equal(Object.keys(downThenUp).includes('gentler'), false)

  const upThenDown = advise((month) => (
    names.slice(0, 3).includes(month) ? quota(month, ladder - 1) : quota(month, ladder + 1)
  ))
  assert.equal(upThenDown.kind, 'gentler')
  assert.equal(upThenDown.ladder, ladder + 1)
})

test('a quota override counts as met, so it does not suggest down or up', () => {
  const advice = advise(
    recent((month) => quota(month, ladder + 1)),
    (month) => ({ quotaAdjusted: true, quota: quota(month, ladder + 1), met: false }),
  )
  assert.equal(advice, null)
})

test('an unaccepted flagged over-entry does not suggest moving up', () => {
  const flagged = (month) => ({
    said: 150,
    flag: {
      status: 'flagged',
      counts: false,
      kapitlach: 150,
      priorKapitlach: quota(month, ladder),
      priorReported: true,
    },
  })
  // said is the flagged 150, which would clear the next ladder. The prior mark is on quota.
  const advice = ladderAdvice({
    grade,
    ladder,
    months: names.slice(0, 3).map((month) => ({ month, reported: true, ...flagged(month) })),
  })
  assert.equal(advice, null)

  const open = ladderAdvice({
    grade,
    ladder,
    months: [
      { month: 'Tishrei', said: quota('Tishrei', ladder - 1), reported: true },
      { month: 'Cheshvan', said: quota('Cheshvan', ladder - 1), reported: true },
      { month: 'Kislev', said: 150, reported: true },
    ],
    openFlag: {
      status: 'flagged',
      month: 'Kislev',
      kapitlach: 150,
      priorKapitlach: quota('Kislev', ladder),
      priorReported: true,
      counts: false,
    },
  })
  assert.equal(open, null)
})

test('an accepted flag counts, and can suggest moving up', () => {
  const advice = advise(
    recent((month) => quota(month, ladder - 1)),
    () => ({
      flag: { status: 'accepted', kapitlach: 150, priorKapitlach: 1, priorReported: true, counts: true },
    }),
  )
  assert.equal(advice?.kind, 'harder')
  assert.equal(advice?.ladder, ladder - 1)
})
