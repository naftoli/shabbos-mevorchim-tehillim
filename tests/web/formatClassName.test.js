import test from 'node:test'
import assert from 'node:assert/strict'
import { displayClassName, formatClassName } from '../../src/lib/formatClassName.js'
import { platoonKey } from '../../src/lib/perfectPlatoons.js'
import { ROSTER } from '../../src/data/demo.js'

const FSI = '\u2068'
const PDI = '\u2069'

test('a leading grade number drops and the grade letter stays', () => {
  assert.equal(formatClassName('1 Aleph Aleph'), 'Aleph Aleph')
  assert.equal(formatClassName('1 Aleph Bet'), 'Aleph Bet')
  assert.equal(formatClassName('2 Bet Bet'), 'Bet Bet')
  assert.equal(formatClassName('2 Bet Gimmel'), 'Bet Gimmel')
  assert.equal(formatClassName('8 Ches Yud'), 'Ches Yud')
})

test('spellings and Hebrew letters are case-insensitive and keep their own marks', () => {
  assert.equal(formatClassName('1 alef Aleph'), 'alef Aleph')
  assert.equal(formatClassName('2 BEIS Bet'), 'BEIS Bet')
  assert.equal(formatClassName('2 bais Gimmel'), 'bais Gimmel')
  assert.equal(formatClassName('3 Gimel Dalet'), 'Gimel Dalet')
  assert.equal(formatClassName('4 Daled Hei'), 'Daled Hei')
  assert.equal(formatClassName('5 Hey Vav'), 'Hey Vav')
  assert.equal(formatClassName('6 Vav Zayin'), 'Vav Zayin')
  assert.equal(formatClassName('7 Zayin Ches'), 'Zayin Ches')
  assert.equal(formatClassName('8 Chet Tes'), 'Chet Tes')
  assert.equal(formatClassName('1 א א'), 'א א')
  assert.equal(formatClassName("1 א' ב'"), "א' ב'")
  assert.equal(formatClassName('1 א׳ ב׳'), 'א׳ ב׳')
  assert.equal(formatClassName('2 ב׳ ג'), 'ב׳ ג')
  assert.equal(formatClassName('8 ח ט'), 'ח ט')
})

test('a hyphen between the number and the letter is the same label', () => {
  assert.equal(formatClassName('1 Aleph-Bet'), 'Aleph-Bet')
  assert.equal(formatClassName('1-Aleph-Aleph'), 'Aleph-Aleph')
  assert.equal(formatClassName('2-Bet Bet'), 'Bet Bet')
})

test('Pre-1A, kindergarten, and names that are not that grade stay put', () => {
  assert.equal(formatClassName('Pre-1A'), 'Pre-1A')
  assert.equal(formatClassName('Pre-1A A'), 'Pre-1A A')
  assert.equal(formatClassName('pre1a'), 'pre1a')
  assert.equal(formatClassName('Kindergarten'), 'Kindergarten')
  assert.equal(formatClassName('1st Grade A'), '1st Grade A')
  assert.equal(formatClassName('4-boys'), '4-boys')
  assert.equal(formatClassName('4-Boys'), '4-Boys')
  assert.equal(formatClassName('5-B'), '5-B')
  assert.equal(formatClassName('5A'), '5A')
  assert.equal(formatClassName('1 Boys'), '1 Boys')
  assert.equal(formatClassName('1 Bet Aleph'), '1 Bet Aleph')
  assert.equal(formatClassName('9 Tes Tes'), '9 Tes Tes')
  assert.equal(formatClassName('12 Aleph'), '12 Aleph')
  assert.equal(formatClassName('Aleph Aleph'), 'Aleph Aleph')
  assert.equal(formatClassName(''), '')
  assert.equal(formatClassName(null), '')
})

test('Hebrew labels are isolated in plain text and English labels are not', () => {
  const hebrew = displayClassName('1 א׳ ב׳')
  assert.equal(hebrew, `${FSI}א׳ ב׳${PDI}`)
  assert.equal(displayClassName(hebrew), hebrew)
  assert.equal(displayClassName('1 Aleph Bet'), 'Aleph Bet')
  assert.equal(displayClassName('Pre-1A'), 'Pre-1A')
})

test('shortening a label does not change the platoon key', () => {
  const raw = { schoolId: 61, classId: 401, className: '1 Aleph Aleph' }
  const shown = { ...raw, className: formatClassName(raw.className) }
  assert.equal(shown.className, 'Aleph Aleph')
  assert.equal(platoonKey(raw), platoonKey(shown))
  assert.equal(platoonKey(raw), '61-401')
  const legacy = { schoolId: 61, className: '1 Aleph Bet' }
  assert.equal(platoonKey(legacy), '61-1 Aleph Bet')
})

test('demo roster names shorten only when they match, and sample cheder stays', () => {
  const sample = ROSTER.find((s) => s.id === 'sample-cheder')
  assert.deepEqual(sample.classes.map((c) => formatClassName(c.name)), sample.classes.map((c) => c.name))
  const pairs = []
  for (const school of ROSTER) {
    if (school.id === 'sample-cheder') continue
    for (const cls of school.classes) {
      const after = formatClassName(cls.name)
      if (after !== cls.name) pairs.push([cls.name, after])
    }
  }
  assert.ok(pairs.some(([before, after]) => before === '1 Aleph Aleph' && after === 'Aleph Aleph'))
  assert.ok(pairs.some(([before, after]) => before === '1 Aleph Bet' && after === 'Aleph Bet'))
  assert.ok(pairs.some(([before, after]) => before === '2 Bet Bet' && after === 'Bet Bet'))
  for (const [before, after] of pairs) {
    assert.match(before, /^[1-8] /)
    assert.equal(after.includes(before.slice(0, 2)), false)
  }
})
