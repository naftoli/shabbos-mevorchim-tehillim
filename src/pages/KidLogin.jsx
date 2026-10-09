import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { Band, Button, Card, Field, Input } from '@/components/ui.jsx'
import { IS_DEMO } from '@/lib/liveMode.js'
import { demoKidCredentials } from '@/services/api.js'

// Auto-format typed digits as MM/DD/YYYY so the numeric keypad can be used
// (type="date" opens a date-picker instead of the keyboard).
function formatDob(raw) {
  const d = String(raw).replace(/\D/g, '').slice(0, 8)
  let out = d.slice(0, 2)
  if (d.length >= 3) out += '/' + d.slice(2, 4)
  if (d.length >= 5) out += '/' + d.slice(4, 8)
  return out
}
// MM/DD/YYYY -> YYYY-MM-DD (the stored/compared format). '' if incomplete/invalid.
function toISO(display) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display)
  if (!m) return ''
  const [, mm, dd, yyyy] = m
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return ''
  return `${yyyy}-${mm}-${dd}`
}
const isoToDisplay = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  return m ? `${m[2]}/${m[3]}/${m[1]}` : ''
}

export default function KidLogin() {
  const { kid, loginKid } = useAuth()
  const navigate = useNavigate()
  const [serial, setSerial] = useState('')
  const [dob, setDob] = useState('')
  const [error, setError] = useState('')

  if (kid) return <Navigate to="/me" replace />

  function submit(e) {
    e.preventDefault()
    setError('')
    const iso = toISO(dob)
    if (!iso) {
      setError('Enter your date of birth as MM/DD/YYYY.')
      return
    }
    try {
      loginKid(serial, iso)
      navigate('/me', { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  const demo = IS_DEMO ? demoKidCredentials() : null

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <Card>
        <Band />
        <form onSubmit={submit} className="p-6 sm:p-8">
          <h1 className="font-display text-2xl font-black text-navy">Soldier Sign In</h1>
          <p className="mt-1 text-sm text-muted">
            Sign in with your serial number and date of birth to record your Tehillim.
          </p>

          <div className="mt-6 space-y-4">
            <Field label="Serial number">
              <Input
                inputMode="numeric"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="e.g. 100001"
                autoFocus
              />
            </Field>
            <Field label="Date of birth" hint="Type the date — MM/DD/YYYY">
              <Input
                type="text"
                inputMode="numeric"
                value={dob}
                onChange={(e) => setDob(formatDob(e.target.value))}
                placeholder="MM/DD/YYYY"
                maxLength={10}
              />
            </Field>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl bg-race-red/12 px-3 py-2 text-sm font-semibold text-red ring-1 ring-race-red/40">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="navy" className="mt-6 w-full">Sign In</Button>

          {demo ? (
            <button
              type="button"
              onClick={() => { setSerial(demo.serial); setDob(isoToDisplay(demo.dob)) }}
              className="mt-4 w-full rounded-xl border border-dashed border-line bg-track/40 px-3 py-2 text-xs text-muted hover:bg-track"
            >
              Demo soldier — tap to fill: serial {demo.serial} · DOB {isoToDisplay(demo.dob)}
            </button>
          ) : null}
        </form>
      </Card>
    </div>
  )
}
