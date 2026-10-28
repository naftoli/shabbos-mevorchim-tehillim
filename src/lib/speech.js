// Browser speech for General 613. Uses the built-in Web Speech API only —
// speechSynthesis to talk, SpeechRecognition to listen. No key, no paid service.
// Both are optional: callers keep working when a browser doesn't have them.

const SILENCE_MS = 8000

let token = 0

export function stripForSpeech(text) {
  return String(text ?? '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\u200d/g, '')
    .replace(/\ufe0f/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function canSpeak() {
  return typeof window !== 'undefined'
    && typeof window.speechSynthesis !== 'undefined'
    && typeof window.SpeechSynthesisUtterance === 'function'
}

export function canListen() {
  if (typeof window === 'undefined') return false
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
  return typeof Ctor === 'function'
}

function englishVoice(synth) {
  const voices = synth.getVoices?.() || []
  return voices.find((v) => /^en(-|_)/i.test(v.lang) && v.localService)
    || voices.find((v) => /^en(-|_)/i.test(v.lang))
    || null
}

export function stopSpeaking() {
  token += 1
  if (!canSpeak()) return
  try { window.speechSynthesis.cancel() } catch { /* already idle */ }
}

/**
 * Speak `text` aloud. Emoji are removed first.
 * Resolves: 'spoken' | 'muted' | 'empty' | 'unavailable' | 'blocked' | 'interrupted' | 'error'
 * 'blocked' means the browser refused autoplay (or never started). The caller
 * can retry from a user gesture. Never throws.
 */
export function speak(text, { muted = false } = {}) {
  const clean = stripForSpeech(text)
  const my = ++token
  const synth = canSpeak() ? window.speechSynthesis : null
  const wasBusy = !!(synth && (synth.speaking || synth.pending))

  const cancelNow = () => {
    if (!synth) return
    try { synth.cancel() } catch { /* ignore */ }
  }

  if (muted || !clean || !synth) {
    cancelNow()
    if (muted) return Promise.resolve('muted')
    if (!clean) return Promise.resolve('empty')
    return Promise.resolve('unavailable')
  }

  return new Promise((resolve) => {
    let settled = false
    let started = false
    let startTimer = 0
    let safetyTimer = 0
    let safetyTries = 0
    const finish = (status) => {
      if (settled) return
      settled = true
      window.clearTimeout(startTimer)
      window.clearTimeout(safetyTimer)
      resolve(status)
    }
    const safety = () => {
      if (settled) return
      if (my !== token) { finish('interrupted'); return }
      if ((synth.speaking || synth.pending) && safetyTries < 60) {
        safetyTries += 1
        safetyTimer = window.setTimeout(safety, 1000)
        return
      }
      if (synth.speaking || synth.pending) cancelNow()
      finish(started ? 'spoken' : 'blocked')
    }
    const go = () => {
      try {
        if (my !== token) { finish('interrupted'); return }
        const utter = new SpeechSynthesisUtterance(clean)
        utter.lang = 'en-US'
        utter.rate = 1
        // A listed voice can be stale or not a real SpeechSynthesisVoice. Skip it
        // and let the browser use its default rather than throwing.
        try {
          const voice = englishVoice(synth)
          if (voice) utter.voice = voice
        } catch { /* default voice */ }
        utter.onstart = () => {
          started = true
          window.clearTimeout(startTimer)
        }
        utter.onend = () => finish(my === token ? 'spoken' : 'interrupted')
        utter.onerror = (event) => {
          const err = event?.error || ''
          if (my !== token || err === 'interrupted' || err === 'canceled' || err === 'cancelled') finish('interrupted')
          else if (err === 'not-allowed') finish('blocked')
          else finish('error')
        }
        // If nothing starts, autoplay was blocked (or this browser has no voice).
        // Cancel so a late start can't talk over the retry.
        startTimer = window.setTimeout(() => {
          if (settled || started || my !== token) return
          cancelNow()
          finish('blocked')
        }, 2500)
        safetyTimer = window.setTimeout(safety, Math.min(50000, 5000 + clean.length * 80))
        synth.resume?.()
        synth.speak(utter)
      } catch {
        finish('blocked')
      }
    }
    // Chrome drops an utterance that starts in the same turn as cancel().
    if (wasBusy) {
      cancelNow()
      window.setTimeout(go, 70)
    } else {
      go()
    }
  })
}

/**
 * Listen once for a phrase. `stop()` is safe to call twice.
 * Silence (nothing said for a while) calls onSilence and does not call onEnd.
 */
export function startRecognition({ onPartial, onFinal, onSilence, onError, onEnd } = {}) {
  if (typeof window === 'undefined') {
    onError?.('unsupported')
    return { stop() {} }
  }
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
  if (typeof Ctor !== 'function') {
    onError?.('unsupported')
    return { stop() {} }
  }
  const rec = new Ctor()
  rec.lang = 'en-US'
  rec.interimResults = true
  rec.continuous = false
  rec.maxAlternatives = 1

  let stopped = false
  let heard = false
  let silenceNotified = false
  let timer = 0
  const clearTimer = () => {
    if (timer) window.clearTimeout(timer)
    timer = 0
  }
  const notifySilence = () => {
    if (stopped || heard || silenceNotified) return
    silenceNotified = true
    stopped = true
    clearTimer()
    try { rec.stop() } catch { /* already ending */ }
    onSilence?.()
  }

  timer = window.setTimeout(notifySilence, SILENCE_MS)

  rec.onresult = (event) => {
    if (stopped) return
    let interim = ''
    let finalText = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const piece = event.results[i][0]?.transcript ?? ''
      if (event.results[i].isFinal) finalText += piece
      else interim += piece
    }
    if (finalText.trim()) {
      heard = true
      clearTimer()
      stop()
      onFinal?.(finalText.trim())
      return
    }
    if (interim.trim()) {
      heard = true
      clearTimer()
      onPartial?.(interim.trim())
    }
  }
  rec.onerror = (event) => {
    const err = event?.error || ''
    if (err === 'no-speech') { notifySilence(); return }
    if (err === 'aborted') return
    silenceNotified = true
    stopped = true
    clearTimer()
    try { rec.stop() } catch { /* already ending */ }
    onError?.(err)
  }
  rec.onend = () => {
    clearTimer()
    if (stopped || silenceNotified) return
    onEnd?.({ heard })
  }

  function stop() {
    if (stopped) return
    stopped = true
    clearTimer()
    try { rec.stop() } catch { /* not started or already stopped */ }
  }

  try {
    rec.start()
  } catch {
    stopped = true
    clearTimer()
    onError?.('start-failed')
  }

  return { stop }
}
