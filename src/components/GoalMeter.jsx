import { fmt } from '@/lib/format.js'
import { CrownIcon } from '@/components/ui.jsx'

// Headline progress meter: kapitlach accomplished vs. quota. The crown marker
// rides the fill.
export default function GoalMeter({ accomplished, quota, label }) {
  const actual = quota > 0 ? (accomplished / quota) * 100 : 0
  const bar = Math.min(100, actual)
  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <div>
          <span className="font-cond text-4xl text-navy">{fmt(accomplished)}</span>
          <span className="text-muted"> / {fmt(quota)} kapitlach</span>
        </div>
        <span className="font-cond text-3xl text-navy">{Math.round(actual)}%</span>
      </div>
      <div className="relative h-5 overflow-hidden rounded-full bg-[var(--color-track)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${bar}%`, background: 'var(--grad-progress)' }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 text-lg"
          style={{ left: `calc(${bar}% - 10px)` }}
          aria-hidden
        >
          <CrownIcon className="h-5 w-auto" />
        </div>
      </div>
      {label ? <p className="mt-2 text-sm text-muted">{label}</p> : null}
    </div>
  )
}
