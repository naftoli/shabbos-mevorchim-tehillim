import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { getKidProgress, getKidSocial } from '@/services/api.js'
import { useLiveData } from '@/lib/useLiveData.js'
import { GRADE_LABEL, MONTH_HEB, finishGrade } from '@/data/ladders.js'
import { nextShabbosMevorchim } from '@/lib/shabbosMevorchim.js'
import { BOT_NAME, ladderMenu, openingGreeting, peekText, quickRepliesFor, readSituation, scriptedTurn } from '@/lib/general613.js'
import { canListen, canSpeak, speak, startRecognition, stopSpeaking, stripForSpeech } from '@/lib/speech.js'

// General 613, the Tehillim Club's talking general. With no ladder yet he walks
// the real choices out loud and saves the one the child accepts. Otherwise he
// greets for a missed month, a quota they beat, or a soldier on track. Kids can
// type or talk back. Scripted, client-side, kid-safe when the AI endpoint is down.

// Real-AI endpoint on the PHP backend (served under the app's base path). When
// it's unreachable — the static Netlify file, offline, or no API key set — the
// chat falls back to the scripted answers below, so General 613 always works.
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
    childGrade: ctx.grade ?? null,
    childGradeLabel: ctx.childGradeLabel ?? null,
    ladder: ctx.ladder ?? null,
    finishTrainingByGrade: ctx.gradeLabel ?? null,
    focusLadder: ctx.focusLadder ?? null,
    situation: ctx.situation,
    greeting: ctx.greeting ?? null,
    monthEn: ctx.monthEn ?? null,
    ladderChoices: ctx.ladderChoices ?? [],
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

function buildReply(text, ctx) {
  const t = ` ${text.toLowerCase()} `
  const has = (...ks) => ks.some((k) => t.includes(k))
  const { firstName, ladder, gradeLabel, progress, social, sMevorchim, monthHeb } = ctx
  const cur = progress?.current
  const medal = progress?.medal
  const plural = (n) => (n === 1 ? '' : 's')

  // --- who / what are you ---
  if (has('who are you', 'your name', 'what are you', 'are you a robot', 'are you real', 'are you a person', 'are you ai', 'who r u', 'who made you')) {
    return `I'm ${BOT_NAME}, your Tehillim general! 😊 I'm here to help with your Tehillim, your ladder, your missions and medals — and to cheer you on. What can I help with?`
  }
  // --- help / menu ---
  if (has('what can you', 'what do you do', 'what can i ask', 'help me with', ' menu ', 'what can i do here', 'what should i ask')) {
    return `Ask me anything about your Tehillim, ${firstName}! Like: what to say this month, how you're doing, your medals, your ladder, your rank, when the next Shabbos Mevorchim is, or how it all works. 💙`
  }
  // --- how it works ---
  if (has('how does it work', 'how it work', 'how do i do this', 'how does this', 'what is this', 'what do i do', 'understand how', 'explain')) {
    return `It's simple, ${firstName}: every Shabbos Mevorchim you say your Tehillim and mark it done here. You pick a “ladder” — your training plan for the grade you'll finish training to say the whole Tehillim by — and each month it tells you exactly what to say. Little by little, you train up to all 150 kapitlach! 📖`
  }
  // --- what is the club / tzivos hashem / mivtza / soldier ---
  if (has('what is the tehillim club', 'what is the club', 'what is tzivos', "what's tzivos", 'what is a mivtza', "what's a mivtza", 'what is a soldier', 'what is a chayol', 'about the club', 'what is this club')) {
    return `The Worldwide Tehillim Club is a Tzivos Hashem mivtza — kids like you, soldiers in Hashem's army, saying Tehillim every Shabbos Mevorchim and climbing grade by grade toward the whole Sefer Tehillim. You're part of a worldwide army! 🌍`
  }
  // --- the goal ---
  if (has('the goal', 'the point', 'the aim', 'working toward', 'working towards', "what's the goal", 'what is the goal')) {
    return `The goal is to say the whole Sefer Tehillim every Shabbos Mevorchim! Your ladder is the training that builds you up to it, one month at a time. 📖`
  }
  // --- about Tehillim (150 / Dovid HaMelech) ---
  if (has('what is tehillim', 'what are tehillim', 'what is a kapitel', 'what is a perek', 'what does kapitel', 'who wrote', 'who said the whole', 'how many kapitlach are', 'how many kapitlach in', 'how many perek', 'how many perakim', 'how many chapters', 'how many psalms', '150 kapitl', 'how many is tehillim')) {
    return `Tehillim (Psalms) has 150 kapitlach, written by Dovid HaMelech. Saying them is a beautiful way to daven to Hashem — and in our club you climb toward saying all 150! 📖`
  }
  // --- Shabbos Mevorchim meaning ---
  if (has('what is shabbos mevorchim', 'what is mevorchim', 'why shabbos mevorchim', 'why mevorchim', 'what does mevorchim', 'what does bentsch', 'what does bentch')) {
    return `Shabbos Mevorchim is the Shabbos before Rosh Chodesh, when we bless the new month. The minhag is to say the whole Tehillim that morning — that's our mission each month! 📖`
  }
  // --- when is the next Shabbos Mevorchim (data) ---
  if (has('when', 'next shabbos', 'next mevorchim', 'how many days', 'how long until', 'bentch', 'bench')) {
    if (!sMevorchim) return `Keep an eye on your page for the next Shabbos Mevorchim! 💙`
    const when = sMevorchim.daysUntil <= 0 ? 'this Shabbos!' : sMevorchim.daysUntil === 1 ? 'tomorrow' : `in ${sMevorchim.daysUntil} days`
    return `The next Shabbos Mevorchim bentches ${MONTH_HEB[sMevorchim.monthEn] ?? sMevorchim.monthEn} — that's ${when}${sMevorchim.hebDateLabel ? ` (${sMevorchim.hebDateLabel})` : ''}. Get ready! 💙`
  }
  // --- report / mark / log ---
  if (has('report', 'mark it', 'how do i put', 'where do i put', 'log my', 'enter my', 'submit', 'write it in', 'i said my', 'i said it', 'i did my', 'how do i record', 'where do i write', 'how do i save')) {
    return `Easy, ${firstName}! On your page, type how many kapitlach (and minutes) you said in the boxes and tap Save. That's it — it counts for your class, school and the whole army! 💙`
  }
  // --- which ladder am I on? (before "pick a ladder") ---
  if (has('am i on', 'currently on', 'ladder am i', 'which ladder am i', 'what ladder am i', 'which one am i', 'what one am i', 'my ladder', 'my current', 'on now', "i'm on", 'im on', 'which number am i', 'what number am i', 'am i currently', 'what grade do i finish')) {
    if (!ladder) return `You haven't picked your ladder yet, ${firstName} — want help choosing one? 🪜`
    return `You're on Ladder ${ladder} — you're training to say the whole Sefer Tehillim by ${gradeLabel} grade. One step every Shabbos Mevorchim! 🪜`
  }
  // --- pick / choose / change ladder ---
  if (has('help me pick', 'help me choose', 'help pick', 'help choose', ' pick', 'choose', 'which ladder', 'what ladder', 'recommend', 'should i be on', 'change my ladder', 'change ladder', 'switch my ladder', 'how do i change', 'how do i switch', 'what is a ladder', 'how do ladders', 'tell me about ladder')) {
    return `A ladder is your training plan — the grade you'll finish training to say the whole Tehillim by. A lower number means a little more each month, a higher number is a gentler climb. Pick whatever feels right; you can always change it later. Tap “${ladder ? 'Switch my ladder' : 'Pick my ladder'}” on your page and I'll be right here. 🪜`
  }
  // --- harder / easier ladder ---
  if (has('harder', 'hardest', 'steep', 'fastest', 'easier', 'easiest', 'slower', 'gentler', 'move up', 'challenge', 'bigger', 'faster ladder')) {
    const target = ladder && ladder > 5 ? ladder - 1 : ladder
    if (ladder && ladder > 5) return `Want a bigger challenge? Ladder ${target} finishes training by ${GRADE_LABEL[String(target)]} grade — a bit more each month than Ladder ${ladder}. If you're beating your quota already, you'd do great! Tap “Switch my ladder” when you're ready. 🌟`
    if (ladder) return `You're already on the steepest ladder — the fastest climb there is! Incredible, ${firstName}. 🌟`
    return `A lower ladder number is a steeper, faster climb; a higher one is gentler. Pick what feels right — tap “Pick my ladder.” 🪜`
  }
  // --- what is a mission ---
  if (has('what is a mission', "what's a mission", 'what are missions', 'how do i get a mission', 'how do i earn', 'what counts as a mission')) {
    return `A mission is finishing a month's Tehillim — say your kapitlach and mark it done, and that's one mission! Collect missions to earn medals. 🎖️`
  }
  // --- how many missions (data) ---
  if (has('how many missions', 'missions do i have', 'how many have i', 'total missions', 'how many did i')) {
    const m = progress?.missionsTotal ?? 0
    return `You've completed ${m} mission${plural(m)} so far, ${firstName}!${medal?.next ? ` ${medal.missionsToNext} more to your ${medal.next.name} medal.` : ''} 💪`
  }
  // --- this month's mission (data) ---
  if (has('this month', 'what do i say', 'what should i say', 'my mission', 'my kapitl', 'how many kapitl', 'how much do i say', 'my quota', ' quota', 'minute', 'say up to')) {
    if (!cur || !ladder) return `Pick your ladder first and I'll tell you exactly what to say each month. Want help choosing? 🪜`
    const mins = cur.minutes ? ` (about ${cur.minutes} minutes)` : ''
    const status = cur.met ? `And you already did it — wonderful! 🌟` : `Say it this Shabbos Mevorchim and mark it done here. You've got this! 💪`
    return `This month — Shabbos Mevorchim ${monthHeb} — you say up to ${cur.quotaLabel}, that's ${cur.quota} kapitlach${mins}. ${status}`
  }
  // --- medals (data) ---
  if (has('medal', 'award', 'prize', 'trophy', 'what do i get', 'next level', 'what level')) {
    if (!medal) return `Finishing a month's Tehillim earns you a mission — and missions earn you medals! 🎖️`
    const current = medal.current ? `You've earned the ${medal.current.name} medal 🎖️.` : `No medal yet — your first is ${medal.next?.name} at ${medal.next?.threshold} missions.`
    const next = medal.next ? ` You're just ${medal.missionsToNext} mission${plural(medal.missionsToNext)} from ${medal.next.name}!` : ` You've earned every single medal — wow! 👑`
    return `${current}${next}`
  }
  // --- progress / how am I doing (data) ---
  if (has('how am i', 'how i am', 'doing', 'progress', 'am i doing', 'how far', 'am i good')) {
    const m = progress?.missionsTotal ?? 0
    const medalLine = medal?.current ? `You've earned the ${medal.current.name} medal` : `You're on your way to your first medal`
    const nextLine = medal?.next ? ` — ${medal.missionsToNext} mission${plural(medal.missionsToNext)} to ${medal.next.name}.` : '.'
    return `You've completed ${m} mission${plural(m)}. ${medalLine}${nextLine} Keep it up, ${firstName}! 💪`
  }
  // --- impact / why it matters ---
  if (has('affect', 'impact', 'matter', 'count', 'does it do', 'help my', 'help the', 'lift', 'difference', 'why does', 'who does', 'why is it important')) {
    return `Every kapitel you say counts for your class, your school, and the whole Tzivos Hashem army, ${firstName} — you lift everyone up! And when every child in your class finishes, you become a Perfect Platoon. 💙`
  }
  // --- rank / class / school / winning (data) ---
  if (has('rank', 'place', 'standing', 'class', 'school', 'leaderboard', 'winning', 'first place', 'who is ahead', 'who won', 'am i first')) {
    if (!social) return `Every time you say your Tehillim, you lift your whole class and school up! 🏆`
    const tail = social.classRank === 1 ? `Your class is in first place — amazing!` : social.needToPass > 0 ? `${social.needToPass} more soldier${plural(social.needToPass)} finishing moves your class up!` : `Every child counts — keep saying your Tehillim!`
    return `Your class ${social.className} is #${social.classRank} of ${social.totalClasses} in ${social.schoolName}, and your school ranks #${social.schoolRank} of ${social.totalSchools} worldwide. ${tail} 🏆`
  }
  // --- perfect platoon ---
  if (has('perfect platoon', 'platoon')) {
    return `A platoon is a class — it becomes a Perfect Platoon when every single child finishes their quota that month. Your part matters! 🎖️`
  }
  // --- how many schools / kids ---
  if (has('how many schools', 'how many kids', 'how many soldiers', 'how many children', 'how big', 'how many people')) {
    return `Soldiers all over the world are in the club! 🌍 The Home page shows every school and the worldwide Tehillim count climbing together.`
  }
  // --- login / account ---
  if (has('log in', 'login', 'sign in', 'password', 'forgot my', 'my serial', 'sign out', 'log out', "can't get in", 'locked out', 'how do i get in')) {
    return `To sign in, use your serial number and date of birth on the Soldier Login page. Stuck? Ask your teacher or parent — they can get your serial for you. 💙`
  }
  // --- behind / missed ---
  if (has('behind', "didn't", 'didnt', 'missed', 'forgot to', 'i forgot', ' late', 'catch up', 'fell behind', 'skipped')) {
    return `It's okay, ${firstName} — every kapitel counts, and you can always catch up. Say what you can this Shabbos Mevorchim and mark it done. I believe in you! 💙`
  }
  // --- tired / hard / don't want ---
  if (has('tired', ' hard', "can't", 'cant', "don't want", 'dont want', 'boring', 'too much', 'give up', 'difficult', "don't feel", 'lazy')) {
    return `I hear you, ${firstName}. Even a little Tehillim is big — start with just a few kapitlach and see how it feels. I'm right here cheering you on. 💙`
  }
  // --- celebration ---
  if (has('i did it', 'i finished', 'i said it all', 'i said all', 'all done', 'i completed', 'i got a medal', 'finished my tehillim', 'i reached', 'i made it', 'i said the whole')) {
    return `That's amazing, ${firstName}!! 🎉 I'm so proud of you — make sure it's marked done on your page so it counts. Onward and upward! 🌟`
  }
  // --- feelings ---
  if (has('sad', 'upset', 'crying', 'scared', 'worried', 'nervous', 'angry', ' mad ', 'lonely')) {
    return `I'm sorry you're feeling that way, ${firstName}. 💙 Saying a little Tehillim can comfort the heart — and if something's really bothering you, please talk to a parent, teacher, or Rabbi. I'm here for your Tehillim whenever you're ready.`
  }
  if (has('happy', 'excited', 'awesome', 'amazing', ' love ', 'the best', 'so good', 'great')) {
    return `That makes me happy too, ${firstName}! 🌟 Let's keep it going — say your Tehillim and climb higher!`
  }
  // --- thanks ---
  if (has('thank', ' thx', 'todah', ' ty ')) return `Anytime, ${firstName}! 💙`
  // --- yes / no ---
  if (has(' yes ', ' yeah ', ' sure ', ' okay ', ' ok ', "let's", ' lets ', ' yep ', ' yup ')) return `Love it! 🌟 Tap “${ladder ? 'Switch my ladder' : 'Pick my ladder'}” on your page, or ask me anything else.`
  if (has(' no ', ' nope ', 'not now', ' nah ')) return `No problem, ${firstName}! I'm right here whenever you need me. 💙`
  // --- greeting ---
  if (has(' hi ', ' hi!', 'hello', ' hey', 'shalom', 'sholom', 'heya', 'good morning', 'good afternoon', 'hi general', 'general 613')) return `Hi ${firstName}! 👋 How can I help you today?`
  // --- bye ---
  if (has(' bye', 'goodbye', 'good shabbos', 'gut shabbos', 'good shabbat', 'see you', 'good night', 'gotta go')) return `Gut Shabbos, ${firstName}! Don't forget your Tehillim. 💙`

  return `I'm not sure about that one, ${firstName} — but I can help with your mission this month, your ladder, your medals, how you're doing, your rank, or the next Shabbos Mevorchim. Just ask, or tap a button below! 💙`
}

function Avatar({ size = 'h-10 w-10', text = 'text-2xl' }) {
  return <span className={`grid ${size} flex-none place-items-center rounded-full bg-gold/90 ${text}`} aria-hidden="true">📖</span>
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  )
}

function SpeakerIcon({ muted }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10v4h3l4 3V7L7 10H4z" />
      {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : (
        <>
          <path d="M16 9a4 4 0 0 1 0 6" />
          <path d="M18.5 7a7 7 0 0 1 0 10" />
        </>
      )}
    </svg>
  )
}

const MUTE_KEY = 'wwtc_general_muted'

export default function ChatBuddy() {
  const { kid, changeLadder } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [peekClosed, setPeekClosed] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
  })
  const [listening, setListening] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [micNote, setMicNote] = useState('')
  const [focusLadder, setFocusLadder] = useState(null)
  // Keep the first spoken greeting in the thread after a ladder is saved,
  // so the walk doesn't get replaced by the next situation line.
  const [pinnedGreeting, setPinnedGreeting] = useState(null)
  const kidId = kid?.id ?? null
  const [trackedKid, setTrackedKid] = useState(kidId)
  // Drop a previous soldier's live mic/voice when the signed-in kid changes.
  if (trackedKid !== kidId) {
    setTrackedKid(kidId)
    setVoiceOn(false)
    setListening(false)
    setSpeaking(false)
    setMicNote('')
    setFocusLadder(null)
    setPinnedGreeting(null)
  }
  const scrollRef = useRef(null)
  const convoRef = useRef([])
  const msgSeq = useRef(0) // monotonic message ids (no impure Date.now in render)
  const mutedRef = useRef(muted)
  const openRef = useRef(open)
  const inputRef = useRef(input)
  const ctxRef = useRef(null)
  const greetingRef = useRef('')
  const voiceOnRef = useRef(false)
  const listenHandle = useRef(null)
  const turnRef = useRef(0)
  const sayGen = useRef(0)
  const greetedId = useRef(null)
  const pendingSpeech = useRef(null)
  const focusLadderRef = useRef(null)

  const { data: progress } = useLiveData(() => (kid ? getKidProgress(kid.id) : Promise.resolve(null)), [kid])
  const { data: social } = useLiveData(
    () => (kid && kid.ladder ? getKidSocial(kid.id) : Promise.resolve(null)),
    [kid],
  )

  const reportMonth = progress && progress.current ? progress.current.month : null
  const ctx = useMemo(() => {
    if (!kid || !progress) return null
    const monthEn = reportMonth || nextShabbosMevorchim()?.monthEn || null
    const base = {
      firstName: (kid.name || 'friend').split(' ')[0],
      ladder: kid.ladder,
      grade: kid.grade,
      childGradeLabel: GRADE_LABEL[String(kid.grade)] ?? '',
      gradeLabel: kid.ladder ? GRADE_LABEL[String(finishGrade(kid.ladder))] : null,
      monthEn,
      focusLadder,
      ladderChoices: ladderMenu(kid.grade, monthEn),
      progress,
      social,
      sMevorchim: nextShabbosMevorchim(),
      monthHeb: monthEn ? MONTH_HEB[monthEn] ?? '' : '',
    }
    const situation = readSituation(base)
    const withSituation = { ...base, situation }
    return { ...withSituation, greeting: openingGreeting(withSituation) }
  }, [kid, progress, social, focusLadder, reportMonth])

  const greeting = ctx?.greeting ?? ''
  const quickReplies = useMemo(() => (ctx ? quickRepliesFor(ctx) : []), [ctx])
  if (kid && ctx && (pinnedGreeting == null || pinnedGreeting.id !== kid.id)) {
    setPinnedGreeting({ id: kid.id, text: ctx.greeting, situation: ctx.situation })
  }
  if (ctx && ctx.situation !== 'pick' && focusLadder != null) {
    setFocusLadder(null)
  }

  // Latest values for async speech/mic callbacks. Written here, not during render.
  useEffect(() => {
    mutedRef.current = muted
    openRef.current = open
    inputRef.current = input
    ctxRef.current = ctx
    greetingRef.current = greeting
    focusLadderRef.current = focusLadder
  })

  function setVoice(on) {
    voiceOnRef.current = on
    setVoiceOn(on)
  }

  function stopListening() {
    listenHandle.current?.stop()
    listenHandle.current = null
    setListening(false)
  }

  function endVoice() {
    setVoice(false)
    stopListening()
  }

  // Speak one line. Latest call wins; emoji are stripped inside speak().
  const say = useCallback((text) => {
    const gen = ++sayGen.current
    const willTalk = !mutedRef.current && canSpeak() && !!stripForSpeech(text)
    if (willTalk) setSpeaking(true)
    const done = speak(text, { muted: mutedRef.current })
    done.finally(() => {
      if (gen === sayGen.current) setSpeaking(false)
    })
    return done
  }, [])

  function beginListening() {
    if (!canListen() || !openRef.current || !voiceOnRef.current) return
    stopListening()
    const draft = inputRef.current
    let lastPartial = ''
    setListening(true)
    setMicNote('')
    listenHandle.current = startRecognition({
      onPartial: (text) => {
        lastPartial = text
        inputRef.current = text
        setInput(text)
      },
      onFinal: (text) => {
        lastPartial = ''
        setListening(false)
        listenHandle.current = null
        inputRef.current = ''
        setInput('')
        void send(text)
      },
      onSilence: () => {
        setListening(false)
        listenHandle.current = null
        inputRef.current = draft
        setInput(draft)
        setVoice(false)
      },
      onError: (code) => {
        setListening(false)
        listenHandle.current = null
        inputRef.current = draft
        setInput(draft)
        setVoice(false)
        setMicNote(
          code === 'not-allowed' || code === 'service-not-allowed'
            ? 'The microphone is blocked in this browser. You can still type.'
            : 'I could not use the microphone. You can still type.',
        )
      },
      onEnd: () => {
        setListening(false)
        listenHandle.current = null
        if (lastPartial.trim()) {
          const text = lastPartial.trim()
          lastPartial = ''
          inputRef.current = ''
          setInput('')
          void send(text)
          return
        }
        inputRef.current = draft
        setInput(draft)
        setVoice(false)
      },
    })
  }

  async function send(raw) {
    const text = String(raw ?? inputRef.current).trim()
    if (!text || !ctxRef.current) return
    inputRef.current = ''
    setInput('')
    setMicNote('')
    stopListening()
    const myTurn = ++turnRef.current
    const kidMsg = { id: `k${(msgSeq.current += 1)}`, from: 'kid', text }
    setMessages((m) => [...m, kidMsg])
    setTyping(true)
    const greet = greetingRef.current
    const history = [...(greet ? [{ from: 'bot', text: greet }] : []), ...convoRef.current, kidMsg].slice(-9)
    const snapshot = { ...ctxRef.current, focusLadder: focusLadderRef.current }
    // The owner's ladder, quota, and medal lines stay exact. Other questions
    // still go to the AI, then the keyword fallback.
    const scripted = scriptedTurn(text, snapshot)
    let reply
    if (scripted) {
      reply = scripted.reply
      focusLadderRef.current = scripted.focusLadder
      setFocusLadder(scripted.focusLadder)
      if (scripted.pickLadder != null) {
        const saved = await changeLadder(scripted.pickLadder)
        if (!saved) {
          reply = `I couldn't save ladder ${scripted.pickLadder} yet. Tap Pick my ladder on your page and choose it there.`
        }
      }
    } else {
      try {
        reply = await aiReply(text, history, snapshot) // real AI via the backend
      } catch {
        reply = buildReply(text, snapshot) // scripted fallback (static file / offline / no key)
      }
    }
    if (myTurn !== turnRef.current) return
    setTyping(false)
    const botMsg = { id: `b${(msgSeq.current += 1)}`, from: 'bot', text: reply }
    setMessages((m) => [...m, botMsg])
    if (!openRef.current) return
    const status = await say(reply)
    if (myTurn !== turnRef.current) return
    if (status === 'blocked' && !voiceOnRef.current) pendingSpeech.current = reply
    if (!voiceOnRef.current || !openRef.current) return
    // Wait a beat after real speech so the mic doesn't hear General 613.
    window.setTimeout(() => {
      if (myTurn !== turnRef.current || !voiceOnRef.current || !openRef.current) return
      beginListening()
    }, status === 'spoken' ? 400 : 0)
  }

  function toggleMic() {
    if (voiceOnRef.current) {
      endVoice()
      return
    }
    stopSpeaking()
    pendingSpeech.current = null
    setMicNote('')
    setVoice(true)
    beginListening()
  }

  function toggleMute() {
    setMuted((was) => {
      const next = !was
      mutedRef.current = next
      try { localStorage.setItem(MUTE_KEY, next ? '1' : '0') } catch { /* private mode */ }
      if (next) {
        pendingSpeech.current = null
        stopSpeaking()
      }
      return next
    })
  }

  function closePanel() {
    setOpen(false)
    openRef.current = false
    endVoice()
    stopSpeaking()
  }

  useEffect(() => {
    convoRef.current = messages
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])

  // Greet out loud once each time a soldier is here. Login is a click, so speech
  // usually starts right away; if the browser blocks it, the next tap or key says it.
  useEffect(() => {
    if (!kid) {
      greetedId.current = null
      pendingSpeech.current = null
      voiceOnRef.current = false
      listenHandle.current?.stop()
      listenHandle.current = null
      stopSpeaking()
      return
    }
    if (!greeting) return
    if (greetedId.current === kid.id) return
    const id = kid.id
    const line = greeting
    const timer = window.setTimeout(() => {
      if (greetedId.current === id) return
      greetedId.current = id
      if (turnRef.current > 0) return
      void say(line).then((status) => {
        if (status === 'blocked') pendingSpeech.current = line
      })
    }, 60)
    return () => window.clearTimeout(timer)
  }, [kid, greeting, say])

  useEffect(() => {
    const onGesture = () => {
      if (canSpeak()) {
        try {
          window.speechSynthesis.resume()
          window.speechSynthesis.getVoices()
        } catch { /* ignore */ }
      }
      if (voiceOnRef.current) return
      const line = pendingSpeech.current
      if (!line || mutedRef.current) return
      pendingSpeech.current = null
      void say(line).then((status) => {
        if (status === 'blocked') pendingSpeech.current = line
      })
    }
    window.addEventListener('pointerdown', onGesture, true)
    window.addEventListener('keydown', onGesture, true)
    return () => {
      window.removeEventListener('pointerdown', onGesture, true)
      window.removeEventListener('keydown', onGesture, true)
    }
  }, [say])

  useEffect(() => () => {
    listenHandle.current?.stop()
    stopSpeaking()
  }, [])

  if (!kid) return null
  const peek = ctx ? peekText(ctx) : ''
  const shownGreeting = pinnedGreeting?.id === kid.id && pinnedGreeting.situation === 'pick'
    ? pinnedGreeting.text
    : greeting
  const showPeek = !open && !peekClosed && pathname === '/me' && !!peek
  const micOk = canListen()
  // The opening greeting is a derived first bubble (not seeded into state), so the
  // panel shows it without a set-state-in-effect; the real conversation follows.
  const thread = shownGreeting ? [{ id: 'w', from: 'bot', text: shownGreeting }, ...messages] : messages
  const statusLine = listening ? 'Listening…' : speaking ? 'Speaking…' : 'Your Tehillim general'

  return (
    <>
      {/* Proactive greeting peek — only on the child's own page */}
      {showPeek ? (
        <div className="fixed bottom-20 right-4 z-50 w-[19rem] max-w-[calc(100vw-2rem)] sm:bottom-24 sm:right-6">
          <div className="relative rounded-2xl rounded-br-md bg-card p-3.5 pr-8 text-[14px] leading-snug text-navy shadow-hover ring-1 ring-line">
            <button type="button" onClick={() => setPeekClosed(true)} aria-label="Dismiss" className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full text-muted transition hover:bg-track">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <button type="button" onClick={() => { openRef.current = true; setOpen(true) }} className="block text-left">
              <span className="mb-1 flex items-center gap-2">
                <Avatar size="h-7 w-7" text="text-base" />
                <span className="font-display text-[14px] font-black text-navy">{BOT_NAME}</span>
              </span>
              {peek}
              <span className="mt-2 block font-semibold text-blue">Tap to chat →</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Launcher */}
      {!open ? (
        <button
          type="button"
          onClick={() => { openRef.current = true; setOpen(true) }}
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
              <p className="mt-0.5 text-[12px] text-white/70">{statusLine}</p>
            </div>
            <button
              type="button"
              onClick={toggleMute}
              aria-pressed={muted}
              aria-label={muted ? `Unmute ${BOT_NAME}` : `Mute ${BOT_NAME}`}
              className={`grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/10 ${muted ? 'text-gold' : 'text-white/80'}`}
            >
              <SpeakerIcon muted={muted} />
            </button>
            <button type="button" onClick={closePanel} aria-label="Close chat" className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto bg-paper/50 px-3 py-3">
            {thread.map((m) => (
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

          {micNote ? (
            <p className="border-t border-line bg-card px-3 pt-2 text-[12px] font-semibold text-navy" role="status">{micNote}</p>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              stopListening()
              void send()
            }}
            className="flex items-center gap-2 border-t border-line bg-card px-3 py-2.5"
          >
            {micOk ? (
              <button
                type="button"
                onClick={toggleMic}
                aria-pressed={voiceOn}
                aria-label={voiceOn ? `Stop talking with ${BOT_NAME}` : `Talk to ${BOT_NAME}`}
                className={`grid h-9 w-9 flex-none place-items-center rounded-full transition ${listening ? 'animate-pulse bg-gold text-navy ring-2 ring-navy/30' : voiceOn ? 'bg-gold text-navy' : 'bg-track text-navy hover:bg-gold/80'}`}
              >
                <MicIcon />
              </button>
            ) : null}
            <input
              value={input}
              onChange={(e) => { inputRef.current = e.target.value; setInput(e.target.value) }}
              onKeyDown={() => { if (listenHandle.current) stopListening() }}
              placeholder={listening ? 'Listening…' : `Ask ${BOT_NAME}…`}
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
