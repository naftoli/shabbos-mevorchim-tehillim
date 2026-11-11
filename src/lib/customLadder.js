// A custom ladder is a generated grade × month quota for one soldier.
//
// The eight ladders in src/data/ladders.js are one climb shifted by a grade:
// the cell for "this many grades before the finish" is (almost) the same on
// every ladder. Ladder 8 is "finish 150 kapitlach by 8th grade". Asking for
// 150 by an existing finish grade reproduces that ladder exactly. Any other
// kapitlach target scales that climb. A finish before 5th grade or after 12th
// grade shifts the same curve, and the years past the slowest ladder (ladder
// 12 at Pre-1A) are extrapolated one step at a time, never below 1 kapitel.
//
// The soldier's current quota is an anchor. From this month forward the
// generated climb never goes below it, and it still reaches the target by the
// finish grade when the target is higher than where they are now.
//
// Precedence, when both exist:
//   1. An active one-month quota override wins for that month's kapitel quota
//      (the month counts as met at the amount they entered). It does not
//      change minutes.
//   2. Otherwise the custom ladder supplies kapitel and minutes.
//   3. Otherwise the normal ladder.

import { GRADES, MONTHS, QUOTA, quotaFor, toHebrewNumeral } from '@/data/ladders.js'
import { effectiveKapQuota } from '@/lib/quotaOverride.js'
import { quotaMonth } from '@/lib/hebrewYear.js'

/** One whole Tehillim. Monthly quotas may be set above this. */
export const TEHILLIM_KAPITLACH = 150

/**
 * How a monthly quota above one Tehillim is shown.
 *
 * Sholem is confirming whether a target above 150 means "that many kapitlach
 * in the month, past whole Tehillims" or some other total. Until that is
 * settled, this display is the one the app uses. It is not a cap: the stored
 * quota stays the plain number (190, 300, …).
 *
 * 'tehillim-plus-count':
 *   150 and below → Aleph-Beis range, same as the ladders (א-מ, א-קנ).
 *     The breakdown still draws a crown on exactly 150.
 *   190 → "1 Tehillim + 40 kapitlach", with the plain number 190 beside it.
 *   300 → "2 Tehillim", with the plain number 300 beside it.
 *   151 → "1 Tehillim + 1 kapitel", with the plain number 151 beside it.
 * Hebrew letters are not used above 150. Gematria past קנ is not a kapitel label.
 */
export const KAPITEL_ABOVE_TEHILLIM_DISPLAY = 'tehillim-plus-count'

/** Highest kapitlach target the generator accepts. Not the Tehillim length. */
export const MAX_TARGET_KAPITLACH = 9999

/** Finish grades offered in the admin picker: Pre-1A through 4 years after 12th. */
export const MAX_FINISH_OFFSET = 4

const GRADE_INDEX = Object.fromEntries(GRADES.map((g, i) => [g, i]))

export function gradeIndex(grade) {
  if (grade == null || grade === '') return -1
  const key = String(grade).trim().toLowerCase()
  if (key === 'pre1a' || key.startsWith('pre')) return 0
  const n = Number(String(grade).replace(/[^0-9]/g, ''))
  if (!Number.isInteger(n) || n < 0) return -1
  return n
}

export function gradeKey(grade) {
  const n = gradeIndex(grade)
  if (n < 0) return ''
  return n === 0 ? 'pre1a' : String(n)
}

const ORDINALS = { 1: '1st', 2: '2nd', 3: '3rd' }

/** "8th grade", "Pre-1A", "2 years after 12th". */
export function finishGradeLabel(grade) {
  const n = gradeIndex(grade)
  if (n < 0) return ''
  if (n === 0) return 'Pre-1A'
  if (n <= 12) return `${ORDINALS[n] || `${n}th`} grade`
  const after = n - 12
  return after === 1 ? '1 year after 12th' : `${after} years after 12th`
}

export function finishGradeOptions() {
  const out = [{ value: 'pre1a', label: 'Pre-1A' }]
  for (let n = 1; n <= 12 + MAX_FINISH_OFFSET; n++) {
    out.push({ value: n === 0 ? 'pre1a' : String(n), label: finishGradeLabel(n) })
  }
  return out
}

export function gradesThrough(finishGrade, alsoGrade) {
  const cap = Math.max(gradeIndex(finishGrade), gradeIndex(alsoGrade), 0)
  const out = ['pre1a']
  for (let n = 1; n <= cap; n++) out.push(String(n))
  return out
}

function cellOf(v, m, h) {
  const cell = { v: Number(v), m: Math.round(Number(m) || 0) }
  if (h) cell.h = 1
  return cell
}

/** Ladder 12 indexed by years-before-finish, the slowest full curve. */
function curveFromSlowest() {
  const curve = []
  for (let years = 0; years <= 12; years++) {
    const grade = years === 12 ? 'pre1a' : String(12 - years)
    const row = {}
    for (const month of MONTHS) {
      const cell = quotaFor(grade, month, 12)
      if (cell) row[month] = cellOf(cell.v, cell.m, cell.h)
    }
    curve[years] = row
  }
  return curve
}

let slowestCurve = null
function slowest() {
  if (!slowestCurve) slowestCurve = curveFromSlowest()
  return slowestCurve
}

/**
 * The 150-kapitel cell for one finish grade, grade, and month, before scaling.
 * An existing ladder (5–12) is copied, including the few cells that are not a
 * perfect shift of ladder 12. Earlier or later finishes shift that curve.
 */
export function standardCell(finishGrade, grade, month) {
  const finish = gradeIndex(finishGrade)
  const g = gradeIndex(grade)
  const mo = quotaMonth(month)
  if (finish < 0 || g < 0 || !mo || !MONTHS.includes(mo)) return null
  const yearsBefore = finish - g
  if (yearsBefore <= 0) return cellOf(TEHILLIM_KAPITLACH, 120)
  if (finish >= 5 && finish <= 12 && g <= finish) {
    const copied = quotaFor(gradeKey(g), mo, finish)
    if (copied) return cellOf(copied.v, copied.m, copied.h)
  }
  if (yearsBefore <= 12) {
    const row = slowest()[yearsBefore]?.[mo]
    return row ? cellOf(row.v, row.m, row.h) : null
  }
  const far = slowest()[12]?.[mo]
  const nearer = slowest()[11]?.[mo]
  if (!far) return null
  const step = nearer ? nearer.v - far.v : 0
  const extra = yearsBefore - 12
  const v = Math.max(1, far.v - extra * (step > 0 ? step : 0))
  return cellOf(v, minutesForKapitlach(v))
}

let minutePoints = null

/** Observed (kapitlach → minutes) pairs. The most common minutes wins a tie at the lower number. */
function minuteTable() {
  if (minutePoints) return minutePoints
  const counts = new Map()
  for (const grade of Object.keys(QUOTA)) {
    for (const month of Object.keys(QUOTA[grade])) {
      for (const cell of Object.values(QUOTA[grade][month])) {
        const key = String(cell.v)
        const bag = counts.get(key) || new Map()
        bag.set(cell.m, (bag.get(cell.m) || 0) + 1)
        counts.set(key, bag)
      }
    }
  }
  const points = []
  for (const [key, bag] of counts) {
    let bestM = null
    let bestN = -1
    for (const [m, n] of bag) {
      if (n > bestN || (n === bestN && (bestM == null || m < bestM))) {
        bestM = m
        bestN = n
      }
    }
    points.push({ v: Number(key), m: bestM })
  }
  points.sort((a, b) => a.v - b.v)
  minutePoints = points
  return points
}

/**
 * Minutes for a kapitel count. Known table values are reused. Gaps are linear
 * between neighbors. Above the table, the last climb that actually raised the
 * minutes is extended (the top of the table is flat at 120, which would
 * otherwise freeze the minutes).
 */
export function minutesForKapitlach(kapitlach) {
  const v = Number(kapitlach)
  const points = minuteTable()
  if (!points.length || !Number.isFinite(v)) return 0
  for (const point of points) {
    if (Math.abs(point.v - v) < 1e-9) return point.m
  }
  if (v <= points[0].v) return points[0].m
  const last = points[points.length - 1]
  if (v > last.v) {
    let slope = 0
    for (let i = points.length - 1; i > 0; i--) {
      const rise = points[i].m - points[i - 1].m
      const run = points[i].v - points[i - 1].v
      if (rise > 0 && run > 0) {
        slope = rise / run
        break
      }
    }
    return Math.max(0, Math.round(last.m + (v - last.v) * slope))
  }
  for (let i = 1; i < points.length; i++) {
    if (points[i].v < v) continue
    const a = points[i - 1]
    const b = points[i]
    const t = (v - a.v) / (b.v - a.v)
    return Math.round(a.m + t * (b.m - a.m))
  }
  return last.m
}

function scaledCell(base, target) {
  if (!base) return null
  if (target === TEHILLIM_KAPITLACH) return cellOf(base.v, base.m, base.h)
  const v = Math.round((base.v * target) / TEHILLIM_KAPITLACH)
  return cellOf(Math.max(1, v), minutesForKapitlach(Math.max(1, v)))
}

function orderedSlots(finishGrade, alsoGrade) {
  const slots = []
  for (const grade of gradesThrough(finishGrade, alsoGrade)) {
    for (const month of MONTHS) slots.push({ grade, month })
  }
  return slots
}

function cloneCells(cells) {
  const out = {}
  for (const [grade, months] of Object.entries(cells)) {
    out[grade] = {}
    for (const [month, cell] of Object.entries(months)) out[grade][month] = { ...cell }
  }
  return out
}

function enforceFloorForward(cells, slots, from, floorV, floorM) {
  let prevV = floorV
  let prevM = floorM
  let changed = false
  for (let i = from; i < slots.length; i++) {
    const slot = slots[i]
    const cell = cells[slot.grade][slot.month]
    let v = cell.v
    let m = cell.m
    if (v < prevV) {
      v = prevV
      m = minutesForKapitlach(v)
    }
    if (m < prevM) m = prevM
    if (v !== cell.v || m !== cell.m) {
      cells[slot.grade][slot.month] = cellOf(v, m, v === cell.v ? cell.h : 0)
      changed = true
    }
    prevV = v
    prevM = m
  }
  return changed
}

/**
 * Build the grid. `anchor` is the soldier's quota right now
 * ({ grade, month, kapitlach, minutes }). Omit it for the pure curve.
 */
export function generateCustomLadder({ targetKapitlach, finishGrade, anchor = null } = {}) {
  const target = Math.round(Number(targetKapitlach))
  if (!Number.isInteger(target) || target < 1 || target > MAX_TARGET_KAPITLACH) {
    throw new Error(`Kapitlach target must be a whole number from 1 to ${MAX_TARGET_KAPITLACH}.`)
  }
  const finish = gradeKey(finishGrade)
  if (!finish || gradeIndex(finish) > 12 + MAX_FINISH_OFFSET) {
    throw new Error('Choose a finish grade from Pre-1A through 4 years after 12th.')
  }
  const anchorGrade = anchor ? gradeKey(anchor.grade) : ''
  const cells = {}
  for (const grade of gradesThrough(finish, anchorGrade)) {
    cells[grade] = {}
    for (const month of MONTHS) {
      cells[grade][month] = scaledCell(standardCell(finish, grade, month), target)
    }
  }
  const finishN = gradeIndex(finish)
  const basedOnLadder = finishN >= 5 && finishN <= 12 ? finishN : 12
  let grid = {
    targetKapitlach: target,
    finishGrade: finish,
    finishLabel: finishGradeLabel(finish),
    basedOnLadder,
    anchored: false,
    cells,
  }
  if (!anchor || anchor.kapitlach == null || anchor.kapitlach === '') return grid
  const aGrade = gradeKey(anchor.grade)
  const aMonth = quotaMonth(anchor.month)
  if (!aGrade || !cells[aGrade]?.[aMonth]) return grid
  // Keep a half-kapitel anchor (118.5). Rounding it up would lift a ladder
  // that already matches and break an exact copy of that ladder.
  const aV = Number(anchor.kapitlach) || 0
  const aM = Math.round(Number(anchor.minutes) || 0)
  const slots = orderedSlots(finish, aGrade)
  const idx = slots.findIndex((s) => s.grade === aGrade && s.month === aMonth)
  if (idx < 0) return grid
  const pure = cells[aGrade][aMonth]
  const next = cloneCells(cells)
  if (aV > pure.v) {
    const goal = Math.max(target, aV)
    const c0 = pure.v
    const endGrade = gradeKey(Math.max(finishN, gradeIndex(aGrade)))
    const c1 = next[endGrade].Elul.v
    let prevV = aV
    let prevM = aM
    for (let j = idx; j < slots.length; j++) {
      const slot = slots[j]
      const c = next[slot.grade][slot.month].v
      let t
      if (c1 === c0) t = slots.length - 1 === idx ? 1 : (j - idx) / (slots.length - 1 - idx)
      else t = (c - c0) / (c1 - c0)
      if (!Number.isFinite(t)) t = 1
      t = Math.min(1, Math.max(0, t))
      let v = Math.round(aV + t * (goal - aV))
      if (v < prevV) v = prevV
      let m = minutesForKapitlach(v)
      if (m < prevM) m = prevM
      next[slot.grade][slot.month] = cellOf(v, m)
      prevV = v
      prevM = m
    }
    grid = { ...grid, cells: next, anchored: true }
  } else if (enforceFloorForward(next, slots, idx, aV, aM)) {
    grid = { ...grid, cells: next, anchored: true }
  }
  return grid
}

export function cellFor(grid, grade, month) {
  if (!grid?.cells) return null
  const g = gradeKey(grade)
  const mo = quotaMonth(month)
  const cell = g && mo ? grid.cells[g]?.[mo] : null
  return cell ? cellOf(cell.v, cell.m, cell.h) : null
}

/**
 * Kapitel quota for one month.
 * Override, then custom ladder, then the normal ladder figure passed in.
 * Minutes follow the custom ladder and ignore the one-month override.
 */
export function resolveQuota({ engineKap = 0, engineMin = 0, customCell = null, override = null } = {}) {
  const baseKap = customCell ? Number(customCell.v) || 0 : Number(engineKap) || 0
  const minutes = customCell ? Number(customCell.m) || 0 : Number(engineMin) || 0
  const eff = effectiveKapQuota(baseKap, override)
  return {
    ...eff,
    minutes,
    customLadder: !!customCell && !eff.quotaAdjusted,
  }
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * Label for a monthly kapitel quota.
 * Returns { label, short, plain, overTehillim, crown }.
 * `label` is the Aleph-Beis range, or the Tehillim-plus phrase above 150.
 * `short` is that range, or the plain number above 150 (tight cells).
 */
export function formatKapitlachQuota(value) {
  const v = Number(value)
  if (!Number.isFinite(v)) {
    return { label: '', short: '', plain: '', overTehillim: false, crown: false }
  }
  const plain = Number.isInteger(v) ? String(v) : String(v)
  if (v > TEHILLIM_KAPITLACH) {
    const books = Math.floor(v / TEHILLIM_KAPITLACH)
    const rem = Math.round((v - books * TEHILLIM_KAPITLACH) * 10) / 10
    const whole = rem === 0
    const label = whole
      ? plural(books, 'Tehillim', 'Tehillim')
      : `${plural(books, 'Tehillim', 'Tehillim')} + ${rem === 1 ? '1 kapitel' : `${plainNumber(rem)} kapitlach`}`
    return { label, short: plain, plain, overTehillim: true, crown: false }
  }
  const letters = v <= 1 ? 'א' : `א-${toHebrewNumeral(v)}`
  return {
    label: letters,
    short: letters,
    plain,
    overTehillim: false,
    crown: v === TEHILLIM_KAPITLACH,
  }
}

function plainNumber(n) {
  return Number.isInteger(n) ? String(n) : String(n)
}

/** The climb does not go down, and every cell stays inside 1..target-or-anchor. */
export function ladderProblems(grid) {
  if (!grid?.cells) return ['A ladder is required.']
  const problems = []
  const slots = orderedSlots(grid.finishGrade, null)
  let prev = null
  for (const slot of slots) {
    const cell = grid.cells[slot.grade]?.[slot.month]
    if (!cell) {
      problems.push(`Missing ${slot.grade} ${slot.month}.`)
      continue
    }
    if (!(cell.v >= 1)) problems.push(`${slot.grade} ${slot.month} kapitlach must be at least 1.`)
    if (!(cell.m >= 0)) problems.push(`${slot.grade} ${slot.month} minutes must be at least 0.`)
    if (prev && cell.v + 1e-9 < prev.v) {
      problems.push(`${slot.grade} ${slot.month} drops below the month before it.`)
    }
    prev = cell
  }
  return problems
}
