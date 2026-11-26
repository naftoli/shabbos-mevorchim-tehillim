import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compareSoldiers, placeLabel, rankSoldiers } from '../../src/lib/soldierBoard.js'

test('a full tie shares rank 1, gets no medals, and is alphabetical', () => {
  const rows = rankSoldiers([
    { id: '3', name: 'Sholom Ber Goldshmid', saidMonth: 150 },
    { id: '1', name: 'Ari Stell', saidMonth: 150 },
    { id: '2', name: 'Rivka Litvin', saidMonth: 150 },
  ])
  assert.deepEqual(rows.map((r) => r.name), ['Ari Stell', 'Rivka Litvin', 'Sholom Ber Goldshmid'])
  assert.deepEqual(rows.map((r) => r.rank), [1, 1, 1])
  assert.deepEqual(rows.map((r) => r.medal), [null, null, null])
  assert.ok(rows.every((r) => r.tied))
})

test('an untied podium gets gold, silver, and bronze', () => {
  const rows = rankSoldiers([
    { id: 'c', name: 'Cara', saidMonth: 10 },
    { id: 'b', name: 'Bea', saidMonth: 30 },
    { id: 'a', name: 'Amy', saidMonth: 20 },
  ])
  assert.deepEqual(rows.map((r) => [r.name, r.rank, r.medal, r.tied]), [
    ['Bea', 1, 1, false],
    ['Amy', 2, 2, false],
    ['Cara', 3, 3, false],
  ])
  assert.deepEqual(rows.map(placeLabel), ['1st place', '2nd place', '3rd place'])
})

test('a tie for first withholds every medal, and the next scores take the next dense places', () => {
  const rows = rankSoldiers([
    { id: '1', name: 'Moe', saidMonth: 100 },
    { id: '2', name: 'Amy', saidMonth: 100 },
    { id: '3', name: 'Bea', saidMonth: 80 },
    { id: '4', name: 'Cal', saidMonth: 70 },
  ])
  assert.deepEqual(rows.map((r) => [r.name, r.rank, r.medal]), [
    ['Amy', 1, null],
    ['Moe', 1, null],
    ['Bea', 2, null],
    ['Cal', 3, null],
  ])
  assert.deepEqual(rows.map(placeLabel), ['Tied for 1', 'Tied for 1', 'Rank 2', 'Rank 3'])
})

test('a tie for second keeps gold and does not hand out silver or bronze', () => {
  const rows = rankSoldiers([
    { id: '1', name: 'Amy', saidMonth: 100 },
    { id: '2', name: 'Cal', saidMonth: 90 },
    { id: '3', name: 'Bea', saidMonth: 90 },
    { id: '4', name: 'Dee', saidMonth: 80 },
  ])
  assert.deepEqual(rows.map((r) => [r.name, r.rank, r.medal]), [
    ['Amy', 1, 1],
    ['Bea', 2, null],
    ['Cal', 2, null],
    ['Dee', 3, null],
  ])
  assert.deepEqual(rows.map(placeLabel), ['1st place', 'Tied for 2', 'Tied for 2', 'Rank 3'])
})

test('a tie for third keeps gold and silver and withholds bronze', () => {
  const rows = rankSoldiers([
    { id: '1', name: 'Amy', saidMonth: 100 },
    { id: '2', name: 'Bea', saidMonth: 90 },
    { id: '3', name: 'Dee', saidMonth: 80 },
    { id: '4', name: 'Cal', saidMonth: 80 },
  ])
  assert.deepEqual(rows.map((r) => [r.rank, r.medal, r.tied]), [
    [1, 1, false],
    [2, 2, false],
    [3, null, true],
    [3, null, true],
  ])
})

test('name order wins inside a tie, not a higher mission count', () => {
  const rows = rankSoldiers([
    { id: '1', name: 'Zev', saidMonth: 40, missions: 99 },
    { id: '2', name: 'amy', saidMonth: 40, missions: 1 },
  ])
  assert.equal(rows[0].name, 'amy')
  assert.equal(rows[1].name, 'Zev')
})

test('identical names stay in id order', () => {
  const rows = ['s2', 's10', 's1'].map((id) => ({ id, name: 'Chana W.', saidMonth: 74 }))
  assert.deepEqual(rankSoldiers(rows).map((r) => r.id), ['s1', 's10', 's2'])
  assert.deepEqual([...rows].sort(compareSoldiers).map((r) => r.id), ['s1', 's10', 's2'])
})

test('an empty board ranks to nothing', () => {
  assert.deepEqual(rankSoldiers(null), [])
  assert.deepEqual(rankSoldiers([]), [])
})

test('places are dense: a tie does not leave a gap, and a tie at 1 awards no medals', () => {
  const scores = [100, 100, 90, 80, 70, 60, 60, 50, 50, 40]
  const rows = rankSoldiers(scores.map((saidMonth, i) => ({
    id: String(i + 1),
    name: `N${String(i).padStart(2, '0')}`,
    saidMonth,
  })))
  assert.deepEqual(rows.map((r) => r.rank), [1, 1, 2, 3, 4, 5, 5, 6, 6, 7])
  assert.ok(rows.every((r) => r.medal == null))
  assert.equal(placeLabel(rows[0]), 'Tied for 1')
  assert.equal(placeLabel(rows[2]), 'Rank 2')
  assert.equal(placeLabel(rows[5]), 'Tied for 5')
})

test('the leaderboard shows the dense place and does not caption the ranking', () => {
  const jsx = readFileSync(new URL('../../src/components/SoldierLeaderboard.jsx', import.meta.url), 'utf8')
  assert.match(jsx, /s\.medal \? RANK_MEDAL\[s\.medal\] : s\.rank/)
  assert.equal(jsx.includes('Kapitlach said this month'), false)
  assert.equal(jsx.includes('Ranked by this month only'), false)
  assert.match(jsx, /View more/)
})
