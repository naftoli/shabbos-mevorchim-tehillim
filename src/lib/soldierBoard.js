// Top Soldiers ranking. Soldiers with the same kapitlach share one dense
// place (1, 1, 2, 3… — the next distinct score is the next number, with no
// gap). A gold / silver / bronze medal is given only when that place and
// every higher place are each held by exactly one soldier. A tie at 1 means
// no medals on the board; a tie at 2 means gold for 1 and none after.
// Ties break alphabetically by name so the board doesn't reshuffle.

const MEDAL_PLACES = new Set([1, 2, 3])

export const SOLDIER_PAGE = 10

export function soldierScore(soldier) {
  const n = Number(soldier?.saidMonth)
  return Number.isFinite(n) ? n : 0
}

export function compareSoldiers(a, b) {
  const byScore = soldierScore(b) - soldierScore(a)
  if (byScore) return byScore
  const byName = String(a?.name || '').localeCompare(String(b?.name || ''), 'en', { sensitivity: 'base' })
  if (byName) return byName
  return String(a?.id ?? '').localeCompare(String(b?.id ?? ''), 'en')
}

/** Screen-reader label. A medal place says 1st/2nd/3rd; a tie says "Tied for N". */
export function placeLabel(row) {
  if (row.medal === 1) return '1st place'
  if (row.medal === 2) return '2nd place'
  if (row.medal === 3) return '3rd place'
  if (row.tied) return `Tied for ${row.rank}`
  return `Rank ${row.rank}`
}

/** Full ordered board. `rank` is the dense place. `medal` is 1, 2, or 3, else null. */
export function rankSoldiers(soldiers) {
  const rows = [...(soldiers || [])].sort(compareSoldiers)
  const ranked = []
  let i = 0
  let place = 0
  let podiumClear = true
  while (i < rows.length) {
    const score = soldierScore(rows[i])
    let j = i + 1
    while (j < rows.length && soldierScore(rows[j]) === score) j += 1
    place += 1
    const tied = j - i > 1
    const medal = podiumClear && !tied && MEDAL_PLACES.has(place) ? place : null
    if (tied) podiumClear = false
    for (let k = i; k < j; k += 1) {
      ranked.push({ ...rows[k], rank: place, tied, medal })
    }
    i = j
  }
  return ranked
}
