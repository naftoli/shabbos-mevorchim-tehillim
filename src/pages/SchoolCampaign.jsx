import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, Pill, SchoolLogo, Button } from '@/components/ui.jsx'
import { PageHero } from './_page.jsx'
import GoalBar from '@/components/GoalBar.jsx'
import { fmt } from '@/lib/format.js'
import { GRADE_LABEL, MONTH_HEB } from '@/data/ladders.js'
import {
  getSchool,
  schoolSoldierLeaderboard,
  schoolClassLeaderboard,
  CURRENT_MONTH,
} from '@/services/api.js'

const RANK_MEDAL = ['🥇', '🥈', '🥉']

export default function SchoolCampaign() {
  const { schoolId } = useParams()
  const school = useMemo(() => getSchool(schoolId), [schoolId])
  const soldiers = useMemo(() => schoolSoldierLeaderboard(schoolId, 10), [schoolId])
  const classes = useMemo(() => schoolClassLeaderboard(schoolId), [schoolId])

  if (!school) {
    return (
      <>
        <PageHero eyebrow="Base Campaign" title="School not found">
          We couldn’t find that school.
        </PageHero>
        <div className="mx-auto max-w-5xl px-4 py-10"><Button to="/">Back to Home</Button></div>
      </>
    )
  }

  const perfect = classes.filter((c) => c.perfect)

  return (
    <>
      <section className="hero-navy">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-10 sm:px-6 lg:px-10">
          <SchoolLogo school={school} size={72} className="!bg-white/10 ring-2 ring-white/30" />
          <div className="min-w-0">
            <p className="font-display text-[13px] font-semibold uppercase tracking-[0.1em] text-gold">Base Campaign · <span className="font-heb">{MONTH_HEB[CURRENT_MONTH]}</span></p>
            <h1 className="font-display text-3xl font-black text-white sm:text-4xl">{school.name}</h1>
            <p className="text-white/80">{school.city} · {fmt(school.kids)} soldiers</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] space-y-8 px-4 py-8 sm:px-6 lg:px-10">
        {/* Goal meter */}
        <Card className="p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-x-10 gap-y-2">
              <div>
                <p className="font-display text-[15px] font-semibold uppercase text-navy">Quota</p>
                <p className="mt-1 font-display text-[34px] font-black tabular-nums text-navy">{fmt(school.quotaMonth)}</p>
              </div>
              <div>
                <p className="font-display text-[15px] font-semibold uppercase text-navy">Kapitlach Said</p>
                <p className="mt-1 font-display text-[34px] font-black tabular-nums text-green">{fmt(school.saidMonth)}</p>
              </div>
            </div>
            {school.pct >= 100 ? <Pill className="!bg-green !text-white">🎉 Quota reached!</Pill> : <Pill>{school.pct}% of quota</Pill>}
          </div>
          <GoalBar percent={school.pct} label="of quota" className="mt-8 sm:mr-[120px]" />
        </Card>

        {/* Dedication */}
        {school.dedication ? (
          <Card className="border-l-4 border-gold p-5 sm:p-6">
            <p className="sh">Dedication · <span className="font-heb">{MONTH_HEB[school.dedication.month]}</span></p>
            <p className="mt-1 font-display text-lg italic text-navy">{school.dedication.text}</p>
          </Card>
        ) : null}

        {/* Perfect platoons */}
        {perfect.length ? (
          <div>
            <h2 className="mb-3 font-display text-xl font-black text-navy">Perfect Platoons · <span className="font-heb">{MONTH_HEB[CURRENT_MONTH]}</span></h2>
            <div className="flex flex-wrap gap-2">
              {perfect.map((c) => (
                <Pill key={c.id} className="!bg-green/10 !text-green !text-[13px]">★ {c.name} · {c.size} soldiers</Pill>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Soldier leaderboard */}
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 font-display text-xl font-black text-navy">Top Soldiers</h2>
            <ol className="space-y-2">
              {soldiers.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-black/[0.03]">
                  <span className="w-7 text-center font-display text-lg font-bold italic text-blue-accent">{RANK_MEDAL[i] || i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-navy">{s.name}</span>
                  <span className="text-xs text-muted">{GRADE_LABEL[s.grade]}</span>
                  <span className="font-display font-bold tabular-nums text-green">{fmt(s.saidYear)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted">Kapitlach said this year.</p>
          </Card>

          {/* Class leaderboard */}
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 font-display text-xl font-black text-navy">Platoons (Classes)</h2>
            <ul className="space-y-3">
              {classes.map((c) => (
                <li key={c.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-navy">
                      {c.name} {c.perfect ? <span title="Perfect Platoon">★</span> : null}
                    </span>
                    <span className="text-muted">{c.pct}% · {c.met}/{c.size} done</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-track">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(3, c.pct)}%`, background: c.perfect ? 'var(--color-green-mid)' : 'var(--grad-progress)' }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div><Button variant="outline" to="/">← All schools</Button></div>
      </div>
    </>
  )
}
