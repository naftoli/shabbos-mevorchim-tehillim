import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rankByRace, rankRace } from '../../src/lib/schoolRace.js'
import { topBaseArt } from '../../src/lib/baseRank.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const home = readFileSync(join(root, 'src/pages/Home.jsx'), 'utf8')

test('an exact tie shares one rank and the next place skips', () => {
  const rows = [
    { id: 1, name: 'Beis', pctMet: 80, metMonth: 4 },
    { id: 2, name: 'Aleph', pctMet: 80, metMonth: 4 },
    { id: 3, name: 'Gimmel', pctMet: 70, metMonth: 99 },
  ]
  const ranked = rankRace(rows, 'finished')
  assert.deepEqual(ranked.map((row) => [row.name, row.rank]), [
    ['Aleph', 1],
    ['Beis', 1],
    ['Gimmel', 3],
  ])
  assert.equal(rows[0].rank, undefined)
  assert.deepEqual(rankByRace(rows, 'finished').map((row) => row.name), ranked.map((row) => row.name))
})

test('a higher raw count outranks the same percentage', () => {
  const rows = [
    { name: 'Beis', pctMet: 80, metMonth: 4 },
    { name: 'Aleph', pctMet: 80, metMonth: 9 },
  ]
  assert.deepEqual(rankRace(rows, 'finished').map((row) => [row.name, row.rank]), [
    ['Aleph', 1],
    ['Beis', 2],
  ])
})

test('each race tab ranks on its own percentage, then its own count', () => {
  const rows = [
    { name: 'Part', pctParticipated: 90, participatedMonth: 2, pctMet: 1, metMonth: 1, pct: 1, saidMonth: 1, minutesPct: 1, minutesSaidMonth: 1 },
    { name: 'Done', pctParticipated: 10, participatedMonth: 9, pctMet: 90, metMonth: 2, pct: 1, saidMonth: 1, minutesPct: 1, minutesSaidMonth: 1 },
    { name: 'Kaps', pctParticipated: 10, participatedMonth: 1, pctMet: 10, metMonth: 9, pct: 90, saidMonth: 2, minutesPct: 1, minutesSaidMonth: 1 },
    { name: 'Time', pctParticipated: 10, participatedMonth: 1, pctMet: 10, metMonth: 1, pct: 10, saidMonth: 9, minutesPct: 90, minutesSaidMonth: 2 },
    { name: 'Part Tie', pctParticipated: 90, participated: 2, pctMet: 0, met: 0, pct: 0, said: 0, minutesPct: 0, minutes: 0 },
  ]
  assert.deepEqual(rankRace(rows, 'participated').map((row) => [row.name, row.rank]), [
    ['Part', 1],
    ['Part Tie', 1],
    ['Done', 3],
    ['Kaps', 4],
    ['Time', 4],
  ])
  assert.equal(rankRace(rows, 'finished')[0].name, 'Done')
  assert.equal(rankRace(rows, 'kapitlach')[0].name, 'Kaps')
  assert.equal(rankRace(rows, 'time')[0].name, 'Time')
})

test('a shared rank inside the top 10 is one badge number, and 11+ stays a plain place', () => {
  const rows = []
  for (let n = 1; n <= 9; n += 1) {
    rows.push({ name: `School ${String(n).padStart(2, '0')}`, pctMet: 100 - n, metMonth: 10 })
  }
  rows.push({ name: 'Tied B', pctMet: 90, metMonth: 5 })
  rows.push({ name: 'Tied A', pctMet: 90, metMonth: 5 })
  rows.push({ name: 'After', pctMet: 89, metMonth: 50 })
  const ranked = rankRace(rows, 'finished')
  const byName = Object.fromEntries(ranked.map((row) => [row.name, row.rank]))
  assert.equal(byName['School 01'], 1)
  assert.equal(byName['School 09'], 9)
  assert.equal(byName['Tied A'], 10)
  assert.equal(byName['Tied B'], 10)
  assert.equal(byName.After, 12)
  for (const row of ranked) {
    if (row.rank <= 10) assert.equal(topBaseArt(row.rank), `design/top-base-${row.rank}.webp`)
    else assert.equal(topBaseArt(row.rank), null)
  }
})

test('the home race shows the top-base badge for places 1-10 on every tab', () => {
  assert.match(home, /const ranked = rankRace\(schools, sort\)/)
  assert.match(home, /<RaceToggle value=\{sort\} onChange=\{setSort\} \/>/)
  assert.match(home, /\{s\.rank <= 10\s*\?\s*<TopBaseBadge rank=\{s\.rank\} className="h-11 w-auto sm:h-12 lg:h-\[52px\]" \/>/)
  assert.match(home, /\{s\.rank\}/)
  assert.equal(home.includes('medal-gold'), false)
  assert.equal(home.includes('medal-silver'), false)
  assert.equal(home.includes('medal-bronze'), false)
  // Bases in action keeps the badge it already had.
  assert.match(home, /<TopBaseBadge rank=\{rank\} className="h-10 w-auto shrink-0 sm:h-12" \/>/)
})
