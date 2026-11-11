import test from 'node:test'
import assert from 'node:assert/strict'
import { GRADES, LADDERS, MONTHS, quotaFor } from '../../src/data/ladders.js'
import { metKap } from '../../src/lib/quotaOverride.js'
import { streakFromMissions } from '../../src/lib/streaks.js'
import {
  KAPITEL_ABOVE_TEHILLIM_DISPLAY,
  cellFor,
  formatKapitlachQuota,
  generateCustomLadder,
  ladderProblems,
  minutesForKapitlach,
  resolveQuota,
} from '../../src/lib/customLadder.js'

const gradeIndex = (grade) => (grade === 'pre1a' ? 0 : Number(grade))

test('a target of 150 at an existing finish grade reproduces that ladder', () => {
  for (const ladder of LADDERS) {
    const grid = generateCustomLadder({ targetKapitlach: 150, finishGrade: ladder })
    assert.equal(ladderProblems(grid).length, 0, `ladder ${ladder} climbs without dropping`)
    for (const grade of GRADES) {
      if (gradeIndex(grade) > ladder) continue
      for (const month of MONTHS) {
        const got = cellFor(grid, grade, month)
        const expected = quotaFor(grade, month, ladder)
        assert.equal(got.v, expected.v, `L${ladder} ${grade} ${month} kapitlach`)
        assert.equal(got.m, expected.m, `L${ladder} ${grade} ${month} minutes`)
        assert.equal(got.h || 0, expected.h || 0)
      }
    }
  }
})

test('the same ladder is reproduced when the anchor already matches that cell', () => {
  const plain = generateCustomLadder({ targetKapitlach: 150, finishGrade: 8 })
  const anchored = generateCustomLadder({
    targetKapitlach: 150,
    finishGrade: 8,
    anchor: { grade: '7', month: 'Teves', kapitlach: 118.5, minutes: 120 },
  })
  assert.equal(cellFor(anchored, '7', 'Teves').v, 118.5)
  assert.equal(cellFor(anchored, '4', 'Tishrei').v, cellFor(plain, '4', 'Tishrei').v)
  assert.equal(anchored.anchored, false)
})

test('a higher target scales the ladder and does not cap at 150', () => {
  const grid = generateCustomLadder({ targetKapitlach: 300, finishGrade: 8 })
  assert.equal(cellFor(grid, '8', 'Elul').v, 300)
  assert.equal(cellFor(grid, '4', 'Tishrei').v, 108)
  assert.equal(cellFor(grid, '4', 'Tishrei').m, minutesForKapitlach(108))
  assert.equal(ladderProblems(grid).length, 0)
  const shown = formatKapitlachQuota(300)
  assert.equal(shown.label, '2 Tehillim')
  assert.equal(shown.plain, '300')
  assert.equal(shown.overTehillim, true)
})

test('minutes follow the ladder table and keep climbing past 150', () => {
  assert.equal(minutesForKapitlach(54), 90)
  assert.equal(minutesForKapitlach(150), 120)
  // Last real climb in the table, extended past the flat 120-minute cap.
  assert.equal(minutesForKapitlach(190), 187)
  assert.equal(minutesForKapitlach(300), 370)
  assert.equal(KAPITEL_ABOVE_TEHILLIM_DISPLAY, 'tehillim-plus-count')
  assert.equal(formatKapitlachQuota(190).label, '1 Tehillim + 40 kapitlach')
  assert.equal(formatKapitlachQuota(151).label, '1 Tehillim + 1 kapitel')
  assert.equal(formatKapitlachQuota(40).label, 'א-מ')
})

test('a finish after 12th grade shifts the slowest ladder', () => {
  const grid = generateCustomLadder({ targetKapitlach: 150, finishGrade: 13 })
  const shifted = quotaFor('11', 'Tishrei', 12)
  assert.equal(cellFor(grid, '12', 'Tishrei').v, shifted.v)
  assert.equal(cellFor(grid, '12', 'Tishrei').m, shifted.m)
  assert.equal(cellFor(grid, '13', 'Elul').v, 150)
  // One year before the slowest known start stays at 1 kapitel.
  assert.equal(cellFor(grid, 'pre1a', 'Nissan').v, 1)
  assert.equal(cellFor(grid, 'pre1a', 'Nissan').m, 10)
})

test('the climb never drops below the quota the soldier has now', () => {
  const grid = generateCustomLadder({
    targetKapitlach: 150,
    finishGrade: 12,
    anchor: { grade: '6', month: 'Cheshvan', kapitlach: 200, minutes: 130 },
  })
  assert.equal(grid.anchored, true)
  assert.ok(cellFor(grid, '6', 'Cheshvan').v >= 200)
  assert.ok(cellFor(grid, '6', 'Elul').v >= 200)
  assert.equal(cellFor(grid, '12', 'Elul').v, 200)
  const untouched = generateCustomLadder({ targetKapitlach: 150, finishGrade: 12 })
  assert.equal(cellFor(grid, '5', 'Elul').v, cellFor(untouched, '5', 'Elul').v)
  assert.equal(ladderProblems(grid).length, 0)
})

test('a one-month override wins; the custom ladder still sets the minutes', () => {
  const custom = { v: 40, m: 80 }
  const both = resolveQuota({
    engineKap: 90,
    engineMin: 100,
    customCell: custom,
    override: { overriddenQuota: 12, originalQuota: 40, undoneAt: null },
  })
  assert.equal(both.quota, 12)
  assert.equal(both.quotaAdjusted, true)
  assert.equal(both.minutes, 80)
  assert.equal(metKap(both.quota, 12, true), true)

  const onlyCustom = resolveQuota({ engineKap: 90, engineMin: 100, customCell: custom, override: null })
  assert.equal(onlyCustom.quota, 40)
  assert.equal(onlyCustom.minutes, 80)
  assert.equal(onlyCustom.customLadder, true)

  const months = [
    { met: metKap(onlyCustom.quota, 40, true), record: true },
    { met: metKap(both.quota, 12, true), record: true },
  ]
  assert.equal(streakFromMissions(months).current, 2)
})
