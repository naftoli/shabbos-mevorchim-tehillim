import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { Button, Card, Avatar, Field, Input, CrownIcon } from '@/components/ui.jsx'
import { PageHero } from './_page.jsx'
import FirstLadderModal from '@/components/FirstLadderModal.jsx'
import GoalBar from '@/components/GoalBar.jsx'
import ClimbMeter from '@/components/ClimbMeter.jsx'
import LadderBreakdownTable from '@/components/LadderBreakdownTable.jsx'
import MedalBoard from '@/components/MedalBoard.jsx'
import TehillimTraining from '@/components/TehillimTraining.jsx'
import StreakBar from '@/components/StreakBar.jsx'
import { getKidProgress, recordMonth, setKidLadder, getKidSocial, CAMPAIGN_YEAR, CURRENT_MONTH } from '@/services/api.js'
import { useLiveData } from '@/lib/useLiveData.js'
import { IS_DEMO } from '@/lib/liveMode.js'
import { GRADE_LABEL, MONTH_HEB, LADDERS, finishGrade, quotaFor } from '@/data/ladders.js'
import { isHebrewLeapYear } from '@/lib/hebrewYear.js'
import { fmt } from '@/lib/format.js'
import { asset } from '@/lib/asset.js'
import { celebrate } from '@/lib/celebrate.js'
import { nextShabbosMevorchim } from '@/lib/shabbosMevorchim.js'
import { isAboveQuota, isExceptional, LADDER_REENGAGE_MISSIONS } from '@/lib/decisions.js'
import { cueAboveConfirmed, cueAboveFixed, cueAboveQuota, cueInviteGentler, cueInviteHarder, cueLadder, cueMedalEarned, cueMedalInfo, cueMissionComplete, cueReport } from '@/lib/commanderCues.js'
import { emitCue } from '@/lib/commanderBus.js'
import { fillClimb, fillStand, standFacts, standPlaceCards, trainByGrade } from '@/lib/commanderScripts.js'
import { earliestMedalWhen } from '@/lib/medalWhen.js'
import { streakFromMissions } from '@/lib/streaks.js'
import { STREAK_COPY } from '@/lib/streakBar.js'
import { streakMissions } from '@/lib/trainingBoard.js'
import { ladderAdvice } from '@/lib/ladderAdvice.js'
import { IconImg, Pending } from '@/components/campaignBits.jsx'
import PerfectPlatoonBanner from '@/components/PerfectPlatoonBanner.jsx'

// Shared ladder glyph (gold on navy). Module-scope so it keeps a stable
// component identity across renders.
function StandRank({ text, rankText }) {
  const token = `#${rankText}`
  const at = text.indexOf(token)
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <span className="font-black">{token}</span>
      {text.slice(at + token.length)}
    </>
  )
}

function LadderGlyph(props) {
  return (
    <svg viewBox="0 0 26 40" aria-hidden="true" {...props}>
      <g stroke="#ffd54a" strokeWidth="3" strokeLinecap="round">
        <line x1="7" y1="38" x2="7" y2="3" /><line x1="19" y1="38" x2="19" y2="3" />
        <line x1="7" y1="30" x2="19" y2="30" /><line x1="7" y1="21" x2="19" y2="21" /><line x1="7" y1="12" x2="19" y2="12" />
      </g>
    </svg>
  )
}

export default function KidDashboard() {
  const { kid, logoutKid, changeLadder } = useAuth()
  const navigate = useNavigate()
  const { data: progress, loading: progressLoading, error: progressError, reload: reloadProgress } = useLiveData(
    () => {
      if (!kid) return Promise.resolve(null)
      // Demo only: the roster rebuilds ladderless on each load, so re-sync the
      // session's chosen ladder before reading. Live keeps the ladder server-side.
      if (IS_DEMO && kid.ladder) setKidLadder(kid.id, kid.ladder)
      return getKidProgress(kid.id)
    },
    [kid],
  )
  const { data: social, reload: reloadSocial } = useLiveData(
    () => (kid && kid.ladder ? getKidSocial(kid.id) : Promise.resolve(null)),
    [kid],
  )

  const cur = progress?.current
  const sMevorchim = useMemo(() => nextShabbosMevorchim(), [])
  // Climb position comes from the same ladder table as "Your Ladder" (grade +
  // month + ladder → cumulative kapitel). Do not use progress.months[].quota —
  // that is the DB date_tasks quantity, which can disagree when user_tracks.level
  // is out of sync with the child's grade (e.g. level 10 → 11 kapitlach while
  // Ladder 9 in 6th grade is 73/74).
  const reached = useMemo(() => {
    if (!progress?.months || !kid?.ladder) return 0
    return progress.months.reduce((mx, m) => {
      if (!m.met) return mx
      const v = quotaFor(kid.grade, m.month, kid.ladder)?.v ?? 0
      return Math.max(mx, Number(v) || 0)
    }, 0)
  }, [progress, kid?.grade, kid?.ladder])
  const climbTarget = cur && kid?.ladder
    ? (quotaFor(kid.grade, cur.month, kid.ladder)?.v ?? 0)
    : 0
  const [said, setSaid] = useState('')
  const [mins, setMins] = useState('')
  const [confirming, setConfirming] = useState(null)
  const [notice, setNotice] = useState('')
  const [declined, setDeclined] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`wwtc.ladderInvite.${kid?.id}`) || 'null') } catch { return null }
  })
  // General 613 walks a new soldier through the ladder out loud. Don't also
  // pop the ladder modal over him; the button below still opens it.
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  // Seed the report inputs from what's on record, re-seeding whenever the month
  // or its recorded values change. Adjusted during render (not in an effect) per
  // React's "adjusting state when a prop changes" guidance; typing into the
  // inputs doesn't change seedKey, so edits aren't clobbered.
  const [seeded, setSeeded] = useState(null)
  const seedKey = cur ? `${cur.month}|${cur.said}|${cur.saidMinutes}` : null
  if (seedKey !== seeded) {
    setSaid(cur && cur.said ? String(cur.said) : '')
    setMins(cur && cur.saidMinutes ? String(cur.saidMinutes) : '')
    setSeeded(seedKey)
  }

  if (!kid) return <Navigate to="/login" replace />
  if (!progress) {
    // Logged in but progress is still loading (or failed) — don't bounce to login.
    return (
      <>
        <PageHero eyebrow={`My Tehillim · ${CAMPAIGN_YEAR}`} title={progressError ? 'Couldn’t load your Tehillim' : kid.name}>
          {progressError ? 'Something went wrong. Please try again.' : <Pending label="Getting your Tehillim" />}
        </PageHero>
        <div className="mx-auto max-w-2xl px-4 py-10 text-center sm:px-6">
          {progressError ? <Button variant="navy" onClick={reloadProgress}>Try again</Button> : null}
          {!progressLoading && !progressError ? <Button variant="ghost" onClick={logoutKid}>Sign out</Button> : null}
        </div>
      </>
    )
  }

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

  const streaks = streakFromMissions(streakMissions(progress))
  const earnBy = earliestMedalWhen(progress.medal?.missionsToNext, cur?.month || CURRENT_MONTH, Number(CAMPAIGN_YEAR))
  let earnedOn = null
  {
    const medal = progress.medal?.current
    if (medal) {
      let count = Number(progress.priorMissions) || 0
      if (count >= medal.threshold) earnedOn = 'before this year’s month-by-month record'
      else {
        for (const month of progress.months || []) {
          if (month.met) count += 1
          if (count >= medal.threshold) { earnedOn = `${month.month} ${CAMPAIGN_YEAR}`; break }
        }
      }
    }
  }
  const advice = ladderAdvice({
    grade: kid.grade,
    ladder: kid.ladder,
    months: progress.months,
    missionsTotal: progress.missionsTotal,
    declined,
  })
  const switched = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('wwtc.lastKid') && sessionStorage.getItem('wwtc.lastKid') !== kid.id
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('wwtc.lastKid', kid.id)

  // Self-reporting closes a week after Shabbos Mevorchim (server: reportOpen on
  // the current month). Undefined (demo) counts as open; only an explicit false
  // from the live API closes the form.
  const reportOpen = cur.reportOpen !== false

  async function saveReport(extra = {}) {
    if (!reportOpen) return
    const wasMet = cur.met
    const beforeMedal = progress.medal?.current?.name || null
    const kap = Number(said) || 0
    const minutes = Number(mins) || 0
    const over = isAboveQuota({ kapitlach: kap, minutes, quotaKap: cur.quota, quotaMin: cur.minutes })
    if (over && !extra.confirmed) {
      setConfirming({ kap, minutes })
      emitCue(`above-${cur.month}-${kap}`, cueAboveQuota(kap))
      return
    }
    const exceptional = extra.confirmed && isExceptional({ kapitlach: kap, minutes, quotaKap: cur.quota, quotaMin: cur.minutes })
    const prog = await recordMonth(kid.id, cur.month, kap, minutes, exceptional ? { exceptionalConfirmed: true } : {})
    setConfirming(null)
    reloadProgress()
    reloadSocial()
    if (extra.confirmed) {
      setNotice(cueAboveConfirmed())
      emitCue(`above-yes-${cur.month}`, cueAboveConfirmed())
    }
    if (prog?.current?.met && !wasMet) {
      celebrate()
      emitCue(`done-${cur.month}`, cueMissionComplete())
    }
    const nextMedal = prog?.medal?.current?.name
    if (nextMedal && nextMedal !== beforeMedal) {
      emitCue(`medal-${nextMedal}`, cueMedalEarned(nextMedal, prog.medal.current.threshold, prog.medal.next?.name, prog.medal.next?.threshold, earnBy))
    }
    if (prog?.exceptional) {
      setNotice(prog.exceptional.emailed
        ? 'Saved. Your mashpia will get a note so they can celebrate this with you.'
        : 'Saved. Your mashpia should confirm a report this large. The email is waiting on WWTC_MASHPIA_EMAIL.')
    }
  }

  return (
    <>
      {/* Soldier hero — the ID lives right in the dashboard header */}
      <section className="hero-navy">
        <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-[13px] font-semibold uppercase tracking-[0.1em] text-gold sm:text-[15px]">My Tehillim · {CAMPAIGN_YEAR}</p>
            <button onClick={logoutKid} className="min-h-11 rounded-full border border-white/30 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-white/10 sm:min-h-0">Sign out</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {/* On a phone the ladder sits on its own line so the name isn't squeezed into a few letters. */}
            <div className="flex w-full min-w-0 items-center gap-4 sm:w-auto sm:flex-1">
              <Avatar name={kid.name} src={kid.photoUrl || progress.photoUrl} size={72} className="ring-2 ring-white/50" />
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-3xl font-black leading-none text-white md:text-4xl">{kid.name}</h1>
                <p className="mt-1.5 leading-snug text-white/80">{kid.className} · {kid.schoolName}</p>
                {progress.rank ? <p className="mt-1 text-sm font-semibold text-gold">Rank · {progress.rank}</p> : null}
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <LadderGlyph width="22" height="34" className="flex-none" />
              <div className="text-right">
                <span className="inline-block rounded-full bg-white/15 px-3 py-1 font-cond text-sm uppercase tracking-wide text-gold">Ladder {kid.ladder}</span>
                <p className="mt-1 text-xs text-white/70">finish training by {GRADE_LABEL[String(finishGrade(kid.ladder))]} grade</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        {/* Countdown to the next Shabbos Mevorchim */}
        {sMevorchim ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-center sm:flex-row sm:flex-wrap sm:gap-x-3 sm:gap-y-1">
            <span className="text-xl" aria-hidden="true">⏳</span>
            <span className="font-cond text-base uppercase leading-snug tracking-wide text-navy sm:text-lg">
              Next Shabbos Mevorchim bentches <span className="font-heb">{MONTH_HEB[sMevorchim.monthEn] ?? sMevorchim.monthEn}</span>
            </span>
            <span className="rounded-full bg-navy px-3 py-1 text-sm font-bold text-white">
              {sMevorchim.daysUntil <= 0 ? 'This Shabbos!' : sMevorchim.daysUntil === 1 ? 'Tomorrow' : `in ${sMevorchim.daysUntil} days`}
            </span>
            <span className="font-heb text-base text-muted">{sMevorchim.hebDateLabel}</span>
          </div>
        ) : null}

        {/* This month's mission — quota header + a simple report form */}
        <Card className="overflow-hidden">
          {/* Graphic header: the book (kapitlach quota) + the clock (minute quota) */}
          <div className="hero-navy relative px-5 pb-5 pt-5">
            <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 400 120" aria-hidden="true">
              <g fill="#fff"><circle cx="30" cy="24" r="2" /><circle cx="360" cy="30" r="2.5" /><circle cx="330" cy="86" r="1.8" /></g>
              <path d="M352 14l1.8 4.3 4.2.4-3.3 3 1 4.3-3.7-2.4-3.7 2.4 1-4.3-3.3-3 4.2-.4z" fill="#c3b1d6" opacity=".9" />
            </svg>
            <p className="relative text-center font-cond text-sm uppercase tracking-[0.14em] text-gold">You are reporting for</p>
            <p className="relative mt-2 text-center font-heb text-4xl text-white">{MONTH_HEB[cur.month]} <span className="font-display text-3xl">{CAMPAIGN_YEAR}</span></p>
            <div className="relative mt-5 grid grid-cols-2 gap-4 text-center">
              {[
                ['design/icon-book.webp', 420, 280, 'Kapitlach', cur.quota, 'kapitlach'],
                ['design/icon-clock.png', 255, 256, 'Minutes', cur.minutes, 'minutes'],
              ].map(([file, w, h, label, value, unit]) => (
                <div key={label} className="flex flex-col items-center gap-2">
                  <img src={asset(file)} alt="" width={w} height={h} aria-hidden="true" draggable="false" className="h-12 w-auto max-w-none" />
                  <div className="text-xs uppercase tracking-wide text-white/80">{label}</div>
                  <div className="font-cond text-4xl leading-none tabular-nums text-white">{value}</div>
                  <div className="text-sm text-white/80">{unit}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Report form — just enter kapitlach + minutes */}
          <div className="p-5 sm:p-6">
            {cur.met ? (
              <p className="mb-4 flex items-center justify-center gap-2 text-center font-display text-lg font-black text-green"><CrownIcon className="h-6 w-auto" /> Mission Complete — you said it all!</p>
            ) : cur.said > 0 ? (
              <p className="mb-4 text-center text-sm font-semibold text-navy">
                You reported {fmt(cur.said)} of {cur.quota} kapitlach{cur.saidMinutes > 0 ? <> in {fmt(cur.saidMinutes)} minutes</> : null}.
              </p>
            ) : !reportOpen ? null : (
              <p className="mb-4 text-center text-sm text-muted">Tell us what you said — it’s counted for your class, school and army.</p>
            )}
            {switched ? <p className="mb-3 text-center text-sm font-semibold text-navy">Signed out of the last soldier. You’re signed in as {kid.name.split(' ')[0]}.</p> : null}
            {notice ? <p className="mb-3 text-center text-sm font-semibold text-green">{notice}</p> : null}
            {confirming ? (
              <div className="mb-4 rounded-2xl bg-gold/15 p-4 text-center">
                <p className="font-display text-lg font-black text-navy">{cueAboveQuota(confirming.kap)}</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <Button variant="navy" onClick={() => saveReport({ confirmed: true })}>Yes, that’s correct</Button>
                  <Button variant="outline" onClick={() => { setConfirming(null); setNotice(cueAboveFixed()); emitCue(`fix-${cur.month}`, cueAboveFixed()) }}>I’ll correct it</Button>
                </div>
              </div>
            ) : null}
            {reportOpen ? (
              <div className="grid grid-cols-2 items-end gap-3 sm:mx-auto sm:max-w-xl sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Field label="Kapitlach I said"><Input className="!min-h-11 w-full" inputMode="numeric" value={said} onChange={(e) => { setSaid(e.target.value); setNotice('') }} onFocus={() => emitCue('report-form', cueReport())} /></Field>
                <Field label="Minutes I said"><Input className="!min-h-11 w-full" inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value)} /></Field>
                <button type="button" className="btn btn-gold col-span-2 min-h-11 w-full sm:col-span-1 sm:w-auto" onClick={() => saveReport()}>Save</button>
              </div>
            ) : (
              <div className="rounded-2xl border border-navy/15 bg-navy/5 p-4 text-center sm:mx-auto sm:max-w-xl">
                <p className="font-display text-base font-black text-navy">Reporting for <span className="font-heb">{MONTH_HEB[cur.month] ?? cur.month}</span> is closed</p>
                <p className="mt-1 text-sm text-muted">
                  You can enter your Tehillim up to a week after Shabbos Mevorchim.
                  {cur.said > 0 ? ' Your report above is saved.' : ' Ask your teacher if you still need to add it.'}
                </p>
              </div>
            )}
            <div className="mt-5">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">This month’s ladders for you · yours is highlighted</p>
              <div className="grid grid-cols-4 gap-1.5">
                {LADDERS.map((L) => {
                  const cell = quotaFor(kid.grade, cur.month, L)
                  const allowed = cell != null
                  const mine = Number(kid.ladder) === L
                  return (
                    <div key={L} className={`min-w-0 rounded-xl px-0.5 py-1.5 text-center leading-tight ${mine ? 'bg-green text-white' : allowed ? 'bg-track text-navy' : 'bg-track/40 text-muted'}`}>
                      <div className="text-[11px] font-bold sm:text-xs">Ladder {L}</div>
                      <div className="font-heb text-[13px] sm:text-sm">{cell?.k || '—'}</div>
                      <div className="text-[11px] sm:text-xs">{cell ? `${cell.m} Min` : 'not for your grade'}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Progress — kapitlach + minutes, laid out like the worldwide card */}
            <div className="mt-8 space-y-7">
              <div>
                <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
                  <div>
                    <p className="font-display text-[13px] font-semibold uppercase leading-none text-navy">Kapitlach Quota</p>
                    <p className="mt-1.5 font-display text-2xl font-black tabular-nums text-navy">{fmt(cur.quota)}</p>
                  </div>
                  <div>
                    <p className="font-display text-[13px] font-semibold uppercase leading-none text-navy">Kapitlach Said</p>
                    <p className="mt-1.5 font-display text-2xl font-black tabular-nums text-green">{fmt(cur.said)}</p>
                  </div>
                  <p className="ml-auto font-display text-2xl font-black tabular-nums text-green">{cur.quota > 0 ? Math.round((cur.said / cur.quota) * 100) : 0}%</p>
                </div>
                <GoalBar percent={cur.quota > 0 ? (cur.said / cur.quota) * 100 : 0} iconSrc={asset('design/icon-book.webp')} className="mt-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
                  <div>
                    <p className="font-display text-[13px] font-semibold uppercase leading-none text-navy">Minutes Quota</p>
                    <p className="mt-1.5 font-display text-2xl font-black tabular-nums text-navy">{fmt(cur.minutes)}</p>
                  </div>
                  <div>
                    <p className="font-display text-[13px] font-semibold uppercase leading-none text-navy">Minutes Said</p>
                    <p className="mt-1.5 font-display text-2xl font-black tabular-nums text-green">{fmt(cur.saidMinutes)}</p>
                  </div>
                  <p className="ml-auto font-display text-2xl font-black tabular-nums text-green">{cur.minutes > 0 ? Math.round((cur.saidMinutes / cur.minutes) * 100) : 0}%</p>
                </div>
                <GoalBar percent={cur.minutes > 0 ? (cur.saidMinutes / cur.minutes) * 100 : 0} iconSrc={asset('design/icon-clock.png')} className="mt-4" />
              </div>
            </div>
          </div>
        </Card>

        {/* School among bases worldwide, platoon within the base, soldier within the base. */}
        {social ? (
          <Card className="p-5 sm:p-6">
            <p className="sh">Where you stand this month</p>
            <p className="mt-1 text-xs text-muted">
              <span className="font-heb">{MONTH_HEB[cur.month]}</span> — your school in the world, your platoon in your base, and you among the Chayolim in your base.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {standPlaceCards(social).map((card) => {
                const body = (
                  <>
                    <IconImg name={card.icon} className="h-8 w-auto shrink-0" />
                    <p className="min-w-0 font-display text-base font-semibold leading-snug text-navy lg:mt-2">
                      <StandRank text={card.text} rankText={card.rankText} />
                    </p>
                  </>
                )
                const cardClass = 'flex h-full w-full items-center gap-3 rounded-2xl bg-track p-4 text-left text-navy lg:block'
                if (card.key !== 'school') {
                  return <div key={card.key} className={cardClass}>{body}</div>
                }
                return (
                  <button
                    key={card.key}
                    type="button"
                    className={`${cardClass} border-0 font-sans`}
                    onClick={() => {
                      const text = fillStand(standFacts(social))
                      if (text) emitCue(`stand-${cur.month}`, text, { force: true })
                    }}
                  >
                    {body}
                  </button>
                )
              })}
            </div>
            {social.classPerfect ? <PerfectPlatoonBanner /> : null}
          </Card>
        ) : null}

        <Card className="p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="sh">Current streak</p>
              <p className="mt-1 font-display text-4xl font-black text-navy">{streaks.current} <span className="text-lg">missions</span></p>
            </div>
            <div>
              <p className="sh">Longest streak</p>
              <p className="mt-1 font-display text-4xl font-black text-navy">{streaks.best} <span className="text-lg">missions</span></p>
            </div>
          </div>
          <div className="mt-4">
            <StreakBar current={streaks.current} />
          </div>
          <p className="mt-4 text-sm text-navy">{STREAK_COPY[0]}</p>
          <p className="mt-2 text-sm text-navy">{STREAK_COPY[1]}</p>
        </Card>

        {advice ? (
          <Card className="p-5 sm:p-6">
            <p className="font-display text-lg font-black text-navy">{advice.kind === 'harder' ? cueInviteHarder() : cueInviteGentler()}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="navy" onClick={() => changeLadder(advice.ladder)}>Yes, Ladder {advice.ladder}</Button>
              <Button variant="outline" onClick={() => {
                const next = { kind: advice.kind, atMissions: progress.missionsTotal }
                setDeclined(next)
                try { localStorage.setItem(`wwtc.ladderInvite.${kid.id}`, JSON.stringify(next)) } catch { /* ignore */ }
              }}>I’ll stay on Ladder {kid.ladder}</Button>
            </div>
            <p className="mt-2 text-xs text-muted">Staying put is perfectly fine. We’ll ask again after {LADDER_REENGAGE_MISSIONS} more completed missions, not before.</p>
          </Card>
        ) : null}

        <TehillimTraining grade={kid.grade} ladder={kid.ladder} months={progress.months} priorMissions={progress.priorMissions} missionsTotal={progress.missionsTotal} missionHistory={progress.missionHistory} year={CAMPAIGN_YEAR} />

        <MedalBoard
          progress={progress}
          earnBy={earnBy}
          earnedOn={earnedOn}
          onMedal={(medal) => emitCue(`medal-info-${medal.name}`, cueMedalInfo(medal.name, medal.threshold))}
        />

        {/* Ladder — summary + the full month-by-month breakdown of this ladder */}
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="sh">Your Ladder</p>
              <h3 className="font-display text-xl font-black text-navy">
                Ladder {kid.ladder}
                <span className="font-normal text-muted"> — finish training by {GRADE_LABEL[String(finishGrade(kid.ladder))]} grade</span>
              </h3>
            </div>
            <Button variant="navy" onClick={() => { emitCue('ladder-screen', cueLadder()); navigate('/ladders') }}>Switch my ladder</Button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl bg-paper/60 p-3">
            <LadderBreakdownTable ladder={kid.ladder} highlightGrade={kid.grade} highlightMonth={cur.month} year={CAMPAIGN_YEAR} />
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            Each cell is the kapitel you say up to (from <span className="font-heb">א</span>) and the minutes · <CrownIcon className="h-3.5 w-auto align-text-bottom" /> = the whole Tehillim ·{' '}
            <span className="rounded bg-green/15 px-1.5 py-0.5 ring-1 ring-green">highlighted</span> is where you are now.
            {isHebrewLeapYear(CAMPAIGN_YEAR) ? ' Adar I and Adar II each use the Adar quota.' : ''}
          </p>
        </Card>

        {/* The whole-Tehillim climb — the big-picture goal, at the very bottom */}
        <Card className="overflow-hidden">
          <ClimbMeter
            reached={reached}
            target={climbTarget}
            ladder={kid.ladder}
            finishGradeLabel={GRADE_LABEL[String(finishGrade(kid.ladder))]}
            gender={kid.gender || progress.gender}
            onOpen={() => {
              const text = fillClimb(trainByGrade(kid.ladder))
              if (text) emitCue(`climb-${kid.id}`, text, { force: true })
            }}
          />
        </Card>
      </div>
    </>
  )
}
