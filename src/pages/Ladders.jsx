import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { PageHero } from './_page.jsx'
import LadderCarousel from '@/components/LadderCarousel.jsx'

export default function Ladders() {
  const { kid, changeLadder } = useAuth()
  const navigate = useNavigate()

  if (!kid) return <Navigate to="/login" replace />

  function pick(L) {
    changeLadder(L)
    navigate('/me', { replace: true })
  }

  return (
    <>
      <PageHero eyebrow="Choose Your Ladder" title="Pick Your Ladder">
        Each ladder is a different pace to finishing the whole Sefer Tehillim. Slide through them and
        see how far you’ll get by each grade, then pick the one for you.
      </PageHero>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <LadderCarousel grade={kid.grade} defaultLadder={kid.ladder ?? 8} onPick={pick} />
        <p className="mt-6 text-center text-sm text-muted">You can change your ladder later from your dashboard.</p>
      </div>
    </>
  )
}
