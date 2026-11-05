import { asset } from '@/lib/asset.js'
import { CAMPAIGN_MARK, QUOTA_BADGE, STAT_NUMBER_COLOR, STAT_NUMBER_PINK } from '@/lib/decisions.js'

export const ICON = {
  book: 'design/icon-book.webp',
  clock: 'design/icon-clock.png',
  hat: 'design/icon-soldier-hat.png',
  flag: 'design/flag.png',
  target: 'design/icon-target.png',
  school: 'design/icon-school-building.png',
  platoon: 'design/icon-platoon.webp',
  climber: 'design/icon-climber.webp',
  climberGirl: 'design/icon-climber-girl.png',
}

export function IconImg({ name, className = 'h-6 w-auto' }) {
  const key = name === 'campaign' ? CAMPAIGN_MARK : name
  const file = ICON[key]
  if (!file) return null
  return <img src={asset(file)} alt="" aria-hidden="true" draggable="false" className={className} />
}

export function CheckMark({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#1f7a4d" />
      <path d="M7 12.5l3.2 3.2L17.5 8.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StarMark({ className = 'h-5 w-5', title = 'Perfect Platoon' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label={title} role="img">
      <path fill="#e0b000" stroke="#8a6a00" strokeWidth="1" d="M12 2.8l2.6 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6 6.7 19.5l1.1-6.1L3.3 9.2l6.1-.8z" />
    </svg>
  )
}

export function QuotaReached({ children = 'Quota reached!' }) {
  if (QUOTA_BADGE === 'plain') {
    return <span className="inline-flex items-center rounded-full bg-green px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wide text-white">{children}</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wide text-white">
      <CheckMark className="h-4 w-4" />
      {children}
    </span>
  )
}

export function numberColor(barColor) {
  return STAT_NUMBER_COLOR === 'pink' ? STAT_NUMBER_PINK : barColor
}

export function Pending({ label = 'Getting the numbers', lines = 3 }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="block h-5 animate-pulse rounded-md bg-track" style={{ width: `${88 - i * 12}%` }} />
      ))}
    </div>
  )
}

export const RACE_SEGMENTS = [
  { key: 'participated', label: '% Soldiers', sub: 'participated', icon: 'hat' },
  { key: 'finished', label: '% Soldiers', sub: 'completed quota', icon: 'check' },
  { key: 'kapitlach', label: '% Kapitlach', sub: 'goal completed', icon: 'book' },
  { key: 'time', label: '% Time', sub: 'goal completed', icon: 'clock' },
]

export function RaceToggle({ value, onChange, compact = false }) {
  // Phones: one full-width row of four, with smaller type so the labels fit at 360px.
  // From sm up, the same fixed 104px tabs as before (compact is unused at that size).
  return (
    <div
      className={`flex w-full min-w-0 basis-full gap-0.5 rounded-[18px] p-0.5 font-cond uppercase leading-none tracking-[0.04em] sm:w-auto sm:basis-auto sm:gap-1 sm:rounded-[24px] sm:p-1 ${compact ? 'sm:flex' : 'sm:flex'}`}
      style={{ background: 'var(--grad-lilac)' }}
    >
      {RACE_SEGMENTS.map((sg) => {
        const active = value === sg.key
        return (
          <button
            key={sg.key}
            type="button"
            onClick={() => onChange(sg.key)}
            aria-pressed={active}
            className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] px-0.5 py-1.5 text-center transition sm:w-[104px] sm:flex-none sm:gap-1 sm:rounded-[18px] sm:px-2 sm:py-2 ${active ? 'text-navy shadow-sm' : 'text-white hover:bg-white/15'}`}
            style={active ? { background: 'linear-gradient(180deg, #c3b1d6 0%, #ede4f6 100%)' } : undefined}
          >
            {sg.icon === 'check' ? <CheckMark className="h-4 w-4 shrink-0 sm:h-7 sm:w-7" /> : <IconImg name={sg.icon} className="h-4 w-auto max-w-full shrink-0 sm:h-7" />}
            <span className="max-w-full text-[10px] leading-none sm:text-[14px]">{sg.label}</span>
            <span className={`max-w-full text-balance text-[8px] font-semibold normal-case leading-[1.15] tracking-normal sm:text-[9px] sm:leading-tight ${active ? 'text-navy/70' : 'text-white/85'}`}>{sg.sub}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Bar fill stops at 100%. The label keeps the real percent, including over 100. */
export function Meter({ pct = 0, color = 'var(--grad-progress)' }) {
  const n = Math.max(0, Math.round(Number(pct) || 0))
  return (
    <div>
      <div className="h-2.5 overflow-hidden rounded-full bg-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, n)} aria-label={`${n}% of goal`}>
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, Math.max(n, n > 0 ? 2 : 0))}%`, background: color }} />
      </div>
      {n > 100 ? <p className="mt-1 text-right text-[11px] font-bold tabular-nums text-navy">{n}% of goal</p> : null}
    </div>
  )
}
