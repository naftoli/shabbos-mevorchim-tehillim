import { useMemo, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { Card, Pill, Button, SchoolLogo } from '@/components/ui.jsx'
import { PageHero } from './_page.jsx'
import { fmt } from '@/lib/format.js'
import { GRADE_LABEL, LADDERS, MONTH_HEB, finishGrade } from '@/data/ladders.js'
import {
  getSchools,
  getSchool,
  getBaseReport,
  notCompleted,
  setSchoolDedication,
  removeSchoolDedication,
  CURRENT_MONTH,
} from '@/services/api.js'

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

export default function AdminDashboard() {
  const { admin, isSuper, logoutAdmin } = useAuth()
  const allSchools = useMemo(() => (isSuper ? getSchools() : []), [isSuper])
  const [schoolId, setSchoolId] = useState(admin?.schoolId || null)
  const [tick, setTick] = useState(0) // bump to re-read after editing the dedication

  if (!admin) return <Navigate to="/admin/login" replace />

  const activeId = isSuper ? schoolId : admin.schoolId
  const school = useMemo(() => (activeId ? getSchool(activeId) : null), [activeId, tick])
  const base = activeId ? getBaseReport(activeId) : null
  const missing = activeId ? notCompleted(activeId) : []

  return (
    <>
      <PageHero eyebrow={isSuper ? 'HQ Command Center' : 'School Admin'} title="Admin Dashboard">
        {isSuper ? 'Run the campaign for the whole army.' : `Run the campaign for ${admin.name}.`}
      </PageHero>

      <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">Signed in as <span className="font-semibold text-navy">{admin.name}</span> {isSuper ? <Pill className="ml-1">HQ</Pill> : null}</p>
          <Button variant="ghost" className="!px-3 !text-[15px]" onClick={logoutAdmin}>Sign out</Button>
        </div>

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

        {!school ? (
          <Card className="p-6 text-center text-muted">Pick a school above to manage it.</Card>
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
                  <div><p className="text-xs uppercase text-muted">Said</p><p className="font-display text-2xl font-black text-green">{fmt(school.saidMonth)}</p></div>
                  <div><p className="text-xs uppercase text-muted">Quota</p><p className="font-display text-2xl font-black text-navy">{fmt(school.quotaMonth)}</p></div>
                  <div><p className="text-xs uppercase text-muted">Met</p><p className="font-display text-2xl font-black text-navy">{school.pctMet}%</p></div>
                </div>
              </div>
              <Link to={`/s/${school.id}`} className="mt-3 inline-block text-sm font-semibold text-blue hover:underline">View public campaign page →</Link>
            </Card>

            {/* Dedication — add / edit / remove */}
            <DedicationEditor school={school} onSaved={() => setTick((t) => t + 1)} />

            {/* Set a class/school onto a ladder */}
            <Card className="p-5 sm:p-6">
              <p className="sh mb-1">Set Ladders</p>
              <p className="mb-4 text-sm text-muted">Put a whole class — or the entire school — onto one ladder at once.</p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm">
                  <span className="mb-1 block font-semibold text-navy">Class</span>
                  <select className="rounded-xl border border-line bg-[#eef4ff] px-3 py-2">
                    <option>Whole school</option>
                    {base.rows.map((c) => <option key={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-semibold text-navy">Ladder</span>
                  <select className="rounded-xl border border-line bg-[#eef4ff] px-3 py-2">
                    {LADDERS.map((L) => <option key={L}>Ladder {L} — finish by {GRADE_LABEL[String(finishGrade(L))]} grade</option>)}
                  </select>
                </label>
                <Button variant="navy">Apply</Button>
              </div>
            </Card>

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
                  {base.rows.map((c) => (
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
