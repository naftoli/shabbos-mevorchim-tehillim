import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { PageHero } from './_page.jsx'
import LadderCarousel from '@/components/LadderCarousel.jsx'

export default function Ladders() {
  const { kid, changeLadder } = useAuth()
  const navigate = useNavigate()
  const [notice, setNotice] = useState('')

  if (!kid) return <Navigate to="/login" replace />

  async function pick(L) {
    setNotice('')
    const { error } = await changeLadder(L)
    if (error) { setNotice(error); return }
    navigate('/me', { replace: true })
  }

  return (
    <>
      <PageHero eyebrow="Choose Your Ladder" title="Pick Your Ladder">
        Each ladder is a different pace to finishing the whole Sefer Tehillim. Slide through them and
        see how far you’ll get by each grade, then pick the one for you.
      </PageHero>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {notice ? <p className="mb-5 rounded-2xl border border-navy/15 bg-navy/5 p-4 text-center text-sm font-semibold text-navy">{notice}</p> : null}
        <LadderCarousel grade={kid.grade} defaultLadder={kid.ladder ?? 8} onPick={pick} />
        <p className="mt-6 text-center text-sm text-muted">You can change your ladder later from your dashboard.</p>
      </div>
    </>
  )
}
