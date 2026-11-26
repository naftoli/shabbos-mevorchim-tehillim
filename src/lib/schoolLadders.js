// Which ladders a school still offers. No list (and an empty list) means every
// ladder is on. A hidden ladder is left out of the kid's picker and out of the
// commander's suggestions. The custom ladder is not one of these numbers.

import { LADDERS, availableLadders } from '../data/ladders.js'

const LADDER_SET = new Set(LADDERS)

/** Ladder numbers the school has turned off. Unknown numbers are ignored. */
export function hiddenLadderList(hidden) {
  const seen = new Set()
  const out = []
  for (const value of hidden || []) {
    const n = Number(value)
    if (!LADDER_SET.has(n) || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

/** Ladders this school still offers. Grade does not restrict the list. */
export function openLadders(_grade, hidden) {
  const off = new Set(hiddenLadderList(hidden))
  return availableLadders().filter((ladder) => !off.has(ladder))
}

export function ladderIsOpen(ladder, hidden) {
  const n = Number(ladder)
  if (!LADDER_SET.has(n)) return false
  return !hiddenLadderList(hidden).includes(n)
}

/**
 * Explicit on/off rows for one class or one child. A missing ladder means
 * "inherit" (class inherits the school, child inherits the class). Unknown
 * ladder numbers are ignored. Accepts either `{ 5: false }` or
 * `[{ ladder: 5, enabled: false }]`.
 */
export function ladderOverrideMap(value) {
  const out = {}
  if (!value) return out
  if (Array.isArray(value)) {
    for (const row of value) {
      const n = Number(row?.ladder)
      if (!LADDER_SET.has(n)) continue
      const enabled = overrideEnabled(row?.enabled)
      if (enabled === null) continue
      out[n] = enabled
    }
    return out
  }
  if (typeof value === 'object') {
    for (const [key, enabledRaw] of Object.entries(value)) {
      const n = Number(key)
      if (!LADDER_SET.has(n)) continue
      const enabled = overrideEnabled(enabledRaw)
      if (enabled === null) continue
      out[n] = enabled
    }
  }
  return out
}

function overrideEnabled(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true
  if (value === false || value === 0 || value === '0' || value === 'false') return false
  return null
}

/**
 * The closest setting wins: child, then class, then school. No setting at any
 * level leaves the ladder on. `classOverrides` / `childOverrides` are explicit
 * rows only; a missing ladder inherits.
 */
export function ladderOnForScope(ladder, schoolHidden, classOverrides = null, childOverrides = null) {
  const n = Number(ladder)
  if (!LADDER_SET.has(n)) return false
  const child = ladderOverrideMap(childOverrides)
  if (Object.prototype.hasOwnProperty.call(child, n)) return child[n]
  const cls = ladderOverrideMap(classOverrides)
  if (Object.prototype.hasOwnProperty.call(cls, n)) return cls[n]
  return ladderIsOpen(n, schoolHidden)
}

/** Ladders that are off for this scope, in picker order (12 down to 5). */
export function hiddenForScope(schoolHidden, classOverrides = null, childOverrides = null) {
  return LADDERS.filter((ladder) => !ladderOnForScope(ladder, schoolHidden, classOverrides, childOverrides))
}
