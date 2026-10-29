// Kid questions for Your Virtual Commander. Answers come from the review sheet.
// Placeholders in braces are filled from the signed-in soldier. shimmy:true
// items have no final answer, so the commander does not invent one.

import { availableLadders, GRADE_LABEL, quotaFor } from '../data/ladders.js'
import { COUNSELOR, TOPICS } from '../data/kidQuestions.js'
import { easiestLadder, hardestLadder, ladderMenu, stepLadder } from './general613.js'

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}

const STOP = new Set(['a', 'an', 'the', 'my', 'your', 'me', 'i', 'to', 'do', 'is', 'it', 'of', 'and', 'or', 'for', 'in', 'on'])

// Bare yes/no lines are confirmations for a ladder the child was just offered.
// They are not questions, so they never match the sheet on their own.
const GENERIC = new Set(['yes', 'yeah', 'yep', 'yup', 'sure', 'okay', 'ok', 'no', 'nope', 'nah', 'no never mind'])

function norm(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g, (word) => String(NUMBER_WORDS[word]))
}

function tokens(text) {
  return norm(text).split(' ').filter((w) => w && !STOP.has(w))
}

function phrasesOf(item) {
  return [item.q, item.also]
    .filter(Boolean)
    .flatMap((s) => String(s).split(/\s*\/\s*/))
    .map((s) => s.trim())
    .filter((s) => s && !GENERIC.has(norm(s)))
}

function allEntries() {
  const out = []
  for (const topic of TOPICS) {
    for (const item of topic.items) {
      out.push(item)
      for (const follow of item.f || []) out.push(follow)
    }
  }
  return out
}

function varsFor(ctx, text) {
  const cur = ctx?.progress?.current
  const medal = ctx?.progress?.medal
  const social = ctx?.social
  const sm = ctx?.sMevorchim
  const grade = ctx?.grade
  const month = ctx?.monthEn
  const easy = easiestLadder(grade)
  const hard = hardestLadder(grade)
  const list = availableLadders(grade)
  const said = Number(cur?.said)
  const quota = Number(cur?.quota)
  const left = Number.isFinite(said) && Number.isFinite(quota) ? Math.max(0, quota - said) : null
  const vars = {
    name: ctx?.firstName || 'friend',
    ladder: ctx?.ladder ?? '',
    finishTrainingByGrade: ctx?.gradeLabel || (ctx?.ladder ? GRADE_LABEL[String(ctx.ladder)] : '') || '',
    childGradeLabel: ctx?.childGradeLabel || '',
    month: ctx?.monthHeb || month || 'this month',
    monthEn: month || '',
    easiest: easy ?? '',
    hardest: hard ?? '',
    list: list.join(', '),
    kapitlachQuota: cur?.quota ?? '',
    minutesQuota: cur?.minutes ?? '',
    kapitlachSaid: cur?.said ?? '',
    kapitlachLabel: cur?.quotaLabel ?? '',
    left: left ?? '',
    missionsTotal: ctx?.progress?.missionsTotal ?? 0,
    missionsToNext: medal?.missionsToNext ?? '',
    'medal.current': medal?.current?.name ?? '',
    'medal.next': medal?.next?.name ?? '',
    'medal.missionsToNext': medal?.missionsToNext ?? '',
    className: social?.className ?? '',
    classRank: social?.classRank ?? '',
    totalClasses: social?.totalClasses ?? '',
    schoolName: social?.schoolName ?? '',
    needToPass: social?.needToPass ?? '',
    schoolRank: social?.schoolRank ?? '',
    totalSchools: social?.totalSchools ?? '',
    daysUntil: sm?.daysUntil ?? '',
    hebDate: sm?.hebDateLabel ?? '',
  }
  const n = text ? parseSpokenLadder(text) : null
  if (n != null) {
    vars.n = n
    const q = quotaFor(grade, month, n)
    if (q) {
      vars.kapitlach = q.v
      vars.minutes = q.m
    }
  }
  return vars
}

function fill(template, vars) {
  let missing = false
  const text = String(template ?? '').replace(/\{([^{}]+)\}/g, (_, key) => {
    const k = key.trim()
    if (vars[k] != null && vars[k] !== '') return String(vars[k])
    missing = true
    return ''
  }).replace(/\s+/g, ' ').trim()
  return { text, missing }
}

function ladderList(ctx) {
  const rows = ctx?.ladderChoices?.length ? ctx.ladderChoices : ladderMenu(ctx?.grade, ctx?.monthEn)
  if (!rows?.length) return ''
  const lines = rows.map((row) => {
    const kapitlach = row.kapitlach ?? row.v
    const minutes = row.minutes ?? row.m
    if (kapitlach == null) return `ladder ${row.ladder}`
    return `ladder ${row.ladder}, ${kapitlach} kapitlach and ${minutes} minutes`
  })
  return `Here they are for this month: ${lines.join('; ')}. Which one do you want to hear about?`
}

function replyFor(item, vars, ctx) {
  if (item.shimmy) return COUNSELOR
  if (String(item.a).includes('{L}')) return ladderList(ctx)
  if (/^\([^)]*\)$/.test(String(item.a).trim())) return ''
  const { text, missing } = fill(item.a, vars)
  if (!text || missing || text.startsWith('Not in the site yet')) {
    return text.startsWith('Not in the site yet') ? COUNSELOR : ''
  }
  return text
}

function score(utterance, phrase) {
  const u = norm(utterance)
  const p = norm(phrase)
  if (!u || !p) return 0
  if (u === p) return 1
  const pt = tokens(phrase)
  const ut = tokens(utterance)
  if (!pt.length || !ut.length) return 0
  const uset = new Set(ut)
  const hit = pt.filter((t) => uset.has(t)).length
  const recall = hit / pt.length
  const precision = hit / new Set(ut).size
  if (p.length >= 8 && (u.includes(p) || (p.includes(u) && u.length >= 8))) {
    return 0.93 + Math.min(p.length, 40) / 1000
  }
  if (recall < 0.72) return recall * 0.5
  return recall * 0.55 + precision * 0.45
}

export function answerQuestion(text, ctx) {
  const vars = varsFor(ctx, text)
  let best = null
  let bestScore = 0
  let bestLen = 0
  for (const item of allEntries()) {
    for (const phrase of phrasesOf(item)) {
      const s = score(text, phrase)
      const len = norm(phrase).length
      if (s > bestScore || (s === bestScore && s > 0 && len > bestLen)) {
        best = item
        bestScore = s
        bestLen = len
      }
    }
  }
  if (!best || bestScore < 0.72) return null
  const reply = replyFor(best, vars, ctx)
  return reply ? { reply, shimmy: !!best.shimmy } : null
}

export function answerSheet(ctx) {
  const vars = varsFor(ctx)
  return allEntries().map((item) => {
    if (item.shimmy) return { q: item.q, a: COUNSELOR }
    if (String(item.a).includes('{L}')) return { q: item.q, a: ladderList(ctx) || item.a }
    const filled = fill(item.a, vars)
    return { q: item.q, a: filled.missing || !filled.text ? item.a : filled.text }
  })
}

export function parseSpokenLadder(text) {
  const t = norm(text)
  const digit = t.match(/\bladder\s*(\d{1,2})\b/)
  if (digit) return Number(digit[1])
  return null
}

export function wantsLadderChange(text) {
  const t = norm(text)
  if (parseSpokenLadder(text) == null) return false
  return /\b(change|switch|put me|move me|make me|i want)\b/.test(t)
}

export function ladderChangeReply(text, ctx) {
  const n = parseSpokenLadder(text)
  if (n == null) return null
  const options = availableLadders(ctx?.grade)
  const label = ctx?.childGradeLabel || 'your'
  if (!options.includes(n)) {
    const list = options.join(', ')
    return {
      reply: `Ladder ${n} isn't one you can pick in ${label} grade. You can choose ladder ${list}.`,
      pickLadder: null,
    }
  }
  const q = quotaFor(ctx?.grade, ctx?.monthEn, n)
  const amount = q ? `${q.v} kapitlach and ${q.m} minutes` : 'the kapitlach and minutes on your page'
  return {
    reply: `Ladder ${n} means you say ${amount} this month. Do you want me to switch you to ladder ${n}?`,
    pickLadder: n,
    confirm: true,
  }
}

// A harder or easier step for a soldier who already has a ladder.
// The first-ladder walk still uses scriptedTurn.
export function ladderStepReply(text, ctx) {
  const t = norm(text)
  const harder = /\b(make it harder|more challenging|bigger quota|higher quota|harder ladder)\b/.test(t)
  const easier = /\b(make it easier|too much|easier ladder|gentler ladder)\b/.test(t)
  if (harder === easier) return null
  const from = Number(ctx?.ladder)
  if (!Number.isFinite(from) || from <= 0) return null
  const direction = harder ? 'harder' : 'easier'
  const next = stepLadder(ctx?.grade, from, direction)
  if (next == null || next === from) {
    return {
      reply: harder
        ? `Ladder ${from} is already the most challenging ladder you can pick.`
        : `Ladder ${from} is already the easiest ladder you can pick.`,
      pickLadder: null,
    }
  }
  const q = quotaFor(ctx?.grade, ctx?.monthEn, next)
  const amount = q ? `${q.v} kapitlach and ${q.m} minutes` : 'the kapitlach and minutes on your page'
  return {
    reply: `Let's look at ladder ${next}. That's ${amount} this month. Do you want me to switch you to ladder ${next}?`,
    pickLadder: next,
    confirm: true,
  }
}

export function ladderConfirmedReply(n) {
  const grade = GRADE_LABEL[String(n)] || `${n}th`
  return `Done! You're now on ladder ${n}. You're training to say the whole Tehillim by ${grade} grade. Hatzlacha!`
}

// Hands-free commands. Parenthetical sheet lines are actions, not words to say.
export function voiceCommand(text) {
  const t = norm(text)
  if (/^(stop talking|be quiet|please be quiet|stop talking please)$/.test(t)) return 'stop'
  if (/^(talk again|you can talk|start talking)$/.test(t)) return 'unmute'
  if (/^(say that again|repeat that|what did you say)$/.test(t)) return 'repeat'
  return null
}

export function looksLikeEcho(heard, spoken) {
  const h = norm(heard)
  const s = norm(spoken)
  if (!h || !s) return false
  // A short piece of the line he is saying right now is his own voice.
  if (h.length >= 2 && s.includes(h)) return true
  const hw = h.split(' ').filter((w) => w.length > 2)
  if (hw.length < 2) return false
  const sw = new Set(s.split(' '))
  const hit = hw.filter((w) => sw.has(w)).length
  return hit / hw.length >= 0.6
}
