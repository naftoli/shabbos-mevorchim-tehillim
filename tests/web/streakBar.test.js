import test from 'node:test'
import assert from 'node:assert/strict'
import { STREAK_BAR_STEPS, STREAK_COPY, streakBarModel } from '../../src/lib/streakBar.js'

test('the streak picture follows the real count and stops at six steps', () => {
  assert.deepEqual(streakBarModel(0), { current: 0, active: null, fill: 0, overflow: false })
  assert.deepEqual(streakBarModel(1), { current: 1, active: 1, fill: 1 / STREAK_BAR_STEPS, overflow: false })
  assert.deepEqual(streakBarModel(2), { current: 2, active: 2, fill: 2 / STREAK_BAR_STEPS, overflow: false })
  assert.deepEqual(streakBarModel(6), { current: 6, active: 6, fill: 1, overflow: false })
  const over = streakBarModel(8)
  assert.equal(over.current, 8)
  assert.equal(over.active, null)
  assert.equal(over.fill, 1)
  assert.equal(over.overflow, true)
  assert.equal(streakBarModel(2).active === 4, false)
})

test('streak copy is the two approved paragraphs', () => {
  assert.deepEqual(STREAK_COPY, [
    "Your current streak shows how many missions you've completed in a row. Complete your next mission to keep it growing!",
    "Your longest streak is your best run so far. Even if you miss a mission and start a new streak, your best record stays.",
  ])
})
