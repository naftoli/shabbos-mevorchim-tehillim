import { MONTHS } from '@/data/ladders.js'

/**
 * Earliest month a medal can be earned if every remaining Shabbos Mevorchim
 * mission is completed. Built only from the campaign month list. Returns null
 * when we cannot place it. Never invents a day-of-month.
 */
export function earliestMedalWhen(missionsToNext, fromMonth, year) {
  const steps = Number(missionsToNext)
  const startYear = Number(year)
  if (!Number.isFinite(steps) || steps < 1 || !Number.isFinite(startYear)) return null
  let index = MONTHS.indexOf(fromMonth)
  if (index < 0) index = 0
  let y = startYear
  let left = steps
  let guard = 0
  while (left > 0 && guard < 400) {
    if (left === 1) {
      return `${MONTHS[index]} ${y}`
    }
    left -= 1
    index += 1
    if (index >= MONTHS.length) {
      index = 0
      y += 1
    }
    guard += 1
  }
  return null
}
