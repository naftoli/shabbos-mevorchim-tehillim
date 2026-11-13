import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mock, lastCall, reset } from './harness.mjs'

const grade = await import('@/lib/platoonGrade.js')
const graphics = await import('@/lib/platoonGraphics.js')
const demo = await import('@/lib/platoonGraphicsDemo.js')
const office = await import('@/lib/platoonGraphicsOfficeDemo.js')
const api = await import('@/services/api.js')
const staff = await import('@/services/platoonOffice.js')

const memory = new Map()
globalThis.sessionStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
}

test('grades 1–8 use the eight Kitah names, and Adar I is not Adar II', () => {
  assert.deepEqual(grade.KITAH_BY_GRADE, {
    1: 'Kitah Alef',
    2: 'Kitah Beis',
    3: 'Kitah Gimmel',
    4: 'Kitah Daled',
    5: 'Kitah Hei',
    6: 'Kitah Vov',
    7: 'Kitah Zayin',
    8: 'Kitah Ches',
  })
  assert.equal(grade.kitahLabel('Grade 1'), 'Kitah Alef')
  assert.equal(grade.kitahLabel('Alef'), 'Kitah Alef')
  assert.equal(grade.kitahLabel('pre1a'), null)
  assert.equal(grade.kitahLabel('9'), null)
  assert.equal(grade.platoonClassLabel('5', '5-B'), 'Kitah Hei-B')
  assert.equal(grade.normalizeClassParts('Kitah Hei-B', '').className, '5-B')
  assert.equal(grade.normalizeCampaignMonth('Adar 1'), 'Adar I')
  assert.equal(grade.normalizeCampaignMonth('Adar 2'), 'Adar II')
  assert.equal(grade.normalizeCampaignMonth('Adar'), 'Adar')
  assert.notEqual(grade.normalizeCampaignMonth('Adar I'), grade.normalizeCampaignMonth('Adar II'))
})

test('a new platoon at an already-sent school is NEW, and the tabs follow that', () => {
  const rows = graphics.decorateGraphics([
    { schoolId: 1, sent: true, className: '3-B', grade: '3' },
    { schoolId: 1, sent: false, className: '1-A', grade: '1' },
    { schoolId: 2, sent: false, className: '2', grade: '2' },
  ])
  assert.equal(rows[1].isNew, true)
  assert.equal(rows[0].isNew, false)
  assert.equal(rows[2].isNew, false)
  const schools = [
    { id: 1, graphics: [rows[0], rows[1]] },
    { id: 2, graphics: [rows[2]] },
    { id: 3, graphics: [{ sent: true, isNew: false }] },
  ]
  assert.equal(graphics.filterOfficeTab(schools, 'to-send').length, 2)
  assert.equal(graphics.filterOfficeTab(schools, 'sent').length, 1)
  assert.equal(graphics.filterOfficeTab(schools, 'all').length, 3)
  assert.equal(graphics.officeCounts(schools).newGraphics, 1)
})

test('the public shape drops phones, sent marks, and student names', () => {
  const schools = graphics.toPublicSchools([{
    id: 61,
    name: 'Cheder Menachem (Sample)',
    whatsapp: '17185550101',
    graphics: [{
      id: 9,
      className: '1-A',
      grade: '1',
      fileUrl: '/x.png',
      sent: true,
      student: 'Mendel K.',
      name: 'Mendel K.',
      teacher: 'Rabbi Cohen',
    }],
  }])
  const json = JSON.stringify(schools)
  assert.equal(schools[0].whatsapp, undefined)
  assert.equal(schools[0].graphics[0].classLabel, 'Kitah Alef-A')
  assert.equal(schools[0].graphics[0].sent, undefined)
  assert.equal(json.includes('17185550101'), false)
  assert.equal(json.includes('Mendel'), false)
  assert.equal(json.includes('Rabbi'), false)
})

test('share falls back to download, and a WhatsApp link keeps the country code', () => {
  assert.equal(graphics.chooseShareAction({ hasFile: true, canShareFiles: true, canShareLink: true }), 'share-file')
  assert.equal(graphics.chooseShareAction({ hasFile: true, canShareFiles: false, canShareLink: false }), 'download')
  assert.equal(graphics.chooseShareAction({ hasFile: false, canShareFiles: false, canShareLink: true }), 'share-link')
  assert.equal(graphics.chooseShareAction({ hasFile: false, canShareFiles: false, canShareLink: false }), 'copy-link')
  const url = graphics.whatsAppSchoolUrl('+1 (718) 555-0101', 'Hello')
  assert.equal(url.startsWith('https://wa.me/17185550101?text='), true)
  assert.equal(graphics.whatsAppSchoolUrl('555', 'Hello'), null)
  assert.equal(graphics.normalizeWhatsapp('')?.digits, null)
})

test('the public demo has graphics and no school phone numbers', () => {
  const data = demo.demoPublicPlatoonGraphics()
  assert.ok(data.schools.length >= 4)
  const json = JSON.stringify(data)
  assert.equal(json.includes('17185550101'), false)
  assert.equal(json.includes('17185550102'), false)
  assert.equal(json.includes('13125550103'), false)
  assert.equal(json.includes('whatsapp'), false)
  assert.equal(json.includes('Mendel'), false)
  assert.equal(data.renderer, 'placeholder')
  const cheder = data.schools.find((school) => school.id === 'cheder-menachem-sample')
  assert.equal(cheder.graphics.some((graphic) => graphic.classLabel === 'Kitah Alef-A'), true)
  assert.equal(demo.demoPublicPlatoonGraphics({ month: 'Nissan', year: 5700 }).schools.length, 0)
  assert.equal(demo.demoPublicPlatoonGraphics({ month: 'Adar I', year: 5700 }).schools.length, 0)
  assert.equal(demo.demoPublicPlatoonGraphics({ month: 'Adar II', year: 5700 }).schools.length, 0)
})

test('the office demo marks a new platoon, hides other schools from a school admin, and keeps numbers off a logged-out call', () => {
  memory.clear()
  const hq = office.demoOfficePlatoonGraphics(undefined, { kind: 'super' })
  const cheder = hq.schools.find((school) => school.id === 'cheder-menachem-sample')
  assert.equal(cheder.whatsapp, '17185550101')
  assert.equal(cheder.graphics.find((graphic) => graphic.id === 1).isNew, true)
  assert.equal(graphics.filterOfficeTab(hq.schools, 'sent').length, 1)
  assert.equal(graphics.filterOfficeTab(hq.schools, 'to-send').some((school) => school.whatsapp == null), true)

  const one = office.demoOfficePlatoonGraphics(undefined, { kind: 'school', schoolId: 'cheder-menachem-sample' })
  const oneJson = JSON.stringify(one)
  assert.equal(one.schools.length, 1)
  assert.equal(oneJson.includes('17185550102'), false)
  assert.equal(oneJson.includes('13125550103'), false)

  const loggedOut = office.demoOfficePlatoonGraphics(undefined, null)
  assert.equal(loggedOut.forbidden, true)
  assert.equal(loggedOut.schools.length, 0)

  office.demoMarkSchoolSent('cheder-menachem-sample')
  const after = office.demoOfficePlatoonGraphics(undefined, { kind: 'super' })
  const again = after.schools.find((school) => school.id === 'cheder-menachem-sample')
  assert.equal(again.graphics.every((graphic) => graphic.sent), true)
  assert.equal(again.graphics.some((graphic) => graphic.isNew), false)
})

test('live graphics routes: public has no token, office sends the admin token', async () => {
  reset()
  mock({
    'GET /platoon-graphics': { body: { month: 'Cheshvan', year: 5786, renderer: 'placeholder', schools: [{ id: 61, name: 'Sample', graphics: [] }] } },
    'POST /admin/login': { body: { token: 'admintok', expiresIn: 100, admin: { kind: 'super', name: 'HQ', schoolId: null } } },
    'GET /office/platoon-graphics': { body: { month: 'Cheshvan', schools: [], storage: 'ready' } },
    'PUT /office/platoon-graphics/contact': { body: { ok: true, whatsapp: '17185550101' } },
    'POST /office/platoon-graphics/sent': { body: { ok: true, updated: 2 } },
  })
  const pub = await api.getPublicPlatoonGraphics()
  assert.equal(lastCall().apiPath, '/platoon-graphics')
  assert.equal(lastCall().headers.Authorization, undefined)
  assert.equal(pub.schools[0].name, 'Sample')

  await api.verifyAdmin('hq', 'secret')
  await staff.getOfficePlatoonGraphics()
  assert.equal(lastCall().apiPath, '/office/platoon-graphics')
  assert.equal(lastCall().headers.Authorization, 'Bearer admintok')

  await staff.saveSchoolWhatsapp(61, '17185550101')
  assert.equal(lastCall().method, 'PUT')
  assert.equal(lastCall().apiPath, '/office/platoon-graphics/contact')
  assert.deepEqual(lastCall().body, { schoolId: 61, whatsapp: '17185550101' })

  await staff.markSchoolGraphicsSent(61)
  assert.equal(lastCall().method, 'POST')
  assert.deepEqual(lastCall().body, { schoolId: 61, sent: true })
})

test('the public page source does not mention WhatsApp or a school number', () => {
  const page = readFileSync(new URL('../../src/pages/PlatoonGraphics.jsx', import.meta.url), 'utf8')
  const demoSrc = readFileSync(new URL('../../src/lib/platoonGraphicsDemo.js', import.meta.url), 'utf8')
  const apiSrc = readFileSync(new URL('../../src/services/api.js', import.meta.url), 'utf8')
  assert.equal(page.includes('wa.me'), false)
  assert.equal(page.includes('whatsapp'), false)
  assert.equal(demoSrc.includes('1718555'), false)
  assert.equal(apiSrc.includes('platoonGraphicsOfficeDemo'), false)
})
