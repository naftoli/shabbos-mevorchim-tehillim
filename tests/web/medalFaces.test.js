import test from 'node:test'
import assert from 'node:assert/strict'
import { MEDALS, isPreYearMedalNote, medalFace } from '../../src/lib/medals.js'

test('a medal earned before this year is not shown as a note, in any color', () => {
  const note = 'before this year’s month-by-month record'
  assert.equal(isPreYearMedalNote(note), true)
  assert.equal(isPreYearMedalNote("before this year's month-by-month record"), true)
  for (const medal of MEDALS) {
    assert.equal(isPreYearMedalNote(note), true, medal.name)
  }
  assert.equal(isPreYearMedalNote('Cheshvan 5787'), false)
  assert.equal(isPreYearMedalNote(null), false)
})

test('dashboard coins use the reverse when earned and a pale crest when not', () => {
  const gray = MEDALS.find((m) => m.name === 'Gray')
  const black = MEDALS.find((m) => m.name === 'Black')
  const gold = MEDALS.find((m) => m.name === 'Gold')
  assert.equal(medalFace(gray, true), 'reverse')
  assert.equal(medalFace(black, false), 'pale-front')
  assert.equal(medalFace(gold, false), 'pale-disc')
  assert.equal(medalFace(gold, true), 'color-disc')
  assert.equal(gold.coin, undefined)
})
