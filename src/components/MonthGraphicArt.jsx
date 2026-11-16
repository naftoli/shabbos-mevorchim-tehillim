import { asset } from '@/lib/asset.js'
import { topBaseArt } from '@/lib/baseRank.js'
import { PERFECT_PLATOON_ART } from '@/lib/perfectPlatoonBanner.js'
import { SchoolLogo } from '@/components/ui.jsx'

// The picture a school shares before the daily job has posted a final PNG:
// the Perfect Platoon shield and class name, or the numbered Top Base badge.
export default function MonthGraphicArt({ school, graphic, month, year }) {
  const top = graphic?.kind === 'top10'
  const rank = Number(graphic?.rank)
  const badge = top ? topBaseArt(rank) : null
  const schoolName = school?.name || ''
  const platoon = graphic?.classLabel || graphic?.className || ''
  const label = top ? `${schoolName}, Top 10 school` : `${schoolName} ${platoon}`.trim()
  return (
    <div
      className="relative flex aspect-square w-full flex-col overflow-hidden rounded-2xl bg-[#17356f] text-center text-white"
      role="img"
      aria-label={label}
    >
      <div className="h-2 shrink-0 bg-gold" />
      <div className="flex min-h-0 flex-1 flex-col items-center px-4 pb-4 pt-4">
        <p className="font-cond text-[11px] uppercase tracking-[0.16em] text-gold sm:text-xs">
          Shabbos Mevorchim · {month} {year}
        </p>
        <div className="grid min-h-0 w-full flex-1 place-items-center px-4 py-1">
          {top && badge ? (
            <img src={asset(badge)} alt="" className="max-h-full max-w-[72%] object-contain" />
          ) : (
            <img src={asset(PERFECT_PLATOON_ART)} alt="" className="max-h-full max-w-[72%] object-contain" />
          )}
        </div>
        <div className="mt-1 flex w-full items-center gap-3 px-1 text-left">
          <SchoolLogo school={school || { name: schoolName || 'School' }} size={44} />
          <div className="min-w-0">
            <p className="font-display text-[18px] font-black leading-tight">
              {top ? schoolName : platoon}
            </p>
            <p className={`text-sm ${top ? 'font-semibold text-gold' : 'text-white/80'}`}>
              {top ? `Top 10 School · #${rank}` : schoolName}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
