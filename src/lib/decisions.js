// Open decisions from the Oct 30 team instructions.
// Each constant is the default we ship. Change the value here to reverse a call
// without hunting through the pages.

/** H4. Campaign mark beside "Army Report" / "The Race". 'flag' | 'target'. */
export const CAMPAIGN_MARK = 'flag'

/** H5. "Quota reached" badge. 'check' is a green check pill (no party emoji). */
export const QUOTA_BADGE = 'check'

/**
 * H9. The big "said" numbers on the quota bars.
 * 'bar' uses that bar's own color. 'pink' uses one pink for every number.
 */
export const STAT_NUMBER_COLOR = 'bar'
export const STAT_NUMBER_PINK = '#a85fa5'

/** R2. Month chips when the year has up to 15 occasions. 'wrap' lets them wrap. */
export const MONTH_CHOOSER = 'wrap'

/** R5. Reports breadcrumb. 'site' uses the same condensed display face as the nav. */
export const BREADCRUMB_STYLE = 'site'

/**
 * Streaks. A completed mission adds 1. A recorded miss breaks the streak and
 * the next completion starts again at 1. The best is kept.
 * Holidays count only when a real record exists (see STREAK_MISSING_BREAKS).
 */
export const STREAK_COUNTS_HOLIDAYS = true

/** A month with no record is skipped. It does not break a streak and it is not a miss. */
export const STREAK_MISSING_BREAKS = false

/**
 * D15. Which figure asks the chayol to confirm.
 * 'both' — kapitlach or minutes over their own quota.
 * 'kapitlach' | 'minutes' to use only one.
 */
export const ABOVE_QUOTA_METRIC = 'both'

/**
 * D16. After the chayol confirms, a report at or above either threshold is
 * "exceptional": email the mashpia. Minutes are a flat cap. Kapitlach are a
 * multiple of that chayol's own quota (so a quota of 2 does not email at 3).
 */
export const EXCEPTIONAL_MINUTES = 180
export const EXCEPTIONAL_KAPITEL_MULTIPLE = 3

/**
 * D24. Months in a row at a more demanding ladder before an invitation.
 * A lower ladder number is the more demanding path. The ladder never changes
 * by itself. After a decline, wait this many further completed missions.
 * This many recorded misses in a row may suggest a gentler ladder.
 */
export const LADDER_INVITE_MONTHS = 3
export const LADDER_REENGAGE_MISSIONS = 3
export const GENTLER_LADDER_MISSES = 3

/**
 * Demo-only labels, from Tehillim medals alone. The live personal page shows
 * the soldier's Tzivos Hashem rank from rank_marks (every campaign's medals).
 * Promotion is NOT announced by the commander until RANK_PROMOTION_ANNOUNCE
 * is true, and rank is not inferred out loud from medals alone.
 */
export const RANK_SCHEDULE = [
  { medals: 3, rank: 'Sergeant' },
  { medals: 7, rank: 'Sergeant Major' },
]
export const RANK_BELOW_SCHEDULE = 'Soldier'
export const RANK_PROMOTION_ANNOUNCE = false

/** How many past campaign years the chooser offers. Live data fills each one. */
export const PAST_YEARS_BACK = 4

/**
 * Who may see one class's student roll (name, ladder, "said X of Y").
 *
 * 'staff' — the default. Public reports and GET /reports/platoon/:id never
 * include the roll. It is returned only to HQ (any class), that school's
 * mashpia admin (admin_auths auth school), and the class teacher
 * (admin_auths auth 'class', id = class_id — see WWTC_CLASS_AUTH).
 * 'hq' would limit the roll to super-admins. 'off' would show it to nobody.
 *
 * Open point, shipped as 'staff': there is no separate teacher login. Mashpia
 * admin login (POST /admin/login) is the session that unlocks the roll. A
 * school admin sees every class in their school, not one class, until Naftoli
 * adds an admin_auths row with auth 'class' for that teacher. A future bearer
 * with type 'teacher' and classId is already accepted for that one class.
 * The API does not read the mashpia.com cookie session.
 */
export const PLATOON_ROLL_AUDIENCE = 'staff'

function sameRollId(a, b) {
  if (a == null || b == null) return false
  const left = String(a)
  const right = String(b)
  if (left === '' || right === '' || left === '0' || right === '0') return false
  return left === right
}

/** viewer is the stored admin/teacher session. scope is { classId, schoolId }. */
export function canSeeClassRoll(viewer, scope = {}) {
  if (!viewer || PLATOON_ROLL_AUDIENCE === 'off') return false
  const kind = viewer.kind
    || (viewer.type === 'teacher' ? 'teacher'
      : viewer.type === 'admin' && viewer.auth === 'super' ? 'super'
        : viewer.type === 'admin' ? 'school'
          : null)
  if (kind === 'super') return true
  if (PLATOON_ROLL_AUDIENCE === 'hq') return false
  const { classId, schoolId } = scope
  if (kind === 'school' || kind === 'admin') {
    const schools = Array.isArray(viewer.schoolIds) ? viewer.schoolIds : [viewer.schoolId]
    if (schools.some((id) => sameRollId(id, schoolId))) return true
    const classes = Array.isArray(viewer.classIds) ? viewer.classIds : [viewer.classId]
    if (classes.some((id) => sameRollId(id, classId))) return true
    return false
  }
  if (kind === 'teacher') {
    if (!sameRollId(viewer.classId, classId)) return false
    if (viewer.schoolId == null || viewer.schoolId === '') return true
    return sameRollId(viewer.schoolId, schoolId)
  }
  return false
}

/**
 * Voices. Marin stays the default and the girl commander.
 * A boy gets cedar unless OPENAI_REALTIME_VOICE pins one voice for everyone.
 */
export const COMMANDER_VOICE = { girl: 'marin', boy: 'cedar', default: 'marin' }

/**
 * What the commander may know about a child. No date of birth, serial,
 * address, password, or parent contact. Escalation text is the exceptional
 * email only, and only after the chayol confirms.
 */
export const AI_CHILD_FIELDS = [
  'name', 'gender', 'childGrade', 'childGradeLabel', 'ladder', 'finishTrainingByGrade',
  'focusLadder', 'situation', 'greeting', 'cue', 'monthEn', 'ladderChoices',
  'thisMonth', 'missionsTotal', 'medal', 'streak', 'rank', 'nextShabbosMevorchim',
  'scripts', 'scriptNow',
]

export function rankForMedals(earnedCount) {
  let rank = RANK_BELOW_SCHEDULE
  const n = Number(earnedCount) || 0
  for (const step of RANK_SCHEDULE) {
    if (n >= step.medals) rank = step.rank
  }
  return rank
}

export function isExceptional({ kapitlach, minutes, quotaKap, quotaMin }) {
  const kap = Number(kapitlach) || 0
  const min = Number(minutes) || 0
  const qk = Number(quotaKap) || 0
  const qm = Number(quotaMin) || 0
  if (min >= EXCEPTIONAL_MINUTES && (qm <= 0 || min > qm)) return true
  if (qk > 0 && kap >= qk * EXCEPTIONAL_KAPITEL_MULTIPLE) return true
  return false
}

export function isAboveQuota({ kapitlach, minutes, quotaKap, quotaMin }) {
  const kapOver = (Number(quotaKap) || 0) > 0 && (Number(kapitlach) || 0) > Number(quotaKap)
  const minOver = (Number(quotaMin) || 0) > 0 && (Number(minutes) || 0) > Number(quotaMin)
  if (ABOVE_QUOTA_METRIC === 'kapitlach') return kapOver
  if (ABOVE_QUOTA_METRIC === 'minutes') return minOver
  return kapOver || minOver
}
