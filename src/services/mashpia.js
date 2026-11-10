// Live Mashpia/WWTC API client — the non-demo half of the services/api.js
// facade. Modeled on Mivtza Lulav's src/services/mashpia.js: signed bearer
// tokens over the existing Mashpia roster, served from /shabbos-mevorchim-
// tehillim/api (see api/README.md).
//
// Only the endpoints the facade has been wired to live so far are implemented
// here. The rest of services/api.js still runs on the demo roster; each
// function flips to its mashpia.* twin as it is wired, the Lulav pattern.

// import.meta.env is injected by Vite in the app; guard it so the module also
// loads under plain Node (the test harness), where it is undefined.
const BASE_URL = (import.meta.env && import.meta.env.BASE_URL) || '/shabbos-mevorchim-tehillim/'
const BASE = `${BASE_URL}api`.replace(/\/$/, '')

// One token slot per role: a soldier and an admin can be signed in at once on a
// shared classroom computer, and the API types every token, so a single slot
// would let the second login break the first role's screens with 403s.
const TOKEN_KEYS = { kid: 'wwtc_token_kid', admin: 'wwtc_token_admin' }
const memoryTokens = { kid: null, admin: null }
const listeners = new Set()
let timer = null

export function getKidToken() {
  return readToken('kid')
}

function readToken(role) {
  try {
    const saved = JSON.parse(localStorage.getItem(TOKEN_KEYS[role]) || 'null')
    if (saved?.token && saved.expiresAt > Date.now()) return saved.token
    localStorage.removeItem(TOKEN_KEYS[role])
  } catch { /* blocked storage */ }
  return memoryTokens[role]
}

export function saveToken(role, token, expiresIn) {
  memoryTokens[role] = token
  try {
    localStorage.setItem(TOKEN_KEYS[role], JSON.stringify({
      token,
      expiresAt: Date.now() + Number(expiresIn || 0) * 1000,
    }))
  } catch { /* in-memory requests still work until reload */ }
}

function clearToken(role) {
  memoryTokens[role] = null
  try { localStorage.removeItem(TOKEN_KEYS[role]) } catch { /* noop */ }
}

// Called when a token expires under us, and by the facade on logout. The event
// names the role so the other one's session survives.
export function endSession(role) {
  clearToken(role)
  window.dispatchEvent(new CustomEvent('wwtc-auth-expired', { detail: { role } }))
}

function emit() {
  listeners.forEach((listener) => listener())
}

// The live feel: useLiveData re-runs its loader on a 30s tick while anything is
// mounted, so a report page picks up other people's progress without a reload.
export function subscribe(listener) {
  listeners.add(listener)
  if (!timer) timer = window.setInterval(emit, 30000)
  return () => {
    listeners.delete(listener)
    if (!listeners.size && timer) {
      window.clearInterval(timer)
      timer = null
    }
  }
}

/**
 * `as` says whose token to send: 'kid', 'admin', or nothing for the public
 * endpoints (the campaign, stats and school pages are public — no token).
 */
async function req(path, { method = 'GET', body, as = null } = {}) {
  const token = as ? readToken(as) : null
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  // Any 401 on a request that was meant to be authenticated (`as` is set) ends
  // the session, even when no token went out: the 30-day session record outlives
  // the 12-hour bearer token, so after a token expires readToken() returns null
  // and we'd send a tokenless request. Without this, that 401 left the soldier
  // stranded on "Couldn't load your Tehillim" — session still live, so no bounce
  // to login, and Try again just 401s again. Clearing here redirects to /login.
  if (response.status === 401 && as) endSession(as)
  const payload = await response.json().catch(() => undefined)
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status}).`)
  }
  // A 2xx with an unparseable (e.g. empty) body means the server died after its
  // headers went out; surface it as a clear error rather than returning null and
  // letting callers crash on `const { token } = null`. (No endpoint here replies
  // 2xx-with-no-body; the only 204 is the CORS preflight the browser handles.)
  if (payload === undefined) {
    throw new Error(`The server returned an unreadable response (${response.status}).`)
  }
  return payload
}

async function write(path, options) {
  const result = await req(path, options)
  emit() // nudge useLiveData subscribers to re-read
  return result
}

// ---- authentication --------------------------------------------------------

export async function verifyKid(serial, dob) {
  try {
    const { token, expiresIn, soldier } = await req('/soldier/login', {
      method: 'POST',
      body: { serial, dob },
    })
    saveToken('kid', token, expiresIn)
    return soldier
  } catch (error) {
    // A bad serial/dob is a "no match", not an error to surface.
    if (/no soldier|serial number|date of birth/i.test(error.message)) return null
    throw error
  }
}

/**
 * The parent site's one-tap sign-in: trade the short-lived code it put in our
 * URL for the same session POST /soldier/login issues.
 */
export async function verifyKidHandoff(code) {
  const { token, expiresIn, soldier } = await req('/soldier/handoff', {
    method: 'POST',
    body: { code },
  })
  saveToken('kid', token, expiresIn)
  return soldier
}

export async function verifyAdmin(username, password) {
  try {
    const { token, expiresIn, admin } = await req('/admin/login', {
      method: 'POST',
      body: { username, password },
    })
    saveToken('admin', token, expiresIn)
    return admin
  } catch (error) {
    if (/username or password/i.test(error.message)) return null
    throw error
  }
}

// ---- read endpoints --------------------------------------------------------

function periodQuery(period) {
  if (!period) return ''
  const params = new URLSearchParams()
  if (period.year) params.set('year', String(period.year))
  if (period.month) params.set('month', period.month)
  const text = params.toString()
  return text ? `?${text}` : ''
}

export const getSchool = (id) => req(`/schools/${id}`)
export const getGlobalStats = (period) => req(`/stats${periodQuery(period)}`)
export const getSchools = (period) => req(`/schools${periodQuery(period)}`).then((r) => r.schools || [])
export const getPerfectPlatoons = (period) => req(`/perfect-platoons${periodQuery(period)}`).then((r) => r.platoons || [])
export const getCampaign = (year) => req(`/campaign${year ? `?year=${year}` : ''}`)
export const getDedication = async (period) => {
  const params = new URLSearchParams()
  params.set('scope', period?.scope || 'army')
  if (period?.year) params.set('year', String(period.year))
  if (period?.month) params.set('month', period.month)
  if (period?.schoolId) params.set('schoolId', String(period.schoolId))
  const data = await req(`/dedication?${params}`)
  return data?.dedication ?? null
}
export const getHqVerify = (period) => req(`/hq/verify${periodQuery(period)}`, { as: 'admin' })
export const getClassLeaderboard = (id) => req(`/schools/${id}/class-leaderboard`).then((r) => r.classes || [])
export const getNotCompleted = (id) => req(`/schools/${id}/not-completed`, { as: 'admin' }).then((r) => r.classes || [])
export const getSoldierLeaderboard = (id, n = null) => {
  const q = n == null ? '' : `?n=${encodeURIComponent(n)}`
  return req(`/schools/${id}/leaderboard${q}`).then((r) => r.soldiers || [])
}
export const getRunningTotals = () => req('/running-totals')
const monthQuery = (idx) => (idx === undefined || idx === null ? '' : `?monthIdx=${idx}`)
function reportQuery(monthIdx, period) {
  if (period?.year || period?.month) return periodQuery(period)
  return monthQuery(monthIdx)
}
export const getArmyReport = (monthIdx, period) => req(`/reports/army${reportQuery(monthIdx, period)}`)
export const getBaseReport = (schoolId, monthIdx, period) => req(`/reports/base/${schoolId}${reportQuery(monthIdx, period)}`)
export async function getPlatoonReport(classId, monthIdx, period) {
  const path = `/reports/platoon/${classId}${reportQuery(monthIdx, period)}`
  // The summary is public. Attach the staff token when we have one so the
  // server can add the roll. A rejected token must not blank the class summary.
  if (!readToken('admin')) return req(path)
  try {
    return await req(path, { as: 'admin' })
  } catch (error) {
    const message = String(error?.message || '')
    if (/authentication|permission|invalid|request failed \(40[13]\)/i.test(message)) {
      return req(path)
    }
    throw error
  }
}

// The signed-in soldier (token-scoped, so no id is sent).
export const getKidProgress = () => req('/me/progress', { as: 'kid' })
export const getKidSocial = () => req('/me/social', { as: 'kid' })
export const recordMonth = (kapitlach, minutes, extra = {}) =>
  write('/me/report', {
    method: 'POST',
    body: {
      kapitlach,
      minutes,
      ...(extra?.exceptionalConfirmed ? { exceptionalConfirmed: true } : {}),
    },
    as: 'kid',
  })
export const setDedication = async ({ scope, schoolId, text, year, month }) => {
  const data = await write('/dedication', { method: 'PUT', body: { scope, schoolId, text, year, month }, as: 'admin' })
  return data?.dedication ?? null
}
export const setKidLadder = (ladder) =>
  write('/me/ladder', { method: 'PUT', body: { ladder }, as: 'kid' })

// Admin sets a ladder for a whole school (classId/kidId null), one class
// (classId set), or one soldier (classId + kidId). kidId is the platoon roll's
// row id (the soldier's user_id). Server scopes it to the admin's authority.
export const adminSetLadder = ({ schoolId, classId = null, kidId = null, ladder }) =>
  write('/admin/ladder', { method: 'PUT', body: { schoolId, classId, kidId, ladder }, as: 'admin' })

// Public. No bearer token: page copy only, never a session, serial, or password.
export const translatePage = (targetLang, content) =>
  req('/translate', { method: 'POST', body: { targetLang, content } })
