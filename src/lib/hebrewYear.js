// Hebrew leap years follow the 19-year (Metonic) cycle. A year is leap when
// `year % 19` is 0, 3, 6, 8, 11, 14, or 17. Checked against the civil calendar:
// 5784 is leap (1 Adar I 5784 = 10 Feb 2024), 5785 is not (1 Adar 5785 = 1 Mar
// 2025), 5787 is leap (1 Adar I 5787 = 8 Feb 2027).
//
// A leap year inserts Adar I (אדר א׳) before Adar II (אדר ב׳). A plain year has
// one Adar. The ladder sheet has a single Adar row, so both leap-year Adars
// reuse that quota (see quotaFor). Stored month keys stay "Adar" in a plain
// year and "Adar I" / "Adar II" in a leap year, so the two months never share
// a record and older plain-year rows still match.

export const PLAIN_MONTHS = ['Tishrei', 'Cheshvan', 'Kislev', 'Teves', 'Shvat', 'Adar', 'Nissan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul']

const LEAP_REMAINDERS = new Set([0, 3, 6, 8, 11, 14, 17])

export function isHebrewLeapYear(year) {
  const y = Number(year)
  if (!Number.isFinite(y)) return false
  const r = ((y % 19) + 19) % 19
  return LEAP_REMAINDERS.has(r)
}

/** Campaign months for one Hebrew year, in calendar order. 12, or 13 in a leap year. */
export function campaignMonths(year) {
  if (!isHebrewLeapYear(year)) return PLAIN_MONTHS.slice()
  const out = []
  for (const month of PLAIN_MONTHS) {
    if (month === 'Adar') out.push('Adar I', 'Adar II')
    else out.push(month)
  }
  return out
}

/** Hebrew year of a civil date, as a number. 5786 when Intl cannot resolve it. */
export function currentHebrewYear(d = new Date()) {
  const y = new Intl.DateTimeFormat('en-u-ca-hebrew', { year: 'numeric' })
    .formatToParts(d)
    .find((p) => p.type === 'year')?.value || ''
  return Number(String(y).replace(/[^0-9]/g, '')) || 5786
}

/**
 * Ladder-sheet month for a campaign month. Adar I and Adar II have no row of
 * their own; both read the Adar quota.
 */
export function quotaMonth(month) {
  return month === 'Adar I' || month === 'Adar II' ? 'Adar' : month
}
