import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MEDALS, isPreYearMedalNote, medalFace } from '../../src/lib/medals.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (path) => readFileSync(join(root, path), 'utf8')

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

test('unearned medals keep a faint trace of their color; earned medals stay full color', () => {
  const css = read('src/index.css')
  const rule = css.match(/\.medal-unearned\s*\{[^}]+\}/)?.[0]
  assert.ok(rule)
  const grayscale = Number(rule.match(/grayscale\(\s*([0-9.]+)\s*\)/)?.[1])
  assert.ok(grayscale >= 0.75 && grayscale <= 0.85, `grayscale ${grayscale} should stay a partial wash`)
  assert.equal(/grayscale\(\s*1(?:\.0+)?\s*\)/.test(rule), false)
  assert.match(rule, /opacity:\s*0\.[0-9]+/)
  assert.match(rule, /brightness\(/)
  assert.match(rule, /saturate\(/)

  const coin = read('src/components/MedalCoin.jsx')
  assert.match(coin, /className="medal-unearned"/)
  assert.match(coin, /className=\{locked \? 'medal-unearned' : ''\}/)
  assert.match(coin, /className="medal-unearned absolute inset-0 rounded-full"/)
  const reverseLine = coin.split('\n').find((line) => line.includes('coin-reverse'))
  assert.match(reverseLine, /design\/coin-reverse-\$\{medal\.coin\}/)
  assert.equal(reverseLine.includes('medal-unearned'), false)
  assert.match(coin, /filter: !locked && active \? 'drop-shadow\(0 0 4px var\(--color-gold\)\)' : undefined/)
  assert.match(coin, /\{medal\.threshold\}/)
  assert.equal(coin.includes('#d5dde8'), false)
  assert.equal(coin.includes('grayscale'), false)
  assert.equal(coin.includes('unearnedDiscBackground'), false)
  assert.match(coin, /radial-gradient\(circle at 34% 28%, rgba\(255,255,255,\.55\), rgba\(255,255,255,0\) 58%\), \$\{medal\.color\}/)
})
