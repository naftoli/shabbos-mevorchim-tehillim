import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FIRST_CAMPAIGN_MONTH,
  FIRST_CAMPAIGN_YEAR,
  breakdownMonthNames,
  campaignYearsThrough,
  scaleAmounts,
  scaleMonthRows,
  yearKeepsBothAdars,
} from '../../src/lib/runningTotals.js'

test('the campaign starts at Cheshvan 5778', () => {
  assert.equal(FIRST_CAMPAIGN_YEAR, 5778)
  assert.equal(FIRST_CAMPAIGN_MONTH, 'Cheshvan')
  const first = breakdownMonthNames(5778)
  assert.equal(first[0], 'Cheshvan')
  assert.equal(first.includes('Tishrei'), false)
  assert.equal(first.at(-1), 'Elul')
  assert.equal(first.length, 11)
})

test('a leap year lists Adar I and Adar II, and a plain year lists one Adar', () => {
  assert.equal(yearKeepsBothAdars(5784), true)
  const leap = breakdownMonthNames(5784)
  assert.equal(leap.includes('Adar I'), true)
  assert.equal(leap.includes('Adar II'), true)
  assert.equal(leap.indexOf('Adar II'), leap.indexOf('Adar I') + 1)
  const plain = breakdownMonthNames(5785)
  assert.deepEqual(plain.filter((month) => month.startsWith('Adar')), ['Adar'])
  assert.equal(plain[0], 'Tishrei')
})

test('years run from 5778 through the current year', () => {
  assert.deepEqual(campaignYearsThrough(5780), [5778, 5779, 5780])
  assert.deepEqual(campaignYearsThrough(5777), [])
})

test('scaled month rows add up to the headline and keep both Adars', () => {
  const rows = scaleMonthRows([
    { month: 'Adar I', kapitlach: 10, minutes: 4 },
    { month: 'Adar II', kapitlach: 30, minutes: 6 },
  ], 100)
  assert.equal(rows[0].month, 'Adar I')
  assert.equal(rows[1].month, 'Adar II')
  assert.equal(rows.reduce((sum, row) => sum + row.kapitlach, 0), 100)
  assert.equal(rows[0].minutes > 0 && rows[1].minutes > 0, true)
  assert.deepEqual(scaleAmounts([0, 0, 0], 10).reduce((a, n) => a + n, 0), 10)
})
