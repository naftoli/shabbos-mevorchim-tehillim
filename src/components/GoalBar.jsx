import { goalBarEnd, progressIconBox } from '@/lib/goalBar.js'

// Nationwide progress bar. The marker rides the end of the fill, clamped to
// the track, and keeps the artwork's own proportions.
export default function GoalBar({ percent, label = 'of goal', marker = true, icon = '📖', iconSrc, fill, className = '' }) {
  const { actual, end } = goalBarEnd(percent)
  const box = progressIconBox(iconSrc)
  const shown = Math.round(actual)
  return (
    <div className={`relative ${className}`}>
      {/* Side gutters are half the widest marker (the open book) so the icon
          can sit on the fill's end and still stay inside the card. */}
      <div className="relative mx-6 sm:mx-[30px]">
        <div
          className="relative h-5 w-full overflow-hidden rounded-full bg-bar-track sm:h-6"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(end)}
          aria-label={`${shown}% ${label}`}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out"
            style={{ width: `${end}%`, background: fill || 'var(--grad-progress)' }}
          />
        </div>

        {marker && (
          iconSrc ? (
            <img
              src={iconSrc}
              alt=""
              width={box?.width}
              height={box?.height}
              draggable="false"
              className="pointer-events-none absolute top-1/2 h-8 w-auto max-w-none -translate-x-1/2 -translate-y-1/2 select-none object-contain sm:h-10"
              style={{
                left: `${end}%`,
                aspectRatio: box ? `${box.width} / ${box.height}` : undefined,
                filter: 'drop-shadow(0 1px 1px rgba(15, 35, 80, 0.28))',
              }}
            />
          ) : (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[28px] leading-none sm:text-[34px]"
              style={{ left: `${end}%` }}
            >
              {icon}
            </span>
          )
        )}
      </div>
    </div>
  )
}
