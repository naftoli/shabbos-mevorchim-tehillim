// Competition place on an existing leaderboard.
// Ties share a rank and the next place skips (1, 1, 3). A name is only a
// display order; it does not split a tie. A higher score places first.

function asList(score) {
  if (Array.isArray(score)) return score.map((n) => Number(n) || 0)
  return [Number(score) || 0]
}

function sameScore(a, b) {
  const left = asList(a)
  const right = asList(b)
  if (left.length !== right.length) return false
  return left.every((n, i) => n === right[i])
}

// Positive when `a` outranks `b`.
function compareScore(a, b) {
  const left = asList(a)
  const right = asList(b)
  const n = Math.max(left.length, right.length)
  for (let i = 0; i < n; i += 1) {
    const d = (left[i] || 0) - (right[i] || 0)
    if (d) return d
  }
  return 0
}

/**
 * Where `mine` places among `rows`.
 * `scoreOf` returns a number or a list of numbers, most important first.
 * Returns null when the row is missing, so a caller can skip the sentence.
 */
export function placeAmong(rows, scoreOf, idOf, mine) {
  const mineId = mine == null ? '' : String(mine)
  if (!mineId) return null
  const scored = []
  for (const row of rows || []) {
    const id = idOf(row)
    if (id == null || id === '') continue
    scored.push({ id: String(id), score: scoreOf(row) })
  }
  if (!scored.some((row) => row.id === mineId)) return null
  const groups = []
  for (const row of scored) {
    const group = groups.find((item) => sameScore(item.score, row.score))
    if (group) group.ids.push(row.id)
    else groups.push({ score: row.score, ids: [row.id] })
  }
  groups.sort((a, b) => compareScore(b.score, a.score))
  let index = 0
  for (const group of groups) {
    const rank = index + 1
    if (group.ids.includes(mineId)) {
      return { rank, total: scored.length, tied: group.ids.length > 1 }
    }
    index += group.ids.length
  }
  return null
}
