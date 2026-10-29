// Holds a server-VAD turn until we can check the transcript, then decides.
// A new speech start drops the pending turn so barge-in is not answered late.

import { turnPlan } from './topicGate.js'

export function createTurnGate({ onDecide, waitMs = 1200, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let seq = 0
  let open = 0
  let done = 0
  let timer = null

  function clear() {
    if (timer != null) clearTimer(timer)
    timer = null
  }

  return {
    speechStarted() {
      seq += 1
      open = 0
      done = 0
      clear()
    },
    speechStopped() {
      const my = ++seq
      open = my
      clear()
      timer = setTimer(() => {
        if (open !== my || done === my) return
        done = my
        open = 0
        onDecide({ plan: 'answer', text: '', timedOut: true, late: false })
      }, waitMs)
    },
    transcript(text) {
      const plan = turnPlan(text)
      if (open && done !== open) {
        const my = open
        done = my
        open = 0
        clear()
        onDecide({ plan, text, timedOut: false, late: false })
        return
      }
      if (done && text) onDecide({ plan, text, timedOut: false, late: true })
    },
  }
}
