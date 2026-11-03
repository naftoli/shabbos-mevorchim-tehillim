// Top Soldiers ranking. Same kapitlach share one place (1, 1, 1, 4…), and a
// gold / silver / bronze medal is only for a place held by exactly one soldier.
// Ties break alphabetically by name so the board doesn't reshuffle.

const MEDAL_RANKS = new Set([1, 2, 3])

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

/** Full ordered board. `medal` is 1, 2, or 3 for an untied podium place, else null. */
export function rankSoldiers(soldiers) {
  const rows = [...(soldiers || [])].sort(compareSoldiers)
  const ranked = []
  let i = 0
  while (i < rows.length) {
    const score = soldierScore(rows[i])
    let j = i + 1
    while (j < rows.length && soldierScore(rows[j]) === score) j += 1
    const tied = j - i > 1
    const rank = i + 1
    const medal = !tied && MEDAL_RANKS.has(rank) ? rank : null
    for (let k = i; k < j; k += 1) {
      ranked.push({ ...rows[k], rank, tied, medal })
    }
    i = j
  }
  return ranked
}
