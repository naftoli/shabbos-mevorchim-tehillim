// Home groups the nationwide list into one card per school. The card keeps
// every class. schoolId picks the card; it does not collapse classes.
// "3 / 16" is perfect classes out of the classes on that school's roster
// (schoolClasses), not a rank and not a page size.

// Same test as api/perfectPlatoon.php. size 0 is not a Perfect Platoon.
export function soldierMetQuota(quota, said) {
  return quota > 0 && said >= quota
}

export function classIsPerfect(met, size) {
  return size > 0 && met === size
}

// The report page used to recompute the star from completed === size, which
// lights a class the server has already decided is not perfect. A boolean
// `perfect` from the API is the shared roster. Older payloads without it
// fall back to that same size test.
export function platoonIsPerfect(data) {
  if (!data) return false
  if (typeof data.perfect === 'boolean') return data.perfect
  return classIsPerfect(Number(data.completed) || 0, Number(data.size) || 0)
}

export function platoonKey(p) {
  if (p && p.classId != null && p.classId !== '') return `${p.schoolId}-${p.classId}`
  return `${p?.schoolId ?? ''}-${p?.className ?? ''}`
}

export function groupPlatoonsBySchool(platoons) {
  const groups = []
  const seen = new Map()
  for (const p of platoons || []) {
    const id = p.schoolId
    let group = seen.get(id)
    if (!group) {
      group = {
        schoolId: id,
        school: p.school,
        items: [],
        schoolClasses: p.schoolClasses || 0,
        schoolSaid: p.schoolSaid || 0,
      }
      seen.set(id, group)
      groups.push(group)
    }
    group.items.push(p)
    group.schoolClasses = Math.max(group.schoolClasses, p.schoolClasses || 0)
    group.schoolSaid = p.schoolSaid || group.schoolSaid
  }
  groups.sort((a, b) => {
    const ap = a.schoolClasses ? a.items.length / a.schoolClasses : 0
    const bp = b.schoolClasses ? b.items.length / b.schoolClasses : 0
    return bp - ap || (b.schoolSaid || 0) - (a.schoolSaid || 0) || a.school.localeCompare(b.school)
  })
  return groups
}
