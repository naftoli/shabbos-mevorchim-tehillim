import { Link } from 'react-router-dom'
import { MEDALS } from '@/lib/medals.js'
import { Card } from './ui.jsx'
import { fmt } from '@/lib/format.js'
import { asset } from '@/lib/asset.js'

// One medal in the strip: an earned tier shows its colour + number; a locked
// tier is a flat grey coin. Mirrors the Mashpia medal board's medal row.
function StripMedal({ medal, earned, current }) {
  return (
    <span
      className="relative grid h-11 w-11 flex-none place-items-center rounded-full font-cond text-[13px] font-bold tabular-nums sm:h-12 sm:w-12 sm:text-[14px]"
      style={
        earned
          ? {
              background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,.55), rgba(255,255,255,0) 58%), ${medal.color}`,
              color: medal.ink,
              boxShadow: current ? '0 0 0 3px var(--color-gold), 0 1px 3px rgba(0,0,0,.25)' : '0 1px 3px rgba(0,0,0,.25)',
            }
          : { background: '#c7ccd6', color: '#7e8795' }
      }
      title={`${medal.name} — ${medal.threshold} missions${earned ? ' · earned' : ''}`}
    >
      {medal.threshold}
    </span>
  )
}

// Compact medal board on the dashboard — tap to open the full levels page.
export default function MedalBoard({ progress }) {
  const { medal, missionsTotal } = progress
  const earnedCount = medal.earnedCount
  const next = medal.next
  const pct = Math.max(2, Math.round((missionsTotal / 110) * 100))

  return (
    <Link to="/medals" className="block">
      <Card className="p-5 transition hover:shadow-hover sm:p-6">
        {/* Header: current medal + count, with the "don't miss" nudge top-right */}
        <div className="flex flex-wrap items-start gap-4">
          <img src={asset('design/medal-gold.png')} alt="" aria-hidden="true" draggable="false" className="h-14 w-auto flex-none drop-shadow sm:h-16" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-2xl font-black leading-none text-navy">Tehillim</h3>
            <p className="mt-1.5 text-sm text-muted">
              <span className="font-display text-xl font-black text-navy">{fmt(missionsTotal)}</span> monthly mission{missionsTotal === 1 ? '' : 's'} earned
            </p>
          </div>
          {next ? (
            <div className="w-full rounded-xl bg-[#4358a2] px-3.5 py-2 text-center text-[13px] font-semibold leading-snug text-white sm:w-auto sm:max-w-[230px]">
              Don’t miss a month to earn your <span className="font-bold text-gold">{next.name}</span> medal!
            </div>
          ) : null}
        </div>

        {/* Medal strip */}
        <div className="mt-5 flex flex-wrap items-center gap-2 sm:justify-between">
          {MEDALS.map((m) => (
            <StripMedal key={m.index} medal={m} earned={m.index < earnedCount} current={medal.current?.index === m.index} />
          ))}
        </div>

        {/* Progress bar — grey track, next-medal fill, centred label */}
        <div className="relative mt-4 h-6 w-full overflow-hidden rounded-full" style={{ background: '#c5cbd9' }}>
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${pct}%`, background: next ? next.color : 'var(--color-green)' }}
          />
          <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] font-bold uppercase tracking-wide text-white">
            {next ? <>{medal.missionsToNext} Mission{medal.missionsToNext === 1 ? '' : 's'} To {next.name}!</> : <>Campaign complete! 👑</>}
          </span>
        </div>
      </Card>
    </Link>
  )
}
