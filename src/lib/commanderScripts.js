// Official virtual-commander scripts (Shimmy Weinbaum, Nov 4 2026).
// The wording stays exact. A placeholder is filled only from real data.
// A sentence whose number is missing is left out. Nothing is invented.

import { GRADE_LABEL, quotaFor } from '../data/ladders.js'
import { cellFor } from './customLadder.js'
import { quotaSheetMonth } from './schoolYear.js'
import { fmt } from './format.js'

const MONTH_SCRIPT_IDS = ['welcome', 'choosing', 'mission', 'review', 'stand', 'streak']
const LIFETIME_SCRIPT_IDS = ['track', 'climb']
export const SCRIPT_IDS = [...MONTH_SCRIPT_IDS, ...LIFETIME_SCRIPT_IDS]

const STORAGE_KEY = 'wwtc.commander.scripts'

export const TRAINING_NOT_NOW = "No problem. There's no rush, and no pressure. Whenever you want to start training, just say yes or tap Start training. I'll be right here."

export const CHOOSING_SCRIPT = `That's wonderful, soldier!

Now let's find the ladder that's right for YOU. All eight ladders lead toward the same goal: saying the entire Tehillim each Shabbos Mevorchim. Your ladder sets your training pace.

Use the arrows to look through the ladder cards. The words under each ladder's name tell you which grade you're working toward finishing your training by. Look for your grade on the card to see how much Tehillim you'd be working toward saying.

Tap SEE FULL BREAKDOWN to see how it grows from month to month, including the kapitlach and minutes.

You don't have to choose the fastest ladder. Choose one you can realistically commit to, including as your quota grows.

Your class, your school, and the entire army will be counting on you. Take your time choosing: this is YOUR commitment.

When you've found the right ladder for you, tap PICK THIS LADDER.`

const MISSION_REPORT = `After Shabbos Mevorchim, come back here and tell us what you said. Under KAPITLACH I SAID, enter how many kapitlach you said. Under MINUTES I SAID, enter how many minutes you spent saying Tehillim. Then tap SAVE.`

const MISSION_SEE = `You'll be able to see your quota alongside what you actually said, and how your effort contributes to your class, your school, and the entire army.`

const MISSION_OTHER = `You can also look at the other ladders shown here and think about whether your ladder is the right training pace for you.`

const NO_STREAK_SCRIPT = `Your first streak is waiting to begin! Start with this Shabbos Mevorchim: take on your mission and do your best to complete it. Then come back and report what you said. One completed mission is your first step. With each mission you complete, you'll build the habit of following through on what you took on.`

const PERFECT_PLATOON_SCRIPT = `You've also earned PERFECT PLATOON! Every single soldier in your platoon completed their mission. You each did your part, and together you made it a perfect platoon!`

export const TRACK_SCRIPT = `This is your Tehillim training track, soldier. Here you can see how your ladder takes you, step by step, toward saying the entire Tehillim.

Each year has missions for Shabbos Mevorchim, Rosh Hashana, and Yom Kippur. Open a year to see the missions and the quota for each one.

Look at how the quotas grow along your ladder. You don't have to do it all at once. Your job is to take on the mission in front of you and keep training, one mission at a time.

This page also shows which missions you've completed, so you can look back at your progress.

And finishing your training isn't the end of your mission! That's what you're training for: to keep saying the entire Tehillim every Shabbos Mevorchim.`

/** The climb picture. Drops "by [grade]" when the ladder's target grade is unknown. */
export function fillClimb(gradeLabel) {
  const grade = cleanName(gradeLabel)
  const reach = grade
    ? `This picture shows how your quota grows along your ladder: from Pre-1A through each grade, until you reach the whole Tehillim by ${grade}.`
    : 'This picture shows how your quota grows along your ladder: from Pre-1A through each grade, until you reach the whole Tehillim.'
  return [
    "Now let's look at your climb to the whole Tehillim!",
    reach,
    "You can see the quota at each stage and where you're holding on that journey now.",
    "The whole Tehillim might look like a lot, but look how your ladder breaks the journey into smaller steps. Focus on your next mission. That's the next step you're working toward!",
  ].join('\n\n')
}

function readyNumber(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function formatNum(value) {
  const n = readyNumber(value)
  if (n == null) return null
  return Number.isInteger(n) ? String(n) : String(n)
}

function cleanName(name) {
  const text = String(name ?? '').trim()
  return text || null
}

/** "Train by 8th" — the grade this ladder finishes training in. */
export function trainByGrade(ladder) {
  const label = GRADE_LABEL[String(ladder)]
  if (!label) return null
  if (label === 'Pre-1A') return 'Pre-1A'
  return `${label} grade`
}

/** This month's kapitlach and minutes from the ladder table. Null when absent. */
export function missionQuota(grade, month, ladder, customGrid = null, firstMonth = 'Tishrei') {
  const named = quotaSheetMonth(month, firstMonth)
  const cell = customGrid ? cellFor(customGrid, grade, named) : quotaFor(grade, named, ladder)
  if (!cell) return { kapitlach: null, minutes: null }
  return {
    kapitlach: readyNumber(cell.v),
    minutes: readyNumber(cell.m),
  }
}

export function fillWelcome(name) {
  const who = cleanName(name)
  const body = [
    "I'm so glad you're here. Every kapitel of Tehillim you say matters. Saying Tehillim on Shabbos Mevorchim is important for you, for your children, and for your children's children one day.",
    "Our mission is to train, step by step, until we can say the entire Tehillim every Shabbos Mevorchim. You don't have to be able to do it all now. That's what the training is for.",
    'But this needs to be something YOU want to take on.',
    'Would you like to start training toward saying the entire Tehillim each Shabbos Mevorchim?',
  ]
  if (!who) return body.join('\n\n')
  return [`Welcome, ${who}`, ...body].join('\n\n')
}

export function fillMission({ name, ladder, gradeLabel, kapitlach, minutes, customTarget, customFinish } = {}) {
  const parts = []
  const who = cleanName(name)
  if (who) parts.push(`Hi ${who}, I'm your virtual commander!`)
  parts.push('New month, new mission!')
  const ladderNum = readyNumber(ladder)
  const grade = cleanName(customFinish) || cleanName(gradeLabel)
  const target = readyNumber(customTarget)
  if (target != null && grade) {
    parts.push(`You're on a custom ladder. You're training to finish ${formatNum(target)} kapitlach by ${grade}.`)
  } else {
    const chosen = ladderNum != null ? `You've chosen Ladder ${formatNum(ladderNum)}.` : null
    const pace = grade ? `That means you're training toward saying the entire Tehillim by ${grade}.` : null
    if (chosen && pace) parts.push(`${chosen} ${pace}`)
    else if (chosen) parts.push(chosen)
    else if (pace) parts.push(pace)
  }
  const kap = formatNum(kapitlach)
  const min = formatNum(minutes)
  if (kap != null && min != null) {
    parts.push(`Your mission for this coming Shabbos Mevorchim is ${kap} kapitlach, about ${min} minutes.`)
  }
  parts.push(MISSION_REPORT, MISSION_SEE, MISSION_OTHER)
  return parts.join('\n\n')
}

export function fillStand({
  baseRank, baseTotal, platoonRank, platoonTotal, soldierRank, soldierTotal, perfect,
} = {}) {
  const parts = []
  const baseR = formatNum(baseRank)
  const baseN = formatNum(baseTotal)
  const platR = formatNum(platoonRank)
  const platN = formatNum(platoonTotal)
  const solR = formatNum(soldierRank)
  const solN = formatNum(soldierTotal)
  if (baseR != null && baseN != null) {
    parts.push(`Your school is your base. This month, your base came number ${baseR} out of ${baseN} bases around the world.`)
  }
  if (platR != null && platN != null) {
    parts.push(`Your class is your platoon. Your platoon came number ${platR} out of ${platN} platoons in your base.`)
  }
  if (solR != null && solN != null) {
    parts.push(`And you came number ${solR} out of ${solN} chayolim in your Base!`)
  }
  if (perfect === true) parts.push(PERFECT_PLATOON_SCRIPT)
  if (!parts.length) return null
  return [`Let's take a look at where you stand this month!`, ...parts].join('\n\n')
}

function reviewLabel(index, count) {
  if (count === 1) return 'Last month'
  return index === count - 1 ? 'Last month' : 'The month before'
}

function reviewParagraph(which, row) {
  const name = cleanName(row?.month)
  const lead = name ? `${which} was ${name}.` : `${which}.`
  if (row?.reported === false) return `${lead} You have not reported what you said yet.`
  const bits = [lead]
  const kap = formatNum(row?.kapitlach)
  const min = formatNum(row?.minutes)
  if (kap != null && min != null) bits.push(`You said ${kap} kapitlach in ${min} minutes.`)
  else if (kap != null) bits.push(`You said ${kap} kapitlach.`)
  else if (min != null) bits.push(`You spent ${min} minutes saying Tehillim.`)
  const quotaKap = formatNum(row?.quotaKapitlach)
  const quotaMin = formatNum(row?.quotaMinutes)
  if (quotaKap != null && quotaMin != null) bits.push(`Your quota was ${quotaKap} kapitlach, about ${quotaMin} minutes.`)
  else if (quotaKap != null) bits.push(`Your quota was ${quotaKap} kapitlach.`)
  if (row?.met === true) bits.push('You met your quota.')
  else if (row?.met === false) bits.push('You did not meet your quota.')
  if (bits.length === 1 && kap == null && min == null && quotaKap == null && row?.met == null) return null
  return bits.join(' ')
}

/**
 * Last month, then the month before, from the soldier's own months.
 * The current month, holidays, and future months are left out. At most two.
 */
export function reviewMonthsFromProgress(progress) {
  if (!progress) return []
  const rows = []
  for (const month of [...(progress.historyMonths || []), ...(progress.months || [])]) {
    if (!month || month.holiday || month.isFuture || month.isCurrent) continue
    const name = cleanName(month.month)
    if (!name) continue
    const reported = month.reported !== false
    rows.push({
      month: name,
      reported,
      kapitlach: reported ? readyNumber(month.said) : null,
      minutes: reported ? readyNumber(month.saidMinutes) : null,
      quotaKapitlach: readyNumber(month.quota),
      quotaMinutes: readyNumber(month.minutes),
      met: month.met === true ? true : month.met === false ? false : null,
    })
  }
  return rows.slice(-2)
}

/** Walk the last two months. A month with no real facts is left out. */
export function fillReview(months) {
  const rows = (Array.isArray(months) ? months : []).filter((row) => row && (cleanName(row.month) || row.reported === false))
  const kept = rows.slice(-2)
  if (!kept.length) return null
  const body = []
  kept.forEach((row, index) => {
    const text = reviewParagraph(reviewLabel(index, kept.length), row)
    if (text) body.push(text)
  })
  if (!body.length) return null
  const intro = kept.length > 1
    ? "Let's take a look at what you did last month and the month before."
    : "Let's take a look at what you did last month."
  return [intro, ...body, 'Keep going, one mission at a time.'].join('\n\n')
}

export function fillStreak({ current, longest } = {}) {
  const now = readyNumber(current)
  if (now == null) return null
  if (now === 0) return NO_STREAK_SCRIPT
  const parts = [
    `Look at your streak! You've completed ${formatNum(now)} missions in a row. Each time, you took on your mission and followed through.`,
  ]
  const best = formatNum(longest)
  if (best != null) {
    parts.push(`Your longest streak so far is ${best} missions. Let's keep building, one mission at a time!`)
  }
  return parts.join('\n\n')
}

export function standFacts(social) {
  if (!social) return null
  const num = (value) => {
    const n = readyNumber(value)
    return n != null && n > 0 ? n : null
  }
  return {
    baseRank: num(social.schoolRank),
    baseTotal: num(social.totalSchools),
    platoonRank: num(social.classRank),
    platoonTotal: num(social.totalClasses),
    soldierRank: num(social.myRankInSchool),
    soldierTotal: num(social.schoolSize),
    perfect: social.classPerfect === true,
  }
}

// Logged-in "Where you stand" cards. Same scopes as standFacts:
// school among bases in the world, platoon among platoons in the base,
// soldier among chayolim in the base. A missing rank is left out.
// Class rank and class size are not a stand-in for the soldier's base place.
export function standPlaceCards(social) {
  const facts = standFacts(social)
  if (!facts) return []
  const card = (key, icon, rank, total, sentence) => {
    if (rank == null || total == null) return null
    const rankText = fmt(rank)
    const totalText = fmt(total)
    return { key, icon, rankText, totalText, text: sentence(rankText, totalText) }
  }
  return [
    card('school', 'school', facts.baseRank, facts.baseTotal,
      (rank, total) => `Your school is #${rank} of ${total} Bases in the world.`),
    card('platoon', 'platoon', facts.platoonRank, facts.platoonTotal,
      (rank, total) => `Your platoon is #${rank} of ${total} platoons in your base.`),
    card('soldier', 'hat', facts.soldierRank, facts.soldierTotal,
      (rank, total) => `You are #${rank} of ${total} Chayolim in your Base.`),
  ].filter(Boolean)
}

function emptyHeard() {
  return { welcome: false, choosing: false, mission: false, review: false, stand: false, streak: false, track: false, climb: false }
}

function memory() {
  const box = new Map()
  return {
    getItem: (key) => (box.has(key) ? box.get(key) : null),
    setItem: (key, value) => { box.set(key, String(value)) },
  }
}

function storeOf(storage) {
  const target = storage || (typeof localStorage !== 'undefined' ? localStorage : memory())
  try {
    const parsed = JSON.parse(target.getItem(STORAGE_KEY) || '{}')
    return { target, all: parsed && typeof parsed === 'object' ? parsed : {} }
  } catch {
    return { target, all: {} }
  }
}

function writeAll(target, all) {
  try { target.setItem(STORAGE_KEY, JSON.stringify(all)) } catch { /* private mode */ }
}

export function readKidScripts(storage, kidId, month) {
  if (kidId == null || month == null || month === '') return { heard: emptyHeard(), training: null }
  const { all } = storeOf(storage)
  const kid = all[String(kidId)] || {}
  const bucket = kid[String(month)] || {}
  const heard = emptyHeard()
  for (const id of MONTH_SCRIPT_IDS) heard[id] = !!bucket[id]
  heard.track = !!kid.track
  heard.climb = !!kid.climb
  const training = bucket.training === 'yes' || bucket.training === 'no' ? bucket.training : null
  return { heard, training }
}

export function rememberScript(storage, kidId, month, id) {
  if (kidId == null || !SCRIPT_IDS.includes(id)) return
  const { target, all } = storeOf(storage)
  const kid = all[String(kidId)] || {}
  if (LIFETIME_SCRIPT_IDS.includes(id)) {
    kid[id] = true
  } else {
    if (!month) return
    const bucket = kid[String(month)] || {}
    bucket[id] = true
    kid[String(month)] = bucket
  }
  all[String(kidId)] = kid
  writeAll(target, all)
}

export function rememberTraining(storage, kidId, month, answer) {
  if (kidId == null || !month) return
  if (answer !== 'yes' && answer !== 'no') return
  const { target, all } = storeOf(storage)
  const kid = all[String(kidId)] || {}
  const bucket = kid[String(month)] || {}
  bucket.training = answer
  kid[String(month)] = bucket
  all[String(kidId)] = kid
  writeAll(target, all)
}

/**
 * Yes or no to the welcome question. A bare yes starts training.
 * Naming a ladder is left for the ladder conversation.
 */
export function readTrainingAnswer(text) {
  const raw = String(text ?? '').trim()
  const t = ` ${raw.toLowerCase().replace(/[’']/g, "'")} `
  if (/\bstart training\b/.test(t)) return 'yes'
  if (/^(yes|yeah|yep|yup|sure|okay|ok)\b/.test(raw.toLowerCase())) return 'yes'
  if (/\bnot now\b|\bnot yet\b|\bmaybe later\b/.test(t)) return 'no'
  if (/^(no|nope|nah)\b/.test(raw.toLowerCase())) return 'no'
  return null
}

/**
 * Which official scripts are due right now, in the order to say them.
 * `heard` is this kid's record for this month. A heard script is not returned.
 */
export function selectCommanderScripts(input = {}) {
  const heard = { ...emptyHeard(), ...(input.heard || {}) }
  const hasLadder = readyNumber(input.ladder) != null
  const out = []

  if (!hasLadder) {
    if (input.training === 'yes' && input.cardsOnScreen && !heard.choosing) {
      out.push({ id: 'choosing', text: CHOOSING_SCRIPT })
    } else if (input.training !== 'yes' && input.training !== 'no' && !heard.welcome) {
      out.push({ id: 'welcome', text: fillWelcome(input.name) })
    }
    // A custom ladder is still training. The numbered-ladder branch below is
    // where a regular ladder hears this; a custom-only soldier hears it here.
    if (readyNumber(input.customTarget) != null && !heard.review) {
      const review = fillReview(input.reviewMonths)
      if (review) out.push({ id: 'review', text: review })
    }
    return out
  }

  if (!heard.mission) {
    const quota = input.quota || {}
    out.push({
      id: 'mission',
      text: fillMission({
        name: input.name,
        ladder: input.ladder,
        gradeLabel: input.gradeLabel,
        kapitlach: quota.kapitlach,
        minutes: quota.minutes,
        customTarget: input.customTarget,
        customFinish: input.customFinish,
      }),
    })
  }

  if (!heard.review) {
    const review = fillReview(input.reviewMonths)
    if (review) out.push({ id: 'review', text: review })
  }

  if (!heard.stand && input.resultsReady) {
    const text = fillStand(input.stand || {})
    if (text) out.push({ id: 'stand', text })
  }

  if (!heard.streak && readyNumber(input.streakCurrent) != null) {
    const text = fillStreak({ current: input.streakCurrent, longest: input.streakLongest })
    if (text) out.push({ id: 'streak', text })
  }

  if (input.trackOpen && !heard.track) {
    out.push({ id: 'track', text: TRACK_SCRIPT })
  }

  if (input.climbOpen && !heard.climb) {
    out.push({ id: 'climb', text: fillClimb(input.gradeLabel) })
  }

  return out
}

/** The old short arrival line stays quiet once an official script owns the visit. */
export function suppressLegacyGreeting(input = {}) {
  if (readyNumber(input.ladder) == null) return true
  const heard = input.heard || {}
  return SCRIPT_IDS.some((id) => heard[id])
}

/** Filled scripts for the model. A null entry means that moment has no real facts. */
export function filledScripts(input = {}) {
  const quota = input.quota || {}
  const stand = input.resultsReady ? fillStand(input.stand || {}) : null
  const streak = fillStreak({ current: input.streakCurrent, longest: input.streakLongest })
  return {
    welcome: fillWelcome(input.name),
    choosing: CHOOSING_SCRIPT,
    mission: readyNumber(input.ladder) == null && readyNumber(input.customTarget) == null ? null : fillMission({
      name: input.name,
      ladder: input.ladder,
      gradeLabel: input.gradeLabel,
      kapitlach: quota.kapitlach,
      minutes: quota.minutes,
      customTarget: input.customTarget,
      customFinish: input.customFinish,
    }),
    stand,
    streak,
    review: fillReview(input.reviewMonths),
    track: TRACK_SCRIPT,
    climb: fillClimb(input.gradeLabel),
  }
}
