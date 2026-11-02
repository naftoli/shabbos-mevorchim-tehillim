// Home "The Race" default order (% soldiers who met first). Keep personal-page
// schoolRank and any other nationwide school lists in lockstep with this.
export function cmpSchoolRace(a, b) {
  return (
    b.pctMet - a.pctMet ||
    (b.saidMonth || 0) - (a.saidMonth || 0) ||
    b.pct - a.pct ||
    b.minutesPct - a.minutesPct ||
    a.name.localeCompare(b.name)
  )
}

export function raceMetric(school, sort) {
  if (sort === 'kapitlach') return school.pct
  if (sort === 'time') return school.minutesPct
  if (sort === 'participated') return school.pctParticipated || 0
  return school.pctMet
}

/** Sort schools for The Race. Same percentage: more kapitlach said ranks first. */
export function rankSchools(schools, sort = 'finished') {
  const metric = (s) => raceMetric(s, sort)
  return [...schools].sort(
    (a, b) =>
      metric(b) - metric(a) ||
      (b.saidMonth || 0) - (a.saidMonth || 0) ||
      a.name.localeCompare(b.name),
  )
}
