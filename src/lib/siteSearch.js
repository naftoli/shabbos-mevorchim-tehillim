// Lookup for Your Virtual Commander. It searches the approved site
// explanations and the signed-in child's own numbers. It does not call a
// model, does not write a report, and does not look anyone up by an id.

import { SITE_GUIDE } from '../data/siteGuide.js'
import { standFacts } from './commanderScripts.js'
import { OFF_TOPIC_REPLY, topicDecision } from './topicGate.js'

const STOP = new Set([
  'a', 'an', 'the', 'my', 'your', 'me', 'i', 'to', 'do', 'is', 'it', 'of', 'and',
  'or', 'for', 'in', 'on', 'what', 'whats', 'how', 'does', 'did', 'can', 'you',
  'please', 'about', 'tell', 'with', 'this', 'that', 'are', 'am', 'be',
])

const GROUPS = [
  ['platoon', 'platoons', 'class', 'classroom'],
  ['base', 'bases', 'school', 'schools'],
  ['soldier', 'soldiers', 'chayol', 'chayolim', 'kid', 'kids'],
  ['kapitel', 'kapitlach', 'chapter', 'chapters', 'psalm', 'psalms', 'perek'],
  ['medal', 'medals', 'award', 'awards', 'coin'],
  ['streak', 'streaks', 'row'],
  ['ladder', 'ladders', 'pace'],
  ['tehillim', 'thilim', 'tillim'],
  ['report', 'save', 'enter', 'type', 'log'],
  ['rank', 'place', 'standing', 'stand'],
]

export const NO_MATCH_REPLY = 'I looked through How It Works and your own numbers, and I don\'t have an answer for that. I don\'t guess. You can ask about your quota, your ladder, your medals, your streak, or where you stand.'

export const PRIVACY_REPLY = 'I can only use your own page. I can\'t look up another soldier, a class list, or a serial number.'

export const DIRECT_REPLY = 'I can direct you how to do it. On your page, under Kapitlach I said, type how many kapitlach you said. Under Minutes I said, type how many minutes you spent saying Tehillim. Then tap Save. I can\'t type it in for you.'

export const SIGN_IN_REPLY = 'Sign in on your own soldier page and I can use your numbers. I won\'t guess them, and I can\'t look someone up from a name or id you type.'

function norm(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(text) {
  return norm(text).split(' ').filter((word) => word.length > 2 && !STOP.has(word))
}

function stem(word) {
  if (word.length > 4 && word.endsWith('s')) return word.slice(0, -1)
  return word
}

function family(word) {
  const group = GROUPS.find((row) => row.includes(word) || row.includes(stem(word)))
  if (group) return group
  const base = stem(word)
  return base === word ? [word] : [word, base]
}

function wordsOf(passage) {
  return tokens(`${passage.title} ${passage.text}`)
}

function scorePassage(queryTokens, passage) {
  if (!queryTokens.length) return 0
  const literal = new Set(wordsOf(passage))
  let hit = 0
  for (const word of queryTokens) {
    const base = stem(word)
    if (literal.has(word) || literal.has(base)) hit += 1
    else if (family(word).some((option) => literal.has(option))) hit += 0.55
  }
  return hit / queryTokens.length
}

function passagesFromGuide() {
  const out = []
  for (const section of SITE_GUIDE) {
    section.paragraphs.forEach((text, index) => {
      out.push({
        id: `${section.id}-${index}`,
        sectionId: section.id,
        title: section.title,
        href: section.href,
        text,
        synonyms: section.synonyms,
        kind: 'guide',
      })
    })
  }
  return out
}

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function personalPassages(ctx) {
  if (!ctx) return []
  const out = []
  const cur = ctx.progress?.current
  const medal = ctx.progress?.medal
  const facts = standFacts(ctx.social)
  const streak = ctx.streakInfo
  if (ctx.ladder != null && ctx.ladder !== '') {
    const finish = ctx.gradeLabel ? ` You are training to finish by ${ctx.gradeLabel}.` : ''
    out.push({
      id: 'mine-ladder',
      sectionId: 'mine-ladder',
      title: 'Your ladder',
      href: '/me',
      text: `You are on ladder ${ctx.ladder}.${finish}`,
      synonyms: ['my', 'ladder', 'which', 'training'],
      kind: 'mine',
    })
  }
  if (cur && num(cur.quota) != null) {
    const minutes = num(cur.minutes)
    const minuteBit = minutes != null ? ` and ${minutes} minutes` : ''
    out.push({
      id: 'mine-quota',
      sectionId: 'mine-quota',
      title: 'Your quota',
      href: '/me',
      text: `This month your quota is ${cur.quota} kapitlach${minuteBit}.`,
      synonyms: ['my', 'quota', 'mission', 'kapitlach', 'minutes', 'say'],
      kind: 'mine',
    })
  }
  if (num(ctx.progress?.missionsTotal) != null) {
    out.push({
      id: 'mine-missions',
      sectionId: 'mine-missions',
      title: 'Your missions',
      href: '/me',
      text: `You have completed ${ctx.progress.missionsTotal} missions.`,
      synonyms: ['my', 'missions', 'total', 'completed'],
      kind: 'mine',
    })
  }
  if (medal?.next?.name && num(medal.missionsToNext) != null) {
    const current = medal.current?.name ? ` Your latest medal is ${medal.current.name}.` : ''
    out.push({
      id: 'mine-medal',
      sectionId: 'mine-medal',
      title: 'Your next medal',
      href: '/me',
      text: `Your next medal is ${medal.next.name}, ${medal.missionsToNext} missions away.${current}`,
      synonyms: ['my', 'medal', 'next', 'award'],
      kind: 'mine',
    })
  } else if (medal?.current?.name) {
    out.push({
      id: 'mine-medal',
      sectionId: 'mine-medal',
      title: 'Your medal',
      href: '/me',
      text: `Your latest medal is ${medal.current.name}.`,
      synonyms: ['my', 'medal', 'award'],
      kind: 'mine',
    })
  }
  if (streak && num(streak.current) != null) {
    const longest = num(streak.longest)
    const best = longest != null ? ` Your longest streak is ${longest}.` : ''
    out.push({
      id: 'mine-streak',
      sectionId: 'mine-streak',
      title: 'Your streak',
      href: '/me',
      text: `Your current streak is ${streak.current} missions in a row.${best}`,
      synonyms: ['my', 'streak', 'row', 'longest'],
      kind: 'mine',
    })
  }
  if (facts?.baseRank != null && facts.baseTotal != null) {
    out.push({
      id: 'mine-base',
      sectionId: 'mine-base',
      title: 'Your base',
      href: '/me',
      text: `Your school is #${facts.baseRank} of ${facts.baseTotal} bases in the world.`,
      synonyms: ['my', 'school', 'base', 'rank', 'place', 'world'],
      kind: 'mine',
    })
  }
  if (facts?.platoonRank != null && facts.platoonTotal != null) {
    out.push({
      id: 'mine-platoon',
      sectionId: 'mine-platoon',
      title: 'Your platoon',
      href: '/me',
      text: `Your platoon is #${facts.platoonRank} of ${facts.platoonTotal} platoons in your base.`,
      synonyms: ['my', 'platoon', 'class', 'rank', 'place'],
      kind: 'mine',
    })
  }
  if (facts?.soldierRank != null && facts.soldierTotal != null) {
    out.push({
      id: 'mine-soldier',
      sectionId: 'mine-soldier',
      title: 'You in your base',
      href: '/me',
      text: `You are #${facts.soldierRank} of ${facts.soldierTotal} chayolim in your base.`,
      synonyms: ['my', 'rank', 'place', 'chayolim', 'school', 'standing'],
      kind: 'mine',
    })
  }
  return out
}

function asksToBeFilledIn(text) {
  const t = norm(text)
  const wantsDone = /\b(put in|fill in|type in|enter|log|report|save)\b/.test(t)
  const forThem = /\b(for me|my tehillim|my kapitlach|my minutes|so i dont)\b/.test(t)
  return wantsDone && forThem
}

function asksAboutSomeoneElse(text) {
  const t = norm(text)
  if (/\b(another|other|someone else|my friend|my classmate|classmate|his|her|their|roster|class list|who is in|names of|serial|password|date of birth|birthday|kid id|user id)\b/.test(t)) {
    return true
  }
  if (/\b\d{5,}\b/.test(t) && /\b(kid|user|soldier|serial|id)\b/.test(t)) return true
  if (/\bhow is (?!my\b|the\b)[a-z]+ doing\b/.test(t)) return true
  if (/\b(?!my\b)[a-z]+s (quota|medal|streak|rank|ladder|serial|password)\b/.test(t)) return true
  return false
}

function asksPersonal(text) {
  const t = norm(text)
  return /\b(my|mine|i am|im|how am i|how many do i|what do i)\b/.test(t)
}

function signedIn(ctx) {
  return !!(ctx && (ctx.progress || ctx.ladder || ctx.firstName))
}

function titleHits(queryTokens, passage) {
  const titleWords = new Set(tokens(passage.title).flatMap((word) => family(word)))
  return queryTokens.filter((word) => family(word).some((option) => titleWords.has(option))).length
}

function rank(query, list) {
  const queryTokens = tokens(query)
  return list
    .map((passage) => {
      const score = scorePassage(queryTokens, passage)
      const title = titleHits(queryTokens, passage)
      return { passage, score, title, rankScore: score + title * 0.2 }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.rankScore - a.rankScore || b.score - a.score)
}

function tooClose(top, alt) {
  if (!alt) return false
  if (alt.passage.sectionId === top.passage.sectionId) return false
  if (top.title > alt.title) return false
  return alt.score >= 0.5 && top.rankScore - alt.rankScore < 0.12
}

function quote(hit) {
  const where = hit.passage.kind === 'mine'
    ? 'On your page'
    : `From ${hit.passage.title}`
  return `${where}: ${hit.passage.text} Read more in ${hit.passage.title} (${hit.passage.href}).`
}

/**
 * @returns {{reply: string, href?: string, title?: string, source: string, usedAi: false}|null}
 * null means this lookup has nothing to say, so a greeting can use the older lines.
 */
export function searchSite(text, ctx) {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  if (topicDecision(raw) === 'refuse') {
    return { reply: OFF_TOPIC_REPLY, source: 'off-topic', usedAi: false }
  }
  if (asksToBeFilledIn(raw)) {
    return { reply: DIRECT_REPLY, href: '/how-to#report', title: 'Mark what you said', source: 'direct', usedAi: false }
  }
  if (asksAboutSomeoneElse(raw)) {
    return { reply: PRIVACY_REPLY, source: 'privacy', usedAi: false }
  }

  const mine = personalPassages(ctx)
  const guide = passagesFromGuide()
  const personal = asksPersonal(raw)
  const mineHits = rank(raw, mine)
  const guideHits = rank(raw, guide)

  if (personal && !signedIn(ctx) && (mineHits.length || /\b(quota|ladder|medal|streak|rank|mission|standing)\b/.test(norm(raw)))) {
    return { reply: SIGN_IN_REPLY, source: 'signed-out', usedAi: false }
  }

  if (personal && mineHits[0] && mineHits[0].score >= 0.3) {
    const top = mineHits[0]
    const alt = mineHits[1]
    if (tooClose(top, alt)) {
      return {
        reply: `I found two things on your page. Did you mean ${top.passage.title} or ${alt.passage.title}?`,
        source: 'clarify',
        usedAi: false,
      }
    }
    return {
      reply: quote(top),
      href: top.passage.href,
      title: top.passage.title,
      source: 'mine',
      usedAi: false,
    }
  }

  if (personal && signedIn(ctx) && /\b(quota|medal|streak|rank|mission|ladder)\b/.test(norm(raw)) && !mineHits.length) {
    const guideHit = guideHits[0]
    const extra = guideHit && guideHit.score >= 0.3 ? ` ${quote(guideHit)}` : ''
    return {
      reply: `I don't have that number on your page, so I won't guess it.${extra}`,
      href: guideHit?.passage.href,
      title: guideHit?.passage.title,
      source: 'missing',
      usedAi: false,
    }
  }

  const top = guideHits[0]
  if (top && top.score >= 0.3) {
    const alt = guideHits.find((hit) => hit.passage.sectionId !== top.passage.sectionId)
    if (tooClose(top, alt)) {
      return {
        reply: `I found two places. Did you mean ${top.passage.title} or ${alt.passage.title}?`,
        source: 'clarify',
        usedAi: false,
      }
    }
    return {
      reply: quote(top),
      href: top.passage.href,
      title: top.passage.title,
      source: 'guide',
      usedAi: false,
    }
  }

  if (/\b(tehillim|ladder|medal|streak|quota|mission|platoon|base|army|kapitel|shabbos|tzivos|rank|report|soldier|club|teacher|principal)\b/.test(norm(raw))) {
    return { reply: NO_MATCH_REPLY, source: 'miss', usedAi: false }
  }
  return null
}
