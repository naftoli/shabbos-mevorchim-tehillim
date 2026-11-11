// Who has not finished this month. Same rule as api/notify.php
// wwtcNotifyKidStatus: said <= 0 is nothing reported, said >= quota is done,
// anything in between reported something and is still short.

import { formatClassName } from './formatClassName.js'
import { sortClasses } from './classOrder.js'

export const FINISH_TITLE = 'Who still needs to finish'
export const SUBMIT_TITLE = 'Who still needs to submit'

export function notDoneHeading(month) {
  return `Not done yet — ${month}`
}

export function kidFinishStatus(said, quota) {
  const n = Number(said) || 0
  const q = Number(quota) || 0
  if (n <= 0) return 'missing'
  if (q > 0 && n >= q) return 'full'
  return 'under'
}

export function stillNeedPhrase(count, action) {
  const n = Math.max(0, Number(count) || 0)
  const verb = n === 1 ? 'needs' : 'need'
  const what = action === 'submit' ? 'submit' : 'finish'
  return `${n} still ${verb} to ${what}`
}

export function stillNeedSummary(finishCount, submitCount) {
  return `${stillNeedPhrase(finishCount, 'finish')}, ${stillNeedPhrase(submitCount, 'submit')}`
}

export function splitIncompleteNames(kids) {
  const missing = []
  const under = []
  const notFilled = []
  for (const kid of kids || []) {
    const status = kidFinishStatus(kid.said, kid.quota)
    if (status === 'full') continue
    missing.push(kid.name)
    if (status === 'under') under.push(kid.name)
    else notFilled.push(kid.name)
  }
  return { missing, under, notFilled }
}

// Sections stay in this order: reported-but-short, then nothing reported.
// A class is listed only inside a section that has names. `missing` on an
// older response (no under / notFilled) is treated as nothing reported.
export function notDoneView(classes) {
  const finishClasses = []
  const submitClasses = []
  for (const row of classes || []) {
    const split = Array.isArray(row.under) || Array.isArray(row.notFilled)
    const under = split ? (row.under || []) : []
    const notFilled = split ? (row.notFilled || []) : (row.missing || [])
    if (under.length) {
      finishClasses.push({
        classId: row.classId,
        className: formatClassName(row.className),
        grade: row.grade,
        size: row.size,
        phrase: stillNeedPhrase(under.length, 'finish'),
        names: under,
      })
    }
    if (notFilled.length) {
      submitClasses.push({
        classId: row.classId,
        className: formatClassName(row.className),
        grade: row.grade,
        size: row.size,
        phrase: stillNeedPhrase(notFilled.length, 'submit'),
        names: notFilled,
      })
    }
  }
  const finishCount = finishClasses.reduce((n, row) => n + row.names.length, 0)
  const submitCount = submitClasses.reduce((n, row) => n + row.names.length, 0)
  return {
    finishCount,
    submitCount,
    summary: stillNeedSummary(finishCount, submitCount),
    empty: finishCount + submitCount === 0,
    sections: [
      {
        title: FINISH_TITLE,
        phrase: stillNeedPhrase(finishCount, 'finish'),
        classes: sortClasses(finishClasses),
      },
      {
        title: SUBMIT_TITLE,
        phrase: stillNeedPhrase(submitCount, 'submit'),
        classes: sortClasses(submitClasses),
      },
    ],
  }
}
