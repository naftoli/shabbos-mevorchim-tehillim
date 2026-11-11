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

/** Ladders a soldier at `grade` may still pick. Default: every ladder. */
export function openLadders(grade, hidden) {
  const off = new Set(hiddenLadderList(hidden))
  return availableLadders(grade).filter((ladder) => !off.has(ladder))
}

export function ladderIsOpen(ladder, hidden) {
  const n = Number(ladder)
  if (!LADDER_SET.has(n)) return false
  return !hiddenLadderList(hidden).includes(n)
}
