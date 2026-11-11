import { useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useLiveData } from '@/lib/useLiveData.js'
import { Card, Button, SchoolLogo, ErrorNote, Textarea } from '@/components/ui.jsx'
import { CheckMark, IconImg, Meter, Pending, RaceToggle, StarMark } from '@/components/campaignBits.jsx'
import { fmt } from '@/lib/format.js'
import { asset } from '@/lib/asset.js'
import { GRADE_LABEL, MONTH_HEB } from '@/data/ladders.js'
import { rankSchools } from '@/lib/schoolRace.js'
import { BREADCRUMB_STYLE, MONTH_CHOOSER } from '@/lib/decisions.js'
import {
  CAMPAIGN_YEAR,
  CURRENT_MONTH,
  getArmyReport,
  getBaseReport,
  getCampaignCalendar,
  getPlatoonReport,
  overrideQuota,
  undoQuotaOverride,
} from '@/services/api.js'
import { QUOTA_ADJUSTED_LABEL, overrideAccessStatus } from '@/lib/quotaOverride.js'

const COLORS = ['#2a5fb8', '#0e8aa6', '#5b3fa8', '#c77d0e', '#1f7a4d', '#c0392b', '#2246a8', '#8b5cf6']
const MEDALS = ['medal-gold', 'medal-silver', 'medal-bronze']

// Months plus each data-backed holiday (from holidayMonths), slotted in right
// after Tishrei. Holidays now have full boards, so board:true like any month.
function chipsFor(months, holidays = []) {
  const out = []
  let placed = false
  const list = months || []
  for (const month of list) {
    out.push({ key: month, board: true })
    if (month === 'Tishrei') {
      for (const h of holidays) out.push({ key: h, board: true })
      placed = true
    }
  }
  if (!placed) {
    for (const h of holidays) out.push({ key: h, board: true })
  }
  return out
}

function StatTile({ icon, value, label, sub }) {
  return (
    <Card className="flex min-w-0 items-center gap-3 p-3 sm:p-4">
      <span className="grid h-11 w-11 flex-none place-items-center">{icon}</span>
      <div className="min-w-0">
        <div className="break-words font-display text-[clamp(1.15rem,4.5vw,1.7rem)] font-black leading-none tabular-nums text-navy">{value}</div>
        <div className="text-[12px] font-semibold uppercase leading-tight tracking-normal text-green sm:text-[13px]">{label}</div>
        {sub ? <div className="text-xs leading-snug text-muted">{sub}</div> : null}
      </div>
    </Card>
  )
}

function Rank({ n }) {
  if (n > 2) return <span className="font-display text-lg font-bold italic text-blue-accent">{n + 1}</span>
  return <img src={asset(`design/${MEDALS[n]}.png`)} alt={`#${n + 1}`} className="h-8 w-auto" />
}

export default function Reports() {
  const { isAdmin, admin } = useAuth()
  const [params, setParams] = useSearchParams()
  const [sort, setSort] = useState('finished')
  const yearParam = params.get('y')
  const monthParam = params.get('m')
  const schoolId = params.get('school')
  const classId = params.get('class')
  const display = params.get('display') === '1'

  const { data: calendar } = useLiveData(() => getCampaignCalendar(yearParam || undefined), [yearParam])
  const year = yearParam || String(calendar?.year || CAMPAIGN_YEAR)
  const month = monthParam || calendar?.currentMonth || CURRENT_MONTH
  const months = calendar?.months || []
  const period = { year, month }

  function write(next) {
    const p = new URLSearchParams(params)
    Object.entries(next).forEach(([key, value]) => {
      if (value == null || value === '') p.delete(key)
      else p.set(key, String(value))
    })
    setParams(p)
  }

  const army = useLiveData(
    () => (schoolId ? Promise.resolve(null) : getArmyReport(null, period)),
    [year, month, schoolId],
  )
  const base = useLiveData(
    () => (schoolId ? getBaseReport(schoolId, null, period) : Promise.resolve(null)),
    [schoolId, year, month],
  )
  const platoon = useLiveData(
    () => (classId ? getPlatoonReport(classId, null, period) : Promise.resolve(null)),
    [classId, year, month],
  )

  const rows = useMemo(() => (army.data?.rows || []).map((r) => ({
    ...r,
    saidMonth: r.accomplished,
    pct: r.pct ?? (r.goal ? Math.round((r.accomplished / r.goal) * 100) : 0),
    pctMet: r.pctMet || 0,
    pctParticipated: r.pctParticipated || 0,
    minutesPct: r.minutesPct || 0,
  })), [army.data])
  const ordered = rankSchools(rows, sort)
  const pctGoal = useMemo(() => {
    const goal = rows.reduce((a, r) => a + (r.goal || 0), 0)
    const done = rows.reduce((a, r) => a + (r.accomplished || 0), 0)
    return goal ? Math.round((done / goal) * 100) : 0
  }, [rows])

  const crumb = BREADCRUMB_STYLE === 'site'
    ? 'font-cond text-[18px] uppercase tracking-[0.04em]'
    : 'text-sm font-semibold'
  const className = platoon.data?.className
    || base.data?.rows?.find((r) => String(r.id) === String(classId))?.name

  // Reports are admin-only. The link lives on the Admin Dashboard; anyone who
  // reaches /reports without an admin session is sent to the admin login.
  if (!isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <div className={display ? 'wwtc-display' : ''}>
      <section className="hero-navy">
        <div className="mx-auto max-w-[1200px] px-4 py-8 text-white sm:px-6 lg:px-10">
          <h1 className="font-display text-4xl font-black md:text-5xl">Monthly Reports</h1>
        </div>
      </section>

      <div className={`mx-auto max-w-[1200px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 ${display ? 'max-w-none text-[18px]' : ''}`}>
        <div className="space-y-3">
          <label className="text-sm font-semibold text-navy">
            Year
            <select className="ml-2 rounded-xl border border-line bg-card px-3 py-2" value={year} onChange={(e) => write({ y: e.target.value, m: null, school: null, class: null })}>
              {(calendar?.years || [year]).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <div className={MONTH_CHOOSER === 'scroll' ? 'flex gap-1 overflow-x-auto pb-1' : 'flex flex-wrap gap-1'}>
            {chipsFor(months.length ? months : [month], calendar?.holidayMonths || []).map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => write({ y: year, m: chip.key })}
                className={`rounded-xl px-3 py-1.5 font-heb text-lg transition ${chip.key === month ? 'text-white shadow-sm' : 'bg-card text-navy ring-1 ring-line hover:bg-track'}`}
                style={chip.key === month ? { background: 'var(--grad-cta-green)' } : undefined}
              >
                {MONTH_HEB[chip.key] || chip.key}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className={`flex flex-wrap items-center gap-2 text-navy ${crumb}`}>
            {(schoolId || classId) ? (
              <button type="button" className="rounded-full bg-navy px-3 py-1 text-sm font-semibold normal-case tracking-normal text-white" onClick={() => write(classId ? { class: null } : { school: null })}>Back</button>
            ) : null}
            <button type="button" className="hover:underline" onClick={() => write({ school: null, class: null })}>Army</button>
            {schoolId ? (<><span className="text-muted">›</span><button type="button" className="hover:underline" onClick={() => write({ class: null })}>{base.data?.school || 'Base'}</button></>) : null}
            {classId ? (<><span className="text-muted">›</span><span>{className || 'Platoon'}</span></>) : null}
          </div>
          <Button variant="outline" className="!px-3 !py-1.5 !text-sm" onClick={() => write({ display: display ? null : '1' })}>
            {display ? 'Exit display mode' : 'Display mode'}
          </Button>
        </div>

        {classId ? (
          <PlatoonView data={platoon.data} error={platoon.error} loading={platoon.loading} reload={platoon.reload} admin={admin} year={year} />
        ) : schoolId ? (
          <BaseView data={base.data} error={base.error} loading={base.loading} reload={base.reload} onPickClass={(id) => write({ class: id })} />
        ) : (
          <ArmyView
            rows={ordered}
            raw={rows}
            error={army.error}
            loading={army.loading}
            reload={army.reload}
            sort={sort}
            setSort={setSort}
            pctGoal={pctGoal}
            onPickSchool={(id) => write({ school: id, class: null })}
          />
        )}
      </div>
    </div>
  )
}

function ArmyView({ rows, raw, error, loading, reload, sort, setSort, pctGoal, onPickSchool }) {
  if (error) return <ErrorNote error={error} onRetry={reload} what="the army report" />
  if (!raw.length && loading) return <Pending label="Getting the army report" />
  const totals = raw.reduce((a, r) => ({
    registered: a.registered + (r.registered || 0),
    goal: a.goal + (r.goal || 0),
    accomplished: a.accomplished + (r.accomplished || 0),
    participated: a.participated + (r.participated ?? 0),
    met: a.met + (r.met ?? 0),
    minutes: a.minutes + (r.minutes || 0),
    minutesGoal: a.minutesGoal + (r.minutesGoal || 0),
  }), { registered: 0, goal: 0, accomplished: 0, participated: 0, met: 0, minutes: 0, minutesGoal: 0 })
  const pctPart = totals.registered ? Math.round((totals.participated / totals.registered) * 100) : 0
  const pctMet = totals.registered ? Math.round((totals.met / totals.registered) * 100) : 0
  const pctTime = totals.minutesGoal ? Math.round((totals.minutes / totals.minutesGoal) * 100) : 0
  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={<IconImg name="book" className="h-11 w-auto" />} value={fmt(totals.accomplished)} label="Kapitlach" sub={`of ${fmt(totals.goal)} goal · ${pctGoal}%`} />
        <StatTile icon={<IconImg name="school" className="h-11 w-auto" />} value={fmt(raw.length)} label="Schools" sub={`${fmt(totals.registered)} soldiers`} />
        <StatTile icon={<IconImg name="hat" className="h-11 w-auto" />} value={`${pctPart}%`} label="Participated" sub={`${fmt(totals.participated)} soldiers`} />
        <StatTile icon={<CheckMark className="h-9 w-9" />} value={`${pctMet}%`} label="Completed Kapitlach Quota" sub={`${fmt(totals.met)} soldiers · time ${pctTime}%`} />
      </section>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
          <h2 className="w-full font-display text-xl font-black text-navy sm:w-auto">Schools, Ranked <span className="font-semibold text-muted">· {pctGoal}% by kapitlach</span></h2>
          <RaceToggle value={sort} onChange={setSort} />
        </div>
        <div className="divide-y divide-line">
          {rows.map((r, i) => {
            const pct = r.goal ? Math.round((r.accomplished / r.goal) * 100) : 0
            return (
              <div key={r.id} className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[auto_auto_minmax(0,1.1fr)_minmax(0,1.5fr)_auto] sm:px-5">
                <Rank n={i} />
                <SchoolLogo school={{ name: r.name, color: COLORS[i % COLORS.length], logo: r.logo }} size={44} />
                <span className="min-w-0 whitespace-normal font-display text-[17px] font-bold leading-tight text-navy">{r.name}<span className="mt-0.5 block text-xs font-semibold text-muted">{fmt(r.registered)} soldiers</span></span>
                <span className="min-w-0">
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-display font-black tabular-nums text-green">{fmt(r.accomplished)}</span>
                    <span className="text-xs text-muted">of {fmt(r.goal)} · {pct}%</span>
                  </div>
                  <Meter pct={pct} color={COLORS[i % COLORS.length]} />
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-navy">
                    <span className="inline-flex items-center gap-1 rounded-full bg-track px-2 py-1"><IconImg name="hat" className="h-3.5 w-auto" /> {r.pctParticipated}% participated</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-green/15 px-2 py-1 text-green"><CheckMark className="h-3.5 w-3.5" /> {r.pctMet}% completed</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-track px-2 py-1"><IconImg name="book" className="h-3.5 w-auto" /> {r.pct}% kapitlach</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-track px-2 py-1"><IconImg name="clock" className="h-3.5 w-auto" /> {r.minutesPct || 0}% time</span>
                  </div>
                </span>
                <button type="button" className="btn btn-o !px-3 !py-2 !text-[14px]" onClick={() => onPickSchool(r.id)}>View classes</button>
              </div>
            )
          })}
        </div>
      </Card>
    </>
  )
}

function BaseView({ data, error, loading, reload, onPickClass }) {
  if (error) return <ErrorNote error={error} onRetry={reload} what="this base" />
  if (!data) return loading ? <Pending label="Getting this base" /> : <ErrorNote error="This base has no report for that month." onRetry={reload} what="this base" />
  const rows = [...(data.rows || [])].sort((a, b) => (b.goal ? b.accomplished / b.goal : 0) - (a.goal ? a.accomplished / a.goal : 0) || b.accomplished - a.accomplished)
  const t = rows.reduce((a, c) => ({ size: a.size + c.size, goal: a.goal + c.goal, accomplished: a.accomplished + c.accomplished, completed: a.completed + c.completed, perfect: a.perfect + (c.perfect ? 1 : 0) }), { size: 0, goal: 0, accomplished: 0, completed: 0, perfect: 0 })
  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={<IconImg name="book" className="h-11 w-auto" />} value={fmt(t.accomplished)} label="Kapitlach" sub={`of ${fmt(t.goal)} · ${t.goal ? Math.round((t.accomplished / t.goal) * 100) : 0}%`} />
        <StatTile icon={<IconImg name="platoon" className="h-11 w-auto" />} value={fmt(rows.length)} label="Classes" sub={`${fmt(t.size)} soldiers`} />
        <StatTile icon={<CheckMark className="h-9 w-9" />} value={`${t.size ? Math.round((t.completed / t.size) * 100) : 0}%`} label="Completed Kapitlach Quota" sub={`${fmt(t.completed)} soldiers`} />
        <StatTile icon={<StarMark className="h-8 w-8" />} value={fmt(t.perfect)} label="Perfect Platoons" sub="every soldier finished" />
      </section>
      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-xl font-black text-navy">{data.school} · classes</h2>
        </div>
        <div className="divide-y divide-line">
          {rows.map((c, i) => {
            const pct = c.goal ? Math.round((c.accomplished / c.goal) * 100) : 0
            return (
              <button key={c.id} type="button" onClick={() => onPickClass(c.id)} className="grid w-full grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.03] sm:px-5">
                <Rank n={i} />
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-navy font-cond text-sm text-gold">{GRADE_LABEL[c.grade] || c.grade}</span>
                <span className="min-w-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-display text-[17px] font-bold text-navy">{c.name}</span>
                    <span className="text-sm text-muted"><b className="text-green">{fmt(c.accomplished)}</b> / {fmt(c.goal)}</span>
                  </span>
                  <span className="mt-1.5 block"><Meter pct={pct} color={c.perfect ? 'var(--color-green-mid)' : COLORS[i % COLORS.length]} /></span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ${c.perfect ? 'bg-green/15 text-green' : 'bg-track text-navy'}`}>
                      {c.completed} of {c.size} chayolim
                    </span>
                    {c.perfect ? <span className="inline-flex items-center gap-1 text-[12px] font-bold text-navy"><StarMark className="h-4 w-4" /> Perfect Platoon{c.teacher ? ` · ${c.teacher}` : ''}</span> : null}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </Card>
    </>
  )
}

function PlatoonView({ data, error, loading, reload, admin, year }) {
  const [pending, setPending] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  if (error) return <ErrorNote error={error} onRetry={reload} what="this platoon" />
  if (!data) return loading ? <Pending label="Getting this platoon" /> : <ErrorNote error="This platoon has no soldiers on the report for that month." onRetry={reload} what="this platoon" />
  const perfect = data.size > 0 && data.completed === data.size
  // Paint names only when the server (or the demo gate) set roll. A response
  // that still contains rows without that flag — an older API — stays hidden.
  const showRoll = data.roll === true && Array.isArray(data.rows)
  const canOverride = showRoll && overrideAccessStatus(admin, data.schoolId) === 200

  function openOverride(row) {
    setReason('')
    setNote('')
    setPending({ mode: 'override', row })
  }
  function openUndo(row) {
    setNote('')
    setPending({ mode: 'undo', row })
  }
  async function confirm() {
    if (!pending) return
    setBusy(true)
    setNote('')
    try {
      const body = { kidId: pending.row.id, year, month: data.month }
      if (pending.mode === 'undo') await undoQuotaOverride(body)
      else await overrideQuota({ ...body, reason })
      setPending(null)
      reload()
    } catch (err) {
      setNote(err?.message || 'Could not save the override.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="sh">Platoon</p>
          <h2 className="font-display text-xl font-black text-navy">{data.className}</h2>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${perfect ? 'bg-green text-white' : 'bg-track text-navy'}`}>
          {perfect ? <StarMark className="h-4 w-4" /> : <CheckMark className="h-4 w-4" />}
          {data.completed} of {data.size} completed kapitlach quota
        </span>
      </div>
      {showRoll ? (
        <ul className="divide-y divide-line">
          {data.rows.map((r) => {
            const under = !r.met && Number(r.said) > 0 && Number(r.said) < Number(r.goal)
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
                <span className={`grid h-8 w-8 place-items-center rounded-full text-sm ${r.met ? 'bg-green text-white' : 'bg-track text-muted'}`}>{r.met ? '✓' : '·'}</span>
                <span className="min-w-0 flex-1 basis-[calc(100%-3rem)] font-semibold text-navy sm:basis-auto">{r.name}</span>
                <span className="text-sm text-navy">
                  {r.quotaAdjusted ? null : <span className="font-heb">{r.goalLabel}</span>}
                  <span className="text-muted">{r.quotaAdjusted ? '' : ' · '}said {fmt(r.said)} of {fmt(r.goal)}</span>
                </span>
                {r.ladder ? <span className="rounded-full bg-track px-2 py-1 text-[11px] font-bold text-navy">L{r.ladder}</span> : null}
                {canOverride && under ? (
                  <button type="button" className="btn btn-o !min-h-11 !px-3 !py-1.5 !text-[13px]" onClick={() => openOverride(r)}>Override</button>
                ) : null}
                {canOverride && r.quotaAdjusted ? (
                  <button type="button" className="btn btn-ghost !min-h-11 !px-3 !py-1.5 !text-[13px]" onClick={() => openUndo(r)}>Undo override</button>
                ) : null}
                {r.quotaAdjusted ? (
                  <span className="basis-full pl-11 text-[11px] font-semibold leading-snug text-navy/70">{QUOTA_ADJUSTED_LABEL}{r.originalGoal != null ? ` · was ${fmt(r.originalGoal)}` : ''}</span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      {note && !pending ? <p className="px-5 py-3 text-sm text-navy">{note}</p> : null}
      {pending ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-navy/75 p-4" role="dialog" aria-modal="true" aria-labelledby="override-title">
          <div className="w-full max-w-md rounded-3xl bg-card p-5 shadow-card sm:p-6">
            <h3 id="override-title" className="font-display text-xl font-black text-navy">
              {pending.mode === 'undo' ? 'Undo this override?' : 'Override this month’s quota?'}
            </h3>
            {pending.mode === 'undo' ? (
              <p className="mt-2 text-sm text-navy">
                Put {pending.row.name}’s {data.month} quota back to {fmt(pending.row.originalGoal)}. This month only. Their ladder stays the same.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-navy">
                  {pending.row.name} entered {fmt(pending.row.said)} of {fmt(pending.row.goal)} for {data.month}. This month’s quota becomes {fmt(pending.row.said)}, so they count as having met it. Next month and their ladder stay the same.
                </p>
                <label className="mt-4 block text-sm font-semibold text-navy">
                  Reason <span className="font-normal text-muted">(optional)</span>
                  <Textarea className="mt-1" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this month’s quota should match what they entered" />
                </label>
              </>
            )}
            {note ? <p className="mt-3 text-sm text-navy">{note}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="navy" disabled={busy} onClick={confirm}>{busy ? 'Saving…' : pending.mode === 'undo' ? 'Undo override' : 'Override'}</Button>
              <Button variant="ghost" disabled={busy} onClick={() => { setPending(null); setNote('') }}>Cancel</Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
