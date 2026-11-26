import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { defaultChatReply } from '../../src/lib/defaultChat.js'
import { NO_MATCH_REPLY } from '../../src/lib/siteSearch.js'
import { realtimeWanted } from '../../src/lib/realtimeOptIn.js'

const child = {
  firstName: 'Dovi',
  ladder: 8,
  gradeLabel: '8th',
  progress: {
    current: { quota: 18, minutes: 55 },
    missionsTotal: 40,
    medal: { current: { name: 'Green' }, next: { name: 'Blue' }, missionsToNext: 5 },
  },
  streakInfo: { current: 2, longest: 4 },
  social: {
    schoolRank: 23,
    totalSchools: 75,
    classRank: 4,
    totalClasses: 47,
    myRankInSchool: 8,
    schoolSize: 581,
    classmates: [{ name: 'Rivky', serial: '99999' }],
  },
}

function reply(text, ctx = child) {
  const calls = []
  const previous = globalThis.fetch
  globalThis.fetch = (...args) => {
    calls.push(args[0])
    throw new Error('default chat must not fetch')
  }
  try {
    const result = defaultChatReply(text, ctx)
    assert.equal(result.usedAi, false)
    assert.equal(calls.length, 0)
    return result
  } finally {
    globalThis.fetch = previous
  }
}

test('a greeting and a thank-you are local, including a misspelling', () => {
  assert.match(reply('hello').reply, /Hi Dovi/)
  assert.match(reply('helo').reply, /Hi Dovi/)
  assert.match(reply('thanks').reply, /Anytime, Dovi/)
  assert.match(reply('thnaks').reply, /Anytime, Dovi/)
})

test('an unmatched line is a no-match, not a guess', () => {
  const found = reply('purple elephant juice')
  assert.equal(found.source, 'local')
  assert.equal(found.reply, NO_MATCH_REPLY)
})

test('a misspelled knowledge question still quotes the site', () => {
  const found = reply('why do childrens tehhilim have a special power')
  assert.match(found.reply, /foils the plans of our enemies/)
  assert.equal(found.href, '/how-to#goal')
  const platoon = reply('what is a plattoon')
  assert.match(platoon.reply, /Perfect Platoon/)
})

test('the child\'s own numbers stay private to that child', () => {
  assert.match(reply('what is my quota').reply, /18 kapitlach/)
  assert.match(reply('what is my quota').reply, /55 minutes/)
  const other = reply('how is Rivky doing')
  assert.equal(other.source, 'privacy')
  assert.equal(other.reply.includes('Rivky'), false)
  assert.equal(other.reply.includes('99999'), false)
})

test('the typed chat path does not call /api/chat or start paid speech', () => {
  const source = readFileSync(new URL('../../src/components/ChatBuddy.jsx', import.meta.url), 'utf8')
  const sendStart = source.indexOf('async function send')
  const sendEnd = source.indexOf('function toggleMic')
  const send = source.slice(sendStart, sendEnd)
  assert.equal(send.includes('defaultChatReply'), true)
  assert.equal(send.includes('aiReply'), false)
  assert.equal(send.includes('api/chat'), false)
  assert.equal(send.includes('fetch('), false)
  assert.equal(source.includes('aiReply'), false)
  assert.equal(source.includes('api/chat'), false)
  assert.match(source, /if \(!IS_DEMO && realtimeWanted\(\)\)/)
  assert.equal(realtimeWanted({ getItem: () => null }), false)
  assert.equal(realtimeWanted({ getItem: () => 'on' }), true)
})
