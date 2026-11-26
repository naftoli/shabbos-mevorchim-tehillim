// Lightweight topic check for Your Virtual Commander.
// Clear off-topic requests are refused before any model speaks.
// Anything that might be about the club is allowed through; the system
// instructions still refuse whatever is not actually connected.

import { voiceCommand } from './kidAnswers.js'

export const OFF_TOPIC_REPLY = 'I can only help with the Tehillim Club. What would you like to know about your Tehillim?'

const OFF_TOPIC = [
  /\bhomework\b/,
  /\b(essay|book report|spelling test|math problem)\b/,
  /\bjoke\b/,
  /\briddle\b/,
  /\bknock knock\b/,
  /\bmake me laugh\b/,
  /\b(video game|minecraft|roblox|fortnite|pokemon)\b/,
  /\b(let'?s play|play a game|play games)\b/,
  /\b(movie|cartoon|youtube|tik ?tok|netflix)\b/,
  /\bweather\b/,
  /\b(president|politics|election)\b/,
  /\bcapital of\b/,
  /\b\d+\s*(plus|minus|times|divided by)\s*\d+\b/,
  /\b(tell me a story|once upon a time)\b/,
  /\b(world series|super bowl|world cup|nba|nfl)\b/,
  /\b(ignore (all |your )?(previous|prior) instructions|you are now|jailbreak)\b/,
  /\b(bomb|weapon|kill|murder|drugs?)\b/,
  /\b(where do you live|how old are you|your (phone|address|password|last name))\b/,
  /\b(girlfriend|boyfriend|dating)\b/,
  /^(please )?just one\b/,
]

export function refusalInstructions() {
  return `The child just said something that is not about the Worldwide Tehillim Club. Do not answer it, do not explain it, and do not mention what they asked. Say only this, in a warm short voice: ${OFF_TOPIC_REPLY}`
}

function norm(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// 'answer' | 'refuse' | 'quiet'
export function topicDecision(text) {
  const t = norm(text)
  if (!t) return 'answer'
  if (voiceCommand(t) === 'stop') return 'quiet'
  if (OFF_TOPIC.some((re) => re.test(t))) return 'refuse'
  return 'answer'
}

// What the realtime call should do with one finished utterance.
// 'answer' | 'refuse' | 'quiet' | 'unmute' | 'repeat'
export function turnPlan(text) {
  const command = voiceCommand(text)
  if (command === 'stop') return 'quiet'
  if (command === 'unmute') return 'unmute'
  if (command === 'repeat') return 'repeat'
  return topicDecision(text)
}
