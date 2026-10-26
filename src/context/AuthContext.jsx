import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { verifyKid, verifyAdmin, getKid, setKidLadder, endSession } from '@/services/api.js'
import { IS_DEMO } from '@/lib/liveMode.js'

// Session store. Demo mode verifies against the anonymized roster; live mode
// calls the Mashpia-backed logins and mashpia.js holds the bearer token. The
// session record here persists in localStorage with a 30-day TTL; if the shorter-
// lived token expires under it, an API 401 fires 'wwtc-auth-expired' and we clear.

const AuthContext = createContext(null)
const KID_KEY = 'wwtc_session_kid'
const ADMIN_KEY = 'wwtc_session_admin'
const TTL = 30 * 24 * 60 * 60 * 1000

function load(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { exp, data } = JSON.parse(raw)
    if (!exp || exp < Date.now()) { localStorage.removeItem(key); return null }
    return data
  } catch { return null }
}
function save(key, data) {
  try {
    if (data) localStorage.setItem(key, JSON.stringify({ exp: Date.now() + TTL, data }))
    else localStorage.removeItem(key)
  } catch { /* private mode */ }
}

export function AuthProvider({ children }) {
  const [kid, setKid] = useState(() => load(KID_KEY))
  const [admin, setAdmin] = useState(() => load(ADMIN_KEY))

  // Demo only: re-validate a restored kid against the current roster (a stale
  // demo seed shouldn't log a ghost in) and sync the chosen ladder back into the
  // in-memory roster, which rebuilds ladderless on every load. Live mode keeps
  // the ladder server-side, so this hack must NOT run there (it would POST a
  // ladder change on every page load).
  useEffect(() => {
    if (!kid || !IS_DEMO) return
    // eslint-disable-next-line react/set-state-in-effect
    if (!getKid(kid.id)) { setKid(null); save(KID_KEY, null); return }
    if (kid.ladder) setKidLadder(kid.id, kid.ladder)
  }, [kid])

  // Live: when a bearer token expires mid-session, clear the matching session.
  useEffect(() => {
    if (IS_DEMO) return
    const onExpired = (e) => {
      const role = e.detail?.role
      if (role === 'kid') { setKid(null); save(KID_KEY, null) }
      if (role === 'admin') { setAdmin(null); save(ADMIN_KEY, null) }
    }
    window.addEventListener('wwtc-auth-expired', onExpired)
    return () => window.removeEventListener('wwtc-auth-expired', onExpired)
  }, [])

  const loginKid = useCallback(async (serial, dob) => {
    const found = await verifyKid(serial, dob)
    if (!found) throw new Error('No soldier matches that serial number and date of birth.')
    setKid(found)
    save(KID_KEY, found)
    return found
  }, [])

  const loginAdmin = useCallback(async (username, password) => {
    const found = await verifyAdmin(username, password)
    if (!found) throw new Error('That username or password is not correct.')
    setAdmin(found)
    save(ADMIN_KEY, found)
    return found
  }, [])

  const changeLadder = useCallback(async (ladder) => {
    if (!kid) return null
    const progress = await setKidLadder(kid.id, ladder)
    if (!progress) return null
    const updated = { ...kid, ladder: Number(ladder) }
    setKid(updated)
    save(KID_KEY, updated)
    return progress
  }, [kid])

  const logoutKid = useCallback(() => { endSession('kid'); setKid(null); save(KID_KEY, null) }, [])
  const logoutAdmin = useCallback(() => { endSession('admin'); setAdmin(null); save(ADMIN_KEY, null) }, [])

  const value = useMemo(
    () => ({
      kid,
      admin,
      isKid: !!kid,
      isAdmin: !!admin,
      isSuper: admin?.kind === 'super',
      loginKid,
      loginAdmin,
      logoutKid,
      logoutAdmin,
      changeLadder,
    }),
    [kid, admin, loginKid, loginAdmin, logoutKid, logoutAdmin, changeLadder],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react/only-export-components -- the hook is colocated with its provider; the fast-refresh hint doesn't apply to a context module
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
