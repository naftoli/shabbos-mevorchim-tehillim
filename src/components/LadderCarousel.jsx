import { useMemo, useState } from 'react'
import { availableLadders, finishGrade, GRADE_LABEL, QUOTA } from '@/data/ladders.js'
import LadderBreakdown from './LadderBreakdown.jsx'

// Kapitel reached by the END of each grade (Elul), for the whole ladder —
// always from Pre-1A up to the grade the child finishes the whole Tehillim.
function ladderJourney(ladder) {
  const rows = []
  const grades = ['pre1a']
  for (let g = 1; g <= finishGrade(ladder); g++) grades.push(String(g))
  for (const key of grades) {
    const cell = QUOTA[key]?.Elul?.[ladder]
    if (!cell) continue
    rows.push({ gradeLabel: GRADE_LABEL[key], k: cell.k, v: cell.v, finish: cell.v >= 150 })
  }
  return rows
}

const ACCENTS = ['#2a5fb8', '#0e8aa6', '#1f7a4d', '#c77d0e', '#8b5cf6', '#e11d48', '#0ea5e9', '#17356f']

function Chevron({ dir }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {dir === 'left' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  )
}

function LadderCard({ ladder, active, onPick, onBreakdown, preview, height }) {
  const rows = useMemo(() => ladderJourney(ladder), [ladder])
  const accent = ACCENTS[(ladder - 1) % ACCENTS.length]
  const clickable = preview && active
  return (
    <div
      onClick={clickable ? () => onPick(ladder) : undefined}
      className={`flex w-full flex-col overflow-hidden rounded-[26px] bg-card ring-1 ring-line transition-shadow ${active ? 'shadow-hover' : 'shadow-card'} ${clickable ? 'cursor-pointer' : ''}`}
      style={{ height }}
    >
      <div className="hero-navy relative px-5 pb-5 pt-5 text-center">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 300 110" aria-hidden="true">
          <g fill="#fff"><circle cx="30" cy="22" r="2" opacity=".5" /><circle cx="268" cy="30" r="2.5" opacity=".5" /><circle cx="250" cy="74" r="1.8" opacity=".4" /></g>
          <path d="M255 14l1.8 4.3 4.2.4-3.3 3 1 4.3-3.7-2.4-3.7 2.4 1-4.3-3.3-3 4.2-.4z" fill="#ffd54a" opacity=".7" />
        </svg>
        <div className="relative flex items-center justify-center gap-3">
          <svg width="26" height="38" viewBox="0 0 26 38" aria-hidden="true">
            <g stroke="#ffd54a" strokeWidth="3" strokeLinecap="round"><line x1="7" y1="36" x2="7" y2="3" /><line x1="19" y1="36" x2="19" y2="3" /><line x1="7" y1="28" x2="19" y2="28" /><line x1="7" y1="20" x2="19" y2="20" /><line x1="7" y1="12" x2="19" y2="12" /></g>
          </svg>
          <div className="font-cond text-[40px] uppercase leading-none tracking-[0.03em] text-white">Ladder {ladder}</div>
        </div>
        <div className="relative mt-1.5 inline-block rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold text-gold">
          Finish by {GRADE_LABEL[String(finishGrade(ladder))]} grade
        </div>
      </div>
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${accent}, var(--color-gold))` }} />

      <div className={`${preview ? 'no-scrollbar ' : ''}min-h-0 flex-1 overflow-y-auto px-4 py-3`}>
        <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">You’ll say up to…</p>
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.gradeLabel} className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${r.finish ? 'bg-gold/25 font-bold text-navy ring-1 ring-gold/60' : 'odd:bg-track/50'}`}>
              <span className="font-semibold text-navy">{r.gradeLabel}</span>
              <span className="flex items-center gap-2">
                <span className="font-heb text-[17px] text-navy">{r.k}</span>
                <span className="text-muted">{r.finish ? '👑 150' : `(${r.v})`}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {preview ? (
        <div className="px-4 pb-4 pt-1 text-center">
          <span className="font-cond text-[17px] uppercase tracking-[0.04em] text-blue">Tap to choose your ladder →</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-4">
          <button className="btn btn-o w-full !py-2 !text-[15px]" onClick={() => onBreakdown(ladder)} tabIndex={active ? 0 : -1}>See full breakdown</button>
          <button className="btn btn-gold w-full !py-3 !text-[18px]" onClick={() => onPick(ladder)} tabIndex={active ? 0 : -1}>Pick this ladder</button>
        </div>
      )}
    </div>
  )
}

export default function LadderCarousel({ grade, defaultLadder = 8, onPick, preview = false, height = 470, cardWidth = 300, spacing = 255 }) {
  const ladders = useMemo(() => availableLadders(grade), [grade])
  const preferred = ladders.indexOf(defaultLadder)
  const [active, setActive] = useState(preferred >= 0 ? preferred : Math.floor(ladders.length / 2))
  const [breakdown, setBreakdown] = useState(null)
  const go = (d) => setActive((i) => Math.min(ladders.length - 1, Math.max(0, i + d)))

  return (
    <div>
      <div
        className={`relative mx-auto ${preview ? 'cursor-pointer' : ''}`}
        style={{ height, maxWidth: cardWidth + spacing + 60 }}
        onClick={preview ? () => onPick?.() : undefined}
        role={preview ? 'button' : undefined}
        aria-label={preview ? 'Open ladder selection' : undefined}
      >
        {ladders.map((L, i) => {
          const off = i - active
          if (Math.abs(off) > 1) return null
          const center = off === 0
          return (
            <div
              key={L}
              className="absolute left-1/2 top-0 transition-all duration-300 ease-out"
              style={{
                width: cardWidth,
                height,
                transform: `translateX(calc(-50% + ${off * spacing}px)) scale(${center ? 1 : 0.84})`,
                opacity: center ? 1 : 0.5,
                zIndex: center ? 20 : 10,
                // Static picture in preview: clicks fall through to the container.
                pointerEvents: preview ? 'none' : center ? 'auto' : 'none',
              }}
            >
              <LadderCard ladder={L} active={center} onPick={onPick} onBreakdown={setBreakdown} preview={preview} height={height} />
            </div>
          )
        })}

        {/* arrows only when interactive (not in the static preview) */}
        {!preview ? (
          <>
            <button onClick={() => go(-1)} disabled={active === 0} aria-label="Previous ladder"
              className="absolute left-0 top-1/2 z-30 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-card text-navy shadow-card ring-1 ring-line transition hover:bg-track disabled:opacity-30">
              <Chevron dir="left" />
            </button>
            <button onClick={() => go(1)} disabled={active === ladders.length - 1} aria-label="Next ladder"
              className="absolute right-0 top-1/2 z-30 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-card text-navy shadow-card ring-1 ring-line transition hover:bg-track disabled:opacity-30">
              <Chevron dir="right" />
            </button>
          </>
        ) : null}
      </div>

      {!preview ? (
        <div className="mt-5 flex justify-center gap-2">
          {ladders.map((L, i) => (
            <button key={L} onClick={() => setActive(i)} aria-label={`Ladder ${L}`}
              className={`h-2.5 rounded-full transition-all ${i === active ? 'w-6 bg-navy' : 'w-2.5 bg-line'}`} />
          ))}
        </div>
      ) : null}

      {breakdown != null ? <LadderBreakdown ladder={breakdown} onClose={() => setBreakdown(null)} /> : null}
    </div>
  )
}
