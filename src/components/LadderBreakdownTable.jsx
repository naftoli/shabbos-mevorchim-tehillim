import { MONTH_HEB, GRADE_LABEL, finishGrade, QUOTA, toHebrewNumeral } from '@/data/ladders.js'
import { currentHebrewYear, quotaMonth } from '@/lib/hebrewYear.js'
import { finishGradeLabel, formatKapitlachQuota, gradesThrough } from '@/lib/customLadder.js'
import { DEFAULT_FIRST_MONTH, quotaSheetMonth, schoolYearMonthNames } from '@/lib/schoolYear.js'
import { CrownIcon } from '@/components/ui.jsx'

// The month-by-month plan for a ladder, every grade from Pre-1A to its finish
// grade. Each cell = the cumulative kapitel (Aleph-Beis) + minutes; 👑 = the
// whole Tehillim. Optionally ring the soldier's current grade+month cell.
// Pass `grid` (a generated custom ladder) to draw that plan instead.
// In a leap year the columns include Adar I and Adar II; both read the Adar quota.
export default function LadderBreakdownTable({ ladder, highlightGrade, highlightMonth, year, grid, firstMonth = DEFAULT_FIRST_MONTH, anchorMonth = null }) {
  const months = schoolYearMonthNames(firstMonth, year ?? currentHebrewYear(), anchorMonth || highlightMonth || 'Tishrei')
  const grades = grid
    ? gradesThrough(grid.finishGrade, highlightGrade)
    : (() => {
        const list = ['pre1a']
        for (let g = 1; g <= finishGrade(ladder); g++) list.push(String(g))
        return list
      })()
  const hg = highlightGrade != null ? String(highlightGrade) : null

  return (
    <table className="w-full border-separate border-spacing-0 text-center text-[13px]">
      <thead>
        <tr>
          <th className="sticky left-0 z-10 bg-paper px-2 py-2 text-left font-cond uppercase tracking-wide text-muted">Grade</th>
          {months.map((m) => (
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
                {GRADE_LABEL[g] || finishGradeLabel(g)}
              </td>
              {months.map((m) => {
                const sheet = quotaMonth(quotaSheetMonth(m, firstMonth))
                const cell = grid?.cells?.[g]?.[sheet] || (!grid ? QUOTA[g]?.[sheet]?.[ladder] : null)
                const shown = cell ? formatKapitlachQuota(cell.v) : null
                const finish = !!shown?.crown
                const here = rowHit && m === highlightMonth
                return (
                  <td
                    key={m}
                    className={`rounded px-2 py-1 leading-tight ${
                      here ? 'bg-green/15 ring-2 ring-green' : finish ? 'bg-[#c3b1d6]/70 font-bold text-navy' : 'odd:bg-card/60'
                    }`}
                  >
                    {cell ? (
                      <>
                        <div className={`text-navy ${shown.overTehillim ? 'text-[11px] font-semibold leading-tight' : 'font-heb text-[15px]'}`}>
                          {finish ? <CrownIcon className="mx-auto h-4 w-auto" /> : shown.overTehillim ? shown.label : toHebrewNumeral(cell.v)}
                        </div>
                        {shown.overTehillim ? <div className="text-[10px] font-semibold text-navy">{shown.plain}</div> : null}
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
