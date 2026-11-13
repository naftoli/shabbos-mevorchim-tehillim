// Fictional office state for the demo. Phone numbers here are made up
// (555) and are loaded only when the office page asks for them.

import { CAMPAIGN_YEAR, CURRENT_MONTH } from '@/data/demo.js'
import { demoPlatoonGraphicRows } from './platoonGraphicsDemo.js'
import { normalizeCampaignMonth } from './platoonGrade.js'
import { decorateGraphics } from './platoonGraphics.js'

const STORAGE_KEY = 'wwtc.demo.platoonOffice'

// Which seed graphics start out already sent. 2 is Cheder's second platoon,
// so its other platoon shows as NEW. 3 and 4 are a school that is fully sent.
const SEED_SENT = { 2: true, 3: true, 4: true }

const SEED_CONTACTS = {
  'cheder-menachem-sample': '17185550101',
  'bais-chaya-mushka-sample': '17185550102',
  'lubavitch-academy-sample': '13125550103',
}

function loadState() {
  const state = { sent: { ...SEED_SENT }, contacts: { ...SEED_CONTACTS } }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return state
    const saved = JSON.parse(raw)
    if (saved?.sent && typeof saved.sent === 'object') state.sent = { ...state.sent, ...saved.sent }
    if (saved?.contacts && typeof saved.contacts === 'object') {
      state.contacts = { ...state.contacts, ...saved.contacts }
    }
  } catch { /* private mode */ }
  return state
}

function saveState(state) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* private mode */ }
}

function readAdmin() {
  try {
    const raw = localStorage.getItem('wwtc_session_admin')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.data || null
  } catch {
    return null
  }
}

function monthMatches(period) {
  if (period?.holiday) return false
  const month = period?.month ? normalizeCampaignMonth(period.month) : CURRENT_MONTH
  const year = period?.year ? String(period.year) : String(CAMPAIGN_YEAR)
  if (month === 'Rosh Hashana' || month === 'Yom Kippur') return false
  return month === normalizeCampaignMonth(CURRENT_MONTH) && year === String(CAMPAIGN_YEAR)
}

export function demoOfficePlatoonGraphics(period, viewer) {
  const month = period?.month ? normalizeCampaignMonth(period.month) : CURRENT_MONTH
  const year = period?.year || CAMPAIGN_YEAR
  const empty = { month, year, renderer: 'placeholder', storage: 'ready', schools: [], forbidden: false }
  const who = viewer === undefined ? readAdmin() : viewer
  if (!who || (who.kind !== 'super' && who.kind !== 'school')) {
    return { ...empty, forbidden: true }
  }
  if (!monthMatches(period)) return empty
  const state = loadState()
  const graphics = decorateGraphics(demoPlatoonGraphicRows().map((row) => ({
    ...row,
    sent: !!state.sent[row.id],
  })))
  const schools = []
  for (const graphic of graphics) {
    let school = schools.find((item) => item.id === graphic.schoolId)
    if (!school) {
      school = {
        id: graphic.schoolId,
        name: graphic.school,
        logo: null,
        color: graphic.color,
        whatsapp: state.contacts[graphic.schoolId] || null,
        graphics: [],
      }
      schools.push(school)
    }
    const rest = { ...graphic }
    delete rest.color
    delete rest.school
    delete rest.name
    school.graphics.push(rest)
  }
  const visible = who.kind === 'school'
    ? schools.filter((school) => String(school.id) === String(who.schoolId))
    : schools
  return { month: CURRENT_MONTH, year: CAMPAIGN_YEAR, renderer: 'placeholder', storage: 'ready', schools: visible, forbidden: false }
}

export function demoSaveWhatsapp(schoolId, whatsapp) {
  const state = loadState()
  if (whatsapp) state.contacts[schoolId] = whatsapp
  else delete state.contacts[schoolId]
  saveState(state)
  return { ok: true, schoolId, whatsapp: whatsapp || null }
}

export function demoMarkGraphicsSent({ ids, sent }) {
  const state = loadState()
  for (const id of ids || []) state.sent[id] = !!sent
  saveState(state)
  return { ok: true, updated: (ids || []).length }
}

export function demoMarkSchoolSent(schoolId) {
  const state = loadState()
  let updated = 0
  for (const row of demoPlatoonGraphicRows()) {
    if (row.schoolId === schoolId && !state.sent[row.id]) {
      state.sent[row.id] = true
      updated += 1
    }
  }
  saveState(state)
  return { ok: true, updated }
}
