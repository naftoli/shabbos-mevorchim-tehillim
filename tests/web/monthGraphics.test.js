import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { topTenFromRace, rankRace } from '../../src/lib/schoolRace.js'
import { topBaseArt } from '../../src/lib/baseRank.js'
import {
  TEACHER_GRAPHICS_CHANNEL,
  compareSchoolGraphics,
  graphicMonthChoices,
  graphicSharePath,
  previousCampaignMonth,
  teacherPacketMessage,
} from '../../src/lib/monthGraphics.js'
import { toPublicSchools } from '../../src/lib/platoonGraphics.js'
import {
  demoArchiveRows,
  demoPublicPlatoonGraphics,
  isDemoArchivePeriod,
} from '../../src/lib/platoonGraphicsDemo.js'
import { demoOfficePlatoonGraphics, demoMarkSchoolSent } from '../../src/lib/platoonGraphicsOfficeDemo.js'
import { demoRaceSchools } from '../../src/services/api.js'
import { CAMPAIGN_YEAR, CURRENT_MONTH } from '../../src/data/demo.js'

const memory = new Map()
globalThis.sessionStorage = globalThis.sessionStorage || {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
}

test('top 10 uses the finished Race place, and 11+ is left out', () => {
  const rows = []
  for (let n = 1; n <= 9; n += 1) {
    rows.push({ id: n, name: `School ${String(n).padStart(2, '0')}`, pctMet: 100 - n, metMonth: 10 })
  }
  rows.push({ id: 10, name: 'Tied B', pctMet: 90, metMonth: 5 })
  rows.push({ id: 11, name: 'Tied A', pctMet: 90, metMonth: 5 })
  rows.push({ id: 12, name: 'After', pctMet: 89, metMonth: 50 })
  const ranked = rankRace(rows, 'finished')
  const top = topTenFromRace(rows)
  assert.deepEqual(top.map((row) => row.rank), ranked.filter((row) => row.rank <= 10).map((row) => row.rank))
  assert.equal(top.find((row) => row.name === 'Tied A').rank, 10)
  assert.equal(top.find((row) => row.name === 'Tied B').rank, 10)
  assert.equal(top.some((row) => row.name === 'After'), false)
  assert.equal(topBaseArt(top[0].rank), 'design/top-base-1.webp')
  assert.equal(topBaseArt(11), null)
})

test('the public shape keeps a Top 10 badge and drops phones and student names', () => {
  const schools = toPublicSchools([{
    id: 61,
    name: 'Cheder Menachem (Sample)',
    whatsapp: '17185550101',
    graphics: [
      {
        id: 'top-61',
        kind: 'top10',
        rank: 3,
        classLabel: 'Top 10 School',
        student: 'Mendel K.',
        teacher: 'Rabbi Cohen',
        sent: true,
      },
      { id: 9, className: '1-A', grade: '1', fileUrl: '/x.png' },
    ],
  }])
  const json = JSON.stringify(schools)
  assert.equal(schools[0].graphics[0].kind, 'top10')
  assert.equal(schools[0].graphics[0].rank, 3)
  assert.equal(schools[0].graphics[0].classLabel, 'Top 10 School')
  assert.equal(schools[0].graphics[1].kind, 'platoon')
  assert.equal(schools[0].graphics[1].classLabel, 'Kitah Alef-A')
  assert.equal(schools[0].whatsapp, undefined)
  assert.equal(json.includes('17185550101'), false)
  assert.equal(json.includes('Mendel'), false)
  assert.equal(json.includes('Rabbi'), false)
  assert.equal(json.includes('"sent"'), false)
})

test('demo graphics follow The Race for this month and keep last month’s set', () => {
  const race = demoRaceSchools()
  const data = demoPublicPlatoonGraphics(undefined, race)
  const json = JSON.stringify(data)
  assert.equal(json.includes('Mendel'), false)
  assert.equal(json.includes('whatsapp'), false)
  assert.equal(json.includes('1718555'), false)
  const tops = data.schools.flatMap((school) => school.graphics.filter((graphic) => graphic.kind === 'top10'))
  const expected = topTenFromRace(race)
  assert.equal(tops.length, expected.length)
  assert.deepEqual(
    tops.map((graphic) => graphic.rank).sort((a, b) => a - b),
    expected.map((row) => row.rank).sort((a, b) => a - b),
  )
  assert.ok(tops.every((graphic) => graphic.rank >= 1 && graphic.rank <= 10))
  const cheder = data.schools.find((school) => school.id === 'cheder-menachem-sample')
  assert.equal(cheder.graphics.some((graphic) => graphic.kind === 'top10'), true)
  assert.equal(cheder.graphics.some((graphic) => graphic.classLabel === 'Kitah Alef-A'), true)

  const prev = previousCampaignMonth(CAMPAIGN_YEAR, CURRENT_MONTH)
  assert.equal(isDemoArchivePeriod({ month: prev.month, year: prev.year }), true)
  const archived = demoPublicPlatoonGraphics({ month: prev.month, year: prev.year })
  assert.equal(archived.month, prev.month)
  assert.notEqual(JSON.stringify(archived.schools), JSON.stringify(data.schools))
  const archivedCheder = archived.schools.find((school) => school.id === 'cheder-menachem-sample')
  assert.equal(archivedCheder.graphics.some((graphic) => graphic.classLabel === 'Kitah Ches-A'), true)
  assert.equal(archivedCheder.graphics.some((graphic) => graphic.classLabel === 'Kitah Alef-A'), false)
  assert.equal(demoArchiveRows().some((row) => row.kind === 'top10' && row.rank === 6), true)
  assert.equal(demoPublicPlatoonGraphics({ month: 'Nissan', year: 5700 }).schools.length, 0)
})

test('the office demo shows Top 10 with the platoons and hides other schools from a school admin', () => {
  memory.clear()
  const race = demoRaceSchools()
  const hq = demoOfficePlatoonGraphics(undefined, { kind: 'super' }, race)
  const cheder = hq.schools.find((school) => school.id === 'cheder-menachem-sample')
  assert.equal(cheder.graphics.some((graphic) => graphic.kind === 'top10' && !graphic.sent), true)
  assert.equal(cheder.whatsapp, '17185550101')
  const bais = hq.schools.find((school) => school.id === 'bais-chaya-mushka-sample')
  assert.equal(bais.graphics.every((graphic) => graphic.sent), true)

  const one = demoOfficePlatoonGraphics(undefined, { kind: 'school', schoolId: 'cheder-menachem-sample' }, race)
  const oneJson = JSON.stringify(one)
  assert.equal(one.schools.length, 1)
  assert.equal(oneJson.includes('17185550102'), false)
  assert.equal(oneJson.includes('Mendel'), false)

  demoMarkSchoolSent('cheder-menachem-sample')
  const after = demoOfficePlatoonGraphics(undefined, { kind: 'super' }, race)
  const again = after.schools.find((school) => school.id === 'cheder-menachem-sample')
  assert.equal(again.graphics.every((graphic) => graphic.sent), true)
})

test('a parent link is one graphic, and teachers are not texted from this page', () => {
  assert.equal(
    graphicSharePath('cheder-menachem-sample', 'top-cheder-menachem-sample', { year: 5787, month: 'Kislev' }),
    '/platoon-graphics/cheder-menachem-sample/share/top-cheder-menachem-sample?year=5787&month=Kislev',
  )
  assert.equal(TEACHER_GRAPHICS_CHANNEL.deliversToTeachers, false)
  assert.match(teacherPacketMessage({ schoolName: 'Cheder', month: 'Kislev', year: 5787, link: 'https://example.test/g' }), /teachers/)
  const choices = graphicMonthChoices(5787, 'Tishrei')
  assert.equal(choices[0].month, 'Elul')
  assert.equal(choices[0].year, 5786)
  assert.equal(compareSchoolGraphics({ kind: 'top10', classLabel: 'Top 10 School' }, { kind: 'platoon', classLabel: 'Kitah Alef' }) < 0, true)

  const share = readFileSync(new URL('../../src/pages/GraphicShare.jsx', import.meta.url), 'utf8')
  const schoolPage = readFileSync(new URL('../../src/pages/SchoolGraphicsShare.jsx', import.meta.url), 'utf8')
  const office = readFileSync(new URL('../../src/pages/PlatoonGraphicsOffice.jsx', import.meta.url), 'utf8')
  for (const src of [share, schoolPage]) {
    assert.equal(src.includes('wa.me'), false)
    assert.equal(src.includes('student'), false)
    assert.equal(src.includes('teacherName'), false)
  }
  assert.match(TEACHER_GRAPHICS_CHANNEL.summary, /does not text or email teachers/)
  assert.match(schoolPage, /TEACHER_GRAPHICS_CHANNEL\.summary/)
  assert.match(schoolPage, /Share with all teachers/)
  assert.match(share, /getPublicPlatoonGraphics/)
  assert.equal(share.includes('getOfficePlatoonGraphics'), false)
  assert.match(office, /Send to school/)
})
