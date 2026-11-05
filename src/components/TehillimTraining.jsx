import { useEffect, useRef, useState } from 'react'
import { Card } from './ui.jsx'
import { asset } from '@/lib/asset.js'
import { buildTraining } from '@/lib/trainingBoard.js'
import { emitCue } from '@/lib/commanderBus.js'
import { TRACK_SCRIPT } from '@/lib/commanderScripts.js'

export default function TehillimTraining({ grade, ladder, months, priorMissions = 0, missionsTotal, missionHistory }) {
  const board = buildTraining({ grade, ladder, months, priorMissions, history: missionHistory })
  const current = String(grade)
  const [open, setOpen] = useState(() => new Set([current]))
  const rootRef = useRef(null)
  useEffect(() => {
    const node = rootRef.current
    if (!node || typeof IntersectionObserver !== 'function') {
      window.dispatchEvent(new CustomEvent('wwtc-training-open'))
      return undefined
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      window.dispatchEvent(new CustomEvent('wwtc-training-open'))
      observer.disconnect()
    }, { threshold: 0.35 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const allOpen = board.boards.every((b) => open.has(b.grade))
  // Lifetime missions earned (matches the medal board). The grid only draws checks
  // for occasions we hold records for (this year), so the headline/bar use the
  // lifetime total while earlier earned missions are summarized in the note below.
  const earned = Number.isFinite(missionsTotal) ? missionsTotal : priorMissions + board.done
  const pct = board.total ? Math.min(100, Math.round((earned / board.total) * 100)) : 0

  function toggle(g) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  return (
    <div ref={rootRef} id="tehillim-training">
    <Card className="relative overflow-hidden p-5 sm:p-6">
      <img src={asset('design/icon-soldier-hat.png')} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute -right-5 -top-4 h-28 w-auto rotate-6 opacity-[0.06]" />
      <div className="relative flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="sh">My Tehillim Training</p>
          <p className="mt-1 text-[13px] font-semibold text-muted">
            Ladder {ladder || '—'} · every Shabbos Mevorchim, plus Rosh Hashana and Yom Kippur, through the grade this ladder finishes.
          </p>
        </div>
        <div className="text-right">
          <p className="font-cond text-sm font-bold uppercase tracking-wide text-green">{earned} earned · {board.total} missions on this ladder</p>
          <button type="button" className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-navy underline sm:min-h-0" onClick={() => setOpen(allOpen ? new Set([current]) : new Set(board.boards.map((b) => b.grade)))}>
            {allOpen ? 'Close all' : 'Expand all'}
          </button>
          <button type="button" className="mt-1 block text-sm font-semibold text-blue" onClick={() => emitCue('track-replay', TRACK_SCRIPT, { force: true })}>
            Hear it again
          </button>
        </div>
      </div>
      <div className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-track">
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, earned ? 2 : 0)}%`, background: 'var(--grad-progress)' }} />
      </div>
      {priorMissions > 0 ? (
        <p className="relative mt-3 text-[13px] font-semibold text-navy/75">{priorMissions} earlier missions are on record in total. A line with no record is not a miss.</p>
      ) : (
        <p className="relative mt-3 text-[13px] font-semibold text-navy/75">A line with no record is not a miss. Only a saved report is checked off.</p>
      )}
      <div className="relative mt-4 space-y-2">
        {board.boards.map((g) => {
          const isOpen = open.has(g.grade)
          return (
            <div key={g.grade} className="rounded-2xl bg-track/50 ring-1 ring-line/70">
              <button type="button" onClick={() => toggle(g.grade)} aria-expanded={isOpen} className="flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-left sm:min-h-0 sm:px-4">
                <svg viewBox="0 0 12 12" className={`h-3 w-3 flex-none text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`} aria-hidden="true">
                  <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-display text-[13px] font-black uppercase tracking-wide text-navy">My {g.title} Missions</span>
                {g.grade === current ? <span className="rounded-full bg-gold/20 px-2 py-0.5 font-cond text-[11px] font-bold uppercase tracking-wide text-navy">You’re here</span> : null}
                <span className="ml-auto font-cond text-[12px] font-bold uppercase tracking-wide text-muted">{g.done} checked</span>
              </button>
              {isOpen ? (
                <div className="grid grid-cols-2 gap-1.5 px-4 pb-3 sm:grid-cols-4 lg:grid-cols-7">
                  {g.missions.map((m) => (
                    <span key={m.key} className={`relative flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-center ${m.met ? 'bg-green/15 text-green ring-1 ring-green/30' : m.record ? 'bg-card text-navy ring-1 ring-line' : 'bg-card text-muted ring-1 ring-dashed ring-line'}`}>
                      {m.met ? (
                        <svg viewBox="0 0 16 16" aria-hidden="true" className="absolute left-1 top-1 h-3.5 w-3.5 text-green">
                          <circle cx="8" cy="8" r="8" fill="currentColor" />
                          <path d="M4.5 8.2l2.3 2.3 4.4-4.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                      <span className="font-heb text-[13px] font-bold leading-none">{m.heb}</span>
                      <span className="text-[10px] font-semibold leading-tight">{m.minutes ? `${m.minutes} min` : '—'}{m.quotaLabel ? ` / ${m.quotaLabel}` : ''}</span>
                      <span className="text-[10px] font-bold uppercase">{m.met ? (m.ladder ? `Done (Ladder ${m.ladder})` : 'Done') : m.record ? 'Reported' : 'No record'}</span>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </Card>
    </div>
  )
}
