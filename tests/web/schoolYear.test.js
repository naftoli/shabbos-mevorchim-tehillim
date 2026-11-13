import test from 'node:test'
import assert from 'node:assert/strict'
import { campaignMonths } from '../../src/lib/hebrewYear.js'
import { quotaFor } from '../../src/data/ladders.js'
import { earliestMedalWhen } from '../../src/lib/medalWhen.js'
import {
  DEFAULT_FIRST_MONTH,
  elapsedSchoolYearSlots,
  gradeEndMonth,
  gradeEndSheetMonth,
  firstMonthFromRow,
  quotaForSchool,
  quotaSheetMonth,
  schoolYearMonthNames,
  schoolYearSlots,
  schoolYearStartYear,
} from '../../src/lib/schoolYear.js'

const PLAIN = ['Tishrei', 'Cheshvan', 'Kislev', 'Teves', 'Shvat', 'Adar', 'Nissan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul']
const SHVAT_YEAR = ['Shvat', 'Adar', 'Nissan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul', 'Tishrei', 'Cheshvan', 'Kislev', 'Teves']

test('Tishrei is the default and leaves the campaign months unchanged', () => {
  assert.equal(DEFAULT_FIRST_MONTH, 'Tishrei')
  assert.deepEqual(schoolYearMonthNames('Tishrei', 5785, 'Cheshvan'), campaignMonths(5785))
  assert.deepEqual(schoolYearMonthNames('Tishrei', 5787, 'Shvat'), campaignMonths(5787))
  assert.equal(gradeEndMonth('Tishrei'), 'Elul')
  assert.equal(gradeEndSheetMonth('Tishrei'), 'Elul')
  for (const month of PLAIN) {
    assert.equal(quotaSheetMonth(month, 'Tishrei'), month)
    assert.equal(quotaForSchool('4', month, 8, 'Tishrei')?.v, quotaFor('4', month, 8)?.v)
  }
  assert.equal(quotaSheetMonth('Adar I', 'Tishrei'), 'Adar')
  assert.equal(quotaSheetMonth('Adar II', 'Tishrei'), 'Adar')
  assert.deepEqual(quotaForSchool('3', 'Adar I', 8, 'Tishrei'), quotaFor('3', 'Adar', 8))
})

test('a school with no settings row starts in Tishrei', () => {
  for (const missing of [null, undefined, '', {}, { first_month: null }, { firstMonth: '' }, { yearStart: undefined }]) {
    assert.equal(firstMonthFromRow(missing), 'Tishrei')
  }
  const month = firstMonthFromRow(null)
  assert.deepEqual(schoolYearMonthNames(month, 5785, 'Cheshvan'), campaignMonths(5785))
  assert.deepEqual(schoolYearSlots(month, 5787).map((slot) => slot.month), campaignMonths(5787))
  assert.equal(gradeEndMonth(month), 'Elul')
  assert.equal(quotaSheetMonth('Cheshvan', month), 'Cheshvan')
  assert.equal(firstMonthFromRow({ first_month: 'Shvat' }), 'Shvat')
  assert.equal(firstMonthFromRow({ yearStart: 'Nissan' }), 'Nissan')
})

test('a Tishrei school year stays inside one Hebrew year, including a leap year', () => {
  const plain = schoolYearSlots('Tishrei', 5785)
  const leap = schoolYearSlots('Tishrei', 5787)
  assert.deepEqual(plain.map((slot) => slot.month), campaignMonths(5785))
  assert.deepEqual(leap.map((slot) => slot.month), campaignMonths(5787))
  assert.ok(plain.every((slot) => slot.year === 5785))
  assert.ok(leap.every((slot) => slot.year === 5787))
  const adarI = leap.find((slot) => slot.month === 'Adar I')
  const adarII = leap.find((slot) => slot.month === 'Adar II')
  assert.equal(adarI.sheetMonth, 'Adar')
  assert.equal(adarII.sheetMonth, 'Adar')
  assert.equal(adarI.position, adarII.position)
})

test('Mevorchim of the picked month is position 1', () => {
  // Shvat means the first Shabbos Mevorchim is Mevorchim Shvat (held in Teves).
  const slots = schoolYearSlots('Shvat', 5786)
  assert.equal(slots[0].month, 'Shvat')
  assert.equal(slots[0].position, 1)
  assert.equal(slots[0].sheetMonth, 'Tishrei')
  assert.deepEqual(slots.map((slot) => slot.month), SHVAT_YEAR)
  assert.equal(gradeEndMonth('Shvat'), 'Teves')
  assert.equal(slots[slots.length - 1].month, 'Teves')
  assert.equal(slots[slots.length - 1].sheetMonth, 'Elul')
  assert.equal(gradeEndSheetMonth('Shvat'), 'Elul')
})

test('a Shvat school uses the Tishrei quota cell in Shvat and the Elul cell in Teves', () => {
  assert.equal(quotaSheetMonth('Shvat', 'Shvat'), 'Tishrei')
  assert.equal(quotaSheetMonth('Adar', 'Shvat'), 'Cheshvan')
  assert.equal(quotaSheetMonth('Adar I', 'Shvat'), 'Cheshvan')
  assert.equal(quotaSheetMonth('Adar II', 'Shvat'), 'Cheshvan')
  assert.equal(quotaSheetMonth('Teves', 'Shvat'), 'Elul')
  assert.equal(quotaSheetMonth('Cheshvan', 'Shvat'), 'Tammuz')
  const shvat = quotaForSchool('5', 'Shvat', 9, 'Shvat')
  const teves = quotaForSchool('5', 'Teves', 9, 'Shvat')
  assert.deepEqual(shvat, quotaFor('5', 'Tishrei', 9))
  assert.deepEqual(teves, quotaFor('5', 'Elul', 9))
  assert.notEqual(shvat.v, quotaFor('5', 'Shvat', 9).v)
})

test('a Shvat school year crosses Rosh Hashana and keeps the Adar of the year it starts in', () => {
  // Cheshvan 5787 is before Shvat, so the grade year started in Shvat 5786.
  assert.equal(schoolYearStartYear('Shvat', 5787, 'Cheshvan'), 5786)
  assert.equal(schoolYearStartYear('Shvat', 5787, 'Shvat'), 5787)
  assert.equal(schoolYearStartYear('Tishrei', 5787, 'Cheshvan'), 5787)
  const slots = schoolYearSlots('Shvat', 5786)
  assert.equal(slots[0].year, 5786)
  assert.equal(slots.find((slot) => slot.month === 'Elul').year, 5786)
  assert.equal(slots.find((slot) => slot.month === 'Tishrei').year, 5787)
  assert.equal(slots.find((slot) => slot.month === 'Teves').year, 5787)
  // 5786 is not a leap year, so this grade year has one Adar.
  assert.equal(slots.some((slot) => slot.month === 'Adar I'), false)
  assert.equal(slots.find((slot) => slot.month === 'Adar').sheetMonth, 'Cheshvan')
  const elapsed = elapsedSchoolYearSlots('Shvat', 5787, 'Cheshvan')
  assert.equal(elapsed[0].month, 'Shvat')
  assert.equal(elapsed[elapsed.length - 1].month, 'Cheshvan')
  assert.equal(elapsed[elapsed.length - 1].sheetMonth, 'Tammuz')
})

test('a Shvat school that starts in a leap year lists Adar I then Adar II on the Cheshvan quota cell', () => {
  const slots = schoolYearSlots('Shvat', 5787)
  assert.deepEqual(
    slots.slice(0, 4).map((slot) => slot.month),
    ['Shvat', 'Adar I', 'Adar II', 'Nissan'],
  )
  const adars = slots.filter((slot) => slot.month.startsWith('Adar'))
  assert.equal(adars.length, 2)
  assert.ok(adars.every((slot) => slot.sheetMonth === 'Cheshvan' && slot.position === 2 && slot.year === 5787))
  assert.deepEqual(quotaForSchool('3', 'Adar I', 8, 'Shvat'), quotaFor('3', 'Cheshvan', 8))
  assert.deepEqual(quotaForSchool('3', 'Adar II', 8, 'Shvat'), quotaFor('3', 'Cheshvan', 8))
})

test('medal timing for a Tishrei school is unchanged', () => {
  assert.equal(earliestMedalWhen(1, 'Shvat', 5787), 'Shvat 5787')
  assert.equal(earliestMedalWhen(2, 'Shvat', 5787), 'Adar I 5787')
  assert.equal(earliestMedalWhen(3, 'Shvat', 5787), 'Adar II 5787')
  assert.equal(earliestMedalWhen(4, 'Shvat', 5787), 'Nissan 5787')
  assert.equal(earliestMedalWhen(3, 'Shvat', 5785), 'Nissan 5785')
  assert.equal(earliestMedalWhen(2, 'Adar', 5785), 'Nissan 5785')
  assert.equal(earliestMedalWhen(2, 'Elul', 5785), 'Tishrei 5786')
})

test('medal timing for a Shvat school starts at Mevorchim Shvat and ends the grade in Teves', () => {
  assert.equal(earliestMedalWhen(1, 'Shvat', 5787, 'Shvat'), 'Shvat 5787')
  assert.equal(earliestMedalWhen(2, 'Shvat', 5787, 'Shvat'), 'Adar I 5787')
  assert.equal(earliestMedalWhen(3, 'Shvat', 5787, 'Shvat'), 'Adar II 5787')
  assert.equal(earliestMedalWhen(4, 'Shvat', 5787, 'Shvat'), 'Nissan 5787')
  // Teves closes the grade. The next mission is Mevorchim Shvat of the next grade year.
  assert.equal(earliestMedalWhen(1, 'Teves', 5787, 'Shvat'), 'Teves 5787')
  assert.equal(earliestMedalWhen(2, 'Teves', 5787, 'Shvat'), 'Shvat 5787')
  assert.equal(earliestMedalWhen(2, 'Shvat', 5785, 'Shvat'), 'Adar 5785')
})
