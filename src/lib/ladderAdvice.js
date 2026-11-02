import { availableLadders, quotaFor } from '@/data/ladders.js'
import { GENTLER_LADDER_MISSES, LADDER_INVITE_MONTHS, LADDER_REENGAGE_MISSIONS } from './decisions.js'

function recorded(months) {
  return (months || []).filter((m) => m && m.reported !== false && !m.holiday && !m.isFuture)
}

/**
 * Invite only. Never returns a ladder the app should apply by itself.
 * `harder` is a lower ladder number. `gentler` is a higher one.
 */
export function ladderAdvice({ grade, ladder, months, missionsTotal = 0, declined }) {
  const list = recorded(months)
  const current = Number(ladder)
  const options = availableLadders(grade)
  if (!current || !list.length) return null
  const harderLadder = options.includes(current - 1) ? current - 1 : null
  const gentlerLadder = options.includes(current + 1) ? current + 1 : null

  let harderRun = 0
  let missRun = 0
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const month = list[i]
    const said = Number(month.said) || 0
    const harderQuota = harderLadder ? quotaFor(grade, month.month, harderLadder) : null
    const atHarder = !!(harderQuota && said >= harderQuota.v)
    if (atHarder && harderRun === (list.length - 1 - i)) harderRun += 1
    if (month.met === false && missRun === (list.length - 1 - i)) missRun += 1
  }

  const cooled = declined
    && (missionsTotal - Number(declined.atMissions || 0)) < LADDER_REENGAGE_MISSIONS
    && declined.kind

  if (harderLadder && harderRun >= LADDER_INVITE_MONTHS) {
    if (cooled && declined.kind === 'harder') return null
    return { kind: 'harder', ladder: harderLadder, months: harderRun }
  }
  if (gentlerLadder && missRun >= GENTLER_LADDER_MISSES) {
    if (cooled && declined.kind === 'gentler') return null
    return { kind: 'gentler', ladder: gentlerLadder, months: missRun }
  }
  return null
}
