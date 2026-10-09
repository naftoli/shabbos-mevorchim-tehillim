import { QUOTA, MONTHS, GRADE_LABEL, finishGrade, toHebrewNumeral } from '@/data/ladders.js'

// The whole-Tehillim climb: every Shabbos Mevorchim a child says kapitel א up to
// their cumulative target, so their position on the climb to 150 is simply that
// kapitel number. This is the lifetime goal the ladder is pacing — the hero of
// the dashboard. `reached` is how far they've actually climbed (furthest month
// they completed); `target` is where this month's rung takes them. The marks
// are where THIS ladder finishes each grade (Elul), labeled in Aleph-Beis.

const TOTAL = 150
const LAST_MONTH = MONTHS[MONTHS.length - 1] // Elul — the end of each grade's year

function gradeMarks(ladder) {
  const grades = ['pre1a']
  for (let g = 1; g <= finishGrade(ladder); g++) grades.push(String(g))
  return grades
    .map((g) => {
      const cell = QUOTA[g]?.[LAST_MONTH]?.[ladder]
      return cell ? { grade: g, v: cell.v, heb: toHebrewNumeral(cell.v) } : null
    })
    .filter(Boolean)
}

export default function ClimbMeter({ reached = 0, target = 0, ladder, finishGradeLabel }) {
  const r = Math.max(0, Math.min(TOTAL, reached))
  const t = Math.max(0, Math.min(TOTAL, target))
  const pct = (n) => (n / TOTAL) * 100
  const done = r >= TOTAL
  const climbingTo = t > r ? t : null
  // Place each grade-finish mark, stacking labels onto higher rows when they sit
  // too close together (high ladders finish the early grades near kapitel 0), so
  // nothing overlaps.
  const MIN_GAP = 6 // percent of the bar
  const ROW = 1.45 // rem per stacked row
  const BASE_TOP = 1.65 // rem below the track
  let _prev = -Infinity
  let _level = 0
  const placed = (ladder ? gradeMarks(ladder) : []).map((m) => {
    const pos = pct(m.v)
    _level = pos - _prev < MIN_GAP ? (_level + 1) % 3 : 0
    _prev = pos
    return { ...m, pos, top: BASE_TOP + _level * ROW }
  })

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
      <div className="relative mt-7 mb-20 h-6">
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

        {/* A tick where this ladder finishes each grade: divider + Aleph-Beis
            kapitel + grade, stacked onto rows so nothing overlaps. */}
        {placed.map((m) => {
          const finish = m.v >= TOTAL
          const left = `${m.pos}%`
          return (
            <span key={m.grade}>
              <span className="absolute top-0 w-px bg-white/70" style={{ left, height: `${m.top - 0.15}rem` }} aria-hidden="true" />
              <span
                className="absolute flex -translate-x-1/2 flex-col items-center leading-tight"
                style={{ left, top: `${m.top}rem` }}
              >
                <span className={`font-heb text-[12px] font-bold ${finish ? 'text-gold' : 'text-navy'}`}>
                  {finish ? '👑' : m.heb}
                </span>
                <span className="text-[8.5px] font-semibold uppercase tracking-wide text-muted">{GRADE_LABEL[m.grade]}</span>
              </span>
            </span>
          )
        })}

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
