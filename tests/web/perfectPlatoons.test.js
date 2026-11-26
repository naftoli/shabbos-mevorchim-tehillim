// A school with three perfect platoons under three teachers must stay three
// rows. Grouping by school builds the home card; it does not drop classes.
// "4-boys" and "4-Boys" are different platoons. The fraction is perfect
// classes / classes on the roster.
import test from 'node:test'
import assert from 'node:assert/strict'
import './harness.mjs'
import { classIsPerfect, groupPlatoonsBySchool, platoonIsPerfect, platoonKey } from '../../src/lib/perfectPlatoons.js'

const { ROSTER, CURRENT_MONTH } = await import('../../src/data/demo.js')
const { quotaFor } = await import('../../src/data/ladders.js')

function metThisMonth(kid) {
  const q = quotaFor(kid.grade, CURRENT_MONTH, kid.ladder)
  return !!q && q.v > 0 && (kid.reports?.[CURRENT_MONTH] ?? 0) >= q.v
}

test('grouping keeps every perfect class, including names that differ only by case', () => {
  const rows = [
    { schoolId: 61, school: 'Sample Cheder', classId: 401, className: '4-boys', teacher: 'Rabbi Adler', size: 4, schoolClasses: 5 },
    { schoolId: 61, school: 'Sample Cheder', classId: 402, className: '4-Boys', teacher: 'Rabbi Berg', size: 4, schoolClasses: 5 },
    { schoolId: 61, school: 'Sample Cheder', classId: 403, className: '3-Boys', teacher: 'Rabbi Klein', size: 4, schoolClasses: 5 },
    { schoolId: 61, school: 'Sample Cheder', classId: 406, className: '4-boys', teacher: 'Rabbi Hale', size: 3, schoolClasses: 5 },
  ]
  const [group] = groupPlatoonsBySchool(rows)
  assert.equal(group.items.length, 4)
  assert.equal(group.schoolClasses, 5)
  assert.equal(`${group.items.length} / ${group.schoolClasses}`, '4 / 5')
  assert.deepEqual(group.items.map((p) => p.teacher), ['Rabbi Klein', 'Rabbi Berg', 'Rabbi Adler', 'Rabbi Hale'])
  const keys = group.items.map(platoonKey)
  assert.equal(new Set(keys).size, keys.length)
  assert.ok(keys.includes('61-401'))
  assert.ok(keys.includes('61-406'))
})

test('the report star follows the shared flag instead of recounting completed === size', () => {
  // The engine can say 4 of 4 while the roster says this class is not perfect
  // (a flagged amount, a missing soldier, a different quota). The page must
  // not light the star from its own recount.
  assert.equal(platoonIsPerfect({ perfect: false, completed: 4, size: 4 }), false)
  assert.equal(platoonIsPerfect({ perfect: true, completed: 3, size: 4 }), true)
  assert.equal(platoonIsPerfect({ completed: 4, size: 4 }), true)
  assert.equal(platoonIsPerfect({ completed: 0, size: 0 }), false)
  assert.equal(classIsPerfect(0, 0), false)
})

test('the fictional sample cheder keeps its perfect platoons and the chips do not name soldiers', () => {
  const school = ROSTER.find((s) => s.id === 'sample-cheder')
  assert.ok(school)
  assert.equal(school.classes.length, 6)
  const perfect = school.classes.filter((cls) => cls.kids.length > 0 && cls.kids.every(metThisMonth))
  assert.equal(perfect.length, 4)
  assert.deepEqual(perfect.map((c) => c.name), ['4-boys', '4-Boys', '3-Boys', 'Pre-1A'])
  assert.deepEqual(perfect.map((c) => c.teacher), ['Rabbi Adler', 'Rabbi Berg', 'Rabbi Klein', 'Rabbi Fried'])
  const notPerfect = school.classes.filter((cls) => !perfect.includes(cls)).map((c) => c.name)
  assert.deepEqual(notPerfect, ['1', 'כיתה א'])

  const rows = perfect.map((cls) => ({
    schoolId: school.id,
    school: school.name,
    classId: cls.id,
    className: cls.name,
    teacher: cls.teacher,
    size: cls.kids.length,
    schoolClasses: school.classes.length,
  }))
  const [group] = groupPlatoonsBySchool(rows)
  assert.equal(group.items.length, 4)
  assert.equal(group.schoolClasses, 6)
  const payload = JSON.stringify(rows)
  assert.equal(payload.includes('Fictional'), false)
  for (const cls of school.classes) {
    for (const kid of cls.kids) {
      assert.equal(payload.includes(kid.name), false)
    }
  }
})
