import { Link } from 'react-router-dom'
import { MEDALS } from '@/lib/medals.js'
import { Card } from './ui.jsx'
import { asset } from '@/lib/asset.js'

// Small medal chip (just the threshold number); greyed until earned.
function MiniMedal({ medal, earned, current }) {
  return (
    <span
      className={`grid h-9 w-9 flex-none place-items-center rounded-full font-cond text-[12px] font-bold ${earned ? 'ring-2' : 'opacity-30 grayscale'} ${current ? 'ring-gold' : 'ring-white'}`}
      style={{ background: medal.color, color: medal.ink }}
      title={`${medal.name} — ${medal.threshold} missions`}
    >
      {medal.threshold}
    </span>
  )
}

// Compact medal summary on the dashboard — tap to open the full levels page.
export default function MedalBoard({ progress }) {
  const { medal, missionsTotal } = progress
  const earnedCount = medal.earnedCount
  return (
    <Link to="/medals" className="block">
      <Card className="p-5 transition hover:shadow-hover sm:p-6">
        <div className="flex items-center gap-4">
          <img src={asset('design/medal-gold.png')} alt="" aria-hidden="true" draggable="false" className="h-12 w-auto flex-none" />
          <div className="min-w-0 flex-1">
            <p className="sh">Medal Board</p>
            <h3 className="font-display text-xl font-black text-navy">
              {missionsTotal} monthly mission{missionsTotal === 1 ? '' : 's'} earned
            </h3>
            <p className="text-sm text-muted">
              {medal.current ? (
                <>Current medal: <span className="font-bold" style={{ color: medal.current.color }}>{medal.current.name}</span></>
              ) : (
                <>No medal yet — keep going!</>
              )}
            </p>
          </div>
          <span className="flex-none text-sm font-semibold text-blue">See all ›</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {MEDALS.map((m) => (
            <MiniMedal key={m.index} medal={m} earned={m.index < earnedCount} current={medal.current?.index === m.index} />
          ))}
        </div>

        <div className="mt-4">
          <div className="h-3 w-full overflow-hidden rounded-full bg-track">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${Math.max(2, Math.round((missionsTotal / 110) * 100))}%`, background: 'var(--grad-progress)' }}
            />
          </div>
          <p className="mt-2 text-center text-xs font-semibold text-muted">
            {medal.next ? (
              <><span className="text-navy">{medal.missionsToNext}</span> to the <span style={{ color: medal.next.color }}>{medal.next.name}</span> medal</>
            ) : (
              <span className="text-green">All medals earned!</span>
            )}
          </p>
        </div>
      </Card>
    </Link>
  )
}
