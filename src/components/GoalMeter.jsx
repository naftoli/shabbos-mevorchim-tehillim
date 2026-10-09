import { fmt } from '@/lib/format.js'

// Headline progress meter: kapitlach accomplished vs. quota. The crown marker
// rides the fill.
export default function GoalMeter({ accomplished, quota, label }) {
  const pct = quota > 0 ? Math.min((accomplished / quota) * 100, 100) : 0
  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <div>
          <span className="font-cond text-4xl text-navy">{fmt(accomplished)}</span>
          <span className="text-muted"> / {fmt(quota)} kapitlach</span>
        </div>
        <span className="font-cond text-3xl text-navy">{Math.round(pct)}%</span>
      </div>
      <div className="relative h-5 overflow-hidden rounded-full bg-[var(--color-track)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: 'var(--grad-progress)' }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 text-lg"
          style={{ left: `calc(${pct}% - 10px)` }}
          aria-hidden
        >
          👑
        </div>
      </div>
      {label ? <p className="mt-2 text-sm text-muted">{label}</p> : null}
    </div>
  )
}
