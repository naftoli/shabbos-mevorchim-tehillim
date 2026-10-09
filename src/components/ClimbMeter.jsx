import { toHebrewNumeral } from '@/data/ladders.js'

// The whole-Tehillim climb: every Shabbos Mevorchim a child says kapitel א up to
// their cumulative target, so their position on the climb to 150 is simply that
// kapitel number. This is the lifetime goal the ladder is pacing — the hero of
// the dashboard. `reached` is how far they've actually climbed (furthest month
// they completed); `target` is where this month's rung takes them.

// The five Sefarim of Tehillim — milestones on the way up.
const BOOKS = [
  { end: 41, label: 'א' },
  { end: 72, label: 'ב' },
  { end: 89, label: 'ג' },
  { end: 106, label: 'ד' },
  { end: 150, label: 'ה' },
]
const TOTAL = 150

export default function ClimbMeter({ reached = 0, target = 0, finishGradeLabel }) {
  const r = Math.max(0, Math.min(TOTAL, reached))
  const t = Math.max(0, Math.min(TOTAL, target))
  const pct = (n) => (n / TOTAL) * 100
  const done = r >= TOTAL
  const climbingTo = t > r ? t : null

  return (
    <div className="rounded-2xl bg-paper/70 p-5 sm:p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="sh">Your climb to the whole Tehillim</p>
          <p className="mt-1 font-display text-2xl font-black leading-none text-navy">
            {done ? (
              <>You finished all 150! 👑</>
            ) : r > 0 ? (
              <>
                Kapitel <span className="font-heb text-green">{toHebrewNumeral(r)}</span>
                <span className="text-muted"> of 150</span>
              </>
            ) : (
              <>Ready to start climbing!</>
            )}
          </p>
        </div>
        <div className="text-right">
          <div className="font-cond text-3xl leading-none text-green">{Math.round(pct(r))}%</div>
          {finishGradeLabel ? <div className="text-xs text-muted">finish by {finishGradeLabel} grade</div> : null}
        </div>
      </div>

      {/* The climb track */}
      <div className="relative mt-6 mb-7 h-6">
        <div className="absolute inset-0 overflow-hidden rounded-full bg-track">
          {/* ghost fill to this month's target */}
          {climbingTo ? (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gold/25 transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(pct(t), 2)}%` }}
            />
          ) : null}
          {/* actual climbed fill */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out"
            style={{ width: `${Math.max(pct(r), r > 0 ? 2.5 : 0)}%`, background: 'var(--grad-progress)' }}
          />
        </div>

        {/* Sefarim dividers + numbers */}
        {BOOKS.slice(0, -1).map((b) => (
          <span key={b.end} className="absolute top-0 h-6 w-px bg-white/70" style={{ left: `${pct(b.end)}%` }} aria-hidden="true" />
        ))}
        {BOOKS.map((b) => (
          <span key={`n${b.end}`} className="absolute -bottom-6 -translate-x-1/2 text-[11px] font-semibold text-muted" style={{ left: `${pct(b.end)}%` }}>
            {b.end}
          </span>
        ))}

        {/* climber marker at reached */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-[18px] -translate-x-1/2 select-none text-2xl transition-[left] duration-1000 ease-out"
          style={{ left: `${pct(r)}%`, filter: 'drop-shadow(0 4px 6px rgba(15,35,80,.25))' }}
        >
          {done ? '👑' : '🧗'}
        </span>
      </div>

      <p className="text-center text-sm text-muted">
        {done ? (
          <>You climbed the whole Sefer Tehillim — the top of the ladder! 🎉</>
        ) : climbingTo ? (
          <>
            Say your kapitlach this Shabbos Mevorchim to climb to{' '}
            <span className="font-heb font-semibold text-navy">{toHebrewNumeral(t)}</span>.
          </>
        ) : (
          <>You’re right on pace — keep climbing!</>
        )}
      </p>
    </div>
  )
}
