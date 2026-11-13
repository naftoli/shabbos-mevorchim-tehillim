// Home "The Race" default order (% soldiers who met first). Keep personal-page
// schoolRank and any other nationwide school lists in lockstep with this: a tie
// on % finished breaks toward whoever has more soldiers who finished.
export function cmpSchoolRace(a, b) {
  return (
    raceMetric(b, 'finished') - raceMetric(a, 'finished') ||
    raceCount(b, 'finished') - raceCount(a, 'finished') ||
    a.name.localeCompare(b.name)
  )
}

// The percentage shown/sorted for each race view.
export function raceMetric(row, sort) {
  if (sort === 'kapitlach') return row.pct
  if (sort === 'time') return row.minutesPct
  if (sort === 'participated') return row.pctParticipated || 0
  return row.pctMet
}

// The raw accomplishment behind each race metric — the tie-breaker when two rows
// share a percentage. Field names differ across schools / classes / report rows,
// so fall back across the known aliases for each view.
export function raceCount(row, sort) {
  if (sort === 'kapitlach') return row.saidMonth ?? row.said ?? row.accomplished ?? 0
  if (sort === 'time') return row.minutesSaidMonth ?? row.minutesSaid ?? row.minutes ?? 0
  if (sort === 'participated') return row.participatedMonth ?? row.participated ?? 0
  return row.metMonth ?? row.met ?? 0
}

/**
 * Sort schools or classes for The Race. A tie on the selected percentage breaks
 * toward whoever has more of that same view's raw count — more kapitlach said in
 * the kapitlach view, more minutes in the time view, more soldiers finished in the
 * finished view, more participating in the participated view — then by name.
 */
export function rankByRace(rows, sort = 'finished') {
  return [...rows].sort(
    (a, b) =>
      raceMetric(b, sort) - raceMetric(a, sort) ||
      raceCount(b, sort) - raceCount(a, sort) ||
      a.name.localeCompare(b.name),
  )
}

// Back-compat name for the schools race + reports.
export const rankSchools = rankByRace

// Two rows are tied when the selected percentage and its raw count do not
// separate them. Name is only a display order (see rankByRace); it is not a score.
function sameRaceScore(a, b, sort) {
  return !(raceMetric(a, sort) - raceMetric(b, sort)) && !(raceCount(a, sort) - raceCount(b, sort))
}

/**
 * The Race in rankByRace order, with a competition place on each row.
 * Tied schools share a rank and the next place skips (1, 1, 3). A shared
 * place inside 1–10 is the Top Base badge number; 11+ stays a plain number.
 */
export function rankRace(rows, sort = 'finished') {
  const ordered = rankByRace(rows || [], sort)
  const placed = []
  let i = 0
  while (i < ordered.length) {
    let j = i + 1
    while (j < ordered.length && sameRaceScore(ordered[i], ordered[j], sort)) j += 1
    const rank = i + 1
    for (let k = i; k < j; k += 1) placed.push({ ...ordered[k], rank })
    i = j
  }
  return placed
}
