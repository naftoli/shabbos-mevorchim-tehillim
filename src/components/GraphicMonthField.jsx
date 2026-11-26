import { graphicMonthChoices } from '@/lib/monthGraphics.js'

export default function GraphicMonthField({ campaignYear, currentMonth, year, month, onChange }) {
  const choices = graphicMonthChoices(campaignYear, currentMonth)
  const value = `${year}|${month}`
  const selected = choices.some((choice) => choice.value === value) ? value : (choices[0]?.value || '')
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-navy">Month</span>
      <select
        className="min-h-11 w-full rounded-2xl bg-card px-3 text-base text-navy shadow-card"
        value={selected}
        aria-label="Shabbos Mevorchim month"
        onChange={(event) => {
          const [nextYear, nextMonth] = event.target.value.split('|')
          onChange({ year: nextYear, month: nextMonth })
        }}
      >
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>{choice.label}</option>
        ))}
      </select>
    </label>
  )
}
