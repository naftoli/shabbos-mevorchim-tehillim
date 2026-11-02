import { STREAK_COUNTS_HOLIDAYS, STREAK_MISSING_BREAKS } from './decisions.js'

/**
 * Consecutive completed missions. A recorded miss breaks the streak and the
 * next completion starts at 1. The best is kept. A missing record is skipped
 * unless STREAK_MISSING_BREAKS is on. Holiday rows count only when the
 * constant says so and a record exists.
 *
 * missions: [{ met, record, holiday }] in chronological order.
 */
export function streakFromMissions(missions) {
  let running = 0
  let best = 0
  for (const mission of missions || []) {
    if (mission?.holiday && !STREAK_COUNTS_HOLIDAYS) continue
    const hasRecord = mission?.record !== false && mission?.record !== undefined
      ? !!mission.record
      : mission?.met != null || mission?.said != null
    if (!hasRecord) {
      if (STREAK_MISSING_BREAKS) running = 0
      continue
    }
    if (mission.met) {
      running += 1
      if (running > best) best = running
    } else {
      running = 0
    }
  }
  return { current: running, best }
}
