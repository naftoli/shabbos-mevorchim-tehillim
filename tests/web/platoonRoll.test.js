import test from 'node:test'
import assert from 'node:assert/strict'
import './harness.mjs'

const { canSeeClassRoll, PLATOON_ROLL_AUDIENCE } = await import('@/lib/decisions.js')

test('the shipped audience is staff', () => {
  assert.equal(PLATOON_ROLL_AUDIENCE, 'staff')
})

test('public and soldier sessions do not see a class roll', () => {
  assert.equal(canSeeClassRoll(null, { classId: '5b', schoolId: 'iowa' }), false)
  assert.equal(canSeeClassRoll({ type: 'kid', id: '100' }, { classId: 555, schoolId: 89 }), false)
})

test('HQ sees any class, a school admin only their school, a teacher only their class', () => {
  assert.equal(canSeeClassRoll({ kind: 'super', schoolId: null }, { classId: 555, schoolId: 89 }), true)
  assert.equal(canSeeClassRoll({ kind: 'school', schoolId: 'bais-chaya-mushka-sample' }, { classId: 'c1', schoolId: 'bais-chaya-mushka-sample' }), true)
  assert.equal(canSeeClassRoll({ kind: 'school', schoolId: 'cheder-menachem-sample' }, { classId: 'c1', schoolId: 'bais-chaya-mushka-sample' }), false)
  assert.equal(canSeeClassRoll({ type: 'admin', auth: 'school', classId: 555 }, { classId: 555, schoolId: 90 }), true)
  assert.equal(canSeeClassRoll({ type: 'admin', auth: 'school', classIds: [555] }, { classId: 556, schoolId: 90 }), false)
  assert.equal(canSeeClassRoll({ kind: 'teacher', classId: 555, schoolId: 89 }, { classId: 555, schoolId: 89 }), true)
  assert.equal(canSeeClassRoll({ kind: 'teacher', classId: 555, schoolId: 89 }, { classId: 556, schoolId: 89 }), false)
  assert.equal(canSeeClassRoll({ type: 'admin', auth: 'super' }, { classId: 1, schoolId: 2 }), true)
})
