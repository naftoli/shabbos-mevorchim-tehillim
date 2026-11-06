import { STREAK_BAR_STEPS, streakBarModel } from '@/lib/streakBar.js'

function Flame({ lit }) {
  return (
    <svg viewBox="0 0 64 72" className="h-12 w-10 sm:h-14 sm:w-12" aria-hidden="true">
      <path
        d="M32 4c8 10 6 16 10 24 6 12 14 16 14 30 0 10-8 16-24 16S8 68 8 56c0-12 8-18 14-28 4-6 6-14 10-24z"
        fill={lit ? '#f7e7ff' : '#e7d4fb'}
        stroke="#7a3cb8"
        strokeWidth="3"
      />
      <path
        d="M32 28c4 6 3 10 6 15 3 6 7 8 7 16 0 6-5 10-13 10s-13-4-13-10c0-7 4-10 8-16 2-4 3-9 5-15z"
        fill={lit ? '#fff' : '#f4e9ff'}
      />
    </svg>
  )
}

function Star() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true">
      <path fill="#fff7cf" stroke="#fff" strokeWidth="1" d="M12 1.5l2.2 6.6h6.3l-5.1 4 2 6.4L12 15.8 6.6 18.5l2-6.4-5.1-4h6.3z" />
    </svg>
  )
}

// Live streak picture. Six month tabs and a purple track. The highlighted tab
// and the star follow the real current streak.
export default function StreakBar({ current }) {
  const model = streakBarModel(current)
  const months = Array.from({ length: STREAK_BAR_STEPS }, (_, i) => i + 1)
  const label = model.overflow
    ? `Current streak: ${model.current} missions in a row. The picture has six steps, so the bar is full.`
    : `Current streak: ${model.current} ${model.current === 1 ? 'mission' : 'missions'} in a row.`
  return (
    <div role="img" aria-label={label}>
      <div className="grid grid-cols-6 gap-1 pr-11 sm:gap-1.5 sm:pr-14">
        {months.map((month) => {
          const active = model.active === month
          const passed = model.overflow || (model.active != null && month < model.active)
          return (
            <div key={month} className="relative min-w-0 text-center">
              <div
                className={`rounded-full px-0.5 py-1 leading-none ring-2 ${active ? 'bg-[#6d35b0] text-white ring-[#6d35b0]' : passed ? 'bg-[#efe4ff] text-[#24315f] ring-[#c9b0ea]' : 'bg-[#e7f3ff] text-[#24315f] ring-[#d5c4f0]'}`}
              >
                <span className="block text-[10px] font-bold sm:text-xs">Month {month}</span>
              </div>
              {active ? <span className="absolute left-1/2 top-full -mt-px h-2 w-2 -translate-x-1/2 rotate-45 bg-[#6d35b0]" /> : null}
            </div>
          )
        })}
      </div>
      <div className="relative mt-2">
        <div className="mr-8 rounded-full bg-gradient-to-b from-[#d7b4f4] to-[#8d45c4] p-1.5 shadow-[inset_0_2px_0_rgba(255,255,255,0.55)] sm:mr-10 sm:p-2">
          <div className="relative h-7 overflow-visible rounded-full bg-[#d5e4ff] sm:h-8">
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${model.fill * 100}%`,
                  background: 'linear-gradient(180deg, #f7f1ff 0%, #e4c8ff 45%, #c9a0f2 100%)',
                }}
              />
            </div>
            <span
              className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow"
              style={{ left: `${model.fill * 100}%` }}
            >
              <Star />
            </span>
          </div>
        </div>
        <span className={`absolute bottom-0 right-0 ${model.fill === 1 ? 'opacity-100' : 'opacity-80'}`}>
          <Flame lit={model.fill === 1} />
        </span>
      </div>
    </div>
  )
}
