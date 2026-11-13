import { placeAmong } from './placeRank.js'

// A base's rank is the same competition place the site already speaks
// ("your base came number N"): percent of soldiers who finished, then
// kapitlach said, then percent of the kapitlach quota, then percent of
// minutes. Ties on all four share a rank and the next place skips
// (1, 1, 3). A name only orders a list; it does not split a tie.
// Same keys as /me/social schoolRank (api/index.php wwtcCompetitionRank).
export function baseRankScore(school) {
  return [
    Number(school?.pctMet) || 0,
    Number(school?.saidMonth) || 0,
    Number(school?.pct) || 0,
    Number(school?.minutesPct) || 0,
  ]
}

/** id -> rank for every base in `schools`. */
export function baseRanks(schools) {
  const map = new Map()
  for (const school of schools || []) {
    if (school?.id == null || school.id === '') continue
    const place = placeAmong(schools, baseRankScore, (row) => row.id, school.id)
    if (place) map.set(String(school.id), place.rank)
  }
  return map
}

/**
 * Home "Bases in action" order. Rank 1 is first. Schools that share a rank
 * (a real tie) fall through to the name. A school with no rank goes last.
 */
export function compareBasesInAction(a, b, ranks) {
  const rankOf = (school) => {
    if (school?.id == null || school.id === '') return null
    const rank = ranks?.get?.(String(school.id))
    return Number.isInteger(rank) && rank > 0 ? rank : null
  }
  const left = rankOf(a)
  const right = rankOf(b)
  if (left != null && right != null && left !== right) return left - right
  if (left != null && right == null) return -1
  if (left == null && right != null) return 1
  return String(a?.name || '').localeCompare(String(b?.name || ''))
}

export const TOP_BASE_ART_WIDTH = 247
export const TOP_BASE_ART_HEIGHT = 320

/** Cropped flyer badge for ranks 1–10. No artwork exists past 10. */
export function topBaseArt(rank) {
  const n = Number(rank)
  if (!Number.isInteger(n) || n < 1 || n > 10) return null
  return `design/top-base-${n}.webp`
}
