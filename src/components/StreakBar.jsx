import { asset } from '@/lib/asset.js'
import { STREAK_BAR_STEPS, streakBarModel } from '@/lib/streakBar.js'

// The purple flame cropped from public/design/how/streaks.webp. Width and
// height are the file's own pixel size, so the picture keeps its proportions.
const FLAME_WIDTH = 292
const FLAME_HEIGHT = 314

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
      <div className="grid grid-cols-6 gap-1 pr-12 sm:gap-1.5 sm:pr-16">
        {months.map((month) => {
          const active = model.active === month
          const passed = model.overflow || (model.active != null && month < model.active)
          return (
            <div key={month} className="relative min-w-0 text-center">
              <div
                className={`rounded-full px-0.5 py-1 leading-none ring-2 ${active ? 'bg-[#6d35b0] text-white ring-[#6d35b0]' : passed ? 'bg-[#efe4ff] text-[#24315f] ring-[#c9b0ea]' : 'bg-[#e7f3ff] text-[#24315f] ring-[#d5c4f0]'}`}
              >
                <span className="block whitespace-nowrap text-[10px] font-bold sm:text-xs">Month {month}</span>
              </div>
              {active ? <span className="absolute left-1/2 top-full -mt-px h-2 w-2 -translate-x-1/2 rotate-45 bg-[#6d35b0]" /> : null}
            </div>
          )
        })}
      </div>
      <div className="relative mt-2">
        <div className="rounded-full bg-gradient-to-b from-[#d7b4f4] to-[#8d45c4] p-1.5 shadow-[inset_0_2px_0_rgba(255,255,255,0.55)] sm:p-2">
          <div className="relative mr-9 h-7 overflow-visible rounded-full bg-[#d5e4ff] sm:mr-11 sm:h-8">
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
        <img
          src={asset('design/icon-streak-flame.webp')}
          alt=""
          width={FLAME_WIDTH}
          height={FLAME_HEIGHT}
          draggable="false"
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[8%] right-0 h-[142%] w-auto max-w-none select-none"
          style={{ aspectRatio: `${FLAME_WIDTH} / ${FLAME_HEIGHT}` }}
        />
      </div>
    </div>
  )
}
