// General 613 — the Tehillim Club's talking general.
//
// A child with no ladder yet hears the ladder walk in the client's words:
// easiest and hardest ladder for their grade, then one ladder's real quota.
// "Ahead" is last month only (more kapitlach than that month's quota).
// A lower ladder number is more challenging. An easier step goes to a
// higher number (ladder 12 is the gentlest).

import { availableLadders, GRADE_LABEL, quotaFor } from '../data/ladders.js'

export const BOT_NAME = 'Your Virtual Commander'

// Open the panel once each time a soldier signs in. A later page change keeps
// the same kid id, so a panel they closed stays closed. Logout clears it.
// `null` means leave the panel as it is.
export function autoOpenFor(openedFor, kidId) {
  if (!kidId) return openedFor == null ? null : { openedFor: null, open: false }
  if (openedFor === kidId) return null
  return { openedFor: kidId, open: true }
}

function priorMonths(progress) {
  return (progress?.months ?? []).filter((m) => !m.isCurrent)
}

export function readSituation(ctx) {
  const { ladder, progress } = ctx ?? {}
  if (!ladder) return 'pick'
  const prior = priorMonths(progress)
  const last = prior[prior.length - 1]
  const quota = Number(last?.quota)
  if (!last || !Number.isFinite(quota) || quota <= 0) return 'ontrack'
  if (!last.met) return 'behind'
  if (Number(last.said) > quota) return 'ahead'
  return 'ontrack'
}

function amount(n, singular, plural) {
  const num = Number(n)
  const whole = Math.floor(num)
  const label = num === whole ? String(whole) : (num - whole === 0.5 ? `${whole} and a half` : String(num))
  return `${label} ${num === 1 ? singular : plural}`
}

// Spoken quota. Minutes are included only when the cell has them.
export function quotaWords(q) {
  if (!q || q.v == null || Number.isNaN(Number(q.v))) return null
  const kapitlach = amount(q.v, 'kapitel', 'kapitlach')
  if (q.m == null || q.m === '') return kapitlach
  return `${kapitlach} and ${amount(q.m, 'minute', 'minutes')}`
}

export function quotaPhrase(grade, month, ladder) {
  return quotaWords(quotaFor(grade, month, ladder))
}

function gradeWords(grade) {
  const label = GRADE_LABEL[String(grade)]
  if (!label) return 'your grade'
  if (String(grade) === 'pre1a') return 'Pre-1A'
  return `${label} grade`
}

function finishWords(ladder) {
  return GRADE_LABEL[String(ladder)] ?? `${ladder}th`
}

// Listed high → low, so the first available ladder is the gentlest.
export function easiestLadder(grade) {
  return availableLadders(grade)[0] ?? null
}

export function hardestLadder(grade) {
  const list = availableLadders(grade)
  return list[list.length - 1] ?? null
}

// direction "harder" moves toward a lower ladder number. "easier" moves up.
export function stepLadder(grade, from, direction) {
  const list = availableLadders(grade)
  if (!list.length) return null
  const i = list.indexOf(Number(from))
  if (i < 0) return direction === 'easier' ? list[0] : list[list.length - 1]
  if (direction === 'harder') return list[Math.min(list.length - 1, i + 1)]
  return list[Math.max(0, i - 1)]
}

export function ladderMenu(grade, month) {
  return availableLadders(grade).map((L) => {
    const q = quotaFor(grade, month, L)
    return { ladder: L, kapitlach: q?.v ?? null, minutes: q?.m ?? null }
  })
}

function hello(ctx) {
  const name = ctx?.firstName || 'friend'
  return `Hi ${name}, I'm your virtual commander.`
}

function choicesParagraph(easy, hard) {
  const easyGrade = finishWords(easy)
  if (hard == null || hard === easy) {
    return `You can take ladder ${easy}. That's the ladder for your grade, and your training will take until ${easyGrade} grade.`
  }
  const hardGrade = finishWords(hard)
  return `You see, there's lots of different choices. You can take ladder ${easy}. That's the easiest ladder, but your training will take until ${easyGrade} grade. Or you can choose ladder ${hard}. That's the hardest ladder, but you'll finish your training and be able to say the entire Tehillim on Shabbos Mevorchim by the time you finish ${hardGrade} grade. So, there's so many other ladders in between.`
}

// Step 2 of the walk: one ladder, this month, the real quota.
export function ladderOffer(ctx, ladder) {
  const month = ctx?.monthEn || 'this month'
  const words = quotaPhrase(ctx?.grade, ctx?.monthEn, ladder)
  const quota = words
    ? `So, if you take ladder ${ladder}, that would mean that your quota is ${words}.`
    : `So, if you take ladder ${ladder}, your page will show the kapitlach for that ladder.`
  return `Let's take a look at ladder ${ladder} and see if that's what works for you. So, now we're holding Shabbos Mevorchim ${month}, and you are in ${gradeWords(ctx?.grade)}. ${quota} Do you think that's something that would work for you, or would you like to check out a more challenging ladder?`
}

export function pickPitch(ctx) {
  const easy = easiestLadder(ctx?.grade)
  const hard = hardestLadder(ctx?.grade)
  const open = `${hello(ctx)} Welcome to Shabbos Mevorchim Tehillim Campaign. Let's start by choosing the ladder that works best for you.`
  if (easy == null) return `${open} Tap Pick my ladder on your page and we'll choose one together.`
  return `${open} ${choicesParagraph(easy, hard)} ${ladderOffer(ctx, easy)}`
}

export function confirmLadderChoice(ctx) {
  const name = ctx?.firstName || 'friend'
  return `Okay, that's fine. That's a great place to start, and I want to wish you a lot of hatzlacha, and don't forget to come back after Shabbos Mevorchim and put in the amount of kapitlach that you said and the amount of minutes that you said. ${name}, remember, your whole class, your whole platoon is relying on you to complete their quota, and your school, your base is relying on you to complete your quota, and the whole army is relying on you. So, give it all you got.`
}

export function openingGreeting(ctx) {
  const missions = ctx?.progress?.missionsTotal ?? 0
  switch (ctx?.situation) {
    case 'pick':
      return pickPitch(ctx)
    case 'behind':
      return `${hello(ctx)} Where were you last month?`
    case 'ahead':
      return `${hello(ctx)} I see you did a great job last month. You did more than your quota. Would you like to go to a higher quota?`
    default:
      return `${hello(ctx)} 👋 So good to see you — you're doing beautifully, ${missions} missions done. Need anything? I can show your mission this month or how you're doing.`
  }
}

// The peek card stays the opening line. The full walk is spoken and in the chat.
export function peekText(ctx) {
  if (ctx?.situation === 'pick') {
    return `${hello(ctx)} Welcome to Shabbos Mevorchim Tehillim Campaign. Let's start by choosing the ladder that works best for you.`
  }
  return openingGreeting(ctx)
}

function resolveFocus(ctx) {
  const options = availableLadders(ctx?.grade)
  const focused = Number(ctx?.focusLadder)
  if (options.includes(focused)) return focused
  return options[0] ?? null
}

export function quickRepliesFor(ctx) {
  switch (ctx?.situation) {
    case 'pick': {
      const focus = resolveFocus(ctx)
      if (focus == null) return ['Help me pick my ladder', 'How does it work?']
      const replies = ["That's good for me"]
      const harder = stepLadder(ctx.grade, focus, 'harder')
      const easier = stepLadder(ctx.grade, focus, 'easier')
      if (harder != null && harder !== focus) replies.push('A more challenging ladder')
      if (easier != null && easier !== focus) replies.push('An easier ladder')
      return replies
    }
    case 'behind':
      return ['What do I say this month?', 'How does it work?']
    case 'ahead': {
      const next = ctx.grade != null && ctx.grade !== ''
        ? stepLadder(ctx.grade, ctx.ladder, 'harder')
        : (Number(ctx.ladder) > 5 ? Number(ctx.ladder) - 1 : Number(ctx.ladder))
      return next != null && next !== Number(ctx.ladder)
        ? [`Tell me about Ladder ${next}`, 'How am I doing?']
        : ['How am I doing?', 'How does it work?']
    }
    default:
      return ['My mission this month', 'How am I doing?', 'My medals']
  }
}

export function readLadderIntent(text) {
  const t = ` ${String(text ?? '').toLowerCase().replace(/[’']/g, "'")} `
  const ladderMatch = t.match(/\bladder\s*(\d{1,2})\b/)
  const ladder = ladderMatch ? Number(ladderMatch[1]) : null
  const harder = /more challenging|higher ladder|harder|too easy|bigger quota|higher quota|steeper/.test(t)
  const easier = /\beasier\b|less ambitious|gentler|too hard|too much/.test(t)
  const yes = /\b(yes|yeah|yep|yup|sure|okay|ok)\b|good for me|that's good|thats good|that is good|that's fine|thats fine|works for me|i'll take|ill take|i want that|sounds good/.test(t)
  const no = /\b(no|nope|nah)\b/.test(t)
  const any = ladder != null || harder || easier || yes || no
  return { ladder, harder, easier, yes, no, any }
}

function unavailableLadder(ctx, n, options) {
  const list = options.map((L) => `ladder ${L}`).join(', ')
  return `Ladder ${n} isn't one you can pick in ${gradeWords(ctx?.grade)}. You can choose ${list}.`
}

function steppedOffer(ctx, from, direction) {
  const next = stepLadder(ctx?.grade, from, direction)
  const landed = next ?? from
  let lead = ''
  if (landed === from && direction === 'harder') {
    lead = `Ladder ${from} is already the most challenging ladder you can pick. `
  } else if (landed === from && direction === 'easier') {
    lead = `Ladder ${from} is already the easiest ladder you can pick. `
  }
  return { reply: `${lead}${ladderOffer(ctx, landed)}`, focusLadder: landed }
}

// Ladder walk. `pickLadder` is set only when the child accepts one, so the
// chat can save it. Returns null for an ordinary question.
export function scriptedTurn(text, ctx) {
  if (!ctx || ctx.situation !== 'pick') return null
  const intent = readLadderIntent(text)
  if (!intent.any) return null

  const options = availableLadders(ctx.grade)
  const focus = resolveFocus(ctx)
  if (focus == null) return null

  if (intent.ladder != null) {
    if (!options.includes(intent.ladder)) {
      return { reply: unavailableLadder(ctx, intent.ladder, options), focusLadder: focus }
    }
    if (intent.harder && !intent.yes) return steppedOffer(ctx, intent.ladder, 'harder')
    if (intent.easier && !intent.yes) return steppedOffer(ctx, intent.ladder, 'easier')
    if (intent.yes && !intent.harder && !intent.easier && !intent.no) {
      return { reply: confirmLadderChoice(ctx), focusLadder: intent.ladder, pickLadder: intent.ladder }
    }
    return { reply: ladderOffer(ctx, intent.ladder), focusLadder: intent.ladder }
  }

  if (intent.harder && !intent.yes) return steppedOffer(ctx, focus, 'harder')
  if (intent.easier && !intent.yes) return steppedOffer(ctx, focus, 'easier')
  if (intent.yes && !intent.no) {
    return { reply: confirmLadderChoice(ctx), focusLadder: focus, pickLadder: focus }
  }
  if (intent.no) {
    return {
      reply: 'Would you like to check out a more challenging ladder, or an easier one?',
      focusLadder: focus,
    }
  }
  return null
}
