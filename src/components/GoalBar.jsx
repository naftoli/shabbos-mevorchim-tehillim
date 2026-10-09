// The nationwide progress bar: a rounded track with a blue gradient fill to
// `percent`, and a marker riding the fill's end — a Sefer Tehillim for kapitlach,
// a clock for minutes (pass `icon`).
export default function GoalBar({ percent, label = 'of goal', marker = true, icon = '📖', className = '' }) {
  const actual = Math.max(0, Math.floor(Number(percent) || 0))
  const p = Math.min(100, actual)
  return (
    <div className={`relative ${className}`}>
      <div
        className="relative h-5 w-full overflow-hidden rounded-full bg-track sm:h-6"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p}
        aria-label={`${actual}% ${label}`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: `${Math.max(p, 1.5)}%`, background: 'var(--grad-progress)' }}
        />
      </div>

      {marker && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[10px] -translate-x-1/2 select-none text-[34px] leading-none transition-[left] duration-1000 ease-out sm:-bottom-[14px] sm:text-[44px]"
          style={{ left: `${p}%`, filter: 'drop-shadow(0 6px 8px rgba(15, 35, 80, 0.22))' }}
        >
          {icon}
        </span>
      )}
    </div>
  )
}
