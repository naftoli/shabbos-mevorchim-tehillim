// Default typed chat. Every reply is chosen on this device. This module
// does not call a network and does not start the optional paid speech call.

import { answerQuestion } from './kidAnswers.js'
import { NO_MATCH_REPLY, searchSite } from './siteSearch.js'
import { OFF_TOPIC_REPLY, topicDecision } from './topicGate.js'

function norm(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function socialLine(text, ctx) {
  const t = norm(text)
  const name = ctx?.firstName || 'friend'
  if (/^(hi|hii|hello|helo|hey|heya|shalom|sholom|good morning|good afternoon)$/.test(t)) {
    return `Hi ${name}! How can I help you today?`
  }
  if (/^(thanks|thank you|thankyou|thanx|thx|thnaks|todah)$/.test(t)) {
    return `Anytime, ${name}!`
  }
  if (/^(bye|goodbye|good shabbos|gut shabbos|see you)$/.test(t)) {
    return `Gut Shabbos, ${name}! Don't forget your Tehillim.`
  }
  return NO_MATCH_REPLY
}

// Always a reply. usedAi is false on every path.
export function defaultChatReply(text, ctx) {
  const raw = String(text ?? '').trim()
  if (!raw) return { reply: NO_MATCH_REPLY, source: 'empty', usedAi: false }
  if (topicDecision(raw) === 'refuse') {
    return { reply: OFF_TOPIC_REPLY, source: 'off-topic', usedAi: false }
  }
  const known = answerQuestion(raw, ctx)
  if (known?.reply) return { reply: known.reply, source: 'sheet', usedAi: false }
  const found = searchSite(raw, ctx)
  if (found?.reply) return { ...found, usedAi: false }
  return { reply: socialLine(raw, ctx), source: 'local', usedAi: false }
}
