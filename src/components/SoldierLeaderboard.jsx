import { useState } from 'react'
import { Button, Card } from '@/components/ui.jsx'
import { fmt } from '@/lib/format.js'
import { GRADE_LABEL } from '@/data/ladders.js'
import { rankSoldiers, SOLDIER_PAGE } from '@/lib/soldierBoard.js'

const RANK_MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

function placeLabel(row) {
  if (row.medal === 1) return '1st place'
  if (row.medal === 2) return '2nd place'
  if (row.medal === 3) return '3rd place'
  if (row.tied) return `Tied for ${row.rank}`
  return `Rank ${row.rank}`
}

// School "Top Soldiers" board. Every caller shares this so ties, medals, and
// the ten-at-a-time list stay the same wherever a soldier leaderboard appears.
export default function SoldierLeaderboard({ soldiers }) {
  const [visible, setVisible] = useState(SOLDIER_PAGE)
  const ranked = rankSoldiers(soldiers)
  const shown = ranked.slice(0, visible)

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-4 font-display text-xl font-black text-navy">Top Soldiers</h2>
      <ul className="space-y-2">
        {shown.map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-black/[0.03]">
            <span className="w-7 text-center font-display text-lg font-bold italic text-blue-accent" aria-label={placeLabel(s)}>
              {s.medal ? RANK_MEDAL[s.medal] : s.rank}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold text-navy">{s.name}</span>
            <span className="text-xs text-muted">{GRADE_LABEL[s.grade]}</span>
            <span className="font-display font-bold tabular-nums text-green">{fmt(s.saidMonth ?? 0)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Kapitlach said this month. Ranked by this month only.</p>
      {ranked.length > visible ? (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => setVisible((v) => v + SOLDIER_PAGE)}>View more</Button>
        </div>
      ) : null}
    </Card>
  )
}
