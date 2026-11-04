import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useLiveData } from '@/lib/useLiveData.js'
import { Card, Pill, Button, SchoolLogo } from '@/components/ui.jsx'
import { PageHero } from './_page.jsx'
import { fmt } from '@/lib/format.js'
import { GRADE_LABEL, LADDERS, MONTH_HEB, finishGrade } from '@/data/ladders.js'
import {
  getSchools,
  getSchool,
  getBaseReport,
  getPlatoonReport,
  adminSetLadder,
  notCompleted,
  setSchoolDedication,
  removeSchoolDedication,
  getHqVerify,
  getArmyDedication,
  setArmyDedication,
  CURRENT_MONTH,
} from '@/services/api.js'

function HqTools() {
  const { data, error, reload } = useLiveData(() => getHqVerify(), [])
  const { data: dedication, reload: reloadDedication } = useLiveData(() => getArmyDedication(), [])
  const [text, setText] = useState(dedication?.text || '')
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
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="This month’s Tehillim is dedicated…" className="mt-2 w-full rounded-xl border border-line bg-[#eef4ff] px-3 py-2 text-navy" />
        <Button variant="navy" className="mt-2" onClick={async () => { await setArmyDedication(text); setSavedNote('Saved for this month.'); reloadDedication() }}>Save dedication</Button>
        {savedNote ? <p className="mt-2 text-sm text-green">{savedNote}</p> : null}
      </div>
    </Card>
  )
}

// School admins add / edit / remove their school's monthly dedication.
function DedicationEditor({ school, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(school.dedication?.text || '')
  const open = () => { setText(school.dedication?.text || ''); setEditing(true) }
  const save = () => { setSchoolDedication(school.id, text); setEditing(false); onSaved() }
  const remove = () => { removeSchoolDedication(school.id); setEditing(false); setText(''); onSaved() }
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="sh">Dedication · <span className="font-heb">{MONTH_HEB[CURRENT_MONTH]}</span></p>
        {!editing ? (
          <div className="flex gap-2">
            <Button variant="outline" className="!px-3 !py-1 !text-sm" onClick={open}>{school.dedication ? 'Edit' : 'Add dedication'}</Button>
            {school.dedication ? <Button variant="ghost" className="!px-3 !py-1 !text-sm" onClick={remove}>Remove</Button> : null}
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
function LadderSetter({ schoolId, classes }) {
  const [classId, setClassId] = useState('') // '' = whole school
  const [kidId, setKidId] = useState('') // '' = all children in the class
  const [ladder, setLadder] = useState(LADDERS[0])
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
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-navy">Class</span>
          <select
            value={classId}
            onChange={(e) => pickClass(e.target.value)}
            className="rounded-xl border border-line bg-[#eef4ff] px-3 py-2"
          >
            <option value="">Whole school</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        {classId ? (
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-navy">Child</span>
            <select
              value={kidId}
              onChange={(e) => setKidId(e.target.value)}
              className="rounded-xl border border-line bg-[#eef4ff] px-3 py-2"
            >
              <option value="">All children in this class</option>
              {kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </label>
        ) : null}

        <label className="text-sm">
          <span className="mb-1 block font-semibold text-navy">Ladder</span>
          <select
            value={ladder}
            onChange={(e) => setLadder(Number(e.target.value))}
            className="rounded-xl border border-line bg-[#eef4ff] px-3 py-2"
          >
            {LADDERS.map((L) => <option key={L} value={L}>Ladder {L} — finish training by {GRADE_LABEL[String(finishGrade(L))]} grade</option>)}
          </select>
        </label>

        <Button variant="navy" onClick={apply} disabled={busy}>{busy ? 'Applying…' : 'Apply'}</Button>
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

export default function AdminDashboard() {
  const { admin, isSuper, logoutAdmin } = useAuth()
  const { data: allSchoolsData } = useLiveData(() => (isSuper ? getSchools() : Promise.resolve([])), [isSuper])
  const allSchools = allSchoolsData ?? []
  const [schoolId, setSchoolId] = useState(admin?.schoolId || null)
  const activeId = isSuper ? schoolId : (admin?.schoolId ?? null)
  // reloadSchool re-reads after editing the dedication (and on the live poll).
  const { data: school, error: schoolError, reload: reloadSchool } = useLiveData(
    () => (activeId ? getSchool(activeId) : Promise.resolve(null)),
    [activeId],
  )
  const { data: base } = useLiveData(() => (activeId ? getBaseReport(activeId) : Promise.resolve(null)), [activeId])
  const { data: missingData } = useLiveData(() => (activeId ? notCompleted(activeId) : Promise.resolve([])), [activeId])
  const missing = missingData ?? []

  if (!admin) return <Navigate to="/admin/login" replace />

  return (
    <>
      <PageHero eyebrow={isSuper ? 'HQ Command Center' : 'School Admin'} title="Admin Dashboard">
        {isSuper ? 'Run the campaign for the whole army.' : `Run the campaign for ${admin.name}.`}
      </PageHero>

      <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">Signed in as <span className="font-semibold text-navy">{admin.name}</span> {isSuper ? <Pill className="ml-1">HQ</Pill> : null}</p>
          <div className="flex items-center gap-2">
            <Button to="/reports" variant="outline" className="!px-3 !text-[15px]">Monthly Reports</Button>
            <Button variant="ghost" className="!px-3 !text-[15px]" onClick={logoutAdmin}>Sign out</Button>
          </div>
        </div>

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
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                    s.id === activeId ? 'border-transparent bg-green text-white' : 'border-line bg-[#eef4ff] hover:bg-track'
                  }`}
                >
                  <SchoolLogo school={s} size={36} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
                  <span className={`text-sm ${s.id === activeId ? 'text-white/80' : 'text-muted'}`}>{s.pct}%</span>
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
                    <p className="text-sm text-muted">{fmt(school.kids)} soldiers · {CURRENT_MONTH}</p>
                  </div>
                </div>
                <div className="flex gap-6 text-right">
                  <div><p className="text-xs uppercase text-muted">Quota</p><p className="font-display text-2xl font-black text-navy">{fmt(school.quotaMonth)}</p></div>
                  <div><p className="text-xs uppercase text-muted">Said</p><p className="font-display text-2xl font-black text-green">{fmt(school.saidMonth)}</p></div>
                  <div><p className="max-w-[9rem] text-xs uppercase text-muted">% of soldiers that met their quota</p><p className="font-display text-2xl font-black text-navy">{school.pctMet}%</p></div>
                </div>
              </div>
              <Link to={`/s/${school.id}`} className="mt-3 inline-block text-sm font-semibold text-blue hover:underline">View public campaign page →</Link>
            </Card>

            {/* Dedication — add / edit / remove */}
            <DedicationEditor school={school} onSaved={reloadSchool} />

            {/* Set a school / class / child onto a ladder */}
            <LadderSetter schoolId={school.id} classes={base?.rows ?? []} />

            {/* Base report */}
            <Card className="overflow-x-auto">
              <div className="border-b border-line px-5 py-3"><h3 className="font-display font-black text-navy">Class Report · {CURRENT_MONTH}</h3></div>
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead><tr className="bg-track/60 text-muted">
                  <th className="px-4 py-2 font-cond uppercase">Class</th>
                  <th className="px-4 py-2 text-right font-cond uppercase">Soldiers</th>
                  <th className="px-4 py-2 text-right font-cond uppercase">Goal</th>
                  <th className="px-4 py-2 text-right font-cond uppercase">Said</th>
                  <th className="px-4 py-2 text-right font-cond uppercase">Completed</th>
                </tr></thead>
                <tbody>
                  {(base?.rows ?? []).map((c) => (
                    <tr key={c.id} className="border-t border-line">
                      <td className="px-4 py-2 font-semibold text-navy">{c.name} {c.perfect ? '★' : ''}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{c.size}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(c.goal)}</td>
                      <td className="px-4 py-2 text-right font-bold tabular-nums text-green">{fmt(c.accomplished)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{c.completed}/{c.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Teacher deadline email */}
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="sh">Teacher Deadline Email</p>
                  <h3 className="font-display text-xl font-black text-navy">Who still needs to finish — {CURRENT_MONTH}</h3>
                </div>
                <Button variant="gold">✉ Send to teachers</Button>
              </div>
              {missing.length === 0 ? (
                <p className="mt-4 font-semibold text-green">Every soldier has completed this month — all Perfect Platoons! 🎉</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {missing.map((c) => (
                    <div key={c.classId} className="rounded-xl bg-track/40 p-3">
                      <p className="font-semibold text-navy">{c.className} <span className="font-normal text-muted">— {c.missing.length} of {c.size} not done</span></p>
                      <p className="mt-1 text-sm text-muted">{c.missing.join(', ')}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  )
}
