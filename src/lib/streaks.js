import { STREAK_COUNTS_HOLIDAYS, STREAK_MISSING_BREAKS } from './decisions.js'

/**
 * Monthly-task streak. Each entry is one month, oldest first.
 * A month they did (met) adds 1. A month they missed breaks the run, and the
 * next month they do starts again at 1. The current streak is the run still
 * open at the end — 0 when the latest counted month was missed. The longest
 * run is kept; it never shrinks, and it is always at least the current streak.
 *
 * A pending month (still open to report) is left out. A holiday with no
 * record is not a missed month. Any other month with no record is a miss
 * when STREAK_MISSING_BREAKS is on, and is skipped when it is off.
 *
 * missions: [{ met, record, holiday, pending }] in chronological order.
 */
export function streakFromMissions(missions) {
  let running = 0
  let best = 0
  for (const mission of missions || []) {
    if (!mission || mission.pending) continue
    if (mission.holiday && !STREAK_COUNTS_HOLIDAYS) continue
    // An explicit record:false is no record. Falling through to `met != null`
    // would treat a miss (met:false) as recorded and, for a holiday, as a
    // broken month.
    const recorded = mission.record === false
      ? false
      : mission.record === true || mission.met != null || mission.said != null
    if (mission.holiday && !recorded) continue
    if (!recorded && !STREAK_MISSING_BREAKS) continue
    if (mission.met) {
      running += 1
      if (running > best) best = running
    } else {
      running = 0
    }
  }
  return { current: running, best }
}
