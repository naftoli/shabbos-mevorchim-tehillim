import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
  const PERFECT_SHOWN = 24 // compact sample; the rest open on the school's own page

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

        {/* Perfect platoons — classes where every soldier completed their quota */}
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="font-display text-xl font-black text-navy">Perfect Platoons · <span className="font-heb">{MONTH_HEB[CURRENT_MONTH]}</span></h2>
            <span className="rounded-full bg-green/15 px-3 py-1 font-cond text-sm font-bold uppercase tracking-wide text-green">🎉 {fmt(perfect.length)} this month</span>
          </div>
          <p className="mb-4 mt-1 text-[13px] font-semibold text-muted">
            A platoon (class) is <span className="text-navy">perfect</span> when every single soldier completed their full quota.
          </p>
          {perfect.length ? (
            <div className="flex flex-wrap gap-2">
              {perfect.slice(0, PERFECT_SHOWN).map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1.5 text-sm ring-1 ring-gold/40"
                  title={`${c.name}${c.teacher ? ' · ' + c.teacher : ''} · ${c.size} soldiers`}
                >
                  <img src={asset('design/medal-gold.png')} alt="" aria-hidden="true" draggable="false" className="h-4 w-auto flex-none" />
                  <span className="font-display font-bold text-navy">{c.name}</span>
                  {c.teacher ? <span className="text-navy/55">· {c.teacher}</span> : null}
                </span>
              ))}
              {perfect.length > PERFECT_SHOWN ? (
                <Link
                  to={`/perfect-platoons?school=${schoolId}`}
                  className="inline-flex items-center rounded-full bg-navy/5 px-3 py-1.5 text-sm font-semibold text-navy ring-1 ring-line transition hover:bg-navy/10"
                >
                  +{fmt(perfect.length - PERFECT_SHOWN)} more — see all →
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="text-sm font-semibold text-navy">No perfect platoons yet this month — a class turns perfect when every soldier in it completes their quota. Keep going! 💪</p>
          )}
        </Card>

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
              { key: 'finished', label: '% Soldiers', sub: 'completed quota', icon: asset('design/icon-soldier-hat.png') },
              { key: 'kapitlach', label: '% Kapitlach', sub: 'goal completed', emoji: '📖' },
              { key: 'time', label: '% Time', sub: 'goal completed', icon: asset('design/icon-clock.png') },
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
