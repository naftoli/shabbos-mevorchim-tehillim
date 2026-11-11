import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { placeAmong } from '../../src/lib/placeRank.js'
import { baseRankScore, baseRanks, topBaseArt } from '../../src/lib/baseRank.js'
import { PERFECT_PLATOON_ART } from '../../src/lib/perfectPlatoonBanner.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (path) => readFileSync(join(root, path), 'utf8')

test('base rank matches the spoken school rank and ties share a place', () => {
  const schools = [
    { id: 1, name: 'Aleph', pctMet: 80, saidMonth: 100, pct: 50, minutesPct: 40 },
    { id: 2, name: 'Beis', pctMet: 80, saidMonth: 100, pct: 50, minutesPct: 40 },
    { id: 3, name: 'Gimmel', pctMet: 80, saidMonth: 90, pct: 99, minutesPct: 99 },
    { id: 4, name: 'Dalet', pctMet: 90, saidMonth: 1, pct: 1, minutesPct: 1 },
  ]
  const ranks = baseRanks(schools)
  assert.equal(ranks.get('4'), 1)
  assert.equal(ranks.get('1'), 2)
  assert.equal(ranks.get('2'), 2)
  assert.equal(ranks.get('3'), 4)
  for (const school of schools) {
    const place = placeAmong(schools, baseRankScore, (row) => row.id, school.id)
    assert.equal(ranks.get(String(school.id)), place.rank)
  }
  // A higher finish-percent outranks more kapitlach. Name does not split the tie above.
  assert.equal(baseRankScore(schools[0]).join(','), '80,100,50,40')
})

test('top base artwork is only the cropped badges 1 through 10', () => {
  for (let n = 1; n <= 10; n += 1) {
    assert.equal(topBaseArt(n), `design/top-base-${n}.webp`)
    assert.equal(existsSync(join(root, 'public', topBaseArt(n))), true)
  }
  assert.equal(topBaseArt(0), null)
  assert.equal(topBaseArt(11), null)
  assert.equal(topBaseArt(1.5), null)
  assert.equal(existsSync(join(root, 'public/design/top-base-11.webp')), false)
  assert.equal(existsSync(join(root, 'public', PERFECT_PLATOON_ART)), true)
})

test('the general Perfect Platoon shield and top-base badges are on the public pages', () => {
  const home = read('src/pages/Home.jsx')
  const school = read('src/pages/SchoolCampaign.jsx')
  const list = read('src/pages/PerfectPlatoons.jsx')
  const how = read('src/pages/HowTo.jsx')
  const banner = read('src/components/PerfectPlatoonBanner.jsx')

  assert.match(home, /asset\(PERFECT_PLATOON_ART\)/)
  assert.match(home, /<PerfectPlatoonLogo/)
  assert.match(home, /Bases In Action/)
  assert.match(home, /<TopBaseBadge rank=\{rank\}/)
  assert.equal(home.includes('icon-platoon.webp'), false)

  assert.match(school, /<TopBaseBadge rank=\{rank\}/)
  assert.match(school, /<PerfectPlatoonLogo/)
  assert.match(list, /<PerfectPlatoonLogo/)
  assert.match(how, /src: PERFECT_PLATOON_ART/)
  assert.equal(how.includes('design/how/perfect-platoon.webp'), false)
  assert.match(banner, /asset\(PERFECT_PLATOON_ART\)/)

  // The classes count on a base report stays the classroom icon, not this shield.
  const reports = read('src/pages/Reports.jsx')
  assert.match(reports, /IconImg name="platoon"/)
})
