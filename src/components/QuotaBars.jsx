import GoalBar from './GoalBar.jsx'
import { fmt } from '@/lib/format.js'
import { asset } from '@/lib/asset.js'
import { numberColor } from './campaignBits.jsx'

const KAP_COLOR = '#8a5fd0'
const MIN_COLOR = '#2a7fd0'
const SOL_COLOR = '#2a5fb8'

function Figure({ label, value, color }) {
  return (
    <div className="min-w-0">
      <p className="font-display text-[12px] font-semibold uppercase leading-tight text-navy sm:text-[15px]">{label}</p>
      <p className="mt-1.5 font-display text-[22px] font-black leading-none tabular-nums sm:text-[34px]" style={{ color }}>{value}</p>
    </div>
  )
}

function Line({ figures, pct, iconSrc, fill, barColor }) {
  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 sm:gap-x-6">
        {figures.map((f) => (
          <Figure key={f.label} label={f.label} value={f.value} color={f.color} />
        ))}
        <p className="ml-auto font-display text-[22px] font-black leading-none tabular-nums sm:text-[34px]" style={{ color: numberColor(barColor) }}>{pct}%</p>
      </div>
      <GoalBar percent={pct} iconSrc={iconSrc} fill={fill} className="mt-4" />
    </div>
  )
}

export default function QuotaBars({ kapitlach, minutes, soldiers, className = '' }) {
  const participated = soldiers.participated
  return (
    <div className={`space-y-8 ${className}`}>
      <Line
        figures={[
          { label: 'Kapitlach Quota', value: fmt(kapitlach.quota), color: 'var(--color-navy)' },
          { label: 'Kapitlach Said', value: fmt(kapitlach.said), color: numberColor(KAP_COLOR) },
        ]}
        pct={kapitlach.pct}
        iconSrc={asset('design/icon-book.webp')}
        fill="linear-gradient(90deg, #d774b4 0%, #8a5fd0 100%)"
        barColor={KAP_COLOR}
      />
      <Line
        figures={[
          { label: 'Minutes Quota', value: fmt(minutes.quota), color: 'var(--color-navy)' },
          { label: 'Minutes Said', value: fmt(minutes.said), color: numberColor(MIN_COLOR) },
        ]}
        pct={minutes.pct}
        iconSrc={asset('design/icon-clock.png')}
        fill="linear-gradient(90deg, #4bc8dd 0%, #2a7fd0 100%)"
        barColor={MIN_COLOR}
      />
      <Line
        figures={[
          { label: 'Soldiers', value: fmt(soldiers.total), color: 'var(--color-navy)' },
          ...(participated != null ? [{ label: 'Participated', value: fmt(participated), color: numberColor(SOL_COLOR) }] : []),
          { label: 'Completed Kapitlach Quota', value: fmt(soldiers.finished), color: numberColor(SOL_COLOR) },
        ]}
        pct={soldiers.pct}
        iconSrc={asset('design/icon-soldier-hat.png')}
        fill="linear-gradient(90deg, #5bb0e0 0%, #2a5fb8 100%)"
        barColor={SOL_COLOR}
      />
    </div>
  )
}
