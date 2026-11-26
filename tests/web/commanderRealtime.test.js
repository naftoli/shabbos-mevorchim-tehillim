import test from 'node:test'
import assert from 'node:assert/strict'
import { OFF_TOPIC_REPLY, topicDecision, turnPlan } from '../../src/lib/topicGate.js'
import { decideLadderChange, transcriptOffersLadder } from '../../src/lib/ladderTool.js'
import { createTurnGate } from '../../src/lib/turnGate.js'

test('off-topic requests are refused before an answer, club questions are not', () => {
  assert.equal(topicDecision('tell me a joke'), 'refuse')
  assert.equal(topicDecision('Can you help with my homework?'), 'refuse')
  assert.equal(topicDecision("Let's play a game"), 'refuse')
  assert.equal(topicDecision('Please? Just one?'), 'refuse')
  assert.equal(topicDecision("what's the capital of France"), 'refuse')
  assert.equal(topicDecision('what is 6 plus 7'), 'refuse')
  assert.equal(topicDecision('who made you?'), 'answer')
  assert.equal(topicDecision('Can you put in my Tehillim for me?'), 'answer')
  assert.equal(topicDecision('what do I say this month?'), 'answer')
  assert.equal(topicDecision("I'm sad"), 'answer')
  assert.equal(topicDecision('change me to ladder 8'), 'answer')
  assert.equal(topicDecision('be quiet'), 'quiet')
  assert.equal(turnPlan('talk again'), 'unmute')
  assert.equal(turnPlan('say that again'), 'repeat')
  assert.equal(
    OFF_TOPIC_REPLY,
    'I can only help with the Tehillim Club. What would you like to know about your Tehillim?',
  )
})

test('change_ladder waits for a spoken yes and a real ladder', () => {
  const allowed = [12, 11, 10, 9, 8, 7, 6, 5]
  const early = decideLadderChange({
    ladder: 8,
    allowed,
    lastUserText: 'change me to ladder 8',
    offerSpoken: false,
  })
  assert.equal(early.apply, false)
  assert.match(early.output, /Do not switch yet/)

  const bad = decideLadderChange({
    ladder: 3,
    allowed,
    lastUserText: 'yes',
    offerSpoken: true,
  })
  assert.equal(bad.apply, false)
  assert.match(bad.output, /not one this soldier can pick/)

  const offer = 'Ladder 8 means you say 22 kapitlach and 40 minutes this month. Do you want me to switch you to ladder 8?'
  assert.equal(transcriptOffersLadder(offer), true)
  const yes = decideLadderChange({
    ladder: 8,
    allowed,
    lastUserText: 'yes',
    offerSpoken: true,
  })
  assert.deepEqual(yes, { apply: true, ladder: 8 })
})

test('the turn gate checks the transcript before answering, and barge-in drops the turn', () => {
  const decisions = []
  const timers = []
  const gate = createTurnGate({
    onDecide: (info) => decisions.push(info),
    waitMs: 1200,
    setTimer: (fn) => {
      timers.push(fn)
      return timers.length
    },
    clearTimer: () => {},
  })

  gate.speechStopped()
  gate.transcript('tell me a joke')
  assert.equal(decisions.length, 1)
  assert.equal(decisions[0].plan, 'refuse')
  assert.equal(decisions[0].late, false)
  assert.equal(timers.length, 1)

  gate.speechStopped()
  timers.at(-1)()
  assert.equal(decisions.at(-1).timedOut, true)
  assert.equal(decisions.at(-1).plan, 'answer')
  gate.transcript("what's the weather")
  assert.equal(decisions.at(-1).late, true)
  assert.equal(decisions.at(-1).plan, 'refuse')

  const before = decisions.length
  gate.speechStopped()
  gate.speechStarted()
  timers.at(-1)()
  gate.transcript('tell me a joke')
  assert.equal(decisions.length, before)
})
