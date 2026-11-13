import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { Card, CrownIcon } from '@/components/ui.jsx'
import { PageHero } from './_page.jsx'
import { getKidProgress } from '@/services/api.js'
import { useLiveData } from '@/lib/useLiveData.js'
import { MEDALS, MEDAL_THRESHOLDS, legibleInk as legible } from '@/lib/medals.js'
import MedalCoin from '@/components/MedalCoin.jsx'
import { MONTH_HEB } from '@/data/ladders.js'
import { fmt } from '@/lib/format.js'

const TOTAL = MEDAL_THRESHOLDS[MEDAL_THRESHOLDS.length - 1] // Black, the top tier

// The mission sticker, straight from the legacy Mission Board: the colour GIF
// once the mission is earned, the greyscale (_bw) variant until then.
const STICKER_BASE = 'https://mashpia.com/mobile/img_new/stickers'
const SUBJECT_STICKER = 'shabbos_mevorchim_tehillim'

// The real medal "backs" the legacy board shows (the WWTC set). The file name is
// the tier colour; the DB spells Gray as "grey" for the image. Tiers with no
// back art (Bronze/Silver/Gold) fall back to the app's own coin.
const BACK_BASE = 'https://mashpia.com/mobile/reg/images/backs/wwtc'
function backName(medal) {
  const n = (medal.coin || medal.name).toLowerCase()
  return n === 'gray' ? 'grey' : n
}

// The medal face: the legacy back image (dimmed until earned, lit when active),
// or the coin fallback for tiers that have no back.
function MedalImage({ medal, lit, active, size = 72 }) {
  if (!medal.coin) return <MedalCoin medal={medal} size={size} locked={!lit} active={active} />
  return (
    <img
      src={`${BACK_BASE}/${backName(medal)}.png`}
      alt={`${medal.name} medal`}
      draggable="false"
      className="w-auto transition"
      style={{ height: size, opacity: lit ? 1 : 0.3, filter: active ? 'drop-shadow(0 0 6px var(--color-gold))' : undefined }}
    />
  )
}

// A single mission slot: numbered sticker that lights up when earned.
function Sticker({ n, earned }) {
  return (
    <div
      className="flex flex-none flex-col items-center gap-0.5"
      title={earned ? `Mission ${n} — earned` : `Mission ${n}`}
    >
      <img
        src={`${STICKER_BASE}/${SUBJECT_STICKER}${earned ? '' : '_bw'}.gif`}
        alt=""
        draggable="false"
        className={`h-9 w-9 sm:h-10 sm:w-10 ${earned ? 'animate-pop' : 'opacity-70'}`}
      />
      <span className={`font-cond text-[11px] tabular-nums ${earned ? 'text-navy' : 'text-muted'}`}>{n}</span>
    </div>
  )
}

// One level: the tier medal + every mission sticker that belongs to it, mirroring
// the legacy sticker board — a sticker strip plus a per-level status/progress.
function Level({ medal, index, missionsTotal, date }) {
  const start = index === 0 ? 1 : MEDAL_THRESHOLDS[index - 1] + 1
  const end = medal.threshold
  const reached = missionsTotal >= end
  const active = missionsTotal >= start && missionsTotal < end // the level in progress
  const lit = reached || active
  const levelCount = end - start + 1
  const earnedInLevel = Math.max(0, Math.min(missionsTotal, end) - (start - 1))
  const pct = Math.round((earnedInLevel / levelCount) * 100)
  const toGo = end - missionsTotal
  const slots = Array.from({ length: levelCount }, (_, k) => start + k)
  return (
    <div className="flex flex-col gap-4 border-t border-line py-5 sm:flex-row sm:items-start sm:gap-6">
      <div className="flex w-28 flex-none flex-col items-center gap-1 text-center">
        <MedalImage medal={medal} lit={lit} active={active} size={72} />
        <span className="font-cond text-[11px] uppercase tracking-wide text-muted">Level {index + 1}</span>
        <span className="text-[13px] font-bold" style={{ color: lit ? legible(medal.color) : 'var(--color-muted)' }}>{medal.name}</span>
        {reached ? (
          date ? (
            <span className="font-heb text-[13px] leading-tight text-navy" dir="rtl">{date}</span>
          ) : (
            <span className="font-cond text-[11px] uppercase tracking-wide text-green">Earned ✓</span>
          )
        ) : active ? (
          <span className="font-cond text-[11px] tabular-nums text-navy">{toGo} to {medal.name}</span>
        ) : (
          <span className="font-cond text-[11px] tabular-nums text-muted">{medal.threshold} missions</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2">
          {slots.map((n) => <Sticker key={n} n={n} earned={n <= missionsTotal} />)}
        </div>
        {active ? (
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-track">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${Math.max(pct, 4)}%`, background: medal.color }}
            />
          </div>
        ) : null}
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
      <PageHero eyebrow="My Medals · this year" title="Medal Board">
        One moment while your medals come up.
      </PageHero>
    )
  }

  const { missionsTotal, medal } = progress
  const medalDates = progress.medalDates || {}
  const dateFor = (m) => medalDates[(m.coin || m.name).toLowerCase()]
  const pct = Math.min(100, Math.round((missionsTotal / TOTAL) * 100))

  return (
    <>
      <PageHero eyebrow="My Medals · this year" title="Medal Board">
        Earn one Shabbos Mevorchim Tehillim mission each month — by saying Tehillim on Shabbos Mevorchim.
      </PageHero>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        {/* Status */}
        <Card className="overflow-hidden">
          <div className="hero-navy flex flex-wrap items-center gap-5 px-6 py-6">
            <MedalImage medal={medal.current || MEDALS[0]} lit={!!medal.current} active={false} size={72} />
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
                <><span className="text-green">{medal.missionsToNext}</span> Mission{medal.missionsToNext === 1 ? '' : 's'} To <span style={{ color: legible(medal.next.color) }}>{medal.next.name}</span>! <span className="font-normal text-muted">Don’t miss Shabbos Mevorchim <span className="font-heb">{MONTH_HEB[progress.current?.month] ?? progress.current?.month}</span>.</span></>
              ) : (
                <>Every medal earned — amazing! <CrownIcon className="inline-block h-4 w-auto align-text-bottom" /></>
              )}
            </p>
          </div>
        </Card>

        {/* Levels */}
        <Card className="px-5 sm:px-6">
          {MEDALS.map((m, i) => <Level key={m.index} medal={m} index={i} missionsTotal={missionsTotal} date={dateFor(m)} />)}
        </Card>
      </div>
    </>
  )
}
