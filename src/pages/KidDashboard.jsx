import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { Button, Card, Avatar, Field, Input } from '@/components/ui.jsx'
import { PageHero } from './_page.jsx'
import FirstLadderModal from '@/components/FirstLadderModal.jsx'
import GoalBar from '@/components/GoalBar.jsx'
import ClimbMeter from '@/components/ClimbMeter.jsx'
import LadderBreakdownTable from '@/components/LadderBreakdownTable.jsx'
import { getKidProgress, recordMonth, setKidLadder, getKidSocial, CAMPAIGN_YEAR } from '@/services/api.js'
import { GRADE_LABEL, MONTH_HEB, LADDERS, finishGrade } from '@/data/ladders.js'
import { fmt } from '@/lib/format.js'
import { celebrate } from '@/lib/celebrate.js'
import { nextShabbosMevorchim } from '@/lib/shabbosMevorchim.js'

export default function KidDashboard() {
  const { kid, logoutKid } = useAuth()
  const navigate = useNavigate()
  const [tick, setTick] = useState(0) // bump to re-read after recording
  const progress = useMemo(() => {
    if (!kid) return null
    // The demo roster rebuilds ladderless on each page load; keep it in sync
    // with the session's chosen ladder before reading progress.
    if (kid.ladder) setKidLadder(kid.id, kid.ladder)
    return getKidProgress(kid.id)
  }, [kid, tick])

  const cur = progress?.current
  const social = useMemo(() => (kid?.ladder ? getKidSocial(kid.id) : null), [kid, tick])
  const sMevorchim = useMemo(() => nextShabbosMevorchim(), [])
  // Furthest kapitel actually climbed this year = highest completed month's target.
  const reached = useMemo(
    () => (progress ? progress.months.reduce((mx, m) => (m.met ? Math.max(mx, m.quota) : mx), 0) : 0),
    [progress],
  )
  const [said, setSaid] = useState('')
  const [mins, setMins] = useState('')
  const [welcomeOpen, setWelcomeOpen] = useState(true)
  const [editing, setEditing] = useState(false)

  if (!kid) return <Navigate to="/login" replace />
  if (!progress) return <Navigate to="/login" replace />

  // First login, or no valid ladder yet: graphic welcome + a prompt to choose.
  // (An out-of-range ladder — e.g. a stale value — counts as not chosen.)
  if (!kid.ladder || !LADDERS.includes(kid.ladder)) {
    return (
      <>
        <PageHero eyebrow={`My Tehillim · ${CAMPAIGN_YEAR}`} title={`Welcome, ${kid.name.split(' ')[0]}!`}>
          Let’s get you started — pick your ladder and you’re on your way up.
        </PageHero>
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <Card className="p-8 text-center">
            <h2 className="font-display text-2xl font-black text-navy">You haven’t picked a ladder yet</h2>
            <p className="mt-2 text-muted">
              Your ladder sets exactly what to say each Shabbos Mevorchim, climbing toward finishing
              the whole Tehillim.
            </p>
            <Button variant="navy" className="mt-5" onClick={() => setWelcomeOpen(true)}>Pick my ladder</Button>
          </Card>
        </div>
        <FirstLadderModal
          open={welcomeOpen}
          name={kid.name}
          grade={kid.grade}
          onPick={() => { setWelcomeOpen(false); navigate('/ladders') }}
          onClose={() => setWelcomeOpen(false)}
        />
      </>
    )
  }

  function record(full) {
    const kap = full ? cur.quota : Number(said) || 0
    const m = full ? cur.minutes : Number(mins) || 0
    const wasMet = cur.met
    const prog = recordMonth(kid.id, cur.month, kap, m)
    setSaid('')
    setMins('')
    setTick((t) => t + 1)
    if (prog?.current?.met && !wasMet) celebrate()
  }

  return (
    <>
      {/* Soldier hero — the ID lives right in the dashboard header */}
      <section className="hero-navy">
        <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-[13px] font-semibold uppercase tracking-[0.1em] text-gold sm:text-[15px]">My Tehillim · {CAMPAIGN_YEAR}</p>
            <button onClick={logoutKid} className="rounded-full border border-white/30 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-white/10">Sign out</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {/* Photo once the backend provides one (Avatar falls back to initials). */}
            <Avatar name={kid.name} src={kid.photoUrl} size={72} className="ring-2 ring-white/50" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="font-display text-3xl font-black leading-none text-white md:text-4xl">{kid.name}</h1>
                {social?.myRankInClass ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-0.5 font-cond text-sm font-bold uppercase tracking-wide text-gold" title="Your rank in your class">
                    🏅 #{social.myRankInClass} in class
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 text-white/80">{kid.className} · {kid.schoolName}</p>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-full bg-white/15 px-3 py-1 font-cond text-sm uppercase tracking-wide text-gold">Ladder {kid.ladder}</span>
              <p className="mt-1 text-xs text-white/70">finish by {GRADE_LABEL[String(finishGrade(kid.ladder))]} grade</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        {/* Countdown to the next Shabbos Mevorchim */}
        {sMevorchim ? (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-center">
            <span className="text-xl" aria-hidden="true">⏳</span>
            <span className="font-cond text-lg uppercase tracking-wide text-navy">
              Next Shabbos Mevorchim bentches <span className="font-heb">{MONTH_HEB[sMevorchim.monthEn] ?? sMevorchim.monthEn}</span>
            </span>
            <span className="rounded-full bg-navy px-3 py-1 text-sm font-bold text-white">
              {sMevorchim.daysUntil <= 0 ? 'This Shabbos!' : sMevorchim.daysUntil === 1 ? 'Tomorrow' : `in ${sMevorchim.daysUntil} days`}
            </span>
            <span className="font-heb text-base text-muted">{sMevorchim.hebDateLabel}</span>
          </div>
        ) : null}

        {/* This month's mission — the big, kid-facing card */}
        <Card className="overflow-hidden">
          {cur.met ? (
            /* Celebratory done state */
            <div className="hero-navy relative px-6 py-10 text-center">
              <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-60" viewBox="0 0 400 200" aria-hidden="true">
                <g fill="#ffd54a"><circle cx="60" cy="40" r="3" /><circle cx="340" cy="56" r="3.5" /><circle cx="120" cy="150" r="2.5" /><circle cx="300" cy="150" r="2.5" /></g>
                <g fill="#fff" opacity=".6"><circle cx="200" cy="30" r="2" /><circle cx="40" cy="120" r="2" /><circle cx="360" cy="120" r="2" /></g>
              </svg>
              <div className="animate-pop relative text-6xl">👑</div>
              <h3 className="relative mt-2 font-display text-3xl font-black text-white">Mission Complete!</h3>
              <p className="relative mt-1 text-white/85">
                You said <span className="font-heb text-gold">{cur.quotaLabel}</span> this{' '}
                <span className="font-heb text-gold">{MONTH_HEB[cur.month]}</span> — a full mission! 🎉
              </p>
              <div className="relative mt-4 flex items-center justify-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-4 py-1.5 font-cond text-lg uppercase tracking-wide text-gold">✓ Done</span>
                <button onClick={() => { setSaid(String(cur.said)); setMins(''); setEditing(true) }} className="text-sm font-semibold text-white/80 underline hover:text-white">Edit entry</button>
              </div>
            </div>
          ) : (
            <>
              {/* Graphic header: what you were meant to say this month */}
              <div className="hero-navy relative px-5 pb-5 pt-5">
                <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 400 120" aria-hidden="true">
                  <g fill="#fff"><circle cx="30" cy="24" r="2" /><circle cx="360" cy="30" r="2.5" /><circle cx="330" cy="86" r="1.8" /></g>
                  <path d="M352 14l1.8 4.3 4.2.4-3.3 3 1 4.3-3.7-2.4-3.7 2.4 1-4.3-3.3-3 4.2-.4z" fill="#ffd54a" opacity=".7" />
                </svg>
                <p className="relative font-cond text-sm uppercase tracking-[0.08em] text-gold">This Shabbos Mevorchim · <span className="font-heb text-base">{MONTH_HEB[cur.month]}</span></p>
                <div className="relative mt-2 flex items-end justify-between gap-3">
                  <div className="flex items-end gap-3">
                    <svg width="26" height="40" viewBox="0 0 26 40" aria-hidden="true">
                      <g stroke="#ffd54a" strokeWidth="3" strokeLinecap="round"><line x1="7" y1="38" x2="7" y2="3" /><line x1="19" y1="38" x2="19" y2="3" /><line x1="7" y1="30" x2="19" y2="30" /><line x1="7" y1="21" x2="19" y2="21" /><line x1="7" y1="12" x2="19" y2="12" /></g>
                    </svg>
                    <div>
                      <div className="text-xs text-white/80">Your kapitlach</div>
                      <div className="font-heb text-4xl font-bold leading-none text-white">{cur.quotaLabel}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-cond text-3xl leading-none text-white">{cur.quota}</div>
                    <div className="text-xs text-white/80">kapitlach · {cur.minutes} min</div>
                  </div>
                </div>
              </div>

              {/* The monthly report: what did you actually say on Shabbos? */}
              <div className="p-5 sm:p-6">
                {cur.said > 0 ? (
                  /* Already reported part — not the full mission */
                  <>
                    <p className="text-center text-sm font-semibold text-navy">
                      You reported saying {fmt(cur.said)} of {cur.quota} kapitlach this{' '}
                      <span className="font-heb">{MONTH_HEB[cur.month]}</span>.
                    </p>
                    <GoalBar percent={Math.min(100, (cur.said / Math.max(1, cur.quota)) * 100)} label="of your mission" className="mx-auto mt-4 max-w-sm" />
                    <button
                      onClick={() => { setSaid(String(cur.said)); setMins(''); setEditing(true) }}
                      className="mx-auto mt-6 block text-sm font-semibold text-blue underline"
                    >
                      Fix what I reported
                    </button>
                  </>
                ) : (
                  /* Nothing reported yet for this month */
                  <>
                    <p className="text-center font-display text-lg font-black text-navy">
                      Did you say your Tehillim this Shabbos Mevorchim?
                    </p>
                    <p className="mt-1 text-center text-sm text-muted">Tell us what you said — it’s counted for your class and school.</p>

                    <button
                      onClick={() => record(true)}
                      className="btn btn-gold mx-auto mt-4 block w-full max-w-sm !py-4 !text-[22px]"
                    >
                      ✓ Yes — I said it all!
                    </button>

                    <details className="mt-4 text-center">
                      <summary className="cursor-pointer text-sm font-semibold text-blue">I said a different amount</summary>
                      <div className="mt-3 flex flex-wrap items-end justify-center gap-2">
                        <Field label="Kapitlach I said"><Input className="w-28" inputMode="numeric" value={said} onChange={(e) => setSaid(e.target.value)} /></Field>
                        <Field label="Minutes"><Input className="w-24" inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value)} /></Field>
                        <Button variant="outline" onClick={() => record(false)}>Report</Button>
                      </div>
                    </details>
                  </>
                )}
              </div>
            </>
          )}

          {/* Edit / correct this month's entry */}
          {editing ? (
            <div className="border-t border-line bg-paper/60 p-5 sm:p-6">
              <p className="sh mb-2">Edit this month’s entry</p>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Kapitlach said"><Input className="w-28" inputMode="numeric" value={said} onChange={(e) => setSaid(e.target.value)} /></Field>
                <Field label="Minutes"><Input className="w-24" inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value)} /></Field>
                <Button variant="navy" onClick={() => {
                  const wasMet = cur.met
                  const prog = recordMonth(kid.id, cur.month, Number(said) || 0, Number(mins) || 0)
                  setEditing(false); setSaid(''); setMins(''); setTick((t) => t + 1)
                  if (prog?.current?.met && !wasMet) celebrate()
                }}>Save</Button>
                <Button variant="outline" onClick={() => { recordMonth(kid.id, cur.month, 0, 0); setEditing(false); setSaid(''); setMins(''); setTick((t) => t + 1) }}>Mark not done</Button>
                <Button variant="ghost" onClick={() => { setEditing(false); setSaid(''); setMins('') }}>Cancel</Button>
              </div>
            </div>
          ) : null}
        </Card>

        {/* The whole-Tehillim climb — the big-picture goal the ladder paces */}
        <Card className="overflow-hidden">
          <ClimbMeter
            reached={reached}
            target={cur.quota}
            ladder={kid.ladder}
            finishGradeLabel={GRADE_LABEL[String(finishGrade(kid.ladder))]}
          />
        </Card>

        {/* Your class needs you — social standing + a nudge */}
        {social ? (
          <Card className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-navy font-cond text-2xl font-bold text-gold">
              #{social.classRank}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-black text-navy">
                {social.className} is #{social.classRank} of {social.totalClasses} in {social.schoolName}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {social.classRank === 1 ? (
                  <>Your class is in <span className="font-semibold text-green">first place</span> — keep it on top! 🏆</>
                ) : social.needToPass > 0 ? (
                  <>
                    {social.needToPass} more {social.needToPass === 1 ? 'soldier' : 'soldiers'} finishing puts you ahead of{' '}
                    <span className="font-semibold text-navy">{social.classAheadName}</span>. Your Tehillim counts!
                  </>
                ) : (
                  <>Every soldier counts — say your Tehillim and lift your class up.</>
                )}
              </p>
            </div>
            <div className="shrink-0 rounded-2xl bg-card px-4 py-2 text-center">
              <div className="font-cond text-2xl font-bold leading-none text-navy">#{social.schoolRank}</div>
              <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                School worldwide<span className="text-muted/70"> · of {social.totalSchools}</span>
              </div>
            </div>
          </Card>
        ) : null}

        {/* This year's months — done / current / missed */}
        <Card className="p-5 sm:p-6">
          <p className="sh mb-2">This Year</p>
          <div className="flex flex-wrap gap-2">
            {progress.months.map((m) => (
              <span
                key={m.month}
                className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${
                  m.met ? 'bg-green/10 text-green' : 'bg-track text-muted line-through'
                } ${m.isCurrent ? 'ring-2 ring-gold' : ''}`}
                title={m.met ? 'Done' : 'Not done'}
              >
                {MONTH_HEB[m.month]}
              </span>
            ))}
          </div>
        </Card>

        {/* Ladder — summary + the full month-by-month breakdown of this ladder */}
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="sh">Your Ladder</p>
              <h3 className="font-display text-xl font-black text-navy">
                Ladder {kid.ladder}
                <span className="font-normal text-muted"> — finish by {GRADE_LABEL[String(finishGrade(kid.ladder))]} grade</span>
              </h3>
            </div>
            <Button variant="navy" onClick={() => navigate('/ladders')}>Switch my ladder</Button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl bg-paper/60 p-3">
            <LadderBreakdownTable ladder={kid.ladder} highlightGrade={kid.grade} highlightMonth={cur.month} />
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            Each cell is the kapitel you say up to (from <span className="font-heb">א</span>) and the minutes · 👑 = the whole Tehillim ·{' '}
            <span className="rounded bg-green/15 px-1.5 py-0.5 ring-1 ring-green">highlighted</span> is where you are now.
          </p>
        </Card>
      </div>
    </>
  )
}
