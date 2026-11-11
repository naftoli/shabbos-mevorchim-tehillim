import { availableLadders, quotaFor } from '@/data/ladders.js'
import { countsInPublicTotals } from './overEntry.js'
import { metKap } from './quotaOverride.js'
import { GENTLER_LADDER_MISSES, LADDER_INVITE_MONTHS, LADDER_REENGAGE_MISSIONS } from './decisions.js'

function ladderQuota(grade, month, ladder) {
  const cell = quotaFor(grade, month, ladder)
  return cell ? Number(cell.v) : null
}

function flagFor(month, openFlag) {
  if (month?.flag && month.flag.status) return month.flag
  if (openFlag && openFlag.status && openFlag.month === month?.month) return openFlag
  return null
}

/**
 * Kapitlach that count for this month. An unaccepted flagged over-entry is
 * left out (same rule as public totals): the prior counted mark is what they
 * said, and a flag with no prior mark is not a recorded month.
 */
function counted(month, openFlag) {
  const flag = flagFor(month, openFlag)
  if (flag && !countsInPublicTotals(flag.status)) {
    if (flag.priorReported === false) return { said: 0, reported: false }
    const prior = flag.priorKapitlach ?? flag.priorSaid
    if (prior != null) return { said: Number(prior) || 0, reported: true }
    const raw = Number(month.said) || 0
    if (flag.kapitlach != null && raw === Number(flag.kapitlach)) return { said: 0, reported: false }
    return { said: raw, reported: month.reported !== false }
  }
  return { said: Number(month.said) || 0, reported: month.reported !== false }
}

function consider(months, openFlag) {
  const out = []
  for (const month of months || []) {
    if (!month || month.holiday || month.isFuture) continue
    const row = counted(month, openFlag)
    if (!row.reported) continue
    out.push({ ...month, said: row.said })
  }
  return out
}

/** Chart quota, unless a base-commander override replaced this month. */
function quotaNow(month, grade, ladder) {
  if (month.quotaAdjusted) return Number(month.quota) || 0
  const chart = ladderQuota(grade, month.month, ladder)
  if (chart != null) return chart
  return Number(month.quota) || 0
}

/**
 * Invite only. Never returns a ladder the app should apply by itself.
 * `harder` is one ladder up (a lower ladder number). `gentler` is one down.
 * A month is only one of those, so the two invitations never fire together.
 */
export function ladderAdvice({ grade, ladder, months, missionsTotal = 0, declined, openFlag = null }) {
  const list = consider(months, openFlag)
  const current = Number(ladder)
  const options = availableLadders(grade)
  if (!current || !list.length) return null
  const harderLadder = options.includes(current - 1) ? current - 1 : null
  const gentlerLadder = options.includes(current + 1) ? current + 1 : null

  let upRun = 0
  let downRun = 0
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const month = list[i]
    const said = Number(month.said) || 0
    const fromEnd = list.length - 1 - i
    const harderQuota = harderLadder ? ladderQuota(grade, month.month, harderLadder) : null
    const atHarder = harderQuota != null && said >= harderQuota
    if (atHarder && upRun === fromEnd) upRun += 1

    // An override counts as met (the quota is the kapitlach they entered).
    // A short month suggests one step down only when that ladder's quota is
    // closer to what they said than the ladder they are on.
    const met = metKap(quotaNow(month, grade, current), said, true)
    let atGentler = false
    if (!atHarder && !met && gentlerLadder) {
      const here = ladderQuota(grade, month.month, current)
      const there = ladderQuota(grade, month.month, gentlerLadder)
      if (here != null && there != null && Math.abs(said - there) < Math.abs(said - here)) {
        atGentler = true
      }
    }
    if (atGentler && downRun === fromEnd) downRun += 1
  }

  const cooled = declined
    && (missionsTotal - Number(declined.atMissions || 0)) < LADDER_REENGAGE_MISSIONS
    && declined.kind

  if (harderLadder && upRun >= LADDER_INVITE_MONTHS) {
    if (cooled && declined.kind === 'harder') return null
    return { kind: 'harder', ladder: harderLadder, months: upRun }
  }
  if (gentlerLadder && downRun >= GENTLER_LADDER_MISSES) {
    if (cooled && declined.kind === 'gentler') return null
    return { kind: 'gentler', ladder: gentlerLadder, months: downRun }
  }
  return null
}
