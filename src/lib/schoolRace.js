// Home "The Race" default order (% soldiers who met first). Keep personal-page
// schoolRank and any other nationwide school lists in lockstep with this.
export function cmpSchoolRace(a, b) {
  return (
    b.pctMet - a.pctMet ||
    b.pct - a.pct ||
    b.minutesPct - a.minutesPct ||
    b.saidMonth - a.saidMonth ||
    a.name.localeCompare(b.name)
  )
}

export function raceMetric(school, sort) {
  if (sort === 'kapitlach') return school.pct
  if (sort === 'time') return school.minutesPct
  return school.pctMet
}

/** Sort schools for The Race. `sort` is 'finished' | 'kapitlach' | 'time'. */
export function rankSchools(schools, sort = 'finished') {
  const metric = (s) => raceMetric(s, sort)
  return [...schools].sort(
    (a, b) =>
      metric(b) - metric(a) ||
      cmpSchoolRace(a, b),
  )
}
