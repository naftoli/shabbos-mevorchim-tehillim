import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

test('the streak flame is the cropped artwork at its real proportions', () => {
  const jsx = readFileSync(new URL('../../src/components/StreakBar.jsx', import.meta.url), 'utf8')
  const file = readFileSync(new URL('../../public/design/icon-streak-flame.webp', import.meta.url))
  assert.match(jsx, /design\/icon-streak-flame\.webp/)
  assert.equal(jsx.includes('M32 4c8'), false)
  assert.equal(file.toString('ascii', 0, 4), 'RIFF')
  assert.equal(file.toString('ascii', 8, 12), 'WEBP')
  assert.equal(file[20], 0x2f)
  const bits = file.readUInt32LE(21)
  const width = (bits & 0x3fff) + 1
  const height = ((bits >> 14) & 0x3fff) + 1
  assert.equal(width, 292)
  assert.equal(height, 314)
  assert.equal((bits >> 28) & 1, 1)
  assert.match(jsx, /FLAME_WIDTH = 292/)
  assert.match(jsx, /FLAME_HEIGHT = 314/)
  assert.match(jsx, /\$\{FLAME_WIDTH\} \/ \$\{FLAME_HEIGHT\}/)
})

test('streak copy is the two approved paragraphs', () => {
  assert.deepEqual(STREAK_COPY, [
    "Your current streak shows how many missions you've completed in a row. Complete your next mission to keep it growing!",
    "Your longest streak is your best run so far. Even if you miss a mission and start a new streak, your best record stays.",
  ])
})
