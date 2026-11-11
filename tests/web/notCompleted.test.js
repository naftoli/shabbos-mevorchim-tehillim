import test from 'node:test'
import assert from 'node:assert/strict'
import './harness.mjs'
import { quotaFor } from '../../src/data/ladders.js'
import { ROSTER, CURRENT_MONTH } from '../../src/data/demo.js'
import {
  FINISH_TITLE,
  SUBMIT_TITLE,
  kidFinishStatus,
  notDoneHeading,
  notDoneView,
  splitIncompleteNames,
  stillNeedPhrase,
} from '../../src/lib/notCompleted.js'

test('status matches the Wednesday rule', () => {
  assert.equal(kidFinishStatus(0, 10), 'missing')
  assert.equal(kidFinishStatus(0, 0), 'missing')
  assert.equal(kidFinishStatus(5, 0), 'under')
  assert.equal(kidFinishStatus(4, 10), 'under')
  assert.equal(kidFinishStatus(0.5, 10), 'under')
  assert.equal(kidFinishStatus(10, 10), 'full')
  assert.equal(kidFinishStatus(12, 10), 'full')
})

test('phrases use finish and submit, with a singular verb for one child', () => {
  assert.equal(stillNeedPhrase(1, 'finish'), '1 still needs to finish')
  assert.equal(stillNeedPhrase(2, 'finish'), '2 still need to finish')
  assert.equal(stillNeedPhrase(1, 'submit'), '1 still needs to submit')
  assert.equal(stillNeedPhrase(3, 'submit'), '3 still need to submit')
  assert.equal(FINISH_TITLE, 'Who still needs to finish')
  assert.equal(SUBMIT_TITLE, 'Who still needs to submit')
  assert.equal(notDoneHeading('Cheshvan'), 'Not done yet — Cheshvan')
})

test('the divided list puts finish before submit and keeps the class name separate from the count', () => {
  const view = notDoneView([
    { classId: 'a', className: '1', size: 8, missing: ['Short', 'Zero'], under: ['Short'], notFilled: ['Zero'] },
    { classId: 'b', className: 'כיתה א', size: 25, missing: ['None Reported'], under: [], notFilled: ['None Reported'] },
  ])
  assert.equal(view.summary, '1 still needs to finish, 2 still need to submit')
  assert.deepEqual(view.sections.map((s) => s.title), [FINISH_TITLE, SUBMIT_TITLE])
  assert.equal(view.sections[0].classes.length, 1)
  assert.equal(view.sections[0].classes[0].className, '1')
  assert.equal(view.sections[0].classes[0].phrase, '1 still needs to finish')
  assert.deepEqual(view.sections[0].classes[0].names, ['Short'])
  assert.deepEqual(view.sections[1].classes.map((c) => c.className), ['1', 'כיתה א'])
  assert.equal(view.sections[1].classes[0].phrase, '1 still needs to submit')
  assert.equal(view.sections[1].classes[1].phrase, '1 still needs to submit')
  assert.equal(view.sections[1].classes[1].size, 25)
})

test('an older response with only missing is listed under submit', () => {
  const view = notDoneView([{ classId: 1, className: '5A', size: 10, missing: ['Dovid'] }])
  assert.equal(view.sections[0].classes.length, 0)
  assert.deepEqual(view.sections[1].classes[0].names, ['Dovid'])
  assert.equal(view.sections[1].phrase, '1 still needs to submit')
})

test('sample cheder shows both groups for the numeric class and the Hebrew class', () => {
  const school = ROSTER.find((s) => s.id === 'sample-cheder')
  const classes = school.classes.map((cls) => {
    const kids = cls.kids.map((k) => {
      const q = quotaFor(k.grade, CURRENT_MONTH, k.ladder)
      return { name: k.name, said: k.reports?.[CURRENT_MONTH] ?? 0, quota: q?.v ?? 0 }
    })
    return { classId: cls.id, className: cls.name, size: cls.kids.length, ...splitIncompleteNames(kids) }
  })
  const view = notDoneView(classes)
  assert.deepEqual(view.sections[0].classes.map((c) => c.className), ['1', 'כיתה א'])
  assert.deepEqual(view.sections[1].classes.map((c) => c.className), ['1', 'כיתה א'])
  assert.equal(view.sections[0].classes[0].phrase, '1 still needs to finish')
  assert.equal(view.sections[0].classes[0].size, 4)
  assert.equal(view.sections[1].classes[0].phrase, '1 still needs to submit')
  assert.equal(view.sections[0].classes[1].phrase, '1 still needs to finish')
  assert.equal(view.sections[1].classes[1].phrase, '1 still needs to submit')
  assert.equal(view.summary, '2 still need to finish, 2 still need to submit')
  for (const section of view.sections) {
    for (const cls of section.classes) {
      assert.equal(cls.phrase.includes(' of '), false)
    }
  }
})
