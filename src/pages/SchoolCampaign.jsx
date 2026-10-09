import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, Pill, SchoolLogo, Button } from '@/components/ui.jsx'
import { PageHero } from './_page.jsx'
import QuotaBars from '@/components/QuotaBars.jsx'
import { fmt } from '@/lib/format.js'
import { asset } from '@/lib/asset.js'
import { GRADE_LABEL, MONTH_HEB } from '@/data/ladders.js'
import {
  getSchool,
  schoolSoldierLeaderboard,
  schoolClassLeaderboard,
  CURRENT_MONTH,
} from '@/services/api.js'

const RANK_MEDAL = ['🥇', '🥈', '🥉']
const RACE_FILLS = [
  'linear-gradient(90deg, #86a8db 0%, var(--color-race-blue) 55%, #1f4f9e 100%)',
  'linear-gradient(90deg, #fde58f 0%, var(--color-race-yellow) 55%, #f0b929 100%)',
  'linear-gradient(90deg, #8ec6ea 0%, var(--color-race-green) 55%, #2f78c4 100%)',
  'linear-gradient(90deg, #f6a09a 0%, var(--color-race-red) 55%, #d9463f 100%)',
  'linear-gradient(90deg, #6fc0d0 0%, var(--color-race-teal) 55%, #0b7389 100%)',
]
const PLATOON_MEDALS = ['medal-gold', 'medal-silver', 'medal-bronze']
const classMono = (c) => {
  const sec = c.name.match(/ ([A-Z])$/)?.[1] || ''
  return (c.grade === 'pre1a' ? 'P1A' : c.grade) + sec
}

export default function SchoolCampaign() {
  const { schoolId } = useParams()
  const school = useMemo(() => getSchool(schoolId), [schoolId])
  const soldiers = useMemo(() => schoolSoldierLeaderboard(schoolId, 10), [schoolId])
  const classes = useMemo(() => schoolClassLeaderboard(schoolId), [schoolId])
  const [classSort, setClassSort] = useState('finished')

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
        {/* Goal meter — kapitlach, minutes and soldiers finished */}
        <Card className="p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="sh">This month · <span className="font-heb">{MONTH_HEB[CURRENT_MONTH]}</span></p>
            {school.pct >= 100 ? <Pill className="!bg-green !text-white">🎉 Quota reached!</Pill> : null}
          </div>
          <QuotaBars
            kapitlach={{ quota: school.quotaMonth, said: school.saidMonth, pct: school.pct }}
            minutes={{ quota: school.minutesQuotaMonth, said: school.minutesSaidMonth, pct: school.minutesPct }}
            soldiers={{ total: school.kids, finished: school.metMonth, pct: school.pctMet }}
          />
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

          {/* Class leaderboard — toggle the metric like the home page race */}
          {(() => {
            const SEGMENTS = [
              { key: 'finished', label: '% Finished', sub: 'soldiers done', icon: asset('design/icon-soldier-hat.png') },
              { key: 'kapitlach', label: '% Kapitlach', sub: 'of goal said', emoji: '📖' },
              { key: 'time', label: '% Time', sub: 'of minutes', icon: asset('design/icon-clock.png') },
            ]
            const metricOf = (c) => (classSort === 'finished' ? c.pctMet : classSort === 'kapitlach' ? c.pct : c.minutesPct)
            const ranked = [...classes].sort(
              (a, b) => metricOf(b) - metricOf(a) || b.pctMet - a.pctMet || b.pct - a.pct || a.name.localeCompare(b.name),
            )
            return (
              <Card className="p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-xl font-black text-navy">Platoons (Classes)</h2>
                  <div className="inline-flex rounded-[22px] bg-[#6d93d8] p-1 font-cond uppercase tracking-[0.04em]">
                    {SEGMENTS.map((sg) => {
                      const active = classSort === sg.key
                      return (
                        <button
                          key={sg.key}
                          type="button"
                          onClick={() => setClassSort(sg.key)}
                          aria-pressed={active}
                          className={`flex w-[84px] flex-col items-center gap-0.5 rounded-[18px] px-2 py-1.5 text-green transition sm:w-[92px] ${active ? 'shadow-sm' : 'hover:bg-white/15'}`}
                          style={active ? { background: 'linear-gradient(90deg, #a6c6f6 0%, #6d93d8 45%, #547fc2 100%)' } : undefined}
                        >
                          {sg.icon ? (
                            <img src={sg.icon} alt="" aria-hidden="true" draggable="false" className="h-5 w-auto sm:h-6" />
                          ) : (
                            <span className="text-[18px] leading-none sm:text-[20px]">{sg.emoji}</span>
                          )}
                          <span className="text-[11px] leading-none sm:text-[12px]">{sg.label}</span>
                          <span className="text-[8px] font-semibold normal-case leading-tight tracking-normal text-navy/70">{sg.sub}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <ul className="space-y-2 sm:space-y-3">
                  {ranked.map((c, i) => {
                    const m = metricOf(c)
                    return (
                      <li
                        key={c.id}
                        className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-2xl px-1 py-2 sm:flex sm:gap-4"
                      >
                        <span className="grid w-9 flex-none place-items-center sm:w-12">
                          {i < 3 && m > 0 ? (
                            <img src={asset(`design/${PLATOON_MEDALS[i]}.png`)} alt={`#${i + 1}`} draggable="false" className="h-9 w-auto sm:h-11" />
                          ) : (
                            <span className="font-display text-[18px] font-bold italic leading-none text-navy/70 sm:text-[22px]">{i + 1}</span>
                          )}
                        </span>
                        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-navy font-cond text-sm font-bold text-gold sm:h-11 sm:w-11">{classMono(c)}</span>
                        <span className="min-w-0 truncate font-display text-[16px] font-semibold text-navy sm:w-40 sm:flex-none sm:text-[18px]">
                          {c.name} {c.perfect ? <span title="Perfect Platoon">★</span> : null}
                        </span>
                        <span className="relative col-span-4 order-last h-4 overflow-hidden rounded-full bg-track sm:order-none sm:col-span-1 sm:h-5 sm:flex-1">
                          <span
                            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
                            style={{ width: `${Math.max(3, Math.min(100, m))}%`, background: c.perfect ? 'var(--color-green-mid)' : RACE_FILLS[i % RACE_FILLS.length] }}
                          />
                        </span>
                        <span className="text-right font-display text-[15px] font-bold tabular-nums text-green sm:w-24 sm:flex-none sm:text-[17px]">
                          {m}%{classSort === 'finished' ? <span className="font-semibold text-muted"> · {c.met}/{c.size}</span> : null}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            )
          })()}
        </div>

        <div><Button variant="outline" to="/">← All schools</Button></div>
      </div>
    </>
  )
}
