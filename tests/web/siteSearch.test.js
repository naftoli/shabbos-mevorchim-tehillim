import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { answerQuestion } from '../../src/lib/kidAnswers.js'
import {
  CHOOSING_SCRIPT,
  TRACK_SCRIPT,
  fillClimb,
  fillMission,
  fillReview,
  fillStand,
  fillStreak,
  fillWelcome,
} from '../../src/lib/commanderScripts.js'
import { guideSection } from '../../src/data/siteGuide.js'
import {
  DIRECT_REPLY,
  NO_MATCH_REPLY,
  PRIVACY_REPLY,
  SIGN_IN_REPLY,
  searchSite,
} from '../../src/lib/siteSearch.js'

// Wording is frozen. This hash moved when the last-two-months review was added.
// The spoken sentences below did not change.
const SCRIPT_HASH = '0dc512230689d3f18cf415417688e46d5c27f821c7390688143808d39ca0468e'

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
    classmates: [{ name: 'Rivky', quota: 99, serial: '99999' }],
  },
}

test('Wednesday commander scripts file is unchanged', () => {
  const source = readFileSync(new URL('../../src/lib/commanderScripts.js', import.meta.url))
  const hash = createHash('sha256').update(source).digest('hex')
  assert.equal(hash, SCRIPT_HASH)
  assert.match(fillWelcome('Mushky'), /^Welcome, Mushky/)
  assert.match(CHOOSING_SCRIPT, /^That's wonderful, soldier!/)
  assert.match(TRACK_SCRIPT, /^This is your Tehillim training track, soldier\./)
  assert.match(fillMission({ name: 'Dovi', ladder: 8, gradeLabel: '8th grade', kapitlach: 18, minutes: 55 }), /18 kapitlach, about 55 minutes/)
  assert.match(fillMission({ name: 'Dovi', customTarget: 150, customFinish: '8th grade', kapitlach: 40, minutes: 80 }), /custom ladder[\s\S]*150 kapitlach by 8th grade/)
  assert.match(fillStand({ baseRank: 23, baseTotal: 75, platoonRank: 4, platoonTotal: 47, soldierRank: 8, soldierTotal: 581 }), /number 23 out of 75/)
  assert.match(fillStreak({ current: 2, longest: 4 }), /2 missions in a row/)
  assert.match(fillClimb('8th grade'), /by 8th grade/)
  assert.match(fillReview([
    { month: 'Cheshvan', kapitlach: 4, minutes: 10, quotaKapitlach: 11, quotaMinutes: 40, met: false, reported: true },
  ]), /Last month was Cheshvan\. You said 4 kapitlach in 10 minutes\./)
})

test('site lookup does not call an AI service', () => {
  const source = readFileSync(new URL('../../src/lib/siteSearch.js', import.meta.url), 'utf8')
  assert.equal(source.includes('fetch('), false)
  assert.equal(source.includes('anthropic'), false)
  assert.equal(source.includes('api/chat'), false)
  const found = searchSite('what is a platoon', child)
  assert.equal(found.usedAi, false)
  assert.match(found.reply, /Perfect Platoon/)
  assert.match(found.reply, /\/how-to#platoon/)
})

test('How It Works and the lookup share the same sentences', () => {
  const page = readFileSync(new URL('../../src/pages/HowTo.jsx', import.meta.url), 'utf8')
  assert.match(page, /guideSection\('goal'\)/)
  const goal = guideSection('goal')
  assert.equal(goal.paragraphs[0], 'Say the entire Tehillim each Shabbos Mevorchim.')
  const found = searchSite('why do childrens tehillim have a special power', null)
  assert.match(found.reply, /foils the plans of our enemies/)
  assert.equal(found.source, 'guide')
})

test('a paraphrase of the ladder page finds the ladder explanation', () => {
  const found = searchSite('which training pace finishes by 5th grade', child)
  assert.match(found.reply, /Ladder 5 builds toward completing it by 5th grade/)
  assert.equal(found.href, '/how-to#ladders')
})

test('two close topics ask which one the child meant', () => {
  const found = searchSite('what is a medal and a streak', child)
  assert.equal(found.source, 'clarify')
  assert.match(found.reply, /Medals/)
  assert.match(found.reply, /Streaks/)
})

test('the child\'s own quota, medal, streak, and ranks come from their page', () => {
  const quota = searchSite('what is my quota this month', child)
  assert.match(quota.reply, /18 kapitlach/)
  assert.match(quota.reply, /55 minutes/)
  assert.equal(quota.reply.includes('99'), false)

  const streak = searchSite('how is my streak', child)
  assert.match(streak.reply, /current streak is 2/)
  assert.match(streak.reply, /longest streak is 4/)

  const medal = searchSite('what is my next medal', child)
  assert.match(medal.reply, /Blue/)
  assert.match(medal.reply, /5 missions away/)

  const rank = searchSite('where does my school stand', child)
  assert.match(rank.reply, /#23 of 75 bases/)
})

test('a quota question does not borrow the mission count', () => {
  const found = searchSite('what is my quota', { ...child, progress: { ...child.progress, current: null } })
  assert.equal(found.source, 'missing')
  assert.equal(found.reply.includes('40 missions'), false)
})

test('a missing number is not invented', () => {
  const found = searchSite('what is my streak', { ...child, streakInfo: null })
  assert.equal(found.source, 'missing')
  assert.match(found.reply, /won't guess/)
  assert.equal(/\bstreak is \d/.test(found.reply), false)
})

test('an unknown club fact is admitted', () => {
  const found = searchSite('who is my teacher', child)
  assert.equal(found.source, 'miss')
  assert.equal(found.reply, NO_MATCH_REPLY)
})

test('an unrelated question is turned back to the club', () => {
  const found = searchSite('tell me a joke about dogs', child)
  assert.equal(found.source, 'off-topic')
  assert.match(found.reply, /Tehillim Club/)
})

test('another child stays private', () => {
  const named = searchSite('how is Rivky doing', child)
  assert.equal(named.reply, PRIVACY_REPLY)
  assert.equal(named.reply.includes('Rivky'), false)
  assert.equal(named.reply.includes('99999'), false)
  assert.equal(named.reply.includes('99'), false)

  const serial = searchSite('look up kid id 55555', child)
  assert.equal(serial.source, 'privacy')
})

test('the commander only directs a report, it does not file one', () => {
  const fromSheet = answerQuestion('Can you put in my Tehillim for me?', child)
  assert.match(fromSheet.reply, /I can direct you how to do it/)
  const fromSearch = searchSite('can you fill in my tehillim so I dont have to', child)
  assert.equal(fromSearch.reply, DIRECT_REPLY)
  assert.equal(fromSearch.usedAi, false)
})

test('a signed-out child still gets the public page, not someone else\'s numbers', () => {
  const mine = searchSite('what is my quota', null)
  assert.equal(mine.reply, SIGN_IN_REPLY)
  const publicPage = searchSite('what is a base', null)
  assert.match(publicPage.reply, /Your school is your base/)
})
