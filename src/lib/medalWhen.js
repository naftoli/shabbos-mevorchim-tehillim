import { DEFAULT_FIRST_MONTH, normalizeFirstMonth, schoolYearSlots, schoolYearStartYear } from '@/lib/schoolYear.js'

/**
 * Earliest month a medal can be earned if every remaining Shabbos Mevorchim
 * mission is completed. Walks the school's own year (Tishrei when no start
 * is set). Adar I and Adar II each count. A caller that still says "Adar"
 * during a leap year starts at Adar I. Returns null when we cannot place it.
 * Never invents a day-of-month.
 */
export function earliestMedalWhen(missionsToNext, fromMonth, year, firstMonth = DEFAULT_FIRST_MONTH) {
  const steps = Number(missionsToNext)
  const fromYear = Number(year)
  if (!Number.isFinite(steps) || steps < 1 || !Number.isFinite(fromYear)) return null
  const first = normalizeFirstMonth(firstMonth)
  let origin = schoolYearStartYear(first, fromYear, fromMonth)
  let slots = schoolYearSlots(first, origin)
  let index = slots.findIndex((slot) => slot.month === fromMonth && slot.year === fromYear)
  if (index < 0 && fromMonth === 'Adar') {
    index = slots.findIndex((slot) => (slot.month === 'Adar I' || slot.month === 'Adar') && slot.year === fromYear)
  }
  if (index < 0) index = 0
  let left = steps
  let guard = 0
  while (left > 0 && guard < 400) {
    if (left === 1) {
      return `${slots[index].month} ${slots[index].year}`
    }
    left -= 1
    index += 1
    if (index >= slots.length) {
      origin += 1
      slots = schoolYearSlots(first, origin)
      index = 0
    }
    guard += 1
  }
  return null
}
