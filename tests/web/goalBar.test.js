import test from 'node:test'
import assert from 'node:assert/strict'
import { goalBarEnd, progressIconBox } from '../../src/lib/goalBar.js'

test('a goal marker stops at the end of the track', () => {
  assert.deepEqual(goalBarEnd(0), { actual: 0, end: 0 })
  assert.deepEqual(goalBarEnd(40), { actual: 40, end: 40 })
  assert.deepEqual(goalBarEnd(100), { actual: 100, end: 100 })
  assert.deepEqual(goalBarEnd(833), { actual: 833, end: 100 })
  assert.deepEqual(goalBarEnd(-4), { actual: 0, end: 0 })
  assert.deepEqual(goalBarEnd('nope'), { actual: 0, end: 0 })
})

test('progress icons keep their real proportions', () => {
  const book = progressIconBox('design/icon-book.webp')
  const clock = progressIconBox('/shabbos-mevorchim-tehillim/design/icon-clock.png')
  const hat = progressIconBox('design/icon-soldier-hat.png')
  assert.equal(book.width / book.height, 420 / 280)
  assert.equal(clock.width / clock.height, 255 / 256)
  assert.equal(hat.width / hat.height, 99 / 71)
  assert.equal(progressIconBox('design/flag.png'), null)
})
