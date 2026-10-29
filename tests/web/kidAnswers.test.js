import test from 'node:test'
import assert from 'node:assert/strict'
import { quotaFor } from '../../src/data/ladders.js'
import { COUNSELOR, TOPICS } from '../../src/data/kidQuestions.js'
import { openingGreeting } from '../../src/lib/general613.js'
import {
  answerQuestion,
  answerSheet,
  ladderChangeReply,
  ladderConfirmedReply,
  looksLikeEcho,
  parseSpokenLadder,
  voiceCommand,
  wantsLadderChange,
} from '../../src/lib/kidAnswers.js'

function countQuestions(topics) {
  let n = 0
  for (const topic of topics) {
    for (const item of topic.items) {
      n += 1
      n += (item.f || []).length
    }
  }
  return n
}

const meir = {
  firstName: 'Meir',
  grade: '1',
  childGradeLabel: '1st',
  monthEn: 'Cheshvan',
  ladder: null,
  progress: { months: [], missionsTotal: 0, current: null },
}

test('the review sheet is in the scripted answers', () => {
  assert.equal(countQuestions(TOPICS), 163)
  assert.equal(answerSheet(meir).length, 163)
  assert.equal(answerSheet(meir).filter((row) => row.a === COUNSELOR).length > 0, true)
})

test('who made you is Tzivos Hashem, verbatim', () => {
  const found = answerQuestion('Who made you?', meir)
  assert.equal(found.reply, 'Tzivos Hashem made me!')
  assert.equal(found.shimmy, false)
})

test('a shimmy question asks the counselor and does not invent an answer', () => {
  const found = answerQuestion('How do I count my minutes?', meir)
  assert.equal(found.reply, COUNSELOR)
  assert.equal(found.shimmy, true)
  assert.equal(found.reply.includes('Suggested'), false)
})

test('putting in Tehillim is a guide, not something the commander types', () => {
  const found = answerQuestion('Can you put in my Tehillim for me?', meir)
  assert.equal(
    found.reply,
    'I can direct you how to do it! On your page, type how many kapitlach you said in the “Kapitlach I said” box and your minutes in the “Minutes I said” box, then tap Save. That\'s it!',
  )
  assert.equal(/\b(i entered|i'll enter|i put in|i saved)\b/i.test(found.reply), false)
})

test('a spoken ladder eight is ladder 8, and only a real ladder is confirmed', () => {
  assert.equal(parseSpokenLadder('change me to ladder eight'), 8)
  assert.equal(wantsLadderChange('change me to ladder eight'), true)
  assert.equal(wantsLadderChange('what does ladder eight mean'), false)
  const q = quotaFor('1', 'Cheshvan', 8)
  const change = ladderChangeReply('change me to ladder eight', meir)
  assert.equal(change.confirm, true)
  assert.equal(change.pickLadder, 8)
  assert.equal(
    change.reply,
    `Ladder 8 means you say ${q.v} kapitlach and ${q.m} minutes this month. Do you want me to switch you to ladder 8?`,
  )
  const blocked = ladderChangeReply('change me to ladder three', meir)
  assert.equal(blocked.confirm, undefined)
  assert.equal(blocked.pickLadder, null)
  assert.match(blocked.reply, /isn't one you can pick/)
  assert.equal(
    ladderConfirmedReply(8),
    "Done! You're now on ladder 8. You're training to say the whole Tehillim by 8th grade. Hatzlacha!",
  )
})

test('yes and no are not sheet answers, and his own voice is an echo', () => {
  assert.equal(answerQuestion('yes', meir), null)
  assert.equal(answerQuestion('no', meir), null)
  const greeting = openingGreeting({ ...meir, situation: 'pick' })
  assert.equal(looksLikeEcho('Hi Meir, I\'m your virtual commander.', greeting), true)
  assert.equal(looksLikeEcho('change me to ladder eight', greeting), false)
  assert.equal(voiceCommand('be quiet'), 'stop')
  assert.equal(voiceCommand('say that again'), 'repeat')
})
