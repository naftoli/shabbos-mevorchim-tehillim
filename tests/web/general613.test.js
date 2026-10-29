import test from 'node:test'
import assert from 'node:assert/strict'
import { quotaFor } from '../../src/data/ladders.js'
import { BOT_NAME, autoOpenFor, openingGreeting, quickRepliesFor, quotaWords, readSituation, scriptedTurn } from '../../src/lib/general613.js'
import { armVoice, canListen, canSpeak, pickVoice, speak, speechChunks, spokenText, startRecognition, stripForSpeech } from '../../src/lib/speech.js'

const hello = (name) => `Hi ${name}, I'm your virtual commander.`

test('no ladder yet walks the real easiest and hardest ladders', () => {
  const ctx = {
    ladder: null,
    firstName: 'Mushky',
    grade: '3',
    monthEn: 'Kislev',
    progress: { months: [], missionsTotal: 0 },
  }
  assert.equal(readSituation(ctx), 'pick')
  const q = quotaFor('3', 'Kislev', 12)
  assert.equal(q.v, 5)
  assert.equal(q.m, 25)
  const greeting = openingGreeting({ ...ctx, situation: 'pick' })
  assert.match(greeting, new RegExp(`^${hello('Mushky').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} Welcome to Shabbos Mevorchim Tehillim Campaign\\. Let's start by choosing the ladder that works best for you\\.`))
  assert.match(greeting, /You can take ladder 12\. That's the easiest ladder, but your training will take until 12th grade\./)
  assert.match(greeting, /Or you can choose ladder 5\. That's the hardest ladder, but you'll finish your training and be able to say the entire Tehillim on Shabbos Mevorchim by the time you finish 5th grade\./)
  assert.match(greeting, /So, there's so many other ladders in between\./)
  assert.match(greeting, /Let's take a look at ladder 12 and see if that's what works for you\. So, now we're holding Shabbos Mevorchim Kislev, and you are in 3rd grade\. So, if you take ladder 12, that would mean that your quota is 5 kapitlach and 25 minutes\./)
  assert.match(greeting, /or would you like to check out a more challenging ladder\?/)
  assert.deepEqual(quickRepliesFor({ ...ctx, situation: 'pick' }), ['That\'s good for me', 'A more challenging ladder'])
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
    openingGreeting({ ...ctx, firstName: 'Dovi', situation: 'behind' }),
    `${hello('Dovi')} Where were you last month?`,
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
    openingGreeting({ ...ctx, firstName: 'Dovi', situation: 'ahead' }),
    `${hello('Dovi')} I see you did a great job last month. You did more than your quota. Would you like to go to a higher quota?`,
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
  const greeting = openingGreeting({ ...ctx, firstName: 'Dovi', situation: 'ontrack' })
  assert.equal(
    greeting,
    `${hello('Dovi')} 👋 So good to see you — you're doing beautifully, 4 missions done. Need anything? I can show your mission this month or how you're doing.`,
  )
  assert.deepEqual(quickRepliesFor({ situation: 'ontrack', ladder: 9 }), ['My mission this month', 'How am I doing?', 'My medals'])
})

test('no finished month yet stays on track', () => {
  assert.equal(readSituation({
    ladder: 8,
    progress: { months: [{ isCurrent: true, met: false, said: 0, quota: 10 }] },
  }), 'ontrack')
})

test('the panel opens once per login and stays shut across a page change', () => {
  assert.deepEqual(autoOpenFor(null, 'meir'), { openedFor: 'meir', open: true })
  assert.equal(autoOpenFor('meir', 'meir'), null)
  assert.deepEqual(autoOpenFor('meir', null), { openedFor: null, open: false })
  assert.equal(autoOpenFor(null, null), null)
  assert.deepEqual(autoOpenFor('meir', 'rochel'), { openedFor: 'rochel', open: true })
})

test('speech helpers no-op when the browser has no speech API', async () => {
  assert.equal(canSpeak(), false)
  assert.equal(canListen(), false)
  armVoice()
  assert.equal(await speak('Hi there 👋'), 'unavailable')
  assert.equal(await speak('Hi', { muted: true }), 'muted')
  assert.equal(await speak('👋'), 'empty')
  let code = ''
  const handle = startRecognition({ onError: (err) => { code = err } })
  handle.stop()
  assert.equal(code, 'unsupported')
})

test('a harder grade uses its own hardest ladder, not ladder 5', () => {
  const ctx = { ladder: null, firstName: 'Rochel', grade: '8', monthEn: 'Kislev', situation: 'pick' }
  const greeting = openingGreeting(ctx)
  assert.match(greeting, /Or you can choose ladder 8\. That's the hardest ladder, but you'll finish your training and be able to say the entire Tehillim on Shabbos Mevorchim by the time you finish 8th grade\./)
  assert.doesNotMatch(greeting, /ladder 5/)
})

test('a 12th grader only hears ladder 12', () => {
  const ctx = { ladder: null, firstName: 'Levi', grade: '12', monthEn: 'Nissan', situation: 'pick' }
  const greeting = openingGreeting(ctx)
  assert.match(greeting, /You can take ladder 12\. That's the ladder for your grade, and your training will take until 12th grade\./)
  assert.doesNotMatch(greeting, /ladder 5/)
  assert.doesNotMatch(greeting, /lots of different choices/)
  const q = quotaFor('12', 'Nissan', 12)
  assert.ok(q.m != null)
  assert.match(greeting, new RegExp(`your quota is ${q.v} kapitlach and ${q.m} minutes`))
})

test('saying yes picks the focused ladder and says the hatzlacha line', () => {
  const ctx = { situation: 'pick', firstName: 'Mushky', grade: '3', monthEn: 'Kislev', ladder: null }
  const yes = scriptedTurn("That's good for me", ctx)
  assert.equal(yes.pickLadder, 12)
  assert.equal(yes.focusLadder, 12)
  assert.match(yes.reply, /^Okay, that's fine\. That's a great place to start, and I want to wish you a lot of hatzlacha/)
  assert.match(yes.reply, /put in the amount of kapitlach that you said and the amount of minutes that you said/)
  assert.match(yes.reply, /Mushky, remember, your whole class, your whole platoon is relying on you to complete their quota, and your school, your base is relying on you to complete your quota, and the whole army is relying on you\. So, give it all you got\./)
})

test('a more challenging ladder repeats the offer one step harder', () => {
  const ctx = { situation: 'pick', firstName: 'Mushky', grade: '3', monthEn: 'Kislev', ladder: null, focusLadder: 12 }
  const next = scriptedTurn('A more challenging ladder', ctx)
  assert.equal(next.pickLadder, undefined)
  assert.equal(next.focusLadder, 11)
  const q = quotaFor('3', 'Kislev', 11)
  assert.match(next.reply, new RegExp(`^Let's take a look at ladder 11 and see if that's what works for you\\. So, now we're holding Shabbos Mevorchim Kislev, and you are in 3rd grade\\. So, if you take ladder 11, that would mean that your quota is ${q.v} kapitlach and ${q.m} minutes\\.`))
  const taken = scriptedTurn('Oh, that\'s good for me', { ...ctx, focusLadder: next.focusLadder })
  assert.equal(taken.pickLadder, 11)
})

test('an easier ladder steps back up and repeats the offer', () => {
  const ctx = { situation: 'pick', firstName: 'Mushky', grade: '3', monthEn: 'Kislev', focusLadder: 11 }
  const back = scriptedTurn('An easier ladder', ctx)
  assert.equal(back.focusLadder, 12)
  assert.equal(back.pickLadder, undefined)
  assert.match(back.reply, /Let's take a look at ladder 12 and see if that's what works for you/)
  assert.match(back.reply, /5 kapitlach and 25 minutes/)
})

test('the hardest ladder does not invent a ladder below it', () => {
  const ctx = { situation: 'pick', firstName: 'Mushky', grade: '3', monthEn: 'Kislev', focusLadder: 5 }
  const next = scriptedTurn('A more challenging ladder', ctx)
  assert.equal(next.focusLadder, 5)
  assert.match(next.reply, /^Ladder 5 is already the most challenging ladder you can pick\. Let's take a look at ladder 5/)
  assert.doesNotMatch(next.reply, /ladder 4/)
})

test('an ordinary question is not the ladder walk', () => {
  const ctx = { situation: 'pick', firstName: 'Mushky', grade: '3', monthEn: 'Kislev' }
  assert.equal(scriptedTurn('How does it work?', ctx), null)
  assert.equal(scriptedTurn('yes', { situation: 'ontrack', firstName: 'Mushky', grade: '3', ladder: 8 }), null)
})

test('a quota with no minutes leaves the minutes out', () => {
  assert.equal(quotaWords({ v: 5, m: 25 }), '5 kapitlach and 25 minutes')
  assert.equal(quotaWords({ v: 5 }), '5 kapitlach')
  assert.equal(quotaWords({ v: 1, m: 1 }), '1 kapitel and 1 minute')
})

test('a spoken 613 is six thirteen, and the greeting uses your virtual commander', () => {
  assert.equal(spokenText('613'), 'six thirteen')
  assert.equal(spokenText('General 613\'s turn. 613'), 'General six thirteen\'s turn. six thirteen')
  const greeting = openingGreeting({ ladder: null, firstName: 'Meir', grade: '1', monthEn: 'Cheshvan', situation: 'pick', progress: { missionsTotal: 0, months: [] } })
  assert.equal(BOT_NAME, 'Your Virtual Commander')
  assert.match(greeting, /^Hi Meir, I'm your virtual commander\./)
  assert.equal(greeting.includes('613'), false)
  assert.equal(speechChunks("Hi, I'm General 613.").join(' '), "Hi, I'm General six thirteen.")
  const long = 'This is a full sentence about the ladder. '.repeat(12).trim()
  const chunks = speechChunks(long)
  assert.ok(chunks.length > 1)
  assert.equal(chunks.join(' '), long)
  for (const chunk of chunks) assert.match(chunk, /ladder\.$/)
  const huge = `${'word '.repeat(80).trim()}.`
  assert.deepEqual(speechChunks(huge), [huge])
})

test('the best available English voice is chosen', () => {
  const natural = { name: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US' }
  const google = { name: 'Google US English', lang: 'en-US' }
  const samantha = { name: 'Samantha', lang: 'en-US' }
  const us = { name: 'Alex', lang: 'en-US' }
  const british = { name: 'Daniel', lang: 'en-GB' }
  assert.equal(pickVoice([british, us, samantha, google, natural]), natural)
  assert.equal(pickVoice([us, british, google, samantha]), google)
  assert.equal(pickVoice([british, us, samantha]), samantha)
  assert.equal(pickVoice([british, us]), us)
  assert.equal(pickVoice([british]), british)
  assert.equal(pickVoice([]), null)
})

test('stripForSpeech drops emoji and keeps the words', () => {
  assert.equal(stripForSpeech('Hi, I\'m General 613. 👋 So good to see you 💙'), 'Hi, I\'m General 613. So good to see you')
  assert.equal(stripForSpeech('Say א-נד 📖 today!'), 'Say א-נד today!')
  assert.equal(stripForSpeech(''), '')
})
