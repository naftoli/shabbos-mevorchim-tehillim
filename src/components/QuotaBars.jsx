import GoalBar from './GoalBar.jsx'
import { fmt } from '@/lib/format.js'
import { asset } from '@/lib/asset.js'

// The standard quota readout used everywhere a quota is shown: three lines —
// kapitlach (book), minutes (clock) and soldiers who finished (hat) — each with
// a goal / achieved pair, a percent and a progress bar riding the matching icon.
function Line({ leftLabel, leftValue, rightLabel, rightValue, pct, icon, iconSrc, fill }) {
  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <div>
          <p className="font-display text-[13px] font-semibold uppercase leading-none text-navy sm:text-[15px]">{leftLabel}</p>
          <p className="mt-1.5 font-display text-[26px] font-black leading-none tabular-nums text-navy sm:text-[34px]">{leftValue}</p>
        </div>
        <div>
          <p className="font-display text-[13px] font-semibold uppercase leading-none text-navy sm:text-[15px]">{rightLabel}</p>
          <p className="mt-1.5 font-display text-[26px] font-black leading-none tabular-nums sm:text-[34px]" style={{ color: '#a85fa5' }}>{rightValue}</p>
        </div>
        <p className="ml-auto font-display text-[26px] font-black leading-none tabular-nums text-blue sm:text-[34px]">{pct}%</p>
      </div>
      <GoalBar percent={pct} icon={icon} iconSrc={iconSrc} fill={fill} className="mt-4 sm:mr-14" />
    </div>
  )
}

export default function QuotaBars({ kapitlach, minutes, soldiers, className = '' }) {
  return (
    <div className={`space-y-8 ${className}`}>
      <Line
        leftLabel="Kapitlach Quota"
        leftValue={fmt(kapitlach.quota)}
        rightLabel="Kapitlach Said"
        rightValue={fmt(kapitlach.said)}
        pct={kapitlach.pct}
        iconSrc={asset('design/icon-book.png')}
        fill="linear-gradient(90deg, #d774b4 0%, #8a5fd0 100%)"
      />
      <Line
        leftLabel="Minutes Quota"
        leftValue={fmt(minutes.quota)}
        rightLabel="Minutes Said"
        rightValue={fmt(minutes.said)}
        pct={minutes.pct}
        iconSrc={asset('design/icon-clock.png')}
        fill="linear-gradient(90deg, #4bc8dd 0%, #2a7fd0 100%)"
      />
      <Line
        leftLabel="Soldiers"
        leftValue={fmt(soldiers.total)}
        rightLabel="Completed Quota"
        rightValue={fmt(soldiers.finished)}
        pct={soldiers.pct}
        iconSrc={asset('design/icon-soldier-hat.png')}
        fill="linear-gradient(90deg, #5bb0e0 0%, #2a5fb8 100%)"
      />
    </div>
  )
}
