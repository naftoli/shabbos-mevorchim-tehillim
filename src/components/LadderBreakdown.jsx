import { useEffect } from 'react'
import { GRADE_LABEL, finishGrade } from '@/data/ladders.js'
import LadderBreakdownTable from './LadderBreakdownTable.jsx'

// Full month-by-month plan for a ladder, every grade from Pre-1A to the finish
// grade. Each cell is the cumulative kapitel (Aleph-Beis) + minutes.
export default function LadderBreakdown({ ladder, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-navy/75 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Ladder ${ladder} full breakdown`}>
      <div className="animate-pop my-auto w-full max-w-3xl overflow-hidden rounded-[26px] bg-paper shadow-hover" onClick={(e) => e.stopPropagation()}>
        <div className="hero-navy flex items-center justify-between px-5 py-4">
          <div>
            <h3 className="font-cond text-2xl uppercase tracking-[0.03em] text-white">Ladder {ladder} · Full Breakdown</h3>
            <p className="text-sm text-gold">Kapitel reached each Shabbos Mevorchim · finish by {GRADE_LABEL[String(finishGrade(ladder))]} grade</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white transition hover:bg-white/35">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto p-4">
          <LadderBreakdownTable ladder={ladder} />
          <p className="mt-3 text-center text-xs text-muted">Each cell shows the kapitel you say up to (from kapitel א) and the minutes. 👑 = the whole Tehillim (קנ).</p>
        </div>
      </div>
    </div>
  )
}
