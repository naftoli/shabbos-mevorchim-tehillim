import { useEffect } from 'react'
import { Routes, Route, useSearchParams } from 'react-router-dom'
import { IS_DEMO } from './lib/liveMode.js'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import SchoolCampaign from './pages/SchoolCampaign.jsx'
import Ladders from './pages/Ladders.jsx'
import KidLogin from './pages/KidLogin.jsx'
import KidDashboard from './pages/KidDashboard.jsx'
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

export default function App() {
  return (
    <Layout>
      <KeepDemoQuery />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/s/:schoolId" element={<SchoolCampaign />} />
        <Route path="/login" element={<KidLogin />} />
        <Route path="/ladders" element={<Ladders />} />
        <Route path="/me" element={<KidDashboard />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/how-to" element={<HowTo />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}
