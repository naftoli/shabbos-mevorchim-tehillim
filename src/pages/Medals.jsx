import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { Card } from '@/components/ui.jsx'
import { PageHero } from './_page.jsx'
import { getKidProgress, CAMPAIGN_YEAR, CURRENT_MONTH } from '@/services/api.js'
import { useLiveData } from '@/lib/useLiveData.js'
import { MEDALS, MEDAL_THRESHOLDS, legibleInk as legible } from '@/lib/medals.js'
import { MONTH_HEB } from '@/data/ladders.js'
import { fmt } from '@/lib/format.js'
import { asset } from '@/lib/asset.js'

const TOTAL = MEDAL_THRESHOLDS[MEDAL_THRESHOLDS.length - 1] // 110

// A single mission coin: gold once earned, a grey slot until then.
function Coin({ n, earned }) {
  return (
    <span
      className={`grid h-9 w-9 flex-none place-items-center rounded-full text-[12px] font-bold tabular-nums ${earned ? 'text-navy ring-1 ring-black/5' : 'text-muted'}`}
      style={{ background: earned ? 'linear-gradient(150deg, #ffe49a 0%, var(--color-gold) 70%)' : 'var(--color-track)' }}
      title={earned ? `Mission ${n} — earned` : `Mission ${n}`}
    >
      {n}
    </span>
  )
}

// One level: the tier medal + every mission coin that belongs to it.
function Level({ medal, index, missionsTotal }) {
  const start = index === 0 ? 1 : MEDAL_THRESHOLDS[index - 1] + 1
  const end = medal.threshold
  const reached = missionsTotal >= end
  const active = missionsTotal >= start && missionsTotal < end // the level in progress
  const lit = reached || active
  const coins = Array.from({ length: end - start + 1 }, (_, k) => start + k)
  return (
    <div className="flex flex-col gap-4 border-t border-line py-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex w-28 flex-none flex-col items-center gap-1 text-center">
        <span
          className={`grid h-16 w-16 place-items-center rounded-full font-cond text-2xl font-black shadow-sm ring-2 ${lit ? '' : 'opacity-30 grayscale'} ${active ? 'ring-gold' : 'ring-black/10'}`}
          style={{ background: medal.color, color: medal.ink }}
        >
          {medal.threshold}
        </span>
        <span className="font-cond text-[11px] uppercase tracking-wide text-muted">Level {index + 1}</span>
        <span className="text-[13px] font-bold" style={{ color: lit ? legible(medal.color) : 'var(--color-muted)' }}>{medal.name}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {coins.map((n) => <Coin key={n} n={n} earned={n <= missionsTotal} />)}
      </div>
    </div>
  )
}

export default function Medals() {
  const { kid } = useAuth()
  const { data: progress } = useLiveData(() => (kid ? getKidProgress(kid.id) : Promise.resolve(null)), [kid])
  if (!kid) return <Navigate to="/login" replace />
  if (!progress) {
    return (
      <PageHero eyebrow={`My Medals · ${CAMPAIGN_YEAR}`} title="Loading…">
        One moment…
      </PageHero>
    )
  }

  const { missionsTotal, medal } = progress
  const pct = Math.min(100, Math.round((missionsTotal / TOTAL) * 100))

  return (
    <>
      <PageHero eyebrow={`My Medals · ${CAMPAIGN_YEAR}`} title="Medal Board">
        Earn one Shabbos Mevorchim Tehillim mission each month — by saying Tehillim on Shabbos Mevorchim.
      </PageHero>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        {/* Status */}
        <Card className="overflow-hidden">
          <div className="hero-navy flex flex-wrap items-center gap-5 px-6 py-6">
            <img src={asset('design/medal-gold.png')} alt="" aria-hidden="true" draggable="false" className="h-16 w-auto drop-shadow" />
            <div className="min-w-0 flex-1">
              <p className="font-cond text-sm uppercase tracking-wide text-gold">Tehillim Missions</p>
              <p className="font-display text-3xl font-black leading-none text-white">
                {fmt(missionsTotal)} <span className="text-white/60">/ {TOTAL}</span>
              </p>
              <p className="mt-1 text-sm text-white/80">
                {medal.current ? (
                  <>Current medal: <span className="font-bold text-gold">{medal.current.name}</span></>
                ) : (
                  <>No medal yet — your first is {medal.next?.name} at {medal.next?.threshold}.</>
                )}
              </p>
            </div>
          </div>
          <div className="p-5 sm:p-6">
            <div className="h-5 w-full overflow-hidden rounded-full bg-track">
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(pct, 2)}%`, background: 'var(--grad-progress)' }} />
            </div>
            <p className="mt-3 text-center text-sm font-semibold text-navy">
              {medal.next ? (
                <><span className="text-green">{medal.missionsToNext}</span> Mission{medal.missionsToNext === 1 ? '' : 's'} To <span style={{ color: legible(medal.next.color) }}>{medal.next.name}</span>! <span className="font-normal text-muted">Don’t miss Shabbos Mevorchim <span className="font-heb">{MONTH_HEB[CURRENT_MONTH]}</span>.</span></>
              ) : (
                <>Every medal earned — amazing! 👑</>
              )}
            </p>
          </div>
        </Card>

        {/* Levels */}
        <Card className="px-5 sm:px-6">
          {MEDALS.map((m, i) => <Level key={m.index} medal={m} index={i} missionsTotal={missionsTotal} />)}
        </Card>
      </div>
    </>
  )
}
