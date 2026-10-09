import { useState } from 'react'
import { Card, Badge } from '@/components/ui.jsx'
import {
  MONTHS,
  MONTH_HEB,
  GRADES,
  GRADE_LABEL,
  availableLadders,
  finishGrade,
  quotaFor,
} from '@/data/ladders.js'

// The ladder picker lives UNDER THE CHILD. A signed-in soldier has a known
// grade (passed in and locked); the demo/preview path lets you pick a grade.
// The child chooses a ladder and sees exactly what to say each Shabbos Mevorchim.

function LadderButton({ ladder, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left transition ${
        active
          ? 'border-transparent text-white shadow-[var(--shadow-card)]'
          : 'border-[var(--color-line)] bg-[#eef4ff] hover:bg-[var(--color-track)]'
      }`}
      style={active ? { background: 'var(--grad-pill-blue)' } : undefined}
    >
      <div className="font-cond text-lg leading-none">Ladder {ladder}</div>
      <div className={`text-xs ${active ? 'text-white/80' : 'text-muted'}`}>
        finish by {GRADE_LABEL[String(finishGrade(ladder))]} grade
      </div>
    </button>
  )
}

export default function LadderPicker({ grade: fixedGrade, ladder: initialLadder, onChoose }) {
  const [grade, setGrade] = useState(fixedGrade ?? '5')
  const ladders = availableLadders(grade)
  const [ladder, setLadder] = useState(initialLadder ?? ladders[ladders.length - 1])
  const activeLadder = ladders.includes(ladder) ? ladder : ladders[0]

  function choose(L) {
    setLadder(L)
    onChoose?.(L, grade)
  }

  return (
    <div>
      {/* Grade is fixed for a real soldier; selectable only in the demo/preview. */}
      {!fixedGrade ? (
        <div className="mb-4">
          <p className="mb-2 font-cond text-sm uppercase tracking-wide text-muted">Grade (demo)</p>
          <div className="flex flex-wrap gap-2">
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => setGrade(g)}
                className={`rounded-lg px-3 py-1.5 font-cond text-sm uppercase tracking-wide transition ${
                  g === grade
                    ? 'text-white'
                    : 'border border-[var(--color-line)] bg-[#eef4ff] text-navy hover:bg-[var(--color-track)]'
                }`}
                style={g === grade ? { background: 'var(--color-navy)' } : undefined}
              >
                {GRADE_LABEL[g]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mb-2 font-cond text-sm uppercase tracking-wide text-muted">
        Choose your ladder
      </p>
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {ladders.map((L) => (
          <LadderButton key={L} ladder={L} active={L === activeLadder} onClick={() => choose(L)} />
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
          <div>
            <h3 className="text-lg font-extrabold text-navy">
              {GRADE_LABEL[grade]} grade · Ladder {activeLadder}
            </h3>
            <p className="text-sm text-muted">
              Finishing the whole Tehillim by {GRADE_LABEL[String(finishGrade(activeLadder))]} grade
            </p>
          </div>
          <Badge>Say kapitel 1 → the number shown</Badge>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-[var(--color-track)]/60 text-muted">
              <th className="px-5 py-2 font-cond uppercase tracking-wide">Month</th>
              <th className="px-5 py-2 font-cond uppercase tracking-wide">Say (kapitlach)</th>
              <th className="px-5 py-2 text-right font-cond uppercase tracking-wide">Minutes</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((mo) => {
              const cell = quotaFor(grade, mo, activeLadder)
              return (
                <tr key={mo} className="border-t border-[var(--color-line)]">
                  <td className="px-5 py-2 font-heb font-semibold text-navy">{MONTH_HEB[mo]}</td>
                  <td className="px-5 py-2">
                    <span className="font-heb text-lg text-navy">{cell?.k ?? '—'}</span>
                    {cell ? <span className="ml-2 text-muted">({cell.v} kapitlach)</span> : null}
                  </td>
                  <td className="px-5 py-2 text-right text-muted">{cell ? `${cell.m} min` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
