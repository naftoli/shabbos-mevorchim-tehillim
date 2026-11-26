// Next Shabbos Mevorchim — the Shabbos that blesses the coming month (the
// Shabbos before Rosh Chodesh). Rosh Chodesh Tishrei / Rosh Hashana is not
// formally bentshed, but the campaign still counts Tishrei: soldiers say the
// whole Tehillim that Shabbos too, so the Shabbos before Rosh Hashana is the
// Tishrei event (matching the backend's $sm[0] in calcTehillim.php). Computed
// live from today with the Intl Hebrew calendar, so no calendar library is
// needed. Returns the date, how many days away, and which month it blesses
// (matched to the campaign's English month names).

import { MONTH_HEB, toHebrewNumeral } from '@/data/ladders.js'

// Add geresh/gershayim punctuation to a Hebrew numeral for a date (כא → כ״א).
function withGershayim(heb) {
  if (heb.length <= 1) return heb + '׳'
  return heb.slice(0, -1) + '״' + heb.slice(-1)
}

const HEB_MONTH_TO_EN = {
  // Intl 'en-u-ca-hebrew' long month names → campaign MONTHS keys.
  Tishri: 'Tishrei',
  Heshvan: 'Cheshvan',
  Kislev: 'Kislev',
  Tevet: 'Teves',
  Shevat: 'Shvat',
  Adar: 'Adar',
  // Leap years: keep the two Adars distinct. A plain year only ever says "Adar".
  'Adar I': 'Adar I',
  'Adar II': 'Adar II',
  Nisan: 'Nissan',
  Iyar: 'Iyar',
  Sivan: 'Sivan',
  Tammuz: 'Tammuz',
  Av: 'Av',
  Elul: 'Elul',
}

const hebFmt = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long' })

function hebParts(date) {
  const parts = hebFmt.formatToParts(date)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  const month = parts.find((p) => p.type === 'month')?.value || ''
  return { day, month }
}

const DAY = 86400000
const atMidnight = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// First upcoming Rosh Chodesh (Hebrew day-of-month === 1). Tishrei (Rosh
// Hashana) counts: during Elul the next one is Rosh Hashana, so the campaign's
// Tishrei event is the Shabbos before it.
function nextRoshChodesh(from) {
  let d = atMidnight(from)
  for (let i = 0; i < 400; i += 1) {
    const { day, month } = hebParts(d)
    if (day === 1) return { date: d, month }
    d = new Date(d.getTime() + DAY)
  }
  return null
}

// The Shabbos strictly before a given date (walk back to the previous Saturday).
function shabbosBefore(date) {
  let d = new Date(date.getTime() - DAY)
  while (d.getDay() !== 6) d = new Date(d.getTime() - DAY)
  return d
}

export function nextShabbosMevorchim(from = new Date()) {
  const today = atMidnight(from)
  let rc = nextRoshChodesh(today)
  if (!rc) return null
  let shabbos = shabbosBefore(rc.date)
  // If this month's bentshen Shabbos already passed, roll to the next month.
  if (shabbos < today) {
    rc = nextRoshChodesh(new Date(rc.date.getTime() + DAY))
    if (!rc) return null
    shabbos = shabbosBefore(rc.date)
  }
  const daysUntil = Math.round((shabbos - today) / DAY)
  const monthEn = HEB_MONTH_TO_EN[rc.month] || rc.month

  // The Shabbos's own Hebrew date (it sits in the current month, bentshing the
  // next), e.g. "כ״ח תשרי".
  const sp = hebParts(shabbos)
  const spMonthHeb = MONTH_HEB[HEB_MONTH_TO_EN[sp.month]] || sp.month
  const hebDateLabel = `${withGershayim(toHebrewNumeral(sp.day))} ${spMonthHeb}`

  return {
    date: shabbos,
    daysUntil,
    monthEn,
    hebDateLabel,
    dateLabel: shabbos.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
  }
}

// Hebrew year of a date, as a number (5787, …).
function hebrewYearNum(d) {
  const y = new Intl.DateTimeFormat('en-u-ca-hebrew', { year: 'numeric' })
    .formatToParts(d)
    .find((p) => p.type === 'year')?.value || ''
  return Number(y.replace(/[^0-9]/g, '')) || 0
}

// Campaign month a `saturday` reports on: the Rosh Chodesh that falls within the
// next seven days, with that RC's year. Tishrei counts — the Shabbos before Rosh
// Hashana reports on Tishrei, its RC's (new) year. The window is seven, not six,
// to match shabbosBefore(): when Rosh Chodesh is itself on Shabbos (e.g. Rosh
// Hashana 5787), the Shabbos that reports on it is a full seven days earlier.
function bentshedBy(saturday) {
  for (let i = 1; i <= 7; i += 1) {
    const rc = new Date(saturday.getTime() + i * DAY)
    const { day, month } = hebParts(rc)
    if (day === 1) return { monthEn: HEB_MONTH_TO_EN[month] || month, year: hebrewYearNum(rc) }
  }
  return null
}

// The month currently being reported: the one bentshed by the most recent
// Shabbos Mevorchim on or before today (it holds from that Shabbos until the
// next one). Before the year's first Shabbos Mevorchim, falls back to the
// upcoming month. e.g. the Shabbos after Mevorchim-Cheshvan → still Cheshvan.
export function currentReportingMonth(from = new Date()) {
  const today = atMidnight(from)
  const thisYear = hebrewYearNum(today)
  let sat = today
  while (sat.getDay() !== 6) sat = new Date(sat.getTime() - DAY)
  for (let w = 0; w < 6; w += 1) {
    const hit = bentshedBy(sat)
    if (hit && hit.year === thisYear) return hit.monthEn
    sat = new Date(sat.getTime() - 7 * DAY)
  }
  return nextShabbosMevorchim(from)?.monthEn ?? null
}
