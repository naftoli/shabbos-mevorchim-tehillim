import { useEffect } from 'react'
import { MONTHS, MONTH_HEB, GRADE_LABEL, finishGrade, QUOTA, toHebrewNumeral } from '@/data/ladders.js'

// Full month-by-month plan for a ladder, every grade from Pre-1A to the finish
// grade. Each cell is the cumulative kapitel (Aleph-Beis) + minutes.
export default function LadderBreakdown({ ladder, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const grades = ['pre1a']
  for (let g = 1; g <= finishGrade(ladder); g++) grades.push(String(g))

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
          <table className="w-full border-separate border-spacing-0 text-center text-[13px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-paper px-2 py-2 text-left font-cond uppercase tracking-wide text-muted">Grade</th>
                {MONTHS.map((m) => (
                  <th key={m} className="font-heb px-2 py-2 text-[15px] font-bold text-navy">{MONTH_HEB[m]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => (
                <tr key={g}>
                  <td className="sticky left-0 z-10 bg-paper px-2 py-1.5 text-left font-semibold text-navy">{GRADE_LABEL[g]}</td>
                  {MONTHS.map((m) => {
                    const cell = QUOTA[g]?.[m]?.[ladder]
                    const finish = cell && cell.v >= 150
                    return (
                      <td key={m} className={`rounded px-2 py-1 leading-tight ${finish ? 'bg-gold/30 font-bold text-navy' : 'odd:bg-card/60'}`}>
                        {cell ? (
                          <>
                            <div className="font-heb text-[15px] text-navy">{finish ? '👑' : toHebrewNumeral(cell.v)}</div>
                            <div className="text-[10px] text-muted">{cell.m}m</div>
                          </>
                        ) : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-center text-xs text-muted">Each cell shows the kapitel you say up to (from kapitel א) and the minutes. 👑 = the whole Tehillim (קנ).</p>
        </div>
      </div>
    </div>
  )
}
