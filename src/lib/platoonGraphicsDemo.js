// Fictional Perfect Platoon graphics for the public demo. No phone numbers
// and no soldier names live in this file. The office demo adds contacts.

import { CAMPAIGN_YEAR, CURRENT_MONTH } from '@/data/demo.js'
import { kitahLabel, normalizeCampaignMonth, platoonClassLabel } from './platoonGrade.js'
import { compareSchoolGraphics, previousCampaignMonth, topGraphicId } from './monthGraphics.js'
import { toPublicSchools } from './platoonGraphics.js'
import { topTenFromRace } from './schoolRace.js'

const SAMPLE = [
  { id: 'cheder-menachem-sample', name: 'Cheder Menachem (Sample)', color: '#2a5fb8' },
  { id: 'bais-chaya-mushka-sample', name: 'Bais Chaya Mushka (Sample)', color: '#0e8aa6' },
  { id: 'lubavitch-academy-sample', name: 'Lubavitch Academy (Sample)', color: '#5b3fa8' },
  { id: 'darkei-menachem-sample', name: 'Darkei Menachem (Sample)', color: '#1f7a4d' },
]

const ROWS = [
  { id: 1, schoolId: 'cheder-menachem-sample', grade: '1', className: '1-A' },
  { id: 2, schoolId: 'cheder-menachem-sample', grade: '3', className: '3-B' },
  { id: 3, schoolId: 'bais-chaya-mushka-sample', grade: '5', className: '5' },
  { id: 4, schoolId: 'bais-chaya-mushka-sample', grade: '6', className: '6-A' },
  { id: 5, schoolId: 'lubavitch-academy-sample', grade: '2', className: '2' },
  { id: 6, schoolId: 'lubavitch-academy-sample', grade: '7', className: '7-A' },
  { id: 7, schoolId: 'darkei-menachem-sample', grade: '4', className: '4-B' },
]

export function demoPlatoonGraphicRows() {
  const byId = Object.fromEntries(SAMPLE.map((school) => [school.id, school]))
  return ROWS.map((row) => {
    const school = byId[row.schoolId]
    return {
      id: row.id,
      schoolId: row.schoolId,
      school: school.name,
      name: school.name,
      color: school.color,
      logo: null,
      grade: row.grade,
      className: row.className,
      gradeLabel: kitahLabel(row.grade) || '',
      classLabel: platoonClassLabel(row.grade, row.className),
      kind: 'platoon',
      month: CURRENT_MONTH,
      year: String(CAMPAIGN_YEAR),
      fileUrl: null,
      madeAt: '2026-11-02T15:00:00Z',
    }
  })
}

const ARCHIVE_SCHOOLS = {
  'bais-chaya-mushka-sample': { name: 'Bais Chaya Mushka (Sample)', color: '#0e8aa6' },
  'ohr-menachem-sample': { name: 'Ohr Menachem (Sample)', color: '#c77d0e' },
  'cheder-menachem-sample': { name: 'Cheder Menachem (Sample)', color: '#2a5fb8' },
  'lubavitch-academy-sample': { name: 'Lubavitch Academy (Sample)', color: '#5b3fa8' },
}

/** Last month's set is stored on its own, so the next month does not replace it. */
export function demoArchiveRows() {
  const prev = previousCampaignMonth(CAMPAIGN_YEAR, CURRENT_MONTH)
  const platoons = [
    { id: 'arch-platoon-1', schoolId: 'cheder-menachem-sample', grade: '8', className: '8-A' },
    { id: 'arch-platoon-2', schoolId: 'bais-chaya-mushka-sample', grade: '2', className: '2-B' },
  ].map((row) => {
    const school = ARCHIVE_SCHOOLS[row.schoolId]
    return {
      id: row.id,
      kind: 'platoon',
      schoolId: row.schoolId,
      school: school.name,
      name: school.name,
      color: school.color,
      logo: null,
      grade: row.grade,
      className: row.className,
      gradeLabel: kitahLabel(row.grade) || '',
      classLabel: platoonClassLabel(row.grade, row.className),
      month: prev.month,
      year: String(prev.year),
      fileUrl: null,
      madeAt: null,
    }
  })
  const tops = [
    { schoolId: 'bais-chaya-mushka-sample', rank: 1 },
    { schoolId: 'ohr-menachem-sample', rank: 2 },
    { schoolId: 'cheder-menachem-sample', rank: 6 },
    { schoolId: 'lubavitch-academy-sample', rank: 9 },
  ].map((row) => {
    const school = ARCHIVE_SCHOOLS[row.schoolId]
    return {
      id: `arch-top-${row.schoolId}`,
      kind: 'top10',
      rank: row.rank,
      schoolId: row.schoolId,
      school: school.name,
      name: school.name,
      color: school.color,
      logo: null,
      grade: '',
      className: '',
      gradeLabel: '',
      classLabel: 'Top 10 School',
      month: prev.month,
      year: String(prev.year),
      fileUrl: null,
      madeAt: null,
    }
  })
  return [...tops, ...platoons]
}

export function isDemoArchivePeriod(period) {
  if (!period || period.holiday || !period.month) return false
  const prev = previousCampaignMonth(CAMPAIGN_YEAR, CURRENT_MONTH)
  return normalizeCampaignMonth(period.month) === prev.month && String(period.year || '') === String(prev.year)
}

function topGraphicsFromSchools(schools, month, year) {
  return topTenFromRace(schools).map((school) => ({
    id: topGraphicId(school.id),
    kind: 'top10',
    rank: school.rank,
    schoolId: school.id,
    school: school.name,
    name: school.name,
    color: school.color || null,
    logo: school.logo || null,
    grade: '',
    className: '',
    gradeLabel: '',
    classLabel: 'Top 10 School',
    month,
    year: String(year),
    fileUrl: null,
    madeAt: null,
  }))
}

/** Current month's platoons, plus Top 10 when race rows are passed. Last month is the archive. */
export function collectDemoGraphics(period, schoolRows) {
  if (isDemoArchivePeriod(period)) return demoArchiveRows()
  if (!sameMonth(period)) return []
  const rows = demoPlatoonGraphicRows()
  if (schoolRows && schoolRows.length) {
    rows.push(...topGraphicsFromSchools(schoolRows, CURRENT_MONTH, CAMPAIGN_YEAR))
  }
  return rows
}

function sameMonth(period) {
  if (period?.holiday) return false
  const month = period?.month ? normalizeCampaignMonth(period.month) : CURRENT_MONTH
  const year = period?.year ? String(period.year) : String(CAMPAIGN_YEAR)
  if (month === 'Rosh Hashana' || month === 'Yom Kippur') return false
  return month === normalizeCampaignMonth(CURRENT_MONTH) && year === String(CAMPAIGN_YEAR)
}

export function demoPublicPlatoonGraphics(period, schoolRows) {
  const month = period?.month ? normalizeCampaignMonth(period.month) : CURRENT_MONTH
  const year = period?.year ? Number(period.year) || period.year : CAMPAIGN_YEAR
  const rows = collectDemoGraphics(period, schoolRows)
  if (!rows.length) {
    return { month, year, renderer: 'placeholder', storage: 'ready', topStorage: 'ready', schools: [] }
  }
  const bySchool = new Map()
  for (const row of rows) {
    if (!bySchool.has(row.schoolId)) {
      bySchool.set(row.schoolId, {
        id: row.schoolId,
        name: row.school,
        logo: row.logo || null,
        color: row.color,
        graphics: [],
      })
    }
    bySchool.get(row.schoolId).graphics.push(row)
  }
  for (const school of bySchool.values()) {
    school.graphics.sort(compareSchoolGraphics)
  }
  const shown = rows[0]
  return {
    month: shown.month,
    year: Number(shown.year) || shown.year,
    renderer: 'placeholder',
    storage: 'ready',
    topStorage: 'ready',
    schools: toPublicSchools([...bySchool.values()]),
  }
}
