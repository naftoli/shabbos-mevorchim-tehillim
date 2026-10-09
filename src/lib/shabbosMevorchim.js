// Next Shabbos Mevorchim — the Shabbos that blesses the coming month (the
// Shabbos before Rosh Chodesh; Rosh Chodesh Tishrei / Rosh Hashana is not
// bentshed). Computed live from today with the Intl Hebrew calendar, so no
// calendar library is needed. Returns the date, how many days away, and which
// month it blesses (matched to the campaign's English month names).

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
  'Adar I': 'Adar',
  'Adar II': 'Adar',
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

// First upcoming Rosh Chodesh (Hebrew day-of-month === 1) that is NOT Tishrei.
function nextRoshChodesh(from) {
  let d = atMidnight(from)
  for (let i = 0; i < 400; i += 1) {
    const { day, month } = hebParts(d)
    if (day === 1 && month !== 'Tishri') return { date: d, month }
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
