import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { Band, Button, Card, Field, Input } from '@/components/ui.jsx'
import { IS_DEMO } from '@/lib/liveMode.js'

export default function AdminLogin() {
  const { admin, loginAdmin } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (admin) return <Navigate to="/admin" replace />

  function submit(e) {
    e.preventDefault()
    setError('')
    try {
      loginAdmin(username, password)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <Card>
        <Band />
        <form onSubmit={submit} className="p-6 sm:p-8">
          <h1 className="font-display text-2xl font-black text-navy">Admin / HQ Sign In</h1>
          <p className="mt-1 text-sm text-muted">Teachers, school admins and HQ sign in here.</p>

          <div className="mt-6 space-y-4">
            <Field label="Username"><Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus /></Field>
            <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl bg-race-red/12 px-3 py-2 text-sm font-semibold text-red ring-1 ring-race-red/40">{error}</p>
          ) : null}

          <Button type="submit" variant="navy" className="mt-6 w-full">Sign In</Button>

          {IS_DEMO ? (
            <div className="mt-4 space-y-1 rounded-xl border border-dashed border-line bg-track/40 px-3 py-2 text-xs text-muted">
              <p className="font-semibold text-navy">Demo logins (password: tehillim)</p>
              <p>HQ: <button type="button" className="underline" onClick={() => { setUsername('hq'); setPassword('tehillim') }}>hq</button></p>
              <p>School admin: <button type="button" className="underline" onClick={() => { setUsername('cheder-menachem-sample'); setPassword('tehillim') }}>cheder-menachem-sample</button></p>
            </div>
          ) : null}
        </form>
      </Card>
    </div>
  )
}
