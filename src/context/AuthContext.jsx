import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { verifyKid, verifyAdmin, getKid, setKidLadder } from '@/services/api.js'

// Session store. Demo mode verifies against the anonymized roster; live mode
// (later) swaps verifyKid/verifyAdmin for the Mashpia-backed calls and stores a
// bearer token. Sessions persist in localStorage with a 30-day TTL.

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

  // Re-validate a restored kid against the current roster (a stale demo seed
  // shouldn't log a ghost in). Also sync the session's chosen ladder back into
  // the (in-memory) demo roster, which rebuilds ladderless on every page load —
  // otherwise the dashboard reads a ladderless record and shows 0 / —.
  useEffect(() => {
    if (!kid) return
    if (!getKid(kid.id)) { setKid(null); save(KID_KEY, null); return }
    if (kid.ladder) setKidLadder(kid.id, kid.ladder)
  }, [kid])

  const loginKid = useCallback((serial, dob) => {
    const found = verifyKid(serial, dob)
    if (!found) throw new Error('No soldier matches that serial number and date of birth.')
    setKid(found)
    save(KID_KEY, found)
    return found
  }, [])

  const loginAdmin = useCallback((username, password) => {
    const found = verifyAdmin(username, password)
    if (!found) throw new Error('That username or password is not correct.')
    setAdmin(found)
    save(ADMIN_KEY, found)
    return found
  }, [])

  const changeLadder = useCallback((ladder) => {
    if (!kid) return null
    const progress = setKidLadder(kid.id, ladder)
    if (!progress) return null
    const updated = { ...kid, ladder: Number(ladder) }
    setKid(updated)
    save(KID_KEY, updated)
    return progress
  }, [kid])

  const logoutKid = useCallback(() => { setKid(null); save(KID_KEY, null) }, [])
  const logoutAdmin = useCallback(() => { setAdmin(null); save(ADMIN_KEY, null) }, [])

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

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
