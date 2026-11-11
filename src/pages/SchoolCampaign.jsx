import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, SchoolLogo, Button } from '@/components/ui.jsx'
import { PageHero } from './_page.jsx'
import QuotaBars from '@/components/QuotaBars.jsx'
import { Pending, QuotaReached, RaceToggle, StarMark } from '@/components/campaignBits.jsx'
import { PerfectPlatoonLogo, TopBaseBadge } from '@/components/brandMarks.jsx'
import SoldierLeaderboard from '@/components/SoldierLeaderboard.jsx'
import { fmt } from '@/lib/format.js'
import { asset } from '@/lib/asset.js'
import { MONTH_HEB } from '@/data/ladders.js'
import { useLiveData } from '@/lib/useLiveData.js'
import { raceMetric, rankByRace } from '@/lib/schoolRace.js'
import { baseRanks } from '@/lib/baseRank.js'
import {
  getSchool,
  getSchools,
  schoolSoldierLeaderboard,
  schoolClassLeaderboard,
  CURRENT_MONTH,
} from '@/services/api.js'
import { displayClassName } from '@/lib/formatClassName.js'
import { teacherName } from '@/lib/teacherName.js'
import ClassName from '@/components/ClassName.jsx'

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
  const { data: school, loading, error, reload } = useLiveData(() => getSchool(schoolId), [schoolId])
  const { data: soldiers } = useLiveData(() => schoolSoldierLeaderboard(schoolId), [schoolId])
  const { data: classesData } = useLiveData(() => schoolClassLeaderboard(schoolId), [schoolId])
  const { data: armySchools } = useLiveData(() => getSchools(), [])
  const classes = classesData ?? []
  const rank = useMemo(
    () => (armySchools ? baseRanks(armySchools).get(String(schoolId)) ?? null : null),
    [armySchools, schoolId],
  )
  const soldierRows = soldiers ?? []
  const [classSort, setClassSort] = useState('finished')

  if (error) {
    return (
      <>
        <PageHero eyebrow="Base Campaign" title="Couldn’t load this school">
          Something went wrong reading this school’s campaign.
        </PageHero>
        <div className="mx-auto max-w-5xl space-y-3 px-4 py-10">
          <Button onClick={reload}>Try again</Button>
          <div><Button variant="outline" to="/">Back to Home</Button></div>
        </div>
      </>
    )
  }

  if (!school) {
    return (
      <>
        <PageHero eyebrow="Base Campaign" title={loading ? 'This base' : 'School not found'}>
          {loading ? <Pending label="Getting this base" /> : 'We couldn’t find that school.'}
        </PageHero>
        {loading ? null : (
          <div className="mx-auto max-w-5xl px-4 py-10"><Button to="/">Back to Home</Button></div>
        )}
      </>
    )
  }

  const perfect = classes.filter((c) => c.perfect)

  return (
    <>
      <section className="hero-navy">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-8 sm:gap-4 sm:px-6 sm:py-10 lg:px-10">
          <SchoolLogo school={school} size={72} className="!h-14 !w-14 ring-2 ring-white/30 sm:!h-[72px] sm:!w-[72px]" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[13px] font-semibold uppercase tracking-[0.1em] text-gold">Base Campaign · <span className="font-heb">{MONTH_HEB[CURRENT_MONTH]}</span></p>
            <div className="flex items-center gap-3">
              <h1 className="min-w-0 break-words font-display text-[1.65rem] font-black leading-tight text-white sm:text-4xl">{school.name}</h1>
              <TopBaseBadge rank={rank} className="h-16 w-auto shrink-0 sm:h-24" />
            </div>
            <p className="text-white/80">{school.city ? `${school.city} · ` : ''}{fmt(school.kids)} soldiers</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] space-y-8 px-4 py-8 sm:px-6 lg:px-10">
        {/* Goal meter — kapitlach, minutes and soldiers finished */}
        <Card className="p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="sh">This month · <span className="font-heb">{MONTH_HEB[CURRENT_MONTH]}</span></p>
            {school.pct >= 100 ? <QuotaReached /> : null}
          </div>
          <QuotaBars
            kapitlach={{ quota: school.quotaMonth, said: school.saidMonth, pct: school.pct }}
            minutes={{ quota: school.minutesQuotaMonth, said: school.minutesSaidMonth, pct: school.minutesPct }}
            soldiers={{ total: school.kids, finished: school.metMonth, participated: school.participatedMonth, pct: school.pctMet }}
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
          <div className="flex items-start gap-3">
            <PerfectPlatoonLogo className="mt-0.5 h-12 w-auto sm:h-14" />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="font-display text-xl font-black text-navy">Perfect Platoons · <span className="font-heb">{MONTH_HEB[CURRENT_MONTH]}</span></h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-green/15 px-3 py-1 font-cond text-sm font-bold uppercase tracking-wide text-green"><StarMark className="h-4 w-4" /> {fmt(perfect.length)} this month</span>
            </div>
          </div>
          <p className="mb-4 mt-1 text-[13px] font-semibold text-muted">
            A “platoon” is a class — and it’s <span className="text-navy">perfect</span> when every single soldier in it finished their full quota of kapitlach this month.
          </p>
          {perfect.length ? (
            <div className="flex flex-wrap gap-2">
              {perfect.map((c) => {
                const teacher = teacherName(c.teacher)
                return (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1.5 text-sm ring-1 ring-gold/40"
                    title={`${displayClassName(c.name)}${teacher ? ' · ' + teacher : ''} · ${c.size} soldiers`}
                  >
                    <StarMark className="h-4 w-4 flex-none" />
                    <span className="font-display font-bold text-navy"><ClassName name={c.name} /></span>
                    {teacher ? <span className="text-green">· {teacher}</span> : null}
                  </span>
                )
              })}
            </div>
          ) : (
            <p className="text-sm font-semibold text-navy">No perfect platoons yet this month — a class turns perfect when every soldier in it completes their quota. Keep going! 💪</p>
          )}
        </Card>

        <div className="grid gap-8 lg:grid-cols-2">
          <SoldierLeaderboard key={schoolId} soldiers={soldierRows} />

          {/* Class leaderboard — toggle the metric like the home page race */}
          {(() => {
            // Same ranking as the schools race: a tie on the selected metric breaks
            // toward whoever has more of that metric's raw count (see rankByRace).
            const metricOf = (c) => raceMetric(c, classSort)
            const ranked = rankByRace(classes, classSort)
            return (
              <Card className="p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="w-full font-display text-xl font-black text-navy sm:w-auto">Platoons (Classes)</h2>
                  <RaceToggle value={classSort} onChange={setClassSort} compact />
                </div>
                <ul className="space-y-2 sm:space-y-3">
                  {ranked.map((c, i) => {
                    const m = metricOf(c)
                    return (
                      <li
                        key={c.id}
                        className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 rounded-2xl px-1 py-2 sm:flex sm:gap-4"
                      >
                        <span className="grid w-9 flex-none place-items-center sm:w-12">
                          {i < 3 && m > 0 ? (
                            <img src={asset(`design/${PLATOON_MEDALS[i]}.png`)} alt={`#${i + 1}`} draggable="false" className="h-9 w-auto sm:h-11" />
                          ) : (
                            <span className="font-display text-[18px] font-bold italic leading-none text-navy/70 sm:text-[22px]">{i + 1}</span>
                          )}
                        </span>
                        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-navy font-cond text-sm font-bold text-gold sm:h-11 sm:w-11">{classMono(c)}</span>
                        <span className="min-w-0 whitespace-normal font-display text-[15px] font-semibold leading-tight text-navy sm:w-40 sm:flex-none sm:truncate sm:text-[18px]">
                          <ClassName name={c.name} /> {c.perfect ? <StarMark className="ml-1 inline h-4 w-4 align-text-bottom" /> : null}
                        </span>
                        <span className="relative col-span-4 order-last h-4 overflow-hidden rounded-full bg-bar-track sm:order-none sm:col-span-1 sm:h-5 sm:flex-1">
                          <span
                            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
                            style={{ width: `${Math.max(3, Math.min(100, m))}%`, background: c.perfect ? 'var(--color-green-mid)' : RACE_FILLS[i % RACE_FILLS.length] }}
                          />
                        </span>
                        <span className="text-right font-display text-[13px] font-bold leading-tight tabular-nums text-green sm:w-24 sm:flex-none sm:text-[17px]">
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
