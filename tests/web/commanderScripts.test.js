import test from 'node:test'
import assert from 'node:assert/strict'
import { quotaFor } from '../../src/data/ladders.js'
import { spokenText } from '../../src/lib/speech.js'
import { placeAmong } from '../../src/lib/placeRank.js'
import {
  CHOOSING_SCRIPT,
  TRACK_SCRIPT,
  fillClimb,
  TRAINING_NOT_NOW,
  fillMission,
  fillReview,
  fillStand,
  fillStreak,
  fillWelcome,
  missionQuota,
  readKidScripts,
  reviewMonthsFromProgress,
  readTrainingAnswer,
  rememberScript,
  rememberTraining,
  selectCommanderScripts,
  standPlaceCards,
  trainByGrade,
} from '../../src/lib/commanderScripts.js'

function memory() {
  const box = new Map()
  return {
    getItem: (key) => (box.has(key) ? box.get(key) : null),
    setItem: (key, value) => { box.set(key, String(value)) },
  }
}

test('welcome uses the child\'s name and the official wording', () => {
  const text = fillWelcome('Mushky')
  assert.match(text, /^Welcome, Mushky\n\nI'm so glad you're here\./)
  assert.match(text, /Every kapitel of Tehillim you say matters\./)
  assert.match(text, /Would you like to start training toward saying the entire Tehillim each Shabbos Mevorchim\?$/)
  assert.equal(text.includes('['), false)
  assert.equal(text.includes('soldier'), false)
})

test('welcome skips the name line when the name is missing', () => {
  const text = fillWelcome('  ')
  assert.equal(text.startsWith("I'm so glad you're here."), true)
  assert.equal(text.includes('Welcome,'), false)
})

test('choosing a ladder is the official script, with no invented ladder', () => {
  assert.match(CHOOSING_SCRIPT, /^That's wonderful, soldier!/)
  assert.match(CHOOSING_SCRIPT, /Tap SEE FULL BREAKDOWN/)
  assert.match(CHOOSING_SCRIPT, /tap PICK THIS LADDER\.$/)
  assert.equal(CHOOSING_SCRIPT.includes('Ladder 8'), false)
})

test('a new-month mission is filled from the ladder table', () => {
  const quota = quotaFor('3', 'Kislev', 12)
  const fromTable = missionQuota('3', 'Kislev', 12)
  assert.equal(fromTable.kapitlach, quota.v)
  assert.equal(fromTable.minutes, quota.m)
  assert.equal(trainByGrade(12), '12th grade')
  const text = fillMission({
    name: 'Mushky',
    ladder: 12,
    gradeLabel: trainByGrade(12),
    kapitlach: fromTable.kapitlach,
    minutes: fromTable.minutes,
  })
  assert.match(text, /^Hi Mushky, I'm your virtual commander!/)
  assert.match(text, /New month, new mission!/)
  assert.match(text, /You've chosen Ladder 12\. That means you're training toward saying the entire Tehillim by 12th grade\./)
  assert.match(text, new RegExp(`Your mission for this coming Shabbos Mevorchim is ${quota.v} kapitlach, about ${quota.m} minutes\\.`))
  assert.match(text, /Under KAPITLACH I SAID/)
  assert.match(text, /Then tap SAVE\./)
})

test('a mission sentence is skipped when its number is missing', () => {
  const noQuota = fillMission({ name: 'Dovi', ladder: 8, gradeLabel: '8th grade' })
  assert.match(noQuota, /You've chosen Ladder 8\. That means you're training toward saying the entire Tehillim by 8th grade\./)
  assert.equal(noQuota.includes('Your mission for this coming'), false)
  const noLadder = fillMission({ name: 'Dovi', kapitlach: 5, minutes: 25 })
  assert.equal(noLadder.includes("You've chosen Ladder"), false)
  assert.equal(noLadder.includes('That means you\'re training'), false)
  assert.match(noLadder, /is 5 kapitlach, about 25 minutes/)
  const noName = fillMission({ ladder: 9, gradeLabel: trainByGrade(9), kapitlach: 4, minutes: 20 })
  assert.equal(noName.includes('Hi '), false)
  assert.match(noName, /by 9th grade/)
})

test('where you stand cards use live ranks in full sentences, each in its own scope', () => {
  const cards = standPlaceCards({
    schoolRank: 23,
    totalSchools: 75,
    classRank: 4,
    totalClasses: 47,
    myRankInClass: 1,
    classSize: 12,
    myRankInSchool: 8,
    schoolSize: 581,
  })
  assert.deepEqual(cards.map((card) => card.text), [
    'Your school is #23 of 75 Bases in the world.',
    'Your platoon is #4 of 47 platoons in your base.',
    'You are #8 of 581 Chayolim in your Base.',
  ])
  assert.deepEqual(cards.map((card) => card.icon), ['school', 'platoon', 'hat'])
  assert.equal(cards.some((card) => card.text.includes('plattons')), false)

  const soldier = standPlaceCards({
    schoolRank: 2,
    totalSchools: 10,
    classRank: 3,
    totalClasses: 9,
    myRankInClass: 8,
    classSize: 581,
    myRankInSchool: 0,
    schoolSize: 0,
  })
  assert.deepEqual(soldier.map((card) => card.key), ['school', 'platoon'])

  assert.deepEqual(standPlaceCards({
    myRankInSchool: 1200,
    schoolSize: 3400,
  }).map((card) => card.text), [
    'You are #1,200 of 3,400 Chayolim in your Base.',
  ])
  assert.deepEqual(standPlaceCards(null), [])
})

test('where you stand uses only the ranks that exist, and perfect platoon only when earned', () => {
  const full = fillStand({
    baseRank: 2, baseTotal: 6, platoonRank: 1, platoonTotal: 4, soldierRank: 3, soldierTotal: 40, perfect: false,
  })
  assert.match(full, /your base came number 2 out of 6 bases around the world/)
  assert.match(full, /Your platoon came number 1 out of 4 platoons in your base/)
  assert.match(full, /you came number 3 out of 40 chayolim in your Base!/)
  assert.equal(full.includes('PERFECT PLATOON'), false)

  const partial = fillStand({ baseRank: 1, baseTotal: 6, perfect: true })
  assert.match(partial, /number 1 out of 6 bases/)
  assert.equal(partial.includes('platoon came'), false)
  assert.equal(partial.includes('chayolim'), false)
  assert.match(partial, /You've also earned PERFECT PLATOON!/)

  assert.equal(fillStand({ perfect: false }), null)
  assert.equal(fillStand({}), null)
})

test('ties on a leaderboard share a rank and the next place skips', () => {
  const rows = [
    { id: 'a', name: 'Amy', pct: 80, said: 10 },
    { id: 'b', name: 'Bea', pct: 80, said: 10 },
    { id: 'c', name: 'Cal', pct: 70, said: 99 },
  ]
  const score = (row) => [row.pct, row.said]
  assert.deepEqual(placeAmong(rows, score, (row) => row.id, 'b'), { rank: 1, total: 3, tied: true })
  assert.deepEqual(placeAmong(rows, score, (row) => row.id, 'a'), { rank: 1, total: 3, tied: true })
  assert.deepEqual(placeAmong(rows, score, (row) => row.id, 'c'), { rank: 3, total: 3, tied: false })
  assert.equal(placeAmong(rows, score, (row) => row.id, 'missing'), null)
})

test('the review walks last month and the month before with the real numbers', () => {
  const text = fillReview([
    { month: 'Tishrei', kapitlach: 7, minutes: 30, quotaKapitlach: 7, quotaMinutes: 30, met: true, reported: true },
    { month: 'Cheshvan', kapitlach: 4, minutes: 10, quotaKapitlach: 11, quotaMinutes: 40, met: false, reported: true },
  ])
  assert.match(text, /^Let's take a look at what you did last month and the month before\./)
  assert.match(text, /The month before was Tishrei\. You said 7 kapitlach in 30 minutes\. Your quota was 7 kapitlach, about 30 minutes\. You met your quota\./)
  assert.match(text, /Last month was Cheshvan\. You said 4 kapitlach in 10 minutes\. Your quota was 11 kapitlach, about 40 minutes\. You did not meet your quota\./)
  assert.match(text, /Keep going, one mission at a time\.$/)
  assert.equal(text.includes('['), false)

  const quiet = fillReview([
    { month: 'Kislev', reported: false, quotaKapitlach: 12, quotaMinutes: 40, met: false },
  ])
  assert.match(quiet, /Last month was Kislev\. You have not reported what you said yet\./)
  assert.equal(quiet.includes('You said'), false)
  assert.equal(fillReview([]), null)
  assert.equal(fillReview(null), null)

  const fromProgress = reviewMonthsFromProgress({
    months: [
      { month: 'Tishrei', said: 5, saidMinutes: 20, quota: 5, minutes: 25, met: true, reported: true, isCurrent: false },
      { month: 'Cheshvan', said: 1, saidMinutes: 4, quota: 8, minutes: 30, met: false, reported: true, isCurrent: false },
      { month: 'Kislev', said: 9, saidMinutes: 40, quota: 9, minutes: 32, met: true, reported: true, isCurrent: true },
      { month: 'Rosh Hashana', said: 9, saidMinutes: 40, quota: 9, minutes: 32, met: true, holiday: true },
    ],
  })
  assert.deepEqual(fromProgress.map((row) => row.month), ['Tishrei', 'Cheshvan'])
  assert.equal(fromProgress[1].kapitlach, 1)
  assert.equal(fromProgress[1].minutes, 4)
  assert.equal(fromProgress[1].met, false)
})

test('the review is part of the automatic guidance once the numbers are real', () => {
  const withReview = {
    name: 'Dovi',
    ladder: 8,
    gradeLabel: '8th grade',
    quota: { kapitlach: 14, minutes: 40 },
    heard: {},
    resultsReady: false,
    streakCurrent: null,
    reviewMonths: [
      { month: 'Tishrei', kapitlach: 5, minutes: 20, quotaKapitlach: 5, quotaMinutes: 25, met: true, reported: true },
    ],
  }
  assert.deepEqual(selectCommanderScripts(withReview).map((item) => item.id), ['mission', 'review'])
  const store = memory()
  rememberScript(store, 's8', 'Kislev', 'review')
  const heard = readKidScripts(store, 's8', 'Kislev')
  assert.equal(heard.heard.review, true)
  assert.equal(selectCommanderScripts({ ...withReview, heard: heard.heard }).some((item) => item.id === 'review'), false)
  const next = readKidScripts(store, 's8', 'Teves')
  assert.equal(next.heard.review, false)
})

test('a streak uses the real counts, and zero uses the no-streak script', () => {
  const going = fillStreak({ current: 4, longest: 9 })
  assert.match(going, /You've completed 4 missions in a row/)
  assert.match(going, /Your longest streak so far is 9 missions/)
  const noBest = fillStreak({ current: 2, longest: null })
  assert.match(noBest, /completed 2 missions/)
  assert.equal(noBest.includes('longest'), false)
  const none = fillStreak({ current: 0, longest: 6 })
  assert.match(none, /^Your first streak is waiting to begin!/)
  assert.equal(none.includes('in a row'), false)
  assert.equal(none.includes('6'), false)
  assert.equal(fillStreak({}), null)
  assert.equal(fillStreak({ current: null, longest: 3 }), null)
})

test('each script is chosen once for its moment, per child per month', () => {
  const store = memory()
  const fresh = {
    name: 'Mushky',
    ladder: null,
    heard: readKidScripts(store, 's1', 'Kislev').heard,
    training: null,
    cardsOnScreen: false,
  }
  assert.deepEqual(selectCommanderScripts(fresh).map((item) => item.id), ['welcome'])

  rememberScript(store, 's1', 'Kislev', 'welcome')
  const heardWelcome = readKidScripts(store, 's1', 'Kislev')
  assert.deepEqual(selectCommanderScripts({ ...fresh, heard: heardWelcome.heard }).map((item) => item.id), [])

  rememberTraining(store, 's1', 'Kislev', 'yes')
  const saidYes = readKidScripts(store, 's1', 'Kislev')
  assert.deepEqual(
    selectCommanderScripts({ ...fresh, heard: saidYes.heard, training: saidYes.training, cardsOnScreen: false }).map((item) => item.id),
    [],
  )
  assert.deepEqual(
    selectCommanderScripts({ ...fresh, heard: saidYes.heard, training: saidYes.training, cardsOnScreen: true }).map((item) => item.id),
    ['choosing'],
  )

  rememberTraining(store, 's2', 'Kislev', 'no')
  const saidNo = readKidScripts(store, 's2', 'Kislev')
  assert.deepEqual(selectCommanderScripts({ ...fresh, heard: saidNo.heard, training: saidNo.training }).map((item) => item.id), [])
  assert.match(TRAINING_NOT_NOW, /no pressure/i)
  assert.equal(TRAINING_NOT_NOW.includes('you have to'), false)

  const withLadder = {
    name: 'Dovi',
    ladder: 8,
    gradeLabel: '8th grade',
    quota: { kapitlach: 14, minutes: 40 },
    heard: {},
    resultsReady: true,
    stand: { baseRank: 1, baseTotal: 6, platoonRank: 2, platoonTotal: 3, soldierRank: 4, soldierTotal: 20, perfect: false },
    streakCurrent: 3,
    streakLongest: 5,
  }
  assert.deepEqual(selectCommanderScripts(withLadder).map((item) => item.id), ['mission', 'stand', 'streak'])
  assert.deepEqual(
    selectCommanderScripts({ ...withLadder, resultsReady: false }).map((item) => item.id),
    ['mission', 'streak'],
  )
  assert.equal(selectCommanderScripts({ ...withLadder, streakCurrent: 0 })[2].text.includes('waiting to begin'), true)

  rememberScript(store, 's3', 'Cheshvan', 'mission')
  const nextMonth = readKidScripts(store, 's3', 'Kislev')
  assert.equal(nextMonth.heard.mission, false)
  const sameMonth = readKidScripts(store, 's3', 'Cheshvan')
  assert.deepEqual(
    selectCommanderScripts({ ...withLadder, heard: sameMonth.heard, resultsReady: false, streakCurrent: null }).map((item) => item.id),
    [],
  )
})

test('the training track script plays once per kid, only while that board is open', () => {
  assert.match(TRACK_SCRIPT, /^This is your Tehillim training track, soldier\./)
  assert.match(TRACK_SCRIPT, /Each year has missions for Shabbos Mevorchim, Rosh Hashana, and Yom Kippur\./)
  assert.match(TRACK_SCRIPT, /keep saying the entire Tehillim every Shabbos Mevorchim\.$/)
  const store = memory()
  const base = { name: 'Dovi', ladder: 8, heard: {}, streakCurrent: null, resultsReady: false }
  assert.equal(selectCommanderScripts({ ...base, trackOpen: false }).some((item) => item.id === 'track'), false)
  const first = selectCommanderScripts({ ...base, trackOpen: true })
  assert.equal(first.at(-1).id, 'track')
  assert.equal(first.at(-1).text, TRACK_SCRIPT)
  rememberScript(store, 's9', 'Kislev', 'track')
  const later = readKidScripts(store, 's9', 'Tevet')
  assert.equal(later.heard.track, true)
  assert.equal(later.heard.mission, false)
  assert.equal(selectCommanderScripts({ ...base, trackOpen: true, heard: later.heard }).some((item) => item.id === 'track'), false)
})

test('the climb script uses the ladder target grade and plays once per kid', () => {
  const text = fillClimb(trainByGrade(9))
  assert.match(text, /^Now let's look at your climb to the whole Tehillim!/)
  assert.match(text, /until you reach the whole Tehillim by 9th grade\./)
  assert.match(text, /Focus on your next mission\. That's the next step you're working toward!$/)
  const missing = fillClimb(null)
  assert.equal(missing.includes('by '), false)
  assert.match(missing, /until you reach the whole Tehillim\./)
  const store = memory()
  const base = { name: 'Meir', ladder: 9, gradeLabel: '9th grade', heard: {}, streakCurrent: null, resultsReady: false }
  assert.equal(selectCommanderScripts({ ...base, climbOpen: false }).some((item) => item.id === 'climb'), false)
  assert.equal(selectCommanderScripts({ ...base, climbOpen: true }).at(-1).text, fillClimb('9th grade'))
  rememberScript(store, 's4', 'Kislev', 'climb')
  const later = readKidScripts(store, 's4', 'Tevet')
  assert.equal(later.heard.climb, true)
  assert.equal(later.heard.mission, false)
  assert.equal(selectCommanderScripts({ ...base, climbOpen: true, heard: later.heard }).some((item) => item.id === 'climb'), false)
})

test('a spoken yes or no is the welcome answer, and Hebrew words keep their speech forms', () => {
  assert.equal(readTrainingAnswer('Yes'), 'yes')
  assert.equal(readTrainingAnswer('Yeah, I want to'), 'yes')
  assert.equal(readTrainingAnswer('Start training'), 'yes')
  assert.equal(readTrainingAnswer('Not now'), 'no')
  assert.equal(readTrainingAnswer('no thanks'), 'no')
  assert.equal(readTrainingAnswer('How does it work?'), null)

  const spoken = spokenText('Say a kapitel of Tehillim. The chayolim said kapitlach on Shabbos Mevorchim.')
  assert.match(spoken, /kahpeetel/)
  assert.match(spoken, /tuhhillim/)
  assert.match(spoken, /khahyolim/)
  assert.match(spoken, /kahpeetlockh/)
  assert.match(spoken, /Shabbos mehvorkhim/)
  assert.equal(spoken.includes('kapitel'), false)
  assert.equal(fillWelcome('Ada').includes('kapitel'), true)
})
