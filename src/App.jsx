import { useEffect, useRef, useState } from 'react'
import { Routes, Route, useNavigate, useSearchParams } from 'react-router-dom'
import { IS_DEMO } from './lib/liveMode.js'
import { useAuth } from './context/AuthContext.jsx'
import { Button, Card, Spinner } from './components/ui.jsx'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import SchoolCampaign from './pages/SchoolCampaign.jsx'
import Ladders from './pages/Ladders.jsx'
import KidLogin from './pages/KidLogin.jsx'
import KidDashboard from './pages/KidDashboard.jsx'
import Medals from './pages/Medals.jsx'
import PerfectPlatoons from './pages/PerfectPlatoons.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import Reports from './pages/Reports.jsx'
import Resources from './pages/Resources.jsx'
import HowTo from './pages/HowTo.jsx'
import NotFound from './pages/NotFound.jsx'

// Live data is the default, so only the demo needs keeping in the URL: a reload
// or a shared link from a demo session should stay in the demo.
function KeepDemoQuery() {
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    if (IS_DEMO && params.get('demo') !== '1') {
      const next = new URLSearchParams(params)
      next.delete('real')
      next.set('demo', '1')
      setParams(next, { replace: true })
    }
  }, [params, setParams])
  return null
}

/**
 * One-tap sign-in from the parent site (mobile/reg/parent_detail.html): it
 * sends the parent here with ?handoff=<code>, we trade the code for the
 * child's session, and the code leaves the URL with the redirect to /me.
 */
function HandoffGate({ children }) {
  const [params] = useSearchParams()
  const { loginKidWithHandoff } = useAuth()
  const navigate = useNavigate()
  const code = params.get('handoff')
  const [error, setError] = useState('')
  // One exchange per code. Reset on cleanup so React's development remount
  // still finishes the sign-in instead of leaving the spinner up.
  const claimed = useRef(null)

  useEffect(() => {
    if (!code || claimed.current === code) return
    claimed.current = code
    let cancelled = false
    setError('')
    loginKidWithHandoff(code)
      .then((kid) => {
        if (cancelled) return
        if (kid) navigate('/me', { replace: true })
        else setError('This sign-in link has expired. Please tap the button again on the parent site.')
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'We could not sign this soldier in.')
      })
    return () => {
      cancelled = true
      if (claimed.current === code) claimed.current = null
    }
  }, [code, loginKidWithHandoff, navigate])

  if (code && !error) {
    return <div className="mx-auto max-w-md px-4 py-16"><Spinner label="Signing in…" /></div>
  }
  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Card className="p-6 text-center">
          <p className="text-sm text-muted">{error}</p>
          <Button to="/login" variant="navy" className="mt-4">Log in with a serial number</Button>
        </Card>
      </div>
    )
  }
  return children
}

export default function App() {
  return (
    <Layout>
      <KeepDemoQuery />
      <HandoffGate>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/s/:schoolId" element={<SchoolCampaign />} />
        <Route path="/login" element={<KidLogin />} />
        <Route path="/ladders" element={<Ladders />} />
        <Route path="/me" element={<KidDashboard />} />
        <Route path="/medals" element={<Medals />} />
        <Route path="/perfect-platoons" element={<PerfectPlatoons />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/how-to" element={<HowTo />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </HandoffGate>
    </Layout>
  )
}
