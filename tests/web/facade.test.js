// Exercises the live (non-demo) branch of the services/api.js facade end to end:
// facade -> mashpia.js client -> mock fetch. Asserts each call hits the right
// endpoint with the right method/auth/body and that responses are shaped as the
// SPA consumes them. Run via `npm run test:web`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mock, lastCall, reset } from './harness.mjs'

const { IS_DEMO } = await import('@/lib/liveMode.js')
const api = await import('@/services/api.js')

test('harness runs the live branch (not demo)', () => {
  assert.equal(IS_DEMO, false)
})

test('verifyKid posts credentials, stores token, returns soldier', async () => {
  reset()
  mock({
    'POST /soldier/login': { body: { token: 'kidtok', expiresIn: 43200, soldier: { id: '100001', name: 'Dovid K', ladder: 8 } } },
    'GET /me/progress': { body: { id: '100001', months: [], missionsTotal: 3, metThisYear: 3, current: null } },
  })
  const soldier = await api.verifyKid('100001', '2015-05-05')
  assert.equal(soldier.name, 'Dovid K')
  const call = lastCall()
  assert.equal(call.method, 'POST')
  assert.equal(call.apiPath, '/soldier/login')
  assert.deepEqual(call.body, { serial: '100001', dob: '2015-05-05' })

  // The stored token must ride the next /me call as a Bearer header.
  await api.getKidProgress('100001')
  assert.match(lastCall().headers.Authorization, /^Bearer kidtok$/)
})

test('verifyKid returns null on a 401 (bad serial/dob), not a throw', async () => {
  reset()
  mock({ 'POST /soldier/login': { status: 401, body: { error: 'No soldier matches that serial number and date of birth.' } } })
  assert.equal(await api.verifyKid('000', '2000-01-01'), null)
})

test('getKidProgress derives the medal from missionsTotal', async () => {
  reset()
  mock({ 'GET /me/progress': { body: { id: '1', months: [], missionsTotal: 12, metThisYear: 12, medal: null, current: null } } })
  const p = await api.getKidProgress('1')
  assert.equal(p.missionsTotal, 12)
  assert.ok(p.medal, 'medal should be attached client-side')
  assert.equal(lastCall().apiPath, '/me/progress')
})

test('recordMonth posts kapitlach+minutes and returns fresh progress', async () => {
  reset()
  mock({ 'POST /me/report': { body: { id: '1', months: [], missionsTotal: 4, metThisYear: 4, current: { met: true } } } })
  const p = await api.recordMonth('1', 'Cheshvan', 40, 80)
  assert.equal(lastCall().method, 'POST')
  assert.equal(lastCall().apiPath, '/me/report')
  assert.deepEqual(lastCall().body, { kapitlach: 40, minutes: 80 })
  assert.ok(p.medal)
})

test('setKidLadder PUTs the ladder number', async () => {
  reset()
  mock({ 'PUT /me/ladder': { body: { id: '1', months: [], missionsTotal: 2, metThisYear: 2, current: null } } })
  await api.setKidLadder('1', 7)
  assert.equal(lastCall().method, 'PUT')
  assert.equal(lastCall().apiPath, '/me/ladder')
  assert.deepEqual(lastCall().body, { ladder: 7 })
})

test('getKidSocial reads /me/social', async () => {
  reset()
  mock({ 'GET /me/social': { body: { className: '5A', classRank: 1, schoolRank: 3 } } })
  const s = await api.getKidSocial('1')
  assert.equal(s.classRank, 1)
  assert.equal(lastCall().apiPath, '/me/social')
})

test('verifyAdmin posts credentials and returns admin', async () => {
  reset()
  mock({ 'POST /admin/login': { body: { token: 'atok', expiresIn: 43200, admin: { kind: 'super', name: 'HQ', schoolId: null } } } })
  const admin = await api.verifyAdmin('hq', 'pw')
  assert.equal(admin.kind, 'super')
  assert.equal(lastCall().apiPath, '/admin/login')
})

test('getSchool reads /schools/:id', async () => {
  reset()
  mock({ 'GET /schools/89': { body: { id: 89, name: 'Test School', kids: 100, pct: 50 } } })
  const s = await api.getSchool(89)
  assert.equal(s.name, 'Test School')
  assert.equal(lastCall().apiPath, '/schools/89')
})

test('schoolSoldierLeaderboard unwraps {soldiers} and passes n', async () => {
  reset()
  mock({ 'GET /schools/89/leaderboard?n=10': { body: { schoolId: 89, soldiers: [{ id: 1, name: 'A', grade: '5', saidYear: 50 }] } } })
  const rows = await api.schoolSoldierLeaderboard(89, 10)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].name, 'A')
})

test('schoolClassLeaderboard unwraps {classes}', async () => {
  reset()
  mock({ 'GET /schools/89/class-leaderboard': { body: { schoolId: 89, classes: [{ id: 1, name: '5A', pct: 80 }] } } })
  const rows = await api.schoolClassLeaderboard(89)
  assert.equal(rows[0].name, '5A')
})

test('getGlobalStats reads /stats', async () => {
  reset()
  mock({ 'GET /stats': { body: { monthLabel: 'Cheshvan', year: 5787, pct: 42, metSoldiers: 10, perfectPlatoons: 2 } } })
  const s = await api.getGlobalStats()
  assert.equal(s.perfectPlatoons, 2)
  assert.equal(lastCall().apiPath, '/stats')
})

test('getRunningTotals reads /running-totals', async () => {
  reset()
  mock({ 'GET /running-totals': { body: { thisMonth: 100, thisYear: 500, allTime: 500 } } })
  const t = await api.getRunningTotals()
  assert.equal(t.thisYear, 500)
  assert.equal(lastCall().apiPath, '/running-totals')
})

test('getSchools unwraps {schools} into an array', async () => {
  reset()
  mock({ 'GET /schools': { body: { month: 'Cheshvan', schools: [{ id: 1, name: 'A', pctMet: 50, pct: 60, minutesPct: 40, saidMonth: 9 }] } } })
  const rows = await api.getSchools()
  assert.ok(Array.isArray(rows))
  assert.equal(rows[0].pctMet, 50)
})

test('getPerfectPlatoons unwraps {platoons}', async () => {
  reset()
  mock({ 'GET /perfect-platoons': { body: { month: 'Cheshvan', platoons: [{ schoolId: 1, school: 'A', className: '5-A', teacher: 'Mrs K', size: 20 }] } } })
  const rows = await api.getPerfectPlatoons()
  assert.equal(rows[0].className, '5-A')
})

test('getArmyReport passes monthIdx as a query param', async () => {
  reset()
  mock({ 'GET /reports/army?monthIdx=0': { body: { month: 'Tishrei', rows: [{ id: 1, name: 'A', registered: 10, goal: 100, accomplished: 80, pct: 80, pctMet: 70 }] } } })
  const r = await api.getArmyReport(0)
  assert.equal(r.rows[0].pctMet, 70)
  assert.equal(lastCall().apiPath, '/reports/army?monthIdx=0')
})

test('getBaseReport and getPlatoonReport hit the right month-scoped paths', async () => {
  reset()
  mock({
    'GET /reports/base/89?monthIdx=1': { body: { school: 'A', schoolId: 89, rows: [] } },
    'GET /reports/platoon/555?monthIdx=1': { body: { className: '5A', completed: 3, size: 10, rows: [] } },
  })
  await api.getBaseReport(89, 1)
  assert.equal(lastCall().apiPath, '/reports/base/89?monthIdx=1')
  await api.getPlatoonReport(555, 1)
  assert.equal(lastCall().apiPath, '/reports/platoon/555?monthIdx=1')
})

test('notCompleted unwraps {classes} and sends an admin token', async () => {
  reset()
  mock({
    'POST /admin/login': { body: { token: 'atok2', expiresIn: 43200, admin: { kind: 'school', schoolId: 89 } } },
    'GET /schools/89/not-completed': { body: { schoolId: 89, classes: [{ classId: 1, className: '5A', size: 10, missing: ['Dovid'] }] } },
  })
  await api.verifyAdmin('x', 'y')
  const rows = await api.notCompleted(89)
  assert.equal(rows[0].missing[0], 'Dovid')
  assert.match(lastCall().headers.Authorization, /^Bearer atok2$/)
})
