// Fictional Perfect Platoon graphics for the public demo. No phone numbers
// and no soldier names live in this file. The office demo adds contacts.

import { CAMPAIGN_YEAR, CURRENT_MONTH } from '@/data/demo.js'
import { kitahLabel, normalizeCampaignMonth, platoonClassLabel } from './platoonGrade.js'
import { toPublicSchools } from './platoonGraphics.js'

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
      month: CURRENT_MONTH,
      year: String(CAMPAIGN_YEAR),
      fileUrl: null,
      madeAt: '2026-11-02T15:00:00Z',
    }
  })
}

function sameMonth(period) {
  if (period?.holiday) return false
  const month = period?.month ? normalizeCampaignMonth(period.month) : CURRENT_MONTH
  const year = period?.year ? String(period.year) : String(CAMPAIGN_YEAR)
  if (month === 'Rosh Hashana' || month === 'Yom Kippur') return false
  return month === normalizeCampaignMonth(CURRENT_MONTH) && year === String(CAMPAIGN_YEAR)
}

export function demoPublicPlatoonGraphics(period) {
  const month = period?.month ? normalizeCampaignMonth(period.month) : CURRENT_MONTH
  const year = period?.year ? Number(period.year) || period.year : CAMPAIGN_YEAR
  if (!sameMonth(period)) {
    return { month, year, renderer: 'placeholder', storage: 'ready', schools: [] }
  }
  const bySchool = new Map()
  for (const row of demoPlatoonGraphicRows()) {
    if (!bySchool.has(row.schoolId)) {
      bySchool.set(row.schoolId, {
        id: row.schoolId,
        name: row.school,
        logo: null,
        color: row.color,
        graphics: [],
      })
    }
    bySchool.get(row.schoolId).graphics.push(row)
  }
  return {
    month: CURRENT_MONTH,
    year: CAMPAIGN_YEAR,
    renderer: 'placeholder',
    storage: 'ready',
    schools: toPublicSchools([...bySchool.values()]),
  }
}
