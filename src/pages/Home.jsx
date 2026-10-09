import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getGlobalStats,
  getRunningTotals,
  getSchools,
  getPerfectPlatoons,
} from '@/services/api.js'
import { fmt } from '@/lib/format.js'
import { asset } from '@/lib/asset.js'
import { Button, Card, Pill, SchoolLogo, Input } from '@/components/ui.jsx'
import GoalBar from '@/components/GoalBar.jsx'
import { MONTH_HEB } from '@/data/ladders.js'

const RACE_FILLS = [
  'linear-gradient(90deg, #86a8db 0%, var(--color-race-blue) 55%, #1f4f9e 100%)',
  'linear-gradient(90deg, #fde58f 0%, var(--color-race-yellow) 55%, #f0b929 100%)',
  'linear-gradient(90deg, #8ec6ea 0%, var(--color-race-green) 55%, #2f78c4 100%)',
  'linear-gradient(90deg, #f6a09a 0%, var(--color-race-red) 55%, #d9463f 100%)',
  'linear-gradient(90deg, #6fc0d0 0%, var(--color-race-teal) 55%, #0b7389 100%)',
]
const SCHOOL_COLORS = ['#2a5fb8', '#0e8aa6', '#5b3fa8', '#c77d0e', '#1f7a4d', '#c0392b']
const MEDALS = ['medal-gold', 'medal-silver', 'medal-bronze']

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
  // Three percentage metrics: % of kids who finished, % of the kapitlach goal
  // said, and % of the minutes goal reached. Ties fall through the other metrics
  // then total kapitlach then name, so the order is always stable.
  const metric = (s) => (sort === 'finished' ? s.pctMet : sort === 'kapitlach' ? s.pct : s.minutesPct)
  const ranked = [...schools].sort(
    (a, b) =>
      metric(b) - metric(a) ||
      b.pctMet - a.pctMet ||
      b.pct - a.pct ||
      b.minutesPct - a.minutesPct ||
      b.saidMonth - a.saidMonth ||
      a.name.localeCompare(b.name),
  )
  const shown = ranked.slice(0, visible)
  const segStyle = (active) => (active ? { background: 'linear-gradient(90deg, #a6c6f6 0%, #6d93d8 45%, #547fc2 100%)' } : undefined)
  const SEGMENTS = [
    { key: 'finished', label: '% Finished', sub: 'soldiers done', icon: asset('design/icon-soldier-hat.png') },
    { key: 'kapitlach', label: '% Kapitlach', sub: 'of goal said', emoji: '📖' },
    { key: 'time', label: '% Time', sub: 'of minutes', icon: asset('design/icon-clock.png') },
  ]
  return (
    <Card className="rounded-[32px] p-5 sm:rounded-[40px] sm:p-10 lg:px-14">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 sm:mb-7">
        <div className="min-w-0">
          <Eyebrow icon={asset('design/flag.png')} iconClass="h-[22px]">The Race</Eyebrow>
          <h2 className="mt-1.5 font-display text-[24px] font-bold italic leading-tight text-navy sm:text-[30px]">Schools going head to head</h2>
        </div>
        <div className="inline-flex rounded-[24px] bg-[#6d93d8] p-1 font-cond uppercase leading-none tracking-[0.04em]">
          {SEGMENTS.map((sg) => {
            const active = sort === sg.key
            return (
              <button
                key={sg.key}
                type="button"
                onClick={() => setSort(sg.key)}
                aria-pressed={active}
                className={`flex w-[92px] flex-col items-center gap-1 rounded-[20px] px-2 py-2 text-green transition sm:w-[106px] ${active ? 'shadow-sm' : 'hover:bg-white/15'}`}
                style={segStyle(active)}
              >
                {sg.icon ? (
                  <img src={sg.icon} alt="" aria-hidden="true" draggable="false" className="h-6 w-auto sm:h-7" />
                ) : (
                  <span className="text-[22px] leading-none sm:text-[26px]">{sg.emoji}</span>
                )}
                <span className="text-[13px] leading-none sm:text-[15px]">{sg.label}</span>
                <span className="text-[9.5px] font-semibold normal-case leading-tight tracking-normal text-navy/70">{sg.sub}</span>
              </button>
            )
          })}
        </div>
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
            <span className="min-w-0 truncate font-display text-[17px] font-semibold text-navy sm:w-40 sm:flex-none sm:text-[19px] lg:w-56 lg:text-[20px] xl:w-64">{s.name}</span>
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
          {s.pct >= 100 ? <Pill className="!bg-green !text-white">🎉 Goal</Pill> : null}
        </div>
        <div className="px-5 pb-5 pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-display text-[28px] font-black leading-none tabular-nums text-navy">{fmt(s.saidMonth)}</span>
            <span className="text-sm font-semibold text-muted">of {fmt(s.quotaMonth)} kapitlach</span>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, Math.max(s.pct, 3))}%`, background: color }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[13px] font-semibold uppercase tracking-[0.04em]">
            <span className="text-green">{s.pct}% of quota</span>
            <span className="text-muted">{fmt(s.kids)} soldiers</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}

export default function Home() {
  const stats = useMemo(() => getGlobalStats(), [])
  const totals = useMemo(() => getRunningTotals(), [])
  const schools = useMemo(() => getSchools(), [])
  const platoons = useMemo(() => getPerfectPlatoons(), [])
  const [platoonLimit, setPlatoonLimit] = useState(12)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = schools.filter(
    (s) => !q || s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q),
  )

  return (
    <div>
      {/* Hero — royal-blue gradient with a glass panel (no Sukkos art). */}
      <section className="hero-navy relative isolate flex min-h-[380px] sm:min-h-[460px] md:min-h-[520px]">
        <div className="relative mx-auto flex w-full max-w-[1400px] flex-col items-start justify-center gap-2 px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
          <div className="hero-glass relative z-30 w-full max-w-[680px] rounded-[22px] p-5 sm:rounded-[36px] sm:p-8 lg:p-10">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-gold sm:text-[15px] lg:text-[18px]">
              Shabbos Mevorchim {stats.year} · Worldwide Mivtza
            </p>
            <h1 className="mt-2 font-display text-[26px] font-black uppercase leading-[1.12] text-white sm:mt-4 sm:text-[38px] lg:text-[44px]">
              Every soldier.<br />Every <span className="text-gold">Kapitel.</span>
            </h1>
            <p className="mt-3 font-display text-[14px] leading-[1.4] text-white/90 sm:mt-5 sm:text-[18px] lg:text-[20px]">
              Tzivos Hashem soldiers say Tehillim every Shabbos Mevorchim — climbing, kapitel by
              kapitel, toward finishing the entire Sefer Tehillim. Join the Mivtza today!
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:mt-7 sm:flex-row sm:flex-wrap sm:gap-4">
              <Button to="/login" variant="navy" className="w-full px-6 py-3 text-[18px] sm:w-auto sm:min-w-[240px] sm:text-[21px]">
                I'm a Soldier
              </Button>
              <button
                type="button"
                onClick={() => document.getElementById('schools')?.scrollIntoView({ behavior: 'smooth' })}
                className="btn btn-gold w-full px-6 py-3 text-[18px] sm:w-auto sm:min-w-[240px] sm:text-[21px]"
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Eyebrow icon={asset('design/flag.png')} iconClass="h-6 sm:h-7">
              Worldwide Tehillim · <span className="font-heb">{MONTH_HEB[stats.monthLabel]}</span> {stats.year}
            </Eyebrow>
            {stats.pct >= 100 && <Pill className="!bg-green !text-white">🎉 Quota reached!</Pill>}
          </div>

          {/* Kapitlach */}
          <div className="relative z-10 mt-4 flex flex-wrap items-end gap-x-6 gap-y-2 sm:mt-5 sm:gap-x-12">
            <div>
              <p className="font-display text-[15px] font-semibold uppercase leading-none text-navy sm:text-[18px]">Kapitlach Quota</p>
              <p className="mt-2 font-display text-[30px] font-black leading-none tabular-nums text-navy sm:text-[40px] lg:text-[44px]">{fmt(stats.quota)}</p>
            </div>
            <div>
              <p className="font-display text-[15px] font-semibold uppercase leading-none text-navy sm:text-[18px]">Kapitlach Said</p>
              <p className="mt-2 font-display text-[30px] font-black leading-none tabular-nums text-green sm:text-[40px] lg:text-[44px]">{fmt(stats.accomplished)}</p>
            </div>
            <p className="ml-auto hidden font-display text-[30px] font-black leading-none tabular-nums text-green [paint-order:stroke_fill] [-webkit-text-stroke:8px_var(--color-card)] sm:block sm:text-[40px] lg:text-[44px]">{stats.pct}%</p>
          </div>

          <div className="mt-5 flex items-center gap-3 sm:mt-0 sm:block">
            <GoalBar percent={stats.pct} label="of kapitlach quota" className="min-w-0 flex-1 sm:mt-6 sm:mr-[120px] lg:mr-[132px]" />
            <span className="flex-none font-display text-[26px] font-black leading-none tabular-nums text-green sm:hidden">{stats.pct}%</span>
          </div>

          {/* Minutes — the same, for time spent saying Tehillim */}
          <div className="relative z-10 mt-8 flex flex-wrap items-end gap-x-6 gap-y-2 sm:gap-x-12">
            <div>
              <p className="font-display text-[15px] font-semibold uppercase leading-none text-navy sm:text-[18px]">Minutes Quota</p>
              <p className="mt-2 font-display text-[30px] font-black leading-none tabular-nums text-navy sm:text-[40px] lg:text-[44px]">{fmt(stats.minutesQuota)}</p>
            </div>
            <div>
              <p className="font-display text-[15px] font-semibold uppercase leading-none text-navy sm:text-[18px]">Minutes Said</p>
              <p className="mt-2 font-display text-[30px] font-black leading-none tabular-nums text-green sm:text-[40px] lg:text-[44px]">{fmt(stats.minutes)}</p>
            </div>
            <p className="ml-auto hidden font-display text-[30px] font-black leading-none tabular-nums text-green [paint-order:stroke_fill] [-webkit-text-stroke:8px_var(--color-card)] sm:block sm:text-[40px] lg:text-[44px]">{stats.minutesPct}%</p>
          </div>

          <div className="mt-5 flex items-center gap-3 sm:mt-0 sm:block">
            <GoalBar percent={stats.minutesPct} iconSrc={asset('design/icon-clock.png')} label="of minutes quota" className="min-w-0 flex-1 sm:mt-6 sm:mr-[120px] lg:mr-[132px]" />
            <span className="flex-none font-display text-[26px] font-black leading-none tabular-nums text-green sm:hidden">{stats.minutesPct}%</span>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6 lg:mt-10 lg:gap-8">
            <Stat icon={asset('design/icon-soldier-hat.png')} value={fmt(stats.soldiers)} label="Soldiers" />
            <Stat icon={asset('design/icon-school.png')} value={fmt(stats.schools)} label="Schools" />
            <Stat icon={asset('design/flag.png')} value={fmt(stats.perfectPlatoons)} label="Perfect Platoons" hint="Classes where every single soldier finished their quota" />
          </div>
        </Card>
      </section>

      {/* Running totals */}
      <section className="mx-auto mt-8 grid max-w-[1400px] grid-cols-1 gap-3 px-4 sm:grid-cols-2 sm:px-6 lg:px-10">
        <Card className="p-5"><div className="font-display text-[26px] font-black tabular-nums text-navy">{fmt(totals.thisYear)}</div><div className="text-sm font-semibold uppercase tracking-wide text-green">This Year</div><div className="text-xs text-muted">kapitlach</div></Card>
        <Card className="p-5"><div className="font-display text-[26px] font-black tabular-nums text-navy">{fmt(totals.allTime)}</div><div className="text-sm font-semibold uppercase tracking-wide text-green">All-Time</div><div className="text-xs text-muted">kapitlach</div></Card>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pt-10 sm:px-6 sm:pt-12 lg:px-10">
        <SchoolsRace schools={schools} />
      </section>

      {/* Perfect Platoons */}
      {platoons.length ? (
        <section className="mx-auto max-w-[1400px] px-4 pt-10 sm:px-6 lg:px-10">
          <h2 className="font-display text-[24px] font-bold italic leading-tight text-navy sm:text-[30px]">
            Perfect Platoons · <span className="font-heb">{MONTH_HEB[stats.monthLabel]}</span>
            <span className="align-middle text-[18px] not-italic text-muted"> · {fmt(platoons.length)}</span>
          </h2>
          <p className="mb-4 mt-1 max-w-xl text-[13px] font-semibold text-muted">
            A “platoon” is a class — and it’s <span className="text-navy">perfect</span> when every single soldier in it finished their full quota this month.
          </p>
          <div className="flex flex-wrap gap-2">
            {platoons.slice(0, platoonLimit).map((p) => (
              <Link key={`${p.schoolId}-${p.className}`} to={`/s/${p.schoolId}`}>
                <Card className="px-4 py-3 transition hover:shadow-hover">
                  <span className="font-display font-bold text-navy">{p.className}</span>
                  {p.teacher ? <span className="text-sm font-semibold text-green"> · {p.teacher}</span> : null}
                  <span className="text-sm text-muted"> · {p.school} · {p.size} soldiers</span>
                </Card>
              </Link>
            ))}
          </div>
          {platoons.length > platoonLimit ? (
            <button
              onClick={() => setPlatoonLimit(platoons.length)}
              className="btn btn-o mt-4"
            >
              Show all {fmt(platoons.length)} perfect platoons
            </button>
          ) : null}
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
        {filtered.length > 0 ? (
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
