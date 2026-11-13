import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useLiveData } from '@/lib/useLiveData.js'
import { Card, Pill, Button, SchoolLogo } from '@/components/ui.jsx'
import { PageHero } from './_page.jsx'
import { fmt } from '@/lib/format.js'
import { GRADE_LABEL, LADDERS, MONTH_HEB, finishGrade } from '@/data/ladders.js'
import { openLadders } from '@/lib/schoolLadders.js'
import { PLAIN_MONTHS } from '@/lib/hebrewYear.js'
import { firstMonthFromRow, gradeEndMonth } from '@/lib/schoolYear.js'
import {
  getSchools,
  getSchool,
  getBaseReport,
  getPlatoonReport,
  adminSetLadder,
  notCompleted,
  setSchoolDedication,
  setSchoolYearStart,
  setSchoolLadders,
  removeSchoolDedication,
  getHqVerify,
  getArmyDedication,
  setArmyDedication,
  getFlagQueue,
  reviewFlag,
} from '@/services/api.js'
import { schoolCampaignPath, useCampaignClock } from '@/lib/useCampaignClock.js'
import { amountLabel, formatFlagWhen, thresholdLabel } from '@/lib/overEntry.js'
import { notDoneHeading, notDoneView } from '@/lib/notCompleted.js'
import ClassName, { HebrewClassName } from '@/components/ClassName.jsx'
import { formatClassName } from '@/lib/formatClassName.js'

const ROW_STRIPE = 'odd:bg-white even:bg-gray-100'
import CustomLadderTool from '@/components/CustomLadderTool.jsx'

function HqTools() {
  const { data, error, reload } = useLiveData(() => getHqVerify(), [])
  const { data: dedication, reload: reloadDedication } = useLiveData(() => getArmyDedication(), [])
  // getArmyDedication is async, so `dedication` is null on the first render and
  // arrives a moment later. `draft` is null until the admin actually types;
  // until then the textarea shows whatever is already saved (`dedication.text`),
  // so returning to the page always shows the existing dedication.
  const [draft, setDraft] = useState(null)
  const text = draft ?? (dedication?.text || '')
  const [savedNote, setSavedNote] = useState('')
  return (
    <Card className="p-5 sm:p-6">
      <p className="sh">Check the numbers</p>
      <p className="mt-1 text-sm text-muted">The same figures the home page shows, with the schools that still need a shield uploaded on mashpia.</p>
      {error ? <p className="mt-3 text-sm text-navy">Couldn’t read the check. <button type="button" className="underline" onClick={reload}>Try again</button></p> : null}
      {data?.home ? (
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <p><b className="block font-display text-2xl">{data.home.soldiers}</b> Soldiers</p>
          <p><b className="block font-display text-2xl">{data.home.participatedSoldiers}</b> Participated</p>
          <p><b className="block font-display text-2xl">{data.home.metSoldiers}</b> Completed quota</p>
          <p><b className="block font-display text-2xl">{data.home.pct}%</b> Kapitlach</p>
        </div>
      ) : <p className="mt-3 text-sm text-muted">Getting the check…</p>}
      {data?.missingLogos?.length ? (
        <p className="mt-3 text-sm text-navy">No shield yet: {data.missingLogos.join(', ')}</p>
      ) : null}
      <div className="mt-5">
        <p className="sh">Army dedication</p>
        <textarea value={text} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="This month’s Tehillim is dedicated…" className="mt-2 w-full rounded-xl border border-line bg-[#eef4ff] px-3 py-2 text-navy" />
        <Button variant="navy" className="mt-2" onClick={async () => { await setArmyDedication(text); setSavedNote('Saved for this month.'); reloadDedication() }}>Save dedication</Button>
        {savedNote ? <p className="mt-2 text-sm text-green">{savedNote}</p> : null}
      </div>
    </Card>
  )
}

// The month the school's first Shabbos Mevorchim blesses. Tishrei is today's
// year (grade ends Elul). Shvat means Mevorchim Shvat is quota position 1
// and the grade ends in Teves. HQ and that school's admin only — this page
// is already limited to them.
function SchoolYearSetting({ school, onSaved }) {
  // Nothing saved (no yearStart on the school) is Tishrei, already selected.
  const saved = firstMonthFromRow(school)
  const [month, setMonth] = useState(saved)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  async function save() {
    setBusy(true)
    setNote('')
    try {
      await setSchoolYearStart(school.id, month)
      setNote(`Saved. The grade year ends in ${gradeEndMonth(month)}.`)
      onSaved()
    } catch (e) {
      setNote(e?.message || 'Could not save the school year.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="p-5 sm:p-6">
      <p className="sh">School year starts in</p>
      <p className="mt-1 text-sm text-muted">
        The first Shabbos Mevorchim of the grade year. <span className="font-heb">{MONTH_HEB[month]}</span> is quota position 1.
        The grade ends in {gradeEndMonth(month)}.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="w-full text-sm sm:w-auto">
          <span className="mb-1 block font-semibold text-navy">First month</span>
          <select
            aria-label="School year starts in"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-line bg-[#eef4ff] px-3 py-2 sm:min-h-0 sm:w-auto"
          >
            {PLAIN_MONTHS.map((name) => (
              <option key={name} value={name}>{name} · {MONTH_HEB[name]}</option>
            ))}
          </select>
        </label>
        <Button variant="navy" onClick={save} disabled={busy || month === saved}>{busy ? 'Saving…' : 'Save'}</Button>
      </div>
      {note ? <p className="mt-3 text-sm font-semibold text-navy">{note}</p> : null}
    </Card>
  )
}

// Turn individual ladders off for this school. Every ladder starts on.
// A custom ladder is not in this list and stays available.
function SchoolLadderSetting({ school, onSaved }) {
  const saved = (school.hiddenLadders || []).map(Number)
  const [hidden, setHidden] = useState(() => new Set(saved))
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  function toggle(ladder) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(ladder)) next.delete(ladder)
      else next.add(ladder)
      return next
    })
  }
  const same = saved.length === hidden.size && saved.every((ladder) => hidden.has(ladder))
  async function save() {
    setBusy(true)
    setNote('')
    try {
      await setSchoolLadders(school.id, [...hidden])
      setNote('Saved. Soldiers and the virtual commander skip the ladders that are off.')
      onSaved()
    } catch (e) {
      setNote(e?.message || 'Could not save the ladders.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="p-5 sm:p-6">
      <p className="sh">Ladders for this school</p>
      <p className="mt-1 text-sm text-muted">
        Turn a ladder off to hide it from the soldier’s picker and from the virtual commander’s suggestions. Every ladder starts on. A custom ladder stays available.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {LADDERS.map((ladder) => {
          const on = !hidden.has(ladder)
          return (
            <li key={ladder}>
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-[#eef4ff] px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(ladder)}
                  aria-label={`Ladder ${ladder}`}
                />
                <span className="font-semibold text-navy">
                  Ladder {ladder}
                  <span className="mt-0.5 block font-normal text-muted">finish training by {GRADE_LABEL[String(finishGrade(ladder))]} grade</span>
                </span>
                <span className={`ml-auto text-xs font-bold uppercase ${on ? 'text-green' : 'text-muted'}`}>{on ? 'On' : 'Off'}</span>
              </label>
            </li>
          )
        })}
      </ul>
      <Button variant="navy" className="mt-3" onClick={save} disabled={busy || same}>{busy ? 'Saving…' : 'Save ladders'}</Button>
      {note ? <p className="mt-3 text-sm font-semibold text-navy">{note}</p> : null}
    </Card>
  )
}

// School admins add / edit / remove their school's monthly dedication.
function DedicationEditor({ school, onSaved, month }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(school.dedication?.text || '')
  const open = () => { setText(school.dedication?.text || ''); setEditing(true) }
  const save = () => { setSchoolDedication(school.id, text); setEditing(false); onSaved() }
  const remove = () => { removeSchoolDedication(school.id); setEditing(false); setText(''); onSaved() }
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="sh">Dedication · <span className="font-heb">{MONTH_HEB[month] ?? month}</span></p>
        {!editing ? (
          <div className="flex gap-2">
            <Button variant="outline" className="!px-3 !py-1 !text-sm max-sm:!min-h-11" onClick={open}>{school.dedication ? 'Edit' : 'Add dedication'}</Button>
            {school.dedication ? <Button variant="ghost" className="!px-3 !py-1 !text-sm max-sm:!min-h-11" onClick={remove}>Remove</Button> : null}
          </div>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="This month’s Tehillim is dedicated…"
            className="w-full rounded-xl border border-line bg-[#eef4ff] px-3 py-2 text-navy outline-none transition focus:border-green"
          />
          <div className="mt-2 flex gap-2">
            <Button variant="navy" onClick={save}>Save</Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : school.dedication ? (
        <p className="mt-2 font-display text-lg italic text-navy">{school.dedication.text}</p>
      ) : (
        <p className="mt-2 text-sm text-muted">No dedication this month yet.</p>
      )}
    </Card>
  )
}

// Put a whole school, one class, or one soldier onto a ladder. Picking a class
// reveals a child dropdown (all children in that class, or one named soldier).
function LadderSetter({ schoolId, classes, hiddenLadders }) {
  const [classId, setClassId] = useState('') // '' = whole school
  const [kidId, setKidId] = useState('') // '' = all children in the class
  const offered = openLadders(null, hiddenLadders)
  const [ladder, setLadder] = useState(offered[0] ?? LADDERS[0])
  if (offered.length && !offered.includes(Number(ladder))) setLadder(offered[0])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)

  // The children in the chosen class come from the platoon roll (staff-only;
  // an admin's token carries the roll). Whole-school needs no child list.
  // classId is the select's string value: a numeric class_id live, a slug like
  // "…-c1" in the demo roster. Pass it through as-is (the live API path and the
  // demo roster both match the raw value; coercing to a number breaks the demo).
  const { data: platoon, error: platoonError } = useLiveData(
    () => (classId ? getPlatoonReport(classId) : Promise.resolve(null)),
    [classId],
  )
  const kids = platoon?.rows ?? []

  // A new class selection clears any previously chosen child.
  function pickClass(value) {
    setClassId(value)
    setKidId('')
  }

  async function apply() {
    setBusy(true)
    setNote(null)
    try {
      const res = await adminSetLadder({
        schoolId,
        classId: classId || null,
        kidId: kidId || null,
        ladder: Number(ladder),
      })
      const n = res?.matched ?? res?.updated ?? 0
      setNote(
        n > 0
          ? { kind: 'ok', text: `Set ladder ${ladder} for ${n} soldier${n === 1 ? '' : 's'}.` }
          : { kind: 'warn', text: 'No enrolled soldiers matched that choice.' },
      )
    } catch (e) {
      setNote({ kind: 'warn', text: e?.message || 'Could not set the ladder.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <p className="sh mb-1">Set Ladders</p>
      <p className="mb-4 text-sm text-muted">Put a whole class — or the entire school — onto one ladder at once. Pick a class to set just one child.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-full text-sm sm:w-auto">
          <span className="mb-1 block font-semibold text-navy">Class</span>
          <select
            value={classId}
            onChange={(e) => pickClass(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-line bg-[#eef4ff] px-3 py-2 sm:min-h-0 sm:w-auto"
          >
            <option value="">Whole school</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{formatClassName(c.name)}</option>)}
          </select>
        </label>

        {classId ? (
          <label className="w-full text-sm sm:w-auto">
            <span className="mb-1 block font-semibold text-navy">Child</span>
            <select
              value={kidId}
              onChange={(e) => setKidId(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-line bg-[#eef4ff] px-3 py-2 sm:min-h-0 sm:w-auto"
            >
              <option value="">All children in this class</option>
              {kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </label>
        ) : null}

        <label className="w-full min-w-0 text-sm sm:w-auto">
          <span className="mb-1 block font-semibold text-navy">Ladder</span>
          <select
            value={ladder}
            onChange={(e) => setLadder(Number(e.target.value))}
            className="min-h-11 w-full max-w-full rounded-xl border border-line bg-[#eef4ff] px-3 py-2 sm:min-h-0 sm:w-auto"
          >
            {offered.map((L) => <option key={L} value={L}>Ladder {L} — finish training by {GRADE_LABEL[String(finishGrade(L))]} grade</option>)}
          </select>
        </label>

        <Button variant="navy" onClick={apply} disabled={busy || !offered.length}>{busy ? 'Applying…' : 'Apply'}</Button>
      </div>
      {classId && platoonError ? (
        <p className="mt-2 text-sm text-navy">Couldn’t load this class’s soldiers.</p>
      ) : null}
      {note ? (
        <p className={`mt-3 text-sm ${note.kind === 'ok' ? 'text-green' : 'text-navy'}`}>{note.text}</p>
      ) : null}
    </Card>
  )
}

function FlagQueue({ schoolId, all, actorName }) {
  const { data, error, reload } = useLiveData(() => getFlagQueue({ schoolId, all }), [schoolId, all])
  const [busy, setBusy] = useState(null)
  const [note, setNote] = useState('')
  async function decide(id, action) {
    setBusy(`${id}:${action}`)
    setNote('')
    try {
      await reviewFlag(id, action, actorName)
      setNote(action === 'accept'
        ? 'Accepted. It counts now.'
        : 'Removed. The soldier is back to the earlier value, or not counted for the month.')
      reload()
    } catch (e) {
      setNote(e?.message || 'Could not save that decision.')
    } finally {
      setBusy(null)
    }
  }
  const pending = data?.pending ?? []
  const recent = data?.recent ?? []
  return (
    <Card className="p-5 sm:p-6">
      <div data-flag-queue>
      <p className="sh">Flagged reports</p>
      <p className="mt-1 text-sm text-muted">
        These amounts do not count in totals, ranks, Perfect Platoon, or medals until you accept them.
        Remove voids the entry and puts the soldier back to the value they had before, or to not counted for the month.
      </p>
      {error ? <p className="mt-3 text-sm text-navy">Couldn’t load the queue. <button type="button" className="underline" onClick={reload}>Try again</button></p> : null}
      {!data && !error ? <p className="mt-3 text-sm text-muted">Getting flagged reports…</p> : null}
      {data && pending.length === 0 ? <p className="mt-3 text-sm font-semibold text-green">No flagged reports waiting.</p> : null}
      {pending.length > 0 ? (
        <>
          <ul className="mt-4 space-y-3 sm:hidden">
            {pending.map((row) => (
              <li key={row.id} className="rounded-xl border border-line p-3">
                <p className="font-semibold text-navy">{row.kidName}</p>
                <p className="text-sm text-muted"><ClassName name={row.className} />{all ? ` · ${row.schoolName}` : ''}</p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-xs uppercase text-muted">Amount</dt><dd className="font-semibold text-navy">{amountLabel(row)}</dd></div>
                  <div><dt className="text-xs uppercase text-muted">Threshold</dt><dd className="text-navy">above {thresholdLabel(row)}</dd></div>
                  <div className="col-span-2"><dt className="text-xs uppercase text-muted">Date</dt><dd className="text-navy">{formatFlagWhen(row.createdAt)}</dd></div>
                </dl>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button type="button" variant="navy" className="min-h-11" disabled={busy != null} onClick={() => decide(row.id, 'accept')}>{busy === `${row.id}:accept` ? 'Saving…' : 'Accept'}</Button>
                  <Button type="button" variant="outline" className="min-h-11" disabled={busy != null} onClick={() => decide(row.id, 'remove')}>{busy === `${row.id}:remove` ? 'Saving…' : 'Remove'}</Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="bg-track/60 text-muted">
                  <th className="px-3 py-2 font-cond uppercase">Kid</th>
                  <th className="px-3 py-2 font-cond uppercase">Class</th>
                  {all ? <th className="px-3 py-2 font-cond uppercase">Base</th> : null}
                  <th className="px-3 py-2 font-cond uppercase">Amount</th>
                  <th className="px-3 py-2 font-cond uppercase">Threshold</th>
                  <th className="px-3 py-2 font-cond uppercase">Date</th>
                  <th className="px-3 py-2 font-cond uppercase">Review</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold text-navy">{row.kidName}</td>
                    <td className="px-3 py-2"><ClassName name={row.className} /></td>
                    {all ? <td className="px-3 py-2">{row.schoolName}</td> : null}
                    <td className="px-3 py-2">{amountLabel(row)}</td>
                    <td className="px-3 py-2">above {thresholdLabel(row)}</td>
                    <td className="px-3 py-2">{formatFlagWhen(row.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button type="button" variant="navy" className="!px-3 !py-1 !text-sm" disabled={busy != null} onClick={() => decide(row.id, 'accept')}>Accept</Button>
                        <Button type="button" variant="outline" className="!px-3 !py-1 !text-sm" disabled={busy != null} onClick={() => decide(row.id, 'remove')}>Remove</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {note ? <p className="mt-3 text-sm font-semibold text-navy">{note}</p> : null}
      {recent.length > 0 ? (
        <div className="mt-5">
          <p className="text-sm font-semibold text-navy">Recent decisions</p>
          <ul className="mt-2 space-y-2 text-sm text-muted">
            {recent.slice(0, 8).map((row) => {
              const last = row.decisions?.[row.decisions.length - 1]
              const accepted = row.status === 'accepted'
              const verb = accepted ? 'Accepted' : 'Removed'
              const flip = accepted ? 'remove' : 'accept'
              const label = accepted ? 'Remove instead' : 'Accept instead'
              return (
                <li key={`${row.id}-${last?.at || 'decision'}`} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {verb} {row.kidName}
                    {last?.actorName ? ` · ${last.actorName}` : ''}
                    {last?.at ? ` · ${formatFlagWhen(last.at, true)}` : ''}
                  </span>
                  {row.status === 'accepted' || row.status === 'removed' ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="!min-h-11 !px-3 !py-1 !text-sm"
                      disabled={busy != null}
                      onClick={() => decide(row.id, flip)}
                    >
                      {busy === `${row.id}:${flip}` ? 'Saving…' : label}
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
      </div>
    </Card>
  )
}

// Soldier names come only from the staff platoon roll. A public response
// has roll:false and no rows, so this list stays empty for anyone else.
function ClassKids({ classId, period }) {
  const { data, loading, error, reload } = useLiveData(() => getPlatoonReport(classId, null, period), [classId, period?.year, period?.month])
  const showRoll = data?.roll === true && Array.isArray(data.rows)
  if (error) {
    return (
      <p className="border-t border-line px-4 py-2 text-sm text-navy">
        Couldn’t load soldiers. <button type="button" className="underline" onClick={reload}>Try again</button>
      </p>
    )
  }
  if (!data && loading) return <p className="border-t border-line px-4 py-2 text-sm text-muted">Getting soldiers…</p>
  if (!showRoll) return <p className="border-t border-line px-4 py-2 text-sm text-muted">Soldier names are shown only to staff.</p>
  if (!data.rows.length) return <p className="border-t border-line px-4 py-2 text-sm text-muted">No soldiers in this class.</p>
  return (
    <ul className="border-t border-line">
      {data.rows.map((r) => (
        <li key={r.id} className={`${ROW_STRIPE} flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm`}>
          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${r.met ? 'bg-green text-white' : 'bg-track text-muted'}`}>{r.met ? '✓' : '·'}</span>
          <span className="min-w-0 flex-1 font-semibold text-navy">{r.name}</span>
          <span className="text-navy">said {fmt(r.said)} of {fmt(r.goal)}</span>
        </li>
      ))}
    </ul>
  )
}

function ClassReport({ rows, month, period }) {
  const [open, setOpen] = useState(() => new Set())
  function toggle(id) {
    const key = String(id)
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const list = rows ?? []
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-3"><h3 className="font-display font-black text-navy">Class Report · {month}</h3></div>
      <ul className="sm:hidden">
        {list.map((c) => {
          const isOpen = open.has(String(c.id))
          return (
            <li key={c.id} className={`${ROW_STRIPE} border-t border-line`}>
              <button type="button" className="w-full px-4 py-3 text-left" aria-expanded={isOpen} onClick={() => toggle(c.id)}>
                <p className="font-semibold text-navy">
                  <HebrewClassName name={c.name} grade={c.grade} /> {c.perfect ? '★' : ''}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div><dt className="text-xs uppercase text-muted">Soldiers</dt><dd className="tabular-nums text-navy">{c.size}</dd></div>
                  <div><dt className="text-xs uppercase text-muted">Goal</dt><dd className="tabular-nums text-navy">{fmt(c.goal)}</dd></div>
                  <div><dt className="text-xs uppercase text-muted">Said</dt><dd className="font-bold tabular-nums text-green">{fmt(c.accomplished)}</dd></div>
                  <div><dt className="text-xs uppercase text-muted">Completed</dt><dd className="tabular-nums text-navy">{c.completed}/{c.size}</dd></div>
                </dl>
                <p className="mt-2 text-xs font-semibold text-navy">{isOpen ? 'Hide soldiers' : 'Show soldiers'}</p>
              </button>
                {isOpen ? <ClassKids classId={c.id} period={period} /> : null}
            </li>
          )
        })}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead><tr className="bg-track/60 text-muted">
            <th className="px-4 py-2 font-cond uppercase">Class</th>
            <th className="px-4 py-2 text-right font-cond uppercase">Soldiers</th>
            <th className="px-4 py-2 text-right font-cond uppercase">Goal</th>
            <th className="px-4 py-2 text-right font-cond uppercase">Said</th>
            <th className="px-4 py-2 text-right font-cond uppercase">Completed</th>
          </tr></thead>
          {list.map((c, i) => {
            const isOpen = open.has(String(c.id))
            const stripe = i % 2 === 0 ? 'bg-white' : 'bg-gray-100'
            return (
              <tbody key={c.id} className={stripe}>
                <tr className="border-t border-line">
                  <td className="px-4 py-2 font-semibold text-navy">
                    <button type="button" className="text-left" aria-expanded={isOpen} onClick={() => toggle(c.id)}>
                      <HebrewClassName name={c.name} grade={c.grade} /> {c.perfect ? '★' : ''}
                      <span className="mt-0.5 block text-xs font-semibold text-muted">{isOpen ? 'Hide soldiers' : 'Show soldiers'}</span>
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.size}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(c.goal)}</td>
                  <td className="px-4 py-2 text-right font-bold tabular-nums text-green">{fmt(c.accomplished)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.completed}/{c.size}</td>
                </tr>
                {isOpen ? (
                  <tr>
                    <td colSpan={5} className="p-0"><ClassKids classId={c.id} period={period} /></td>
                  </tr>
                ) : null}
              </tbody>
            )
          })}
        </table>
      </div>
    </Card>
  )
}

function NotDoneList({ classes }) {
  const view = notDoneView(classes)
  if (view.empty) {
    return <p className="mt-4 font-semibold text-green">Every soldier has completed this month — all Perfect Platoons! 🎉</p>
  }
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm font-semibold text-navy">{view.summary}</p>
      {view.sections.map((section) => (
        <section key={section.title} className="rounded-xl bg-track/40 p-3">
          <h4 className="font-display text-lg font-black text-navy">{section.title}</h4>
          <p className="text-sm font-semibold text-navy">{section.phrase}</p>
          {section.classes.length === 0 ? (
            <p className="mt-2 text-sm text-muted">None</p>
          ) : (
            <div className="mt-3 space-y-3">
              {section.classes.map((cls) => (
                <div key={cls.classId} className="rounded-lg bg-white px-3 py-2">
                  <p className="text-navy">
                    <span className="text-sm font-normal text-muted">Class: </span>
                    <bdi dir="auto" className="font-bold">{formatClassName(cls.className)}</bdi>
                  </p>
                  {cls.size > 0 ? <p className="mt-1 text-sm text-muted">{cls.size} soldiers</p> : null}
                  <p className="mt-1 text-sm text-navy">{cls.phrase}</p>
                  <ul className="mt-1 space-y-0.5 text-sm text-muted">
                    {cls.names.map((name, i) => (
                      <li key={`${cls.classId}-${i}`}>
                        <bdi dir="auto">{name}</bdi>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

export default function AdminDashboard() {
  const { admin, isSuper, logoutAdmin } = useAuth()
  const clock = useCampaignClock()
  const period = { year: clock.year, month: clock.currentMonth }
  const { data: allSchoolsData } = useLiveData(() => (isSuper ? getSchools(period) : Promise.resolve([])), [isSuper, period.year, period.month])
  const allSchools = allSchoolsData ?? []
  const [schoolId, setSchoolId] = useState(admin?.schoolId || null)
  const activeId = isSuper ? schoolId : (admin?.schoolId ?? null)
  // reloadSchool re-reads after editing the dedication (and on the live poll).
  const { data: school, error: schoolError, reload: reloadSchool } = useLiveData(
    () => (activeId ? getSchool(activeId, period) : Promise.resolve(null)),
    [activeId, period.year, period.month],
  )
  const { data: base } = useLiveData(() => (activeId ? getBaseReport(activeId, null, period) : Promise.resolve(null)), [activeId, period.year, period.month])
  const { data: missingData } = useLiveData(() => (activeId ? notCompleted(activeId) : Promise.resolve([])), [activeId])
  const missing = missingData ?? []

  if (!admin) return <Navigate to="/admin/login" replace />

  return (
    <>
      <PageHero eyebrow={isSuper ? 'HQ Command Center' : 'School Admin'} title="Admin Dashboard">
        {isSuper ? 'Run the campaign for the whole army.' : `Run the campaign for ${admin.name}.`}
      </PageHero>

      <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">Signed in as <span className="font-semibold text-navy">{admin.name}</span> {isSuper ? <Pill className="ml-1">HQ</Pill> : null}</p>
          <div className="flex flex-wrap gap-2 sm:items-center">
            <Button to="/reports" variant="outline" className="!px-3 !text-[15px] max-sm:min-h-11">Monthly Reports</Button>
            <Button to="/office/platoon-graphics" variant="outline" className="!px-3 !text-[15px] max-sm:min-h-11">Platoon Graphics</Button>
            <Button variant="ghost" className="!px-3 !text-[15px] max-sm:min-h-11" onClick={logoutAdmin}>Sign out</Button>
          </div>
        </div>

        <FlagQueue schoolId={isSuper ? null : admin.schoolId} all={!!isSuper} actorName={admin.name} />

        {isSuper ? <HqTools /> : null}

        {/* HQ: school switcher + worldwide snapshot */}
        {isSuper ? (
          <Card className="p-5 sm:p-6">
            <p className="sh mb-3">Choose a school</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {allSchools.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSchoolId(s.id)}
                  className={`flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-left transition sm:min-h-0 ${
                    s.id === activeId ? 'border-transparent bg-green text-white' : 'border-line bg-[#eef4ff] hover:bg-track'
                  }`}
                >
                  <SchoolLogo school={s} size={36} />
                  <span className="min-w-0 flex-1 whitespace-normal font-semibold leading-tight sm:truncate">{s.name}</span>
                  <span className={`shrink-0 text-sm ${s.id === activeId ? 'text-white/80' : 'text-muted'}`}>{s.pct}%</span>
                </button>
              ))}
            </div>
          </Card>
        ) : null}

        {!activeId ? (
          // Genuinely nothing selected — only an HQ admin who hasn't picked yet.
          <Card className="p-6 text-center text-muted">Pick a school above to manage it.</Card>
        ) : schoolError ? (
          <Card className="p-6 text-center text-muted">
            Couldn’t load this school.{' '}
            <button type="button" className="underline" onClick={reloadSchool}>Try again</button>
          </Card>
        ) : !school ? (
          // A school is selected (or this is a school admin) but its data is still loading.
          <Card className="p-6 text-center text-muted">Getting {isSuper ? 'the school' : 'your school'}…</Card>
        ) : (
          <>
            {/* School snapshot */}
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <SchoolLogo school={school} size={52} />
                  <div>
                    <h2 className="font-display text-2xl font-black text-navy">{school.name}</h2>
                    <p className="text-sm text-muted">{fmt(school.kids)} soldiers · {clock.currentMonth}</p>
                  </div>
                </div>
                <div className="grid w-full grid-cols-3 gap-2 text-left sm:flex sm:w-auto sm:gap-6 sm:text-right">
                  <div><p className="text-xs uppercase text-muted">Quota</p><p className="font-display text-xl font-black text-navy sm:text-2xl">{fmt(school.quotaMonth)}</p></div>
                  <div><p className="text-xs uppercase text-muted">Said</p><p className="font-display text-xl font-black text-green sm:text-2xl">{fmt(school.saidMonth)}</p></div>
                  <div><p className="text-xs uppercase text-muted sm:max-w-[9rem]">% of soldiers that met their quota</p><p className="font-display text-xl font-black text-navy sm:text-2xl">{school.pctMet}%</p></div>
                </div>
              </div>
              <Link to={schoolCampaignPath(school.id, period)} className="mt-3 inline-block text-sm font-semibold text-blue hover:underline">View public campaign page →</Link>
            </Card>

            <SchoolYearSetting key={school.id} school={school} onSaved={reloadSchool} />

            <SchoolLadderSetting key={`ladders-${school.id}`} school={school} onSaved={reloadSchool} />

            {/* Dedication — add / edit / remove */}
            <DedicationEditor school={school} onSaved={reloadSchool} month={clock.currentMonth} />

            {/* Set a school / class / child onto a ladder */}
            <LadderSetter key={`set-${school.id}`} schoolId={school.id} classes={base?.rows ?? []} hiddenLadders={school.hiddenLadders} />

            <CustomLadderTool schoolId={school.id} />

            <ClassReport rows={base?.rows} month={clock.currentMonth} period={period} />

            {/* Teacher deadline email */}
            <Card className="p-5 sm:p-6">
              <div id="not-done-yet">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="sh">Teacher Deadline Email</p>
                  <h3 className="font-display text-xl font-black text-navy">{notDoneHeading(clock.currentMonth)}</h3>
                </div>
                <Button variant="gold">✉ Send to teachers</Button>
              </div>
              <NotDoneList classes={missing} />
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
