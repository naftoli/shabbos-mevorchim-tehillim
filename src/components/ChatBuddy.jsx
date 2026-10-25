import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { getKidProgress, getKidSocial } from '@/services/api.js'
import { GRADE_LABEL, MONTH_HEB, finishGrade } from '@/data/ladders.js'
import { nextShabbosMevorchim } from '@/lib/shabbosMevorchim.js'

// A warm, caring Tehillim helper (NOT a commander). It greets the child by name
// and opens with a nudge that fits how they're actually doing — behind on quota,
// way ahead, or still finding their feet — then chats from the data on record.
// Scripted, client-side, kid-safe. Rename the helper here:
const BOT_NAME = 'Mendy'

// Real-AI endpoint on the PHP backend (served under the app's base path). When
// it's unreachable — the static Netlify file, offline, or no API key set — the
// chat falls back to the scripted answers below, so Mendy always works.
const AI_ENDPOINT = `${import.meta.env.BASE_URL}api/chat`

// A compact, non-sensitive snapshot of the child's data for the AI prompt.
function aiContext(ctx) {
  if (!ctx) return {}
  const cur = ctx.progress?.current
  const medal = ctx.progress?.medal
  const s = ctx.social
  const sm = ctx.sMevorchim
  return {
    name: ctx.firstName,
    ladder: ctx.ladder ?? null,
    finishTrainingByGrade: ctx.gradeLabel ?? null,
    situation: ctx.situation,
    thisMonth: cur
      ? { month: ctx.monthHeb, kapitlachQuota: cur.quota, kapitlachLabel: cur.quotaLabel, kapitlachSaid: cur.said, minutesQuota: cur.minutes, minutesSaid: cur.saidMinutes, done: cur.met }
      : null,
    missionsTotal: ctx.progress?.missionsTotal ?? 0,
    medal: medal ? { current: medal.current?.name ?? null, next: medal.next?.name ?? null, missionsToNext: medal.missionsToNext ?? null } : null,
    rank: s ? { className: s.className, classRank: s.classRank, totalClasses: s.totalClasses, schoolName: s.schoolName, schoolRank: s.schoolRank, totalSchools: s.totalSchools, needToPass: s.needToPass } : null,
    nextShabbosMevorchim: sm ? { month: sm.monthEn, daysUntil: sm.daysUntil, hebDate: sm.hebDateLabel } : null,
  }
}

// Ask the backend AI. Throws on any failure so the caller can fall back.
async function aiReply(message, history, ctx) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: history.map((m) => ({ from: m.from, text: m.text })),
        context: aiContext(ctx),
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`chat ${res.status}`)
    const data = await res.json()
    if (!data || typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('no reply')
    return data.reply.trim()
  } finally {
    clearTimeout(timer)
  }
}

// Which situation is the child in right now? Drives the opening greeting.
function readSituation(ctx) {
  const { ladder, progress } = ctx
  if (!ladder) return 'pick'
  const prior = (progress?.months ?? []).filter((m) => !m.isCurrent)
  const last = prior[prior.length - 1]
  if (last && !last.met) return 'behind'
  const last3 = prior.slice(-3)
  if (last3.length >= 3 && last3.every((m) => m.said > m.quota) && ladder > 5) return 'ahead'
  return 'ontrack'
}

function openingGreeting(ctx) {
  const { firstName, ladder, progress } = ctx
  switch (ctx.situation) {
    case 'pick':
      return `Hi ${firstName}! 👋 Do you need help picking your ladder, or understanding how the Tehillim Club works? I'm here for you.`
    case 'behind': {
      const prior = progress.months.filter((m) => !m.isCurrent)
      const last = prior[prior.length - 1]
      const heb = last ? MONTH_HEB[last.month] : ''
      return `Hi ${firstName}. I noticed you didn't finish your Tehillim${heb ? ` for ${heb}` : ' last month'} — is everything okay? Your class, your school, and the whole army are counting on you. Even a little gets you right back on track. 💙`
    }
    case 'ahead':
      return `Hi ${firstName}! 🌟 You've been doing even more than your quota 3 months running — amazing! Ready for a bigger challenge? You could move up to Ladder ${ladder - 1}. Want to hear about it?`
    default:
      return `Hi ${firstName}! 👋 So good to see you — you're doing beautifully, ${progress?.missionsTotal ?? 0} missions done. Need anything? I can show your mission this month or how you're doing.`
  }
}

function quickRepliesFor(ctx) {
  switch (ctx.situation) {
    case 'pick':
      return ['Help me pick my ladder', 'How does it work?']
    case 'behind':
      return ['What do I say this month?', 'How does it work?']
    case 'ahead':
      return [`Tell me about Ladder ${ctx.ladder - 1}`, 'How am I doing?']
    default:
      return ['My mission this month', 'How am I doing?', 'My medals']
  }
}

function buildReply(text, ctx) {
  const t = ` ${text.toLowerCase()} `
  const has = (...ks) => ks.some((k) => t.includes(k))
  const { firstName, ladder, gradeLabel, progress, social, sMevorchim, monthHeb } = ctx
  const cur = progress?.current
  const medal = progress?.medal
  const plural = (n) => (n === 1 ? '' : 's')

  if (has('how does it work', 'how it work', 'how do i', 'explain', 'what is this', 'what do i do', 'understand')) {
    return `It's simple, ${firstName}: every Shabbos Mevorchim you say your Tehillim and mark it done here. You pick a “ladder” — your training plan for the grade you'll finish training to say the whole Tehillim by — and each month it tells you exactly what to say. Little by little, you train up to all 150 kapitlach! 📖`
  }
  // Which ladder am I on? — check before "pick a ladder" so it isn't mistaken
  // for a help-choosing question.
  if (has('am i on', 'currently on', 'ladder am i', 'which ladder am i', 'what ladder am i', 'which one am i', 'what one am i', 'my ladder', 'my current', 'on now', "i'm on", 'im on', 'which number am i', 'what number am i', 'am i currently')) {
    if (!ladder) return `You haven't picked your ladder yet, ${firstName} — want help choosing one? 🪜`
    return `You're on Ladder ${ladder} — you're training to say the whole Sefer Tehillim by ${gradeLabel} grade. One step every Shabbos Mevorchim! 🪜`
  }
  if (has('help me pick', 'help me choose', 'help pick', 'help choose', 'pick', 'choose', 'which ladder', 'what ladder', 'recommend', 'should i be on')) {
    return `A ladder is your training plan — the grade you'll finish training to say the whole Tehillim by. A lower number means a little more each month, a higher number is a gentler climb. Pick whatever feels right for you; you can always change it later. Tap “${ladder ? 'Switch my ladder' : 'Pick my ladder'}” on your page and I'll be right here. 🪜`
  }
  if (has('challenge', 'harder', 'move up', 'switch', 'change', 'tell me about ladder', 'bigger')) {
    const target = ladder && ladder > 5 ? ladder - 1 : ladder
    if (ladder && ladder > 5) return `Ladder ${target} finishes the whole Tehillim by ${GRADE_LABEL[String(target)]} grade — a bit more each month than Ladder ${ladder}. If you're saying more than your quota already, you'd do great! Tap “Switch my ladder” whenever you're ready. 🌟`
    return `You're already on the steepest ladder — that's the fastest climb there is! Incredible, ${firstName}. 🌟`
  }
  if (has('mission', ' say', 'kapitl', 'kapitel', 'quota', 'this month')) {
    if (!cur || !ladder) return `Pick your ladder first and I'll tell you exactly what to say each month. Want help choosing? 🪜`
    const mins = cur.minutes ? ` (about ${cur.minutes} minutes)` : ''
    const status = cur.met ? `And you already did it — wonderful! 🌟` : `Say it this Shabbos Mevorchim and mark it done here. You've got this! 💪`
    return `This month — Shabbos Mevorchim ${monthHeb} — you say up to ${cur.quotaLabel}, that's ${cur.quota} kapitlach${mins}. ${status}`
  }
  if (has('medal')) {
    if (!medal) return `Finishing a month's Tehillim earns you a mission — and missions earn you medals! 🎖️`
    const current = medal.current ? `You've earned the ${medal.current.name} medal 🎖️.` : `No medal yet — your first is ${medal.next?.name} at ${medal.next?.threshold} missions.`
    const next = medal.next ? ` You're just ${medal.missionsToNext} mission${plural(medal.missionsToNext)} from ${medal.next.name}!` : ` You've earned every single medal — wow! 👑`
    return `${current}${next}`
  }
  if (has('how am i', 'how i am', 'doing', 'progress', 'am i doing')) {
    const m = progress?.missionsTotal ?? 0
    const medalLine = medal?.current ? `You've earned the ${medal.current.name} medal` : `You're on your way to your first medal`
    const nextLine = medal?.next ? ` — ${medal.missionsToNext} mission${plural(medal.missionsToNext)} to ${medal.next.name}.` : '.'
    return `You've completed ${m} mission${plural(m)}. ${medalLine}${nextLine} Keep it up, ${firstName}! 💪`
  }
  if (has('ladder', 'which one', 'what one', 'currently on', 'am i on', 'which am i', 'what am i on', "i'm on", 'im on', 'on now', 'my current', 'what grade', 'which number', 'what number')) {
    if (!ladder) return `You haven't picked your ladder yet, ${firstName} — want help choosing one? 🪜`
    return `You're on Ladder ${ladder} — you're training to say the whole Sefer Tehillim by ${gradeLabel} grade. One step every Shabbos Mevorchim! 🪜`
  }
  if (has('mevorchim', 'next shabbos', 'when', 'bentch', 'bench')) {
    if (!sMevorchim) return `Keep an eye on your page for the next Shabbos Mevorchim! 💙`
    const when = sMevorchim.daysUntil <= 0 ? 'this Shabbos!' : sMevorchim.daysUntil === 1 ? 'tomorrow' : `in ${sMevorchim.daysUntil} days`
    return `The next Shabbos Mevorchim bentches ${MONTH_HEB[sMevorchim.monthEn] ?? sMevorchim.monthEn} — that's ${when}${sMevorchim.hebDateLabel ? ` (${sMevorchim.hebDateLabel})` : ''}. Get ready! 💙`
  }
  if (has('rank', 'place', 'standing', 'class', 'school', 'leaderboard')) {
    if (!social) return `Every time you say your Tehillim, you lift your whole class and school up! 🏆`
    const tail = social.classRank === 1 ? `Your class is in first place — amazing!` : social.needToPass > 0 ? `${social.needToPass} more soldier${plural(social.needToPass)} finishing moves your class up!` : `Every child counts — keep saying your Tehillim!`
    return `Your class ${social.className} is #${social.classRank} of ${social.totalClasses} in ${social.schoolName}, and your school ranks #${social.schoolRank} of ${social.totalSchools} worldwide. ${tail} 🏆`
  }
  if (has('perfect platoon', 'platoon')) {
    return `A platoon is a class — it becomes a Perfect Platoon when every single child finishes their quota that month. Your part matters! 🎖️`
  }
  if (has('behind', "didn't", 'didnt', 'missed', 'forgot', 'late', 'catch up')) {
    return `It's okay, ${firstName} — every kapitel counts, and you can always catch up. Say what you can this Shabbos Mevorchim and mark it done. I believe in you! 💙`
  }
  if (has('tired', ' hard', "can't", 'cant', "don't want", 'dont want', 'boring', 'too much', 'give up')) {
    return `I hear you, ${firstName}. Even a little Tehillim is big — start with just a few kapitlach and see how it feels. I'm right here cheering you on. 💙`
  }
  if (has('thank', 'thx', 'todah')) return `Anytime, ${firstName}! 💙`
  if (has('yes', 'sure', 'okay', 'ok ', "let's", 'lets')) return `Love it! 🌟 Tap “${ladder ? 'Switch my ladder' : 'Pick my ladder'}” on your page, or ask me anything else.`
  if (has('bye', 'goodbye', 'good shabbos', 'gut shabbos', 'good shabbat')) return `Gut Shabbos, ${firstName}! Don't forget your Tehillim. 💙`
  if (has('hi ', 'hello', 'hey', 'shalom', 'sholom', 'heya')) return `Hi ${firstName}! 👋 How can I help you today?`

  return `I'm not sure about that one, ${firstName} — but I can help with picking your ladder, how it all works, your mission this month, your medals, or how you're doing. Tap a button below! 💙`
}

function Avatar({ size = 'h-10 w-10', text = 'text-2xl' }) {
  return <span className={`grid ${size} flex-none place-items-center rounded-full bg-gold/90 ${text}`} aria-hidden="true">📖</span>
}

export default function ChatBuddy() {
  const { kid } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [peekClosed, setPeekClosed] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef(null)
  const convoRef = useRef([])

  const ctx = useMemo(() => {
    if (!kid) return null
    const progress = getKidProgress(kid.id)
    const social = kid.ladder ? getKidSocial(kid.id) : null
    const base = {
      firstName: (kid.name || 'friend').split(' ')[0],
      ladder: kid.ladder,
      gradeLabel: kid.ladder ? GRADE_LABEL[String(finishGrade(kid.ladder))] : null,
      progress,
      social,
      sMevorchim: nextShabbosMevorchim(),
      monthHeb: progress?.current ? MONTH_HEB[progress.current.month] : '',
    }
    return { ...base, situation: readSituation(base) }
  }, [kid])

  const greeting = useMemo(() => (ctx ? openingGreeting(ctx) : ''), [ctx])
  const quickReplies = useMemo(() => (ctx ? quickRepliesFor(ctx) : []), [ctx])

  // Seed the opening greeting the first time the panel opens.
  useEffect(() => {
    if (open && !messages.length && greeting) setMessages([{ id: 'w', from: 'bot', text: greeting }])
  }, [open, messages.length, greeting])

  useEffect(() => {
    convoRef.current = messages
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])

  if (!kid) return null
  const showPeek = !open && !peekClosed && pathname === '/me' && !!greeting

  async function send(raw) {
    const text = (raw ?? input).trim()
    if (!text) return
    setInput('')
    const kidMsg = { id: `k${Date.now()}`, from: 'kid', text }
    setMessages((m) => [...m, kidMsg])
    setTyping(true)
    const history = [...convoRef.current, kidMsg].slice(-9)
    let reply
    try {
      reply = await aiReply(text, history, ctx) // real AI via the backend
    } catch {
      reply = buildReply(text, ctx) // scripted fallback (static file / offline / no key)
    }
    setTyping(false)
    setMessages((m) => [...m, { id: `b${Date.now()}`, from: 'bot', text: reply }])
  }

  return (
    <>
      {/* Proactive greeting peek — only on the child's own page */}
      {showPeek ? (
        <div className="fixed bottom-20 right-4 z-50 w-[19rem] max-w-[calc(100vw-2rem)] sm:bottom-24 sm:right-6">
          <div className="relative rounded-2xl rounded-br-md bg-card p-3.5 pr-8 text-[14px] leading-snug text-navy shadow-hover ring-1 ring-line">
            <button type="button" onClick={() => setPeekClosed(true)} aria-label="Dismiss" className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full text-muted transition hover:bg-track">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <button type="button" onClick={() => setOpen(true)} className="block text-left">
              <span className="mb-1 flex items-center gap-2">
                <Avatar size="h-7 w-7" text="text-base" />
                <span className="font-display text-[14px] font-black text-navy">{BOT_NAME}</span>
              </span>
              {greeting}
              <span className="mt-2 block font-semibold text-blue">Tap to chat →</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Launcher */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-navy py-2.5 pl-2.5 pr-4 text-white shadow-hover ring-1 ring-white/15 transition hover:-translate-y-0.5 sm:bottom-6 sm:right-6"
          aria-label={`Chat with ${BOT_NAME}`}
        >
          <Avatar size="h-9 w-9" text="text-xl" />
          <span className="font-cond text-[15px] uppercase tracking-wide">Hi! Need help?</span>
        </button>
      ) : null}

      {/* Panel */}
      {open ? (
        <div className="fixed bottom-4 right-4 z-50 flex h-[32rem] max-h-[80vh] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[22px] bg-card shadow-hover ring-1 ring-line sm:bottom-6 sm:right-6">
          <div className="hero-navy flex items-center gap-3 px-4 py-3">
            <Avatar />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[17px] font-black leading-none text-white">{BOT_NAME}</p>
              <p className="mt-0.5 text-[12px] text-white/70">Your Tehillim helper</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto bg-paper/50 px-3 py-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === 'kid' ? 'justify-end' : 'justify-start'}`}>
                <span className={`inline-block max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[14px] leading-snug ${m.from === 'kid' ? 'rounded-br-md bg-navy text-white' : 'rounded-bl-md bg-card text-navy ring-1 ring-line'}`}>
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

          <div className="flex flex-wrap gap-1.5 border-t border-line bg-card px-3 py-2">
            {quickReplies.map((q) => (
              <button key={q} type="button" onClick={() => send(q)} className="rounded-full bg-track px-2.5 py-1 text-[12px] font-semibold text-navy transition hover:bg-green/15 hover:text-green">
                {q}
              </button>
            ))}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex items-center gap-2 border-t border-line bg-card px-3 py-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask ${BOT_NAME}…`}
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
