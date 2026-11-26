import { quotaFor } from '@/data/ladders.js'
import { PLAIN_MONTHS, campaignMonths, isHebrewLeapYear } from '@/lib/hebrewYear.js'

/**
 * FIRST_SHABBOS_MEVORCHIM
 *
 * The month a school picks is its first Shabbos Mevorchim: Mevorchim M,
 * the Shabbos held in the month before M that blesses M. That month is
 * quota and ladder position 1.
 *
 * Tishrei → Mevorchim Tishrei (held in Elul) → today's sequence. The grade
 * ends in Elul, and each month uses its own quota cell.
 * Shvat → Mevorchim Shvat (held in Teves) → Shvat, Adar, Nissan, …, Teves.
 * The grade ends in Teves. Shvat uses today's Tishrei quota cell, Adar uses
 * today's Cheshvan cell, and Teves uses today's Elul cell.
 *
 * Adar I and Adar II stay two reporting months and share the single quota
 * cell of whichever position Adar occupies in the rotated year.
 */
export const DEFAULT_FIRST_MONTH = 'Tishrei'

const HOLIDAYS = new Set(['Rosh Hashana', 'Yom Kippur', 'Rosh Hashona', 'Rosh Hashanah'])

export function normalizeFirstMonth(month) {
  const name = String(month || '').trim()
  return PLAIN_MONTHS.includes(name) ? name : DEFAULT_FIRST_MONTH
}

/**
 * First month for one school. No settings row — null, a missing field, or a
 * blank month — is Tishrei, the first month of the campaign year. A saved
 * month stays. HQ sets it. A school admin sets it only after HQ turns
 * allowSchoolPick on for that school.
 */
export function firstMonthFromRow(row) {
  if (row == null || row === '') return DEFAULT_FIRST_MONTH
  if (typeof row === 'object') {
    const stored = row.firstMonth ?? row.first_month ?? row.yearStart
    if (stored == null || stored === '') return DEFAULT_FIRST_MONTH
    return normalizeFirstMonth(stored)
  }
  return normalizeFirstMonth(row)
}

/**
 * HQ's per-school switch. Missing, 0, false, or anything but an explicit
 * on value is off, including before the column exists.
 */
export function allowSchoolPickFromRow(row) {
  if (row == null || typeof row !== 'object') return false
  const raw = row.allowSchoolPick !== undefined ? row.allowSchoolPick : row.allow_school_pick
  return raw === true || raw === 1 || raw === '1' || raw === 'true'
}

/**
 * HQ always sees the start-month picker. A school admin sees it only when
 * HQ has turned the switch on for that school.
 */
export function schoolYearPickerVisible({ isSuper = false, allowSchoolPick = false } = {}) {
  return !!isSuper || allowSchoolPickFromRow({ allowSchoolPick })
}

/**
 * Who may save the start month. HQ (auth super, or the demo kind super)
 * always may. A school admin may only when the switch is on.
 */
export function maySetSchoolYear(actor, allowSchoolPick = false) {
  if (!actor || typeof actor !== 'object') return false
  const type = actor.type || ''
  if (type !== '' && type !== 'admin') return false
  if (actor.auth === 'super' || actor.kind === 'super') return true
  if (type !== 'admin' && actor.kind !== 'school') return false
  return allowSchoolPickFromRow({ allowSchoolPick })
}

/** Adar I and Adar II occupy Adar's one slot. Anything else is unchanged. */
export function plainMonthName(month) {
  if (month === 'Adar I' || month === 'Adar II') return 'Adar'
  return month
}

export function rotatedPlainMonths(firstMonth) {
  const first = normalizeFirstMonth(firstMonth)
  const start = PLAIN_MONTHS.indexOf(first)
  return PLAIN_MONTHS.slice(start).concat(PLAIN_MONTHS.slice(0, start))
}

/**
 * Quota-sheet month for a calendar month at a school.
 * Position k of the school's year reads the cell position k uses when the
 * year starts in Tishrei (position 1 = Tishrei, position 12 = Elul).
 */
export function quotaSheetMonth(calendarMonth, firstMonth = DEFAULT_FIRST_MONTH) {
  const plain = plainMonthName(calendarMonth)
  if (!PLAIN_MONTHS.includes(plain)) return calendarMonth
  const index = rotatedPlainMonths(firstMonth).indexOf(plain)
  if (index < 0) return plain
  return PLAIN_MONTHS[index]
}

/** Calendar month that closes the grade. Tishrei → Elul. Shvat → Teves. */
export function gradeEndMonth(firstMonth = DEFAULT_FIRST_MONTH) {
  const months = rotatedPlainMonths(firstMonth)
  return months[months.length - 1]
}

/**
 * Quota cell for the end of the grade. Position 12 always reads the Elul
 * cell; gradeEndMonth is the calendar month in which that cell is reached.
 */
export function gradeEndSheetMonth(firstMonth = DEFAULT_FIRST_MONTH) {
  return quotaSheetMonth(gradeEndMonth(firstMonth), firstMonth)
}

export function quotaForSchool(grade, calendarMonth, ladder, firstMonth = DEFAULT_FIRST_MONTH) {
  const month = HOLIDAYS.has(calendarMonth) ? 'Tishrei' : calendarMonth
  return quotaFor(grade, quotaSheetMonth(month, firstMonth), ladder)
}

/**
 * Hebrew year in which the school's current grade year started.
 * A month that falls before the picked month in the Tishrei order belongs
 * to the school year that started in the previous Hebrew year.
 */
export function schoolYearStartYear(firstMonth, hebrewYear, hebrewMonth) {
  const year = Number(hebrewYear)
  const first = normalizeFirstMonth(firstMonth)
  const plain = plainMonthName(hebrewMonth)
  const startIdx = PLAIN_MONTHS.indexOf(first)
  const monthIdx = PLAIN_MONTHS.indexOf(plain)
  if (!Number.isFinite(year)) return year
  if (monthIdx < 0) return year
  return monthIdx >= startIdx ? year : year - 1
}

/**
 * One school year, in order. Each slot's sheetMonth is the quota cell.
 * Adar expands to Adar I and Adar II in the Hebrew year that Adar falls in,
 * and both slots share that position's cell. Crossing Tishrei after the
 * start moves into the next Hebrew year.
 */
export function schoolYearSlots(firstMonth, startYear) {
  const first = normalizeFirstMonth(firstMonth)
  const origin = Number(startYear)
  const plain = rotatedPlainMonths(first)
  let year = origin
  const slots = []
  plain.forEach((month, index) => {
    if (month === 'Tishrei' && index > 0) year += 1
    const sheetMonth = PLAIN_MONTHS[index]
    const position = index + 1
    if (month === 'Adar' && isHebrewLeapYear(year)) {
      slots.push({ month: 'Adar I', year, sheetMonth, position })
      slots.push({ month: 'Adar II', year, sheetMonth, position })
      return
    }
    slots.push({ month, year, sheetMonth, position })
  })
  return slots
}

/** Months of the school year that contains hebrewMonth of hebrewYear, oldest first. */
export function schoolYearMonthNames(firstMonth, hebrewYear, hebrewMonth) {
  const first = normalizeFirstMonth(firstMonth)
  const year = Number(hebrewYear)
  if (!Number.isFinite(year)) return campaignMonths(year)
  if (first === DEFAULT_FIRST_MONTH) return campaignMonths(year)
  const start = schoolYearStartYear(first, year, hebrewMonth || DEFAULT_FIRST_MONTH)
  return schoolYearSlots(first, start).map((slot) => slot.month)
}

/** Slots from the school year's first month through hebrewMonth, inclusive. */
export function elapsedSchoolYearSlots(firstMonth, hebrewYear, hebrewMonth) {
  const first = normalizeFirstMonth(firstMonth)
  const year = Number(hebrewYear)
  const month = hebrewMonth || DEFAULT_FIRST_MONTH
  const start = schoolYearStartYear(first, year, month)
  const slots = schoolYearSlots(first, start)
  let index = slots.findIndex((slot) => slot.month === month && slot.year === year)
  if (index < 0 && month === 'Adar') {
    index = slots.findIndex((slot) => (slot.month === 'Adar' || slot.month === 'Adar I') && slot.year === year)
  }
  if (index < 0) return slots
  return slots.slice(0, index + 1)
}
