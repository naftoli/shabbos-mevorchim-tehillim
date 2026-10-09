import { MEDALS } from '@/lib/medals.js'
import { Card } from './ui.jsx'

function Medal({ medal, earned, current }) {
  return (
    <div className={`flex flex-col items-center gap-1 ${earned ? '' : 'opacity-35 grayscale'}`}>
      <span
        className={`grid h-12 w-12 place-items-center rounded-full text-white shadow-sm ring-2 ${current ? 'ring-gold' : 'ring-white'}`}
        style={{ background: medal.color }}
        title={`${medal.name} — ${medal.threshold} missions`}
      >
        <span className="text-lg">🎖️</span>
      </span>
      <span className="font-cond text-[13px] uppercase leading-none text-navy">{medal.name}</span>
      <span className="text-[11px] text-muted">{medal.threshold}</span>
    </div>
  )
}

export default function MedalBoard({ progress }) {
  const { medal, months, missionsTotal } = progress
  const earnedCount = medal.earnedCount
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="sh">Medal Board</p>
          <h3 className="font-display text-xl font-black text-navy">
            {missionsTotal} mission{missionsTotal === 1 ? '' : 's'} completed
          </h3>
        </div>
        <div className="text-right">
          {medal.current ? (
            <p className="text-sm text-muted">
              Current medal: <span className="font-bold" style={{ color: medal.current.color }}>{medal.current.name}</span>
            </p>
          ) : (
            <p className="text-sm text-muted">No medal yet — keep climbing!</p>
          )}
          {medal.next ? (
            <p className="text-sm text-muted">
              <span className="font-bold text-navy">{medal.missionsToNext}</span> to the {medal.next.name} medal
            </p>
          ) : (
            <p className="text-sm font-semibold text-green">All medals earned — amazing!</p>
          )}
        </div>
      </div>

      {/* Medal row */}
      <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-11">
        {MEDALS.map((m) => (
          <Medal key={m.index} medal={m} earned={m.index < earnedCount} current={medal.current?.index === m.index} />
        ))}
      </div>

      {/* Month strip — every month this year; missed months crossed out. */}
      <div className="mt-6">
        <p className="sh mb-2">This Year</p>
        <div className="flex flex-wrap gap-2">
          {months.map((m) => (
            <span
              key={m.month}
              className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${
                m.met
                  ? 'bg-green/10 text-green'
                  : 'bg-track text-muted line-through'
              } ${m.isCurrent ? 'ring-2 ring-gold' : ''}`}
              title={m.met ? 'Mission complete' : 'Missed'}
            >
              {m.month}
            </span>
          ))}
        </div>
      </div>
    </Card>
  )
}
