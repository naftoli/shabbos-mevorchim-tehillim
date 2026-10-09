import { MONTHS, MONTH_HEB, GRADE_LABEL, finishGrade, QUOTA, toHebrewNumeral } from '@/data/ladders.js'

// The month-by-month plan for a ladder, every grade from Pre-1A to its finish
// grade. Each cell = the cumulative kapitel (Aleph-Beis) + minutes; 👑 = the
// whole Tehillim. Optionally ring the soldier's current grade+month cell.
export default function LadderBreakdownTable({ ladder, highlightGrade, highlightMonth }) {
  const grades = ['pre1a']
  for (let g = 1; g <= finishGrade(ladder); g++) grades.push(String(g))
  const hg = highlightGrade != null ? String(highlightGrade) : null

  return (
    <table className="w-full border-separate border-spacing-0 text-center text-[13px]">
      <thead>
        <tr>
          <th className="sticky left-0 z-10 bg-paper px-2 py-2 text-left font-cond uppercase tracking-wide text-muted">Grade</th>
          {MONTHS.map((m) => (
            <th
              key={m}
              className={`font-heb px-2 py-2 text-[15px] font-bold ${m === highlightMonth ? 'text-green' : 'text-navy'}`}
            >
              {MONTH_HEB[m]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grades.map((g) => {
          const rowHit = g === hg
          return (
            <tr key={g}>
              <td className={`sticky left-0 z-10 bg-paper px-2 py-1.5 text-left font-semibold ${rowHit ? 'text-green' : 'text-navy'}`}>
                {GRADE_LABEL[g]}
              </td>
              {MONTHS.map((m) => {
                const cell = QUOTA[g]?.[m]?.[ladder]
                const finish = cell && cell.v >= 150
                const here = rowHit && m === highlightMonth
                return (
                  <td
                    key={m}
                    className={`rounded px-2 py-1 leading-tight ${
                      here ? 'bg-green/15 ring-2 ring-green' : finish ? 'bg-gold/30 font-bold text-navy' : 'odd:bg-card/60'
                    }`}
                  >
                    {cell ? (
                      <>
                        <div className="font-heb text-[15px] text-navy">{finish ? '👑' : toHebrewNumeral(cell.v)}</div>
                        <div className="text-[10px] text-muted">{cell.m}m</div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
