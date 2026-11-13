import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { teacherName } from '../../src/lib/teacherName.js'

test('a real teacher is trimmed and kept', () => {
  assert.equal(teacherName('  Rabbi Adler  '), 'Rabbi Adler')
  assert.equal(teacherName('Naomi Fox'), 'Naomi Fox')
  assert.equal(teacherName('10'), '10')
})

test('placeholder teachers count as no teacher', () => {
  for (const value of ['Na', 'na', 'NA', ' N/A ', 'n/a', 'None', 'NONE', ' none ', '-', ' - ', '0', ' 0 ', '', '   ', null, undefined]) {
    assert.equal(teacherName(value), '', JSON.stringify(value))
  }
})

test('class chips and the base report go through the shared helper', () => {
  for (const file of [
    'src/pages/SchoolCampaign.jsx',
    'src/pages/Home.jsx',
    'src/pages/PerfectPlatoons.jsx',
    'src/pages/Reports.jsx',
  ]) {
    const src = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
    assert.match(src, /teacherName\(/, file)
  }
})
