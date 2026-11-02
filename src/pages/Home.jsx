import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getGlobalStats,
  getRunningTotals,
  getSchools,
  getPerfectPlatoons,
  getCampaignCalendar,
  getArmyDedication,
  isHolidayMonth,
  CAMPAIGN_YEAR,
  CURRENT_MONTH,
} from '@/services/api.js'
import { fmt } from '@/lib/format.js'
import { asset } from '@/lib/asset.js'
import { rankSchools, raceMetric } from '@/lib/schoolRace.js'
import { useLiveData } from '@/lib/useLiveData.js'
import { Button, Card, SchoolLogo, Input } from '@/components/ui.jsx'
import QuotaBars from '@/components/QuotaBars.jsx'
import { IconImg, QuotaReached, RaceToggle, StarMark, Pending } from '@/components/campaignBits.jsx'
import { MONTH_HEB } from '@/data/ladders.js'
import { CAMPAIGN_MARK, MONTH_CHOOSER } from '@/lib/decisions.js'

const CAMPAIGN_ICON = CAMPAIGN_MARK === 'target' ? 'design/icon-target.png' : 'design/flag.png'

function Skeleton({ className = '' }) {
  return <span className={`inline-block animate-pulse rounded-md bg-track ${className}`} aria-hidden="true" />
}

const RACE_FILLS = [
  'linear-gradient(90deg, #86a8db 0%, var(--color-race-blue) 55%, #1f4f9e 100%)',
  'linear-gradient(90deg, #fde58f 0%, var(--color-race-yellow) 55%, #f0b929 100%)',
  'linear-gradient(90deg, #8ec6ea 0%, var(--color-race-green) 55%, #2f78c4 100%)',
  'linear-gradient(90deg, #f6a09a 0%, var(--color-race-red) 55%, #d9463f 100%)',
  'linear-gradient(90deg, #6fc0d0 0%, var(--color-race-teal) 55%, #0b7389 100%)',
]
const SCHOOL_COLORS = ['#2a5fb8', '#0e8aa6', '#5b3fa8', '#c77d0e', '#1f7a4d', '#c0392b']
const MEDALS = ['medal-gold', 'medal-silver', 'medal-bronze']
const PLATOON_PAGE = 10

function Eyebrow({ icon, iconClass = 'h-5', className = '', children }) {
  return (
    <p className={`flex items-center gap-2 font-display text-[15px] font-extrabold uppercase leading-none tracking-[0.02em] text-green sm:text-[18px] ${className}`}>
      {icon && <img src={icon} alt="" aria-hidden="true" draggable="false" className={`w-auto flex-none ${iconClass}`} />}
      <span>{children}</span>
    </p>
  )
}

function Stat({ value, label, icon, hint }) {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <span className="grid h-[60px] w-[72px] flex-none place-items-center lg:h-[76px] lg:w-[92px]">
        <img src={icon} alt="" aria-hidden="true" draggable="false" className="max-h-full max-w-full object-contain" />
      </span>
      <div className="min-w-0">
        <div className="font-display text-[28px] font-black leading-none tabular-nums text-navy lg:text-[34px]">{value}</div>
        <div className="mt-1 font-display text-[15px] font-semibold uppercase leading-tight text-navy sm:text-[16px] lg:text-[18px]">{label}</div>
        {hint ? <div className="mt-1 text-[11.5px] font-medium leading-snug text-muted">{hint}</div> : null}
      </div>
    </div>
  )
}

function SchoolsRace({ schools }) {
  const [sort, setSort] = useState('finished')
  const [visible, setVisible] = useState(10)
  const ranked = rankSchools(schools, sort)
  const metric = (s) => raceMetric(s, sort)
  const shown = ranked.slice(0, visible)
  return (
    <Card className="rounded-[32px] p-5 sm:rounded-[40px] sm:p-10 lg:px-14">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 sm:mb-7">
        <div className="min-w-0">
          <Eyebrow icon={asset('design/flag.png')} iconClass="h-[22px]">The Race</Eyebrow>
          <h2 className="mt-1.5 font-display text-[24px] font-bold italic leading-tight text-navy sm:text-[30px]">Schools going head to head</h2>
        </div>
        <RaceToggle value={sort} onChange={setSort} />
      </div>

      <div className="space-y-2 sm:space-y-3">
        {shown.map((s, i) => (
          <Link
            key={s.id}
            to={`/s/${s.id}`}
            className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-2xl px-2 py-2.5 transition hover:bg-black/[0.03] sm:flex sm:gap-4 sm:px-3 lg:gap-5"
          >
            <span className="grid w-9 flex-none place-items-center sm:w-12 lg:w-14">
              {i < 3 && s.saidMonth > 0
                ? <img src={asset(`design/${MEDALS[i]}.png`)} alt={`#${i + 1}`} draggable="false" className="h-9 w-auto sm:h-[46px] lg:h-[52px]" />
                : <span className="font-display text-[20px] font-bold italic leading-none text-blue-accent sm:text-[24px]">{i + 1}</span>}
            </span>
            <SchoolLogo school={{ ...s, color: SCHOOL_COLORS[i % SCHOOL_COLORS.length] }} size={44} />
            <span className="min-w-0 whitespace-normal font-display text-[17px] font-semibold leading-tight text-navy sm:w-56 sm:flex-none sm:text-[19px] lg:w-80 lg:text-[20px]">{s.name}</span>
            <span className="relative col-span-4 order-last h-4 overflow-hidden rounded-full bg-track sm:order-none sm:col-span-1 sm:h-5 sm:flex-1">
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out"
                style={{ width: `${Math.min(100, Math.max(metric(s), 3))}%`, background: RACE_FILLS[i % RACE_FILLS.length] }}
              />
            </span>
            <span className="text-right font-display text-[16px] font-bold tabular-nums text-green sm:w-16 sm:flex-none sm:text-[18px] lg:w-24 lg:text-[20px]">
              {metric(s)}%
            </span>
          </Link>
        ))}
      </div>

      {ranked.length > visible && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => setVisible((v) => v + 10)}>View more</Button>
        </div>
      )}
    </Card>
  )
}

function SchoolCard({ s, color }) {
  return (
    <Link to={`/s/${s.id}`} className="group block">
      <Card className="h-full transition group-hover:-translate-y-[3px] group-hover:shadow-hover">
        <div className="flex items-start gap-3 px-5 pt-5">
          <SchoolLogo school={{ ...s, color }} size={48} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-xl font-bold leading-tight text-navy">{s.name}</h3>
            <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-green">{s.city}</p>
          </div>
          {s.pct >= 100 ? <QuotaReached /> : null}
        </div>
        <div className="space-y-3 px-5 pb-5 pt-4">
          <div className="flex items-start gap-3">
            <IconImg name="hat" className="mt-0.5 h-8 w-auto flex-none" />
            <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-navy">
              <span className="font-display text-[22px] font-black tabular-nums">{fmt(s.metMonth)}</span> of {fmt(s.kids)} chayolim completed their kapitlach quota
            </p>
            <span className="font-display text-[22px] font-black tabular-nums text-green">{s.pctMet}%</span>
          </div>
          <div className="flex items-start gap-3 text-[15px] font-semibold leading-snug text-navy">
            <IconImg name="book" className="mt-0.5 h-8 w-auto flex-none" />
            <p>Kapitlach Quota {fmt(s.quotaMonth)} — Kapitlach Said {fmt(s.saidMonth)}</p>
          </div>
        </div>
      </Card>
    </Link>
  )
}

function chipsFor(months) {
  const out = []
  for (const month of months || []) {
    out.push(month)
    if (month === 'Tishrei') out.push('Rosh Hashana', 'Yom Kippur')
  }
  if (!(months || []).includes('Tishrei')) out.push('Rosh Hashana', 'Yom Kippur')
  return out
}

export default function Home() {
  const [pickedYear, setPickedYear] = useState(null)
  const [pickedMonth, setPickedMonth] = useState(null)
  const { data: calendar } = useLiveData(() => getCampaignCalendar(pickedYear || undefined), [pickedYear])
  const year = pickedYear || calendar?.year || CAMPAIGN_YEAR
  const monthLabel = pickedMonth || calendar?.currentMonth || CURRENT_MONTH
  const period = calendar ? { year, month: monthLabel } : null
  const { data: stats, loading: statsLoading } = useLiveData(() => getGlobalStats(period), [period?.year, period?.month])
  const { data: totals, loading: totalsLoading } = useLiveData(() => getRunningTotals(), [])
  const { data: schoolsData, loading: schoolsLoading } = useLiveData(() => getSchools(period), [period?.year, period?.month])
  const { data: platoonsData, loading: platoonsLoading } = useLiveData(() => (isHolidayMonth(monthLabel) ? Promise.resolve([]) : getPerfectPlatoons(period)), [period?.year, period?.month, monthLabel])
  const { data: dedication } = useLiveData(() => getArmyDedication(period), [period?.year, period?.month])
  const [query, setQuery] = useState('')

  const schools = schoolsData ?? []
  const platoons = platoonsData ?? []
  const [openSchool, setOpenSchool] = useState(null)
  const [teacherSchool, setTeacherSchool] = useState(null)
  const [platoonVisible, setPlatoonVisible] = useState(PLATOON_PAGE)
  const [platoonsExpanded, setPlatoonsExpanded] = useState(false)
  const schoolById = Object.fromEntries(schools.map((s) => [s.id, s]))
  const platoonGroups = []
  {
    const seen = new Map()
    for (const p of platoons) {
      let group = seen.get(p.schoolId)
      if (!group) {
        group = { schoolId: p.schoolId, school: p.school, items: [], schoolClasses: p.schoolClasses || 0, schoolSaid: p.schoolSaid || 0 }
        seen.set(p.schoolId, group)
        platoonGroups.push(group)
      }
      group.items.push(p)
      group.schoolClasses = Math.max(group.schoolClasses, p.schoolClasses || 0)
      group.schoolSaid = p.schoolSaid || group.schoolSaid
    }
    platoonGroups.sort((a, b) => {
      const ap = a.schoolClasses ? a.items.length / a.schoolClasses : 0
      const bp = b.schoolClasses ? b.items.length / b.schoolClasses : 0
      return bp - ap || (b.schoolSaid || 0) - (a.schoolSaid || 0) || a.school.localeCompare(b.school)
    })
  }
  const shownGroups = platoonsExpanded ? platoonGroups : platoonGroups.slice(0, platoonVisible)
  const q = query.trim().toLowerCase()
  const filtered = schools.filter(
    (s) => !q || s.name.toLowerCase().includes(q) || (s.city || '').toLowerCase().includes(q),
  )

  // Hero + shell render immediately; numbers fill in as each request lands so
  // the page never sits on a full-screen "Loading…" while the army aggregates.
  return (
    <div>
      {/* Hero — the Weiss shul photo full-bleed with the brand glass panel on top. */}
      <section className="relative isolate flex min-h-[420px] overflow-hidden sm:min-h-[500px] md:min-h-[560px]">
        <img
          src={asset('design/hero-bg.webp')}
          alt=""
          draggable="false"
          className="absolute inset-0 h-full w-full select-none object-cover object-center"
        />
        <div className="relative z-30 mx-auto flex w-full max-w-[640px] items-center px-4 py-10 sm:px-0 sm:py-14">
          <img
            src={asset('design/hero-boy.webp')}
            alt=""
            draggable="false"
            className="pointer-events-none absolute bottom-0 right-[calc(100%-1.25rem)] z-20 hidden h-[92%] w-auto max-w-[min(30vw,340px)] select-none object-contain object-bottom min-[1100px]:block"
          />
          <img
            src={asset('design/hero-girl.webp')}
            alt=""
            draggable="false"
            className="pointer-events-none absolute bottom-0 left-[calc(100%-1.25rem)] z-20 hidden h-[92%] w-auto max-w-[min(30vw,340px)] select-none object-contain object-bottom min-[1100px]:block"
          />
          <div className="hero-glass relative z-30 w-full rounded-[22px] p-5 sm:rounded-[36px] sm:p-8 lg:p-10">
            <p className="font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-white sm:text-[16px] lg:text-[18px]">
              Shabbos Mevorchim Tehillim Campaign
            </p>
            <h1 className="mt-2 font-display text-[26px] font-black uppercase leading-[1.12] text-white sm:mt-4 sm:text-[38px] lg:text-[44px]">
              Every soldier.<br />Every Kapitel.
            </h1>
            <p className="mt-3 font-display text-[14px] leading-[1.4] text-white/90 sm:mt-5 sm:text-[18px] lg:text-[20px]">
              Saying the entire Tehillim on Shabbos Mevorchim is important for you, your children, and your children's children. <b>Train at your own pace, saying more Tehillim from month to month, until you can say the entire Tehillim every Shabbos Mevorchim.</b>
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:mt-7 sm:flex-row sm:flex-wrap sm:gap-4">
              <Button to="/login" variant="navy" className="w-full px-6 py-3 text-[18px] sm:w-auto sm:min-w-[240px] sm:text-[21px]">
                I'm a Soldier
              </Button>
              <button
                type="button"
                onClick={() => document.getElementById('schools')?.scrollIntoView({ behavior: 'smooth' })}
                className="btn btn-o-white w-full px-6 py-3 text-[18px] sm:w-auto sm:min-w-[240px] sm:text-[21px]"
              >
                See the Schools
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Worldwide goal + global stats — pulled up over the hero's bottom edge. */}
      <section className="relative z-10 mx-auto -mt-6 max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <Card className="rounded-[32px] p-6 pt-8 sm:rounded-[40px] sm:p-10 lg:px-14 lg:pb-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <label className="mb-2 block text-sm font-semibold text-navy">
                Year
                <select className="ml-2 rounded-xl border border-line bg-white px-3 py-1.5" value={year} onChange={(e) => { setPickedYear(e.target.value); setPickedMonth(null) }}>
                  {(calendar?.years || [year]).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <div className={MONTH_CHOOSER === 'scroll' ? 'flex gap-1 overflow-x-auto' : 'flex flex-wrap gap-1'}>
                {chipsFor(calendar?.months || []).map((m) => (
                  <button key={m} type="button" onClick={() => setPickedMonth(m)} className={`rounded-xl px-2.5 py-1 font-heb text-lg ${m === monthLabel ? 'text-white' : 'bg-track text-navy'}`} style={m === monthLabel ? { background: 'var(--grad-cta-green)' } : undefined}>
                    {MONTH_HEB[m] || m}
                  </button>
                ))}
              </div>
              <Eyebrow icon={asset(CAMPAIGN_ICON)} iconClass="h-6 sm:h-7" className="mt-3">
                Army Report: <span className="font-heb">{MONTH_HEB[monthLabel] || monthLabel}</span> {year}
              </Eyebrow>
            </div>
            {stats?.pct >= 100 && !stats?.holiday ? <QuotaReached /> : null}
          </div>

          {stats?.holiday ? (
            <p className="mt-6 text-navy/80">{monthLabel} is a training mission. It does not have a separate army board. Choose a Shabbos Mevorchim month to see the totals.</p>
          ) : stats ? (
            <QuotaBars
              className="mt-6 sm:mt-7"
              kapitlach={{ quota: stats.quota, said: stats.accomplished, pct: stats.pct }}
              minutes={{ quota: stats.minutesQuota, said: stats.minutes, pct: stats.minutesPct }}
              soldiers={{ total: stats.soldiers, finished: stats.metSoldiers, participated: stats.participatedSoldiers, pct: stats.pctSoldiersMet }}
            />
          ) : (
            <div className="mt-6 sm:mt-7">
              <Pending label={statsLoading ? 'Getting the army report' : 'Army report'} />
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:mt-10 lg:gap-8">
            <Stat icon={asset('design/icon-school-building.png')} value={stats ? fmt(stats.schools) : '…'} label="Schools" />
            <Stat icon={asset('design/icon-platoon.webp')} value={stats ? fmt(stats.perfectPlatoons) : '…'} label="Perfect Platoons" hint="Classes where every single soldier finished their full quota of kapitlach" />
          </div>
        </Card>
      </section>

      {/* Running totals — kapitlach said */}
      <section className="mx-auto mt-8 max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <p className="sh mb-3">Kapitlach Said</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { value: totals?.thisYear, label: year, sub: 'this year', heb: true, emoji: '📖' },
            { value: totals?.allTime, label: 'All-Time', sub: 'every year', heb: false, emoji: '🌍' },
          ].map((c) => (
            <Card key={c.sub} className="relative overflow-hidden p-5 sm:p-6">
              <span aria-hidden="true" className="pointer-events-none absolute -right-3 -bottom-4 select-none text-[86px] leading-none opacity-[0.07]">{c.emoji}</span>
              <div className="relative flex items-center gap-4">
                <span className="h-11 w-1.5 flex-none rounded-full" style={{ background: 'var(--grad-cta-green)' }} />
                <div className="min-w-0">
                  <div className="font-display text-[30px] font-black leading-none tabular-nums text-navy sm:text-[38px]">
                    {c.value != null ? fmt(c.value) : (totalsLoading ? '…' : '—')}
                  </div>
                  <div className={`mt-1.5 text-sm font-semibold uppercase tracking-wide text-green ${c.heb ? 'font-heb text-base' : ''}`}>{c.label}</div>
                  <div className="text-xs text-muted">{c.sub}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pt-10 sm:px-6 sm:pt-12 lg:px-10">
        {schoolsLoading && !schools.length ? (
          <Card className="rounded-[32px] p-8 text-center sm:rounded-[40px]">
            <Pending label="Getting the school race" />
          </Card>
        ) : (
          <SchoolsRace schools={schools} />
        )}
      </section>

      {/* Perfect Platoons */}
      {platoonsLoading && !platoonGroups.length ? (
        <section className="mx-auto max-w-[1400px] px-4 pt-10 sm:px-6 lg:px-10">
          <Pending label="Getting perfect platoons" />
        </section>
      ) : platoonGroups.length ? (
        <section className="mx-auto max-w-[1400px] px-4 pt-10 sm:px-6 lg:px-10">
          <Card className="rounded-[32px] p-5 sm:rounded-[40px] sm:p-10 lg:px-14">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="font-display text-[24px] font-bold italic leading-tight text-navy sm:text-[30px]">
                Perfect Platoons · <span className="font-heb">{MONTH_HEB[monthLabel]}</span>
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-green/15 px-3 py-1 font-cond text-sm font-bold uppercase tracking-wide text-green"><StarMark className="h-4 w-4" /> {fmt(platoons.length)} this month</span>
              <button type="button" className="btn btn-o !px-3 !py-1.5 !text-sm" onClick={() => setPlatoonsExpanded((v) => !v)}>{platoonsExpanded ? 'Close' : 'Expand all'}</button>
            </div>
            <p className="mb-4 mt-1 max-w-xl text-[13px] font-semibold text-muted">
              A “platoon” is a class — and it’s <span className="text-navy">perfect</span> when every single soldier in it finished their full quota of kapitlach this month.
            </p>
            <div className="space-y-2">
              {shownGroups.map((g) => {
                const open = platoonsExpanded || openSchool === g.schoolId
                const showingTeacher = teacherSchool === g.schoolId
                const teachers = [...new Set(g.items.map((p) => p.teacher).filter(Boolean))]
                const school = schoolById[g.schoolId] || { name: g.school, color: '#268ecd' }
                const total = g.schoolClasses || g.items.length
                return (
                  <div key={g.schoolId} className="rounded-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenSchool(open && !platoonsExpanded ? null : g.schoolId)
                        setTeacherSchool(showingTeacher ? null : g.schoolId)
                      }}
                      aria-expanded={open}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-black/[0.04]"
                    >
                      <SchoolLogo school={school} size={44} />
                      <span className="min-w-0 flex-1 whitespace-normal font-display text-[17px] font-bold leading-tight text-navy sm:text-[19px]">
                        {showingTeacher && teachers.length ? teachers.join(', ') : g.school}
                      </span>
                      <span className="font-display text-[18px] font-black tabular-nums text-navy">{g.items.length} / {total}</span>
                    </button>
                    {open ? (
                      <div className="flex flex-wrap gap-2 px-3 pb-3 pl-16">
                        {g.items.map((p) => (
                          <Link
                            key={`${p.schoolId}-${p.className}`}
                            to={`/s/${p.schoolId}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#c3b1d6]/40 px-3 py-1.5 text-sm ring-1 ring-[#8464a6]/40 transition hover:-translate-y-px hover:bg-[#c3b1d6]/70"
                            title={`${p.className} · ${p.teacher || p.school} · ${p.size} soldiers`}
                          >
                            <StarMark className="h-4 w-4 flex-none" />
                            <span className="font-display font-bold text-navy">{p.className}</span>
                            {p.teacher ? <span className="text-green">· {p.teacher}</span> : null}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
            {!platoonsExpanded && platoonGroups.length > platoonVisible ? (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" onClick={() => setPlatoonVisible((v) => v + PLATOON_PAGE)}>View more</Button>
              </div>
            ) : null}
          </Card>
        </section>
      ) : null}

      {dedication?.text ? (
        <section className="mx-auto max-w-[1400px] px-4 pt-8 sm:px-6 lg:px-10">
          <Card className="border-l-4 border-gold p-5 sm:p-6">
            <p className="sh">Dedication · <span className="font-heb">{MONTH_HEB[dedication.month] || MONTH_HEB[monthLabel]}</span> {dedication.year || year}</p>
            <p className="mt-1 font-display text-lg italic text-navy">{dedication.text}</p>
          </Card>
        </section>
      ) : null}

      <section id="schools" className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 sm:py-12 lg:px-10">
        <div className="mb-6">
          <h2 className="font-display text-[24px] font-bold italic leading-tight text-navy sm:text-[30px]">Bases In Action</h2>
        </div>
        <div className="mb-6 max-w-md">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search schools by name…"
            aria-label="Search schools by name"
          />
        </div>
        {schoolsLoading && !schools.length ? (
          <Pending label="Getting the bases" />
        ) : filtered.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s, i) => <SchoolCard key={s.id} s={s} color={SCHOOL_COLORS[i % SCHOOL_COLORS.length]} />)}
          </div>
        ) : (
          <p className="font-display text-[16px] italic text-muted">No schools match “{query}”.</p>
        )}
      </section>
    </div>
  )
}
