import { useMemo, useState } from 'react'
import { Card, Pill } from '@/components/ui.jsx'
import { PageHero } from './_page.jsx'
import { fmt } from '@/lib/format.js'
import { asset } from '@/lib/asset.js'
import { GRADE_LABEL, MONTH_HEB } from '@/data/ladders.js'
import {
  ELAPSED_MONTHS,
  CURRENT_MONTH_INDEX,
  getArmyReport,
  getBaseReport,
  getPlatoonReport,
} from '@/services/api.js'

const COLORS = ['#2a5fb8', '#0e8aa6', '#5b3fa8', '#c77d0e', '#1f7a4d', '#c0392b', '#2246a8', '#8b5cf6']
const MEDALS = ['medal-gold', 'medal-silver', 'medal-bronze']

function Mono({ name, color }) {
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-cond text-lg text-white shadow-sm" style={{ background: color }}>
      {initials}
    </span>
  )
}

function Bar({ pct, color = 'var(--grad-progress)', track = 'var(--color-track)' }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full" style={{ background: track }}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, Math.max(pct, 2))}%`, background: color }} />
    </div>
  )
}

function MonthTabs({ idx, setIdx }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-card p-1 shadow-card ring-1 ring-line">
      {ELAPSED_MONTHS.map((mo, i) => (
        <button
          key={mo}
          onClick={() => setIdx(i)}
          className={`rounded-xl px-4 py-1.5 font-heb text-lg transition ${i === idx ? 'text-white shadow-sm' : 'text-navy hover:bg-track'}`}
          style={i === idx ? { background: 'var(--grad-cta-green)' } : undefined}
        >
          {MONTH_HEB[mo]}
        </button>
      ))}
    </div>
  )
}

function StatTile({ icon, value, label, sub }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      {icon ? <img src={icon} alt="" className="h-11 w-auto" draggable="false" /> : null}
      <div className="min-w-0">
        <div className="font-display text-2xl font-black leading-none tabular-nums text-navy">{value}</div>
        <div className="text-[13px] font-semibold uppercase tracking-wide text-green">{label}</div>
        {sub ? <div className="text-xs text-muted">{sub}</div> : null}
      </div>
    </Card>
  )
}

function ArmyReport({ monthIdx, monthHeb, onPickSchool }) {
  const report = useMemo(() => getArmyReport(monthIdx), [monthIdx])
  const [sort, setSort] = useState('accomplished')
  const ratio = (r) => r.accomplished / (r.goal || 1) // % of quota, as a tiebreaker
  const rows = [...report.rows].sort((a, b) =>
    sort === 'met'
      ? b.pctMet - a.pctMet || ratio(b) - ratio(a) || b.accomplished - a.accomplished || a.name.localeCompare(b.name)
      : b.accomplished - a.accomplished || b.pctMet - a.pctMet || a.name.localeCompare(b.name),
  )

  const totals = report.rows.reduce(
    (a, r) => ({
      registered: a.registered + r.registered,
      goal: a.goal + r.goal,
      accomplished: a.accomplished + r.accomplished,
      participated: a.participated + Math.round((r.pctParticipated / 100) * r.registered),
      met: a.met + Math.round((r.pctMet / 100) * r.registered),
    }),
    { registered: 0, goal: 0, accomplished: 0, participated: 0, met: 0 },
  )
  const pctGoal = totals.goal ? Math.min(100, Math.round((totals.accomplished / totals.goal) * 100)) : 0
  const pctPart = totals.registered ? Math.round((totals.participated / totals.registered) * 100) : 0
  const pctMet = totals.registered ? Math.round((totals.met / totals.registered) * 100) : 0
  const maxAcc = Math.max(1, ...report.rows.map((r) => r.accomplished))

  const seg = (active) => `rounded-full px-4 py-1.5 font-cond text-sm uppercase tracking-wide transition ${active ? 'text-white shadow-sm' : 'text-navy hover:bg-white/40'}`

  return (
    <>
      {/* month summary band */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={asset('design/icon-soldier-hat.png')} value={fmt(totals.accomplished)} label="Kapitlach" sub={`of ${fmt(totals.goal)} goal · ${pctGoal}%`} />
        <StatTile icon={asset('design/icon-school.png')} value={fmt(report.rows.length)} label="Schools" sub={`${fmt(totals.registered)} soldiers`} />
        <StatTile icon={asset('design/flag.png')} value={`${pctPart}%`} label="Participated" sub={`${fmt(totals.participated)} soldiers`} />
        <StatTile icon={asset('design/medal-gold.png')} value={`${pctMet}%`} label="Met Quota" sub={`${fmt(totals.met)} soldiers`} />
      </section>

      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="sh">Army Report · <span className="font-heb">{monthHeb}</span></p>
            <h2 className="font-display text-xl font-black text-navy">Schools, ranked</h2>
          </div>
          <div className="inline-flex rounded-full bg-track p-1 font-cond">
            <button onClick={() => setSort('accomplished')} className={seg(sort === 'accomplished')} style={sort === 'accomplished' ? { background: 'var(--grad-cta-green)' } : undefined}>Kapitlach</button>
            <button onClick={() => setSort('met')} className={seg(sort === 'met')} style={sort === 'met' ? { background: 'var(--grad-cta-green)' } : undefined}>% Met</button>
          </div>
        </div>

        <div className="divide-y divide-line">
          {rows.map((r, i) => {
            const color = COLORS[i % COLORS.length]
            return (
              <button
                key={r.id}
                onClick={() => onPickSchool(r.id, r.name)}
                className="grid w-full grid-cols-[auto_auto_1fr] items-center gap-x-3 gap-y-3 px-4 py-3 text-left transition hover:bg-black/[0.03] sm:grid-cols-[auto_auto_minmax(0,1.4fr)_minmax(0,1.6fr)_auto] sm:gap-4 sm:px-5"
              >
                <span className="grid w-8 place-items-center">
                  {i < 3 ? <img src={asset(`design/${MEDALS[i]}.png`)} alt={`#${i + 1}`} className="h-8 w-auto" /> : <span className="font-display text-lg font-bold italic text-blue-accent">{i + 1}</span>}
                </span>
                <Mono name={r.name} color={color} />
                <span className="min-w-0">
                  <span className="block truncate font-display text-[17px] font-bold text-navy">{r.name}</span>
                  <span className="text-xs text-muted">{fmt(r.registered)} soldiers</span>
                </span>

                {/* goal progress + accomplished */}
                <span className="col-span-3 sm:col-span-1">
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-display font-black tabular-nums text-green">{fmt(r.accomplished)}</span>
                    <span className="text-xs text-muted">of {fmt(r.goal)}</span>
                  </div>
                  <Bar pct={(r.accomplished / maxAcc) * 100} color={color} />
                  <div className="mt-2 flex gap-2">
                    <Pill className="!bg-track !text-[10.5px]">🚩 {r.pctParticipated}% part.</Pill>
                    <Pill className="!bg-green/15 !text-green !text-[10.5px]">✓ {r.pctMet}% met</Pill>
                  </div>
                </span>

                <span className="hidden text-right sm:block">
                  <span className="text-xs text-muted">view classes</span>
                  <span className="block text-blue">→</span>
                </span>
              </button>
            )
          })}
        </div>
      </Card>
    </>
  )
}

function BaseReport({ schoolId, monthIdx, monthHeb, onPickClass }) {
  const report = useMemo(() => getBaseReport(schoolId, monthIdx), [schoolId, monthIdx])
  if (!report) return null
  const rows = [...report.rows].sort((a, b) => b.accomplished - a.accomplished)
  const t = report.rows.reduce((a, c) => ({ size: a.size + c.size, goal: a.goal + c.goal, accomplished: a.accomplished + c.accomplished, completed: a.completed + c.completed, perfect: a.perfect + (c.perfect ? 1 : 0) }), { size: 0, goal: 0, accomplished: 0, completed: 0, perfect: 0 })
  const maxAcc = Math.max(1, ...report.rows.map((c) => c.accomplished))

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={asset('design/icon-soldier-hat.png')} value={fmt(t.accomplished)} label="Kapitlach" sub={`of ${fmt(t.goal)} · ${t.goal ? Math.round((t.accomplished / t.goal) * 100) : 0}%`} />
        <StatTile icon={asset('design/icon-school.png')} value={fmt(report.rows.length)} label="Classes" sub={`${fmt(t.size)} soldiers`} />
        <StatTile icon={asset('design/medal-gold.png')} value={`${t.size ? Math.round((t.completed / t.size) * 100) : 0}%`} label="Met Quota" sub={`${fmt(t.completed)} soldiers`} />
        <StatTile icon={asset('design/flag.png')} value={fmt(t.perfect)} label="Perfect Platoons" sub="classes at 100%" />
      </section>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <p className="sh">Base Report · <span className="font-heb">{monthHeb}</span></p>
          <h2 className="font-display text-xl font-black text-navy">{report.school} · classes</h2>
        </div>
        <div className="divide-y divide-line">
          {rows.map((c, i) => {
            const color = COLORS[i % COLORS.length]
            return (
              <button key={c.id} onClick={() => onPickClass(c.id, c.name)} className="grid w-full grid-cols-[auto_auto_1fr] items-center gap-x-3 gap-y-2 px-4 py-3 text-left transition hover:bg-black/[0.03] sm:px-5">
                <span className="grid w-8 place-items-center">
                  {i < 3 ? <img src={asset(`design/${MEDALS[i]}.png`)} alt={`#${i + 1}`} className="h-8 w-auto" /> : <span className="font-display text-lg font-bold italic text-blue-accent">{i + 1}</span>}
                </span>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-cond text-base text-white shadow-sm" style={{ background: color }}>{GRADE_LABEL[c.grade]}</span>
                <span className="min-w-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-display text-[17px] font-bold text-navy">{c.name} {c.perfect ? <span title="Perfect Platoon">⭐</span> : null}</span>
                    <span className="text-sm text-muted"><b className="text-green">{fmt(c.accomplished)}</b> / {fmt(c.goal)}</span>
                  </span>
                  <span className="mt-1.5 block"><Bar pct={(c.accomplished / maxAcc) * 100} color={c.perfect ? 'var(--color-green-mid)' : color} /></span>
                  <span className="mt-1.5 block"><Pill className={`!text-[10.5px] ${c.perfect ? '!bg-green/15 !text-green' : '!bg-track'}`}>✓ {c.completed}/{c.size} done</Pill></span>
                </span>
              </button>
            )
          })}
        </div>
      </Card>
    </>
  )
}

function PlatoonReport({ classId, monthIdx }) {
  const report = useMemo(() => getPlatoonReport(classId, monthIdx), [classId, monthIdx])
  if (!report) return null
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <p className="sh">Platoon Report</p>
          <h2 className="font-display text-xl font-black text-navy">{report.className}</h2>
        </div>
        <Pill className={report.completed === report.size ? '!bg-green !text-white' : ''}>{report.completed}/{report.size} completed</Pill>
      </div>
      <ul className="divide-y divide-line">
        {report.rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
            <span className={`grid h-7 w-7 place-items-center rounded-full text-sm ${r.met ? 'bg-green text-white' : 'bg-track text-muted'}`}>{r.met ? '✓' : '·'}</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-navy">{r.name}</span>
            <span className="text-sm"><span className="font-heb text-navy">{r.goalLabel}</span> <span className="text-muted">· said {fmt(r.said)}</span></span>
            <Pill className="!text-[10.5px]">L{r.ladder}</Pill>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function Reports() {
  const [monthIdx, setMonthIdx] = useState(CURRENT_MONTH_INDEX)
  const [school, setSchool] = useState(null)
  const [cls, setCls] = useState(null)
  const monthHeb = MONTH_HEB[ELAPSED_MONTHS[monthIdx]]

  return (
    <>
      <PageHero eyebrow="Public · Screen-Friendly" title="Monthly Reports">
        Every month has its own board, and all past months stay viewable.
      </PageHero>

      <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-8 sm:px-6 lg:px-10">
        <MonthTabs idx={monthIdx} setIdx={(i) => { setMonthIdx(i); setSchool(null); setCls(null) }} />

        {/* breadcrumb */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button className="font-semibold text-blue hover:underline" onClick={() => { setSchool(null); setCls(null) }}>Army</button>
          {school ? <><span className="text-muted">›</span><button className="font-semibold text-blue hover:underline" onClick={() => setCls(null)}>{school.name}</button></> : null}
          {cls ? <><span className="text-muted">›</span><span className="font-semibold text-navy">{cls.name}</span></> : null}
        </div>

        {!school ? (
          <ArmyReport monthIdx={monthIdx} monthHeb={monthHeb} onPickSchool={(id, name) => setSchool({ id, name })} />
        ) : !cls ? (
          <BaseReport schoolId={school.id} monthIdx={monthIdx} monthHeb={monthHeb} onPickClass={(id, name) => setCls({ id, name })} />
        ) : (
          <PlatoonReport classId={cls.id} monthIdx={monthIdx} />
        )}
      </div>
    </>
  )
}
