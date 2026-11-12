// Worldwide Tehillim Club — ladder quota table.
//
// GENERATED from the campaign's "Master" sheet (13 grades x 12 months x up to
// 8 ladders). Do not hand-edit cells; regenerate from the source sheet into
// ladders-quota.json (shared with the PHP generator).
//
// A child picks a LADDER (5-12) — their TRAINING plan, numbered by the grade in
// which they finish training to say the whole Tehillim (kapitel 150): Ladder 5 =
// finish training by 5th grade ... Ladder 12 = by 12th grade. (Saying the whole
// Tehillim every Shabbos Mevorchim is the goal; the ladder is the ramp to it.)
// The child stays on their ladder number every year.
// Every grade may pick ladders 5..12.
//
// Each cell is the CUMULATIVE Shabbos-Mevorchim target for that grade + month +
// ladder: { k: Hebrew range label ("א-נד"), v: numeric kapitel value, m:
// minutes, h: 1 when the end kapitel is only half said (א-½קיט = through the
// middle of 119, v = 118.5) }.

import QUOTA from './ladders-quota.json' with { type: 'json' }
export { QUOTA }

export const MONTHS = ["Tishrei","Cheshvan","Kislev","Teves","Shvat","Adar","Nissan","Iyar","Sivan","Tammuz","Av","Elul"]

export const MONTH_HEB = {
  Tishrei: "תשרי", "Rosh Hashana": "ראש השנה", "Yom Kippur": "יום כיפור", Cheshvan: "חשון", Kislev: "כסלו", Teves: "טבת", Shvat: "שבט", Adar: "אדר",
  Nissan: "ניסן", Iyar: "אייר", Sivan: "סיון", Tammuz: "תמוז", Av: "אב", Elul: "אלול",
  // Leap-year Adars (the backend labels them "Adar I" / "Adar II"); both say the
  // same Adar quota, but keep distinct Hebrew labels.
  "Adar I": "אדר א׳", "Adar II": "אדר ב׳",
}

export const GRADES = ["pre1a","1","2","3","4","5","6","7","8","9","10","11","12"]

export const GRADE_LABEL = {"1":"1st","2":"2nd","3":"3rd","4":"4th","5":"5th","6":"6th","7":"7th","8":"8th","9":"9th","10":"10th","11":"11th","12":"12th","pre1a":"Pre-1A"}

// A ladder IS numbered by the grade a child finishes their training in:
// Ladder 5 finishes training by 5th grade … Ladder 12 by 12th grade.
// Listed high → low so the steepest ladder (12) shows first everywhere.
export const LADDERS = [12, 11, 10, 9, 8, 7, 6, 5]

// The grade in which a ladder reaches the full 150 kapitlach — the ladder number.
export const finishGrade = (ladder) => ladder

// Ladders a soldier may pick. Every ladder (5..12) is selectable regardless of
// grade; the backend accepts the same range.
export function availableLadders() {
  return LADDERS.slice()
}

// Look up one cell. grade: 'pre1a' | '1'..'12'; month: a MONTHS entry (or
// "Adar I" / "Adar II"); ladder 5-12.
// The master sheet has no separate Adar I / Adar II rows. A leap year says the
// Adar quota twice — once in Adar I (אדר א׳) and once in Adar II (אדר ב׳).
// Holiday boards reuse the Tishrei quota, same as PHP wwtcCustomMonthName.
export function quotaFor(grade, month, ladder) {
  const mo = month === 'Adar I' || month === 'Adar II' ? 'Adar'
    : (month === 'Rosh Hashana' || month === 'Yom Kippur' || month === 'Rosh Hashona' || month === 'Rosh Hashanah' ? 'Tishrei' : month)
  const cells = QUOTA[grade]?.[mo]
  if (!cells) return null
  const direct = cells[ladder]
  if (direct) return direct
  // A ladder below this grade's range was finished in an earlier grade (e.g. a
  // 6th-grader still on ladder 5, which completes the whole Tehillim by grade 5),
  // so the table omits it. Such a child is simply done — full 150 every month,
  // which is exactly the grade's lowest (finished) ladder cell.
  const L = Number(ladder)
  const minLadder = Math.min(...Object.keys(cells).map(Number))
  if (L >= 5 && L < minLadder) return cells[minLadder]
  return null
}

// Integer → Hebrew numeral (gematria): 10→"י", 15→"טו", 119→"קיט", 150→"קנ".
// A half value (the ½קיט case, e.g. 118.5) renders as "½<letters>".
const HEB_ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']
const HEB_TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ']
const HEB_HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת']
function hebTwo(n) {
  if (n === 15) return 'טו'
  if (n === 16) return 'טז'
  return (HEB_TENS[Math.floor(n / 10)] || '') + (HEB_ONES[n % 10] || '')
}
export function toHebrewNumeral(num) {
  if (num == null) return ''
  const half = !Number.isInteger(num)
  const n = Math.floor(num)
  let out = ''
  let h = Math.floor(n / 100)
  while (h > 0) { const take = Math.min(h, 4); out += HEB_HUNDREDS[take]; h -= take }
  out += hebTwo(n % 100)
  return half ? '½' + out : out
}
