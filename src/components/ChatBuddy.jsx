import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext.jsx'
import { getKidProgress, getKidSocial } from '@/services/api.js'
import { GRADE_LABEL, MONTH_HEB, finishGrade } from '@/data/ladders.js'
import { nextShabbosMevorchim } from '@/lib/shabbosMevorchim.js'
import { asset } from '@/lib/asset.js'

// A friendly Tzivos Hashem commander who greets the soldier and answers from
// what the site already knows about them. Scripted (no API / no cost / safe for
// kids) — it matches keywords in the child's question to the data on record.
// Rename the mascot here.
const BOT_NAME = 'Commander Mendy'

const QUICK_REPLIES = [
  'My mission this month',
  'How am I doing?',
  'My next medal',
  'When’s the next Shabbos Mevorchim?',
]

function buildReply(text, ctx) {
  const t = ` ${text.toLowerCase()} `
  const has = (...ks) => ks.some((k) => t.includes(k))
  const { firstName, ladder, gradeLabel, progress, social, sMevorchim, monthHeb } = ctx
  const cur = progress?.current
  const medal = progress?.medal
  const plural = (n) => (n === 1 ? '' : 's')

  if (has('help', 'what can you', 'what do you')) {
    return `I'm your commander, ${firstName}! 🫡 Ask me about:\n• your mission this month\n• how you're doing\n• your medals\n• your ladder\n• your rank\n• the next Shabbos Mevorchim`
  }
  if (!ladder && has('mission', 'say', 'kapitl', 'kapitel', 'quota', 'month', 'ladder', 'doing')) {
    return `First pick your ladder, soldier — then I'll tell you exactly what to say each month. Tap “Pick my ladder”! 🪜`
  }
  if (has('mission', ' say', 'kapitl', 'kapitel', 'quota', 'this month')) {
    if (!cur) return `Pick your ladder first and I'll give you your mission, soldier! 🪜`
    const mins = cur.minutes ? ` (about ${cur.minutes} minutes)` : ''
    const status = cur.met
      ? `You already reported it — mission complete! 👑`
      : `Say it this Shabbos Mevorchim and mark it done on your dashboard. 💪`
    return `This month — Shabbos Mevorchim ${monthHeb} — your mission is to say up to ${cur.quotaLabel}, that's ${cur.quota} kapitlach${mins}. ${status}`
  }
  if (has('medal')) {
    if (!medal) return `Finish a month's Tehillim and you earn a mission — missions earn medals! 🎖️`
    const current = medal.current ? `You've earned the ${medal.current.name} medal 🎖️.` : `No medal yet — your first is ${medal.next?.name} at ${medal.next?.threshold} missions.`
    const next = medal.next ? ` You're just ${medal.missionsToNext} mission${plural(medal.missionsToNext)} from ${medal.next.name}!` : ` You've earned every medal — incredible! 👑`
    return `${current}${next}`
  }
  if (has('how am i', 'how i am', 'doing', 'progress', 'am i doing')) {
    const m = progress?.missionsTotal ?? 0
    const medalLine = medal?.current ? `You're a ${medal.current.name}-medal soldier` : `You're on your way to your first medal`
    const nextLine = medal?.next ? ` — ${medal.missionsToNext} mission${plural(medal.missionsToNext)} to ${medal.next.name}.` : '.'
    return `You've completed ${m} mission${plural(m)}. ${medalLine}${nextLine} Keep climbing! 💪`
  }
  if (has('ladder')) {
    return `You're on Ladder ${ladder} — climbing to finish the whole Sefer Tehillim by ${gradeLabel} grade. 🪜 One step every Shabbos Mevorchim!`
  }
  if (has('mevorchim', 'next shabbos', 'when', 'bentch', 'bench')) {
    if (!sMevorchim) return `Keep an eye on your dashboard for the next Shabbos Mevorchim, soldier! 🎖️`
    const when = sMevorchim.daysUntil <= 0 ? 'this Shabbos!' : sMevorchim.daysUntil === 1 ? 'tomorrow' : `in ${sMevorchim.daysUntil} days`
    return `The next Shabbos Mevorchim bentches ${MONTH_HEB[sMevorchim.monthEn] ?? sMevorchim.monthEn} — that's ${when}${sMevorchim.hebDateLabel ? ` (${sMevorchim.hebDateLabel})` : ''}. Get ready! 🎖️`
  }
  if (has('rank', 'place', 'standing', 'class', 'school', 'leaderboard', 'first place')) {
    if (!social) return `Say your Tehillim and you lift your whole class and school up the ranks! 🏆`
    const tail = social.classRank === 1 ? `Your class is in first place — keep it on top! 🏆` : social.needToPass > 0 ? `${social.needToPass} more soldier${plural(social.needToPass)} finishing moves your class up!` : `Every soldier counts — say your Tehillim!`
    return `Your class ${social.className} is #${social.classRank} of ${social.totalClasses} in ${social.schoolName}, and your school ranks #${social.schoolRank} of ${social.totalSchools} worldwide. ${tail}`
  }
  if (has('perfect platoon', 'platoon')) {
    return `A platoon is a class — it becomes a Perfect Platoon when every single soldier finishes their quota that month. Do your part, soldier! 🎖️`
  }
  if (has('thank', 'thx', 'todah')) return `Anytime, soldier ${firstName}! 🫡`
  if (has('tired', ' hard', "can't", 'cant', "don't want", 'dont want', 'boring', 'too much', 'give up')) {
    return `Every kapitel counts, soldier — even a little Tehillim is a big mission. I'm counting on you, and so is the whole army! 💪`
  }
  if (has('bye', 'goodbye', 'good shabbos', 'gut shabbos', 'good shabbat')) return `Gut Shabbos, soldier ${firstName}! Don't forget your Tehillim. 🎖️`
  if (has('hi ', 'hello', 'hey', 'shalom', 'sholom', 'yo ', 'heya')) return `Attention, soldier ${firstName}! 🫡 Ready for your next mission?`

  return `I'm not sure about that one, soldier — but I can tell you about your mission this month, your medals, your ladder, your rank, or the next Shabbos Mevorchim. Tap a button below! 🎖️`
}

export default function ChatBuddy() {
  const { kid } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef(null)
  const timers = useRef([])

  const ctx = useMemo(() => {
    if (!kid) return null
    const progress = getKidProgress(kid.id)
    const social = kid.ladder ? getKidSocial(kid.id) : null
    return {
      firstName: (kid.name || 'Soldier').split(' ')[0],
      ladder: kid.ladder,
      gradeLabel: kid.ladder ? GRADE_LABEL[String(finishGrade(kid.ladder))] : null,
      progress,
      social,
      sMevorchim: nextShabbosMevorchim(),
      monthHeb: progress?.current ? MONTH_HEB[progress.current.month] : '',
    }
  }, [kid])

  // Greet once per login when the panel is first opened.
  useEffect(() => {
    if (!open || messages.length || !ctx) return
    const { firstName, ladder, gradeLabel, progress } = ctx
    const line1 = `Attention, soldier ${firstName}! 🫡 I'm ${BOT_NAME}.`
    const line2 = ladder
      ? `You're on Ladder ${ladder}, climbing to finish the whole Tehillim by ${gradeLabel} grade — ${progress?.missionsTotal ?? 0} missions done so far.`
      : `Let's get you started — pick your ladder and you're on your way up!`
    setMessages([{ id: 'w', from: 'bot', text: `${line1}\n${line2}\nHow can I help?` }])
  }, [open, messages.length, ctx])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  if (!kid) return null

  function send(raw) {
    const text = (raw ?? input).trim()
    if (!text) return
    setInput('')
    setMessages((m) => [...m, { id: `k${Date.now()}`, from: 'kid', text }])
    setTyping(true)
    const reply = buildReply(text, ctx)
    const tmr = setTimeout(() => {
      setTyping(false)
      setMessages((m) => [...m, { id: `b${Date.now()}`, from: 'bot', text: reply }])
    }, 450)
    timers.current.push(tmr)
  }

  return (
    <>
      {/* Launcher */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-navy py-2.5 pl-2.5 pr-4 text-white shadow-hover ring-1 ring-white/15 transition hover:-translate-y-0.5 sm:bottom-6 sm:right-6"
          aria-label={`Chat with ${BOT_NAME}`}
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gold">
            <img src={asset('design/icon-soldier-hat.png')} alt="" aria-hidden="true" draggable="false" className="h-6 w-auto" />
          </span>
          <span className="font-cond text-[15px] uppercase tracking-wide">Ask your commander</span>
        </button>
      ) : null}

      {/* Panel */}
      {open ? (
        <div className="fixed bottom-4 right-4 z-50 flex h-[32rem] max-h-[80vh] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[22px] bg-card shadow-hover ring-1 ring-line sm:bottom-6 sm:right-6">
          {/* Header */}
          <div className="hero-navy flex items-center gap-3 px-4 py-3">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-gold">
              <img src={asset('design/icon-soldier-hat.png')} alt="" aria-hidden="true" draggable="false" className="h-7 w-auto" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-cond text-[17px] uppercase leading-none tracking-wide text-white">{BOT_NAME}</p>
              <p className="mt-0.5 text-[12px] text-white/70">Your Tehillim commander</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto bg-paper/50 px-3 py-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === 'kid' ? 'justify-end' : 'justify-start'}`}>
                <span
                  className={`inline-block max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[14px] leading-snug ${
                    m.from === 'kid' ? 'rounded-br-md bg-navy text-white' : 'rounded-bl-md bg-card text-navy ring-1 ring-line'
                  }`}
                >
                  {m.text}
                </span>
              </div>
            ))}
            {typing ? (
              <div className="flex justify-start">
                <span className="inline-flex gap-1 rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 ring-1 ring-line">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
                </span>
              </div>
            ) : null}
          </div>

          {/* Quick replies */}
          <div className="flex flex-wrap gap-1.5 border-t border-line bg-card px-3 py-2">
            {QUICK_REPLIES.map((q) => (
              <button key={q} type="button" onClick={() => send(q)} className="rounded-full bg-track px-2.5 py-1 text-[12px] font-semibold text-navy transition hover:bg-green/15 hover:text-green">
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send() }}
            className="flex items-center gap-2 border-t border-line bg-card px-3 py-2.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your commander…"
              aria-label="Message"
              className="min-w-0 flex-1 rounded-full border border-line bg-[#eef4ff] px-3.5 py-2 text-[14px] text-navy outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/25"
            />
            <button type="submit" aria-label="Send" disabled={!input.trim()} className="grid h-9 w-9 flex-none place-items-center rounded-full bg-gold text-navy transition hover:brightness-95 disabled:opacity-40">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </form>
        </div>
      ) : null}
    </>
  )
}
