import test from 'node:test'
import assert from 'node:assert/strict'
import { BOT_NAME, openingGreeting, quickRepliesFor, readSituation } from '../../src/lib/general613.js'
import { canListen, canSpeak, speak, startRecognition, stripForSpeech } from '../../src/lib/speech.js'

test('no ladder yet asks them to pick one', () => {
  const ctx = { ladder: null, firstName: 'Dovi', progress: { months: [], missionsTotal: 0 } }
  assert.equal(readSituation(ctx), 'pick')
  assert.equal(
    openingGreeting({ ...ctx, situation: 'pick' }),
    `Hi, I'm ${BOT_NAME}. I see you didn't pick a ladder yet. Let's pick the ladder.`,
  )
  assert.deepEqual(quickRepliesFor({ situation: 'pick' }), ['Help me pick my ladder', 'How does it work?'])
})

test('missing last month asks where they were', () => {
  const ctx = {
    ladder: 8,
    progress: {
      months: [
        { isCurrent: false, met: true, said: 20, quota: 10 },
        { isCurrent: false, met: false, said: 3, quota: 12 },
        { isCurrent: true, met: false, said: 0, quota: 14 },
      ],
    },
  }
  assert.equal(readSituation(ctx), 'behind')
  assert.equal(
    openingGreeting({ ...ctx, situation: 'behind' }),
    `Hi, I'm ${BOT_NAME}. Where were you last month?`,
  )
  assert.ok(quickRepliesFor({ ...ctx, situation: 'behind' }).length >= 2)
})

test('ahead is last month over quota, not a three-month streak', () => {
  const ctx = {
    ladder: 8,
    progress: {
      months: [
        { isCurrent: false, met: false, said: 1, quota: 10 },
        { isCurrent: false, met: true, said: 15, quota: 10 },
        { isCurrent: true, met: false, said: 0, quota: 12 },
      ],
    },
  }
  assert.equal(readSituation(ctx), 'ahead')
  assert.equal(
    openingGreeting({ ...ctx, situation: 'ahead' }),
    `Hi, I'm ${BOT_NAME}. I see you did a great job last month. You did more than your quota. Would you like to go to a higher quota?`,
  )
  assert.deepEqual(quickRepliesFor({ ...ctx, situation: 'ahead' }), ['Tell me about Ladder 7', 'How am I doing?'])
})

test('ladder 5 can still be ahead, without offering a ladder that does not exist', () => {
  const ctx = {
    ladder: 5,
    progress: {
      months: [
        { isCurrent: false, met: true, said: 11, quota: 10 },
        { isCurrent: true, met: false, said: 0, quota: 12 },
      ],
    },
  }
  assert.equal(readSituation(ctx), 'ahead')
  assert.deepEqual(quickRepliesFor({ ...ctx, situation: 'ahead' }), ['How am I doing?', 'How does it work?'])
})

test('meeting last month exactly is on track, and the old greeting follows the new hello', () => {
  const ctx = {
    ladder: 9,
    progress: {
      missionsTotal: 4,
      months: [
        { isCurrent: false, met: true, said: 30, quota: 10 },
        { isCurrent: false, met: true, said: 12, quota: 12 },
        { isCurrent: true, met: false, said: 1, quota: 14 },
      ],
    },
  }
  assert.equal(readSituation(ctx), 'ontrack')
  const greeting = openingGreeting({ ...ctx, situation: 'ontrack' })
  assert.equal(
    greeting,
    `Hi, I'm ${BOT_NAME}. 👋 So good to see you — you're doing beautifully, 4 missions done. Need anything? I can show your mission this month or how you're doing.`,
  )
  assert.deepEqual(quickRepliesFor({ situation: 'ontrack', ladder: 9 }), ['My mission this month', 'How am I doing?', 'My medals'])
})

test('no finished month yet stays on track', () => {
  assert.equal(readSituation({
    ladder: 8,
    progress: { months: [{ isCurrent: true, met: false, said: 0, quota: 10 }] },
  }), 'ontrack')
})

test('speech helpers no-op when the browser has no speech API', async () => {
  assert.equal(canSpeak(), false)
  assert.equal(canListen(), false)
  assert.equal(await speak('Hi there 👋'), 'unavailable')
  assert.equal(await speak('Hi', { muted: true }), 'muted')
  assert.equal(await speak('👋'), 'empty')
  let code = ''
  const handle = startRecognition({ onError: (err) => { code = err } })
  handle.stop()
  assert.equal(code, 'unsupported')
})

test('stripForSpeech drops emoji and keeps the words', () => {
  assert.equal(stripForSpeech('Hi, I\'m General 613. 👋 So good to see you 💙'), 'Hi, I\'m General 613. So good to see you')
  assert.equal(stripForSpeech('Say א-נד 📖 today!'), 'Say א-נד today!')
  assert.equal(stripForSpeech(''), '')
})
