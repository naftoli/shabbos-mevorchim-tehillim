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
  // Place each grade-finish mark. High ladders finish the early grades bunched
  // near kapitel 0, so instead of stacking every label below the track we spread
  // them onto BOTH sides — some above, some below — and only stack when a side is
  // still crowded. Each mark takes whichever side keeps it on the lowest row.
  const MIN_GAP = 7 // percent of the bar two labels need between them on a row
  const ROW = 1.4 // rem per stacked row
  const ABOVE_BASE = 0.55 // rem above the track to the first row
  const BELOW_BASE = 1.65 // rem below the track to the first row
  const sides = { above: [], below: [] } // last position used on each row per side
  const laneFor = (rows, pos) => {
    const i = rows.findIndex((last) => pos - last >= MIN_GAP)
    return i === -1 ? rows.length : i
  }
  const placed = (ladder ? gradeMarks(ladder) : []).map((m, idx) => {
    const pos = pct(m.v)
    const lb = laneFor(sides.below, pos)
    const la = laneFor(sides.above, pos)
    // Lower row wins; on a tie, alternate sides to keep them balanced.
    const side = lb !== la ? (lb < la ? 'below' : 'above') : idx % 2 === 0 ? 'below' : 'above'
    const rows = sides[side]
    const lane = laneFor(rows, pos)
    if (lane === rows.length) rows.push(pos); else rows[lane] = pos
    return { ...m, pos, side, offset: (side === 'above' ? ABOVE_BASE : BELOW_BASE) + lane * ROW }
  })
  // Reserve enough room on each side for its deepest label row.
  const topSpace = `${sides.above.length ? ABOVE_BASE + sides.above.length * ROW + 1.1 : 1.3}rem`
  const bottomSpace = `${sides.below.length ? BELOW_BASE + sides.below.length * ROW + 0.4 : 0.6}rem`

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
      <div className="relative h-6" style={{ marginTop: topSpace, marginBottom: bottomSpace }}>
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
            kapitel + grade. Marks sit above or below the track so the bunched
            early grades don't pile up on one side. */}
        {placed.map((m) => {
          const finish = m.v >= TOTAL
          const left = `${m.pos}%`
          const heb = (
            <span className={`font-heb text-[12px] font-bold ${finish ? 'text-gold' : 'text-navy'}`}>{finish ? '👑' : m.heb}</span>
          )
          const grade = <span className="text-[8.5px] font-semibold uppercase tracking-wide text-muted">{GRADE_LABEL[m.grade]}</span>
          if (m.side === 'above') {
            return (
              <span key={m.grade}>
                <span className="absolute w-px bg-white/70" style={{ left, bottom: '100%', height: `${m.offset - 0.15}rem` }} aria-hidden="true" />
                <span className="absolute flex -translate-x-1/2 flex-col items-center leading-tight" style={{ left, bottom: `calc(100% + ${m.offset}rem)` }}>
                  {grade}
                  {heb}
                </span>
              </span>
            )
          }
          return (
            <span key={m.grade}>
              <span className="absolute top-0 w-px bg-white/70" style={{ left, height: `${m.offset - 0.15}rem` }} aria-hidden="true" />
              <span className="absolute flex -translate-x-1/2 flex-col items-center leading-tight" style={{ left, top: `${m.offset}rem` }}>
                {heb}
                {grade}
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
