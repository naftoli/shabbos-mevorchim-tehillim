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
    // Dashes are read as a hard stop. A comma keeps the sentence moving.
    .replace(/[—–]/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
}

// If a "613" is still spoken, say "six thirteen", not "six hundred and thirteen".
export function spokenText(text) {
  return stripForSpeech(text).replace(/\b613\b/g, 'six thirteen')
}

// Chrome drops an utterance that runs much past 15 seconds. Stay under that,
// and only break where a sentence already ends.
const CHUNK_CHARS = 180

export function speechChunks(text) {
  const clean = spokenText(text)
  if (!clean) return []
  if (clean.length <= CHUNK_CHARS) return [clean]
  const sentences = clean.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [clean]
  const chunks = []
  let buf = ''
  for (const raw of sentences) {
    const sentence = raw.trim()
    if (!sentence) continue
    const next = buf ? `${buf} ${sentence}` : sentence
    if (buf && next.length > CHUNK_CHARS) {
      chunks.push(buf)
      buf = sentence
    } else {
      buf = next
    }
  }
  if (buf) chunks.push(buf)
  return chunks
}

function voiceScore(voice) {
  const name = voice?.name || ''
  const lang = String(voice?.lang || '').toLowerCase().replace('_', '-')
  if (/microsoft/i.test(name) && /online \(natural\)/i.test(name)) return 400
  if (/google us english/i.test(name)) return 300
  if (/en-us/.test(lang) && /\b(samantha|ava)\b/i.test(name)) return 200
  if (/en-us/.test(lang) && /premium|enhanced/i.test(name)) return 150
  if (/en-us/.test(lang)) return 50
  if (/^en-/.test(lang)) return 10
  return 0
}

// Best English voice the browser actually offers. Empty list returns null.
// A paid neural voice is not used here. If none of these exist, the browser
// default is the fallback; a neural service could be added later behind the
// PHP /chat proxy without changing the on-screen text.
export function pickVoice(voices) {
  let best = null
  let bestScore = 0
  for (const voice of voices || []) {
    const score = voiceScore(voice)
    if (score > bestScore) {
      best = voice
      bestScore = score
    }
  }
  return best
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

function voicesReady(synth) {
  const current = () => synth.getVoices?.() || []
  if (current().length) return Promise.resolve(current())
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      const list = current()
      if (!list.length) return
      settled = true
      synth.removeEventListener?.('voiceschanged', finish)
      window.clearTimeout(timer)
      resolve(list)
    }
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      synth.removeEventListener?.('voiceschanged', finish)
      resolve(current())
    }, 1500)
    synth.addEventListener?.('voiceschanged', finish)
    // Chrome loads the list only after getVoices() is called.
    current()
  })
}

export function stopSpeaking() {
  token += 1
  if (!canSpeak()) return
  try { window.speechSynthesis.cancel() } catch { /* already idle */ }
}

// Drop the echo-cancelled mic kept open for the call. Logout uses this.
export function releaseCallMic() {
  if (typeof window === 'undefined') return
  const stream = window.__wwtcCallMic
  if (!stream) return
  window.__wwtcCallMic = null
  try {
    stream.getTracks().forEach((track) => track.stop())
  } catch { /* already stopped */ }
}

// Call inside the Sign In click, before any await. A silent utterance counts as
// the user gesture, so Chrome will allow the real greeting once the dashboard
// is on screen. The mic permission is asked in that same gesture.
export function armVoice() {
  if (typeof window === 'undefined') return
  try {
    const synth = window.speechSynthesis
    if (synth && typeof window.SpeechSynthesisUtterance === 'function') {
      synth.resume?.()
      // Silent, same rate as real speech, so the unlock doesn't chirp
      // or leave a fast utterance for the greeting to cut off.
      const utter = new SpeechSynthesisUtterance('.')
      utter.volume = 0
      utter.rate = 1
      utter.pitch = 1
      synth.speak(utter)
    }
  } catch { /* speech missing or already busy */ }
  try {
    const ask = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
    if (!ask) return
    ask({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    }).then((stream) => {
      // Keep the cleaned-up mic open for the call so the browser can
      // cancel the commander's own voice. Speech recognition uses this session.
      stream.getTracks().forEach((track) => {
        track.enabled = true
      })
      window.__wwtcCallMic = stream
    }).catch(() => { /* permission dismissed; typing still works */ })
  } catch { /* no media devices */ }
}

/**
 * Speak `text` aloud. Emoji are removed first.
 * Resolves: 'spoken' | 'muted' | 'empty' | 'unavailable' | 'blocked' | 'interrupted' | 'error'
 * 'blocked' means the browser refused autoplay (or never started). The caller
 * can retry from a user gesture. Never throws.
 */
export function speak(text, { muted = false } = {}) {
  const chunks = speechChunks(text)
  const my = ++token
  const synth = canSpeak() ? window.speechSynthesis : null

  const cancelNow = () => {
    if (!synth) return
    try { synth.cancel() } catch { /* ignore */ }
  }

  if (muted || !chunks.length || !synth) {
    cancelNow()
    if (muted) return Promise.resolve('muted')
    if (!chunks.length) return Promise.resolve('empty')
    return Promise.resolve('unavailable')
  }

  return new Promise((resolve) => {
    let settled = false
    let started = false
    let startTimer = 0
    let safetyTimer = 0
    let safetyTries = 0
    const totalChars = chunks.reduce((n, chunk) => n + chunk.length, 0)
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
      // Keep waiting while this queue is still playing. Cancelling here
      // would cut him off mid-sentence.
      if ((synth.speaking || synth.pending) && safetyTries < 180) {
        safetyTries += 1
        safetyTimer = window.setTimeout(safety, 1000)
        return
      }
      finish(started ? 'spoken' : 'blocked')
    }
    const queue = (voice) => {
      if (my !== token) { finish('interrupted'); return }
      const last = chunks.length - 1
      chunks.forEach((chunk, index) => {
        const utter = new SpeechSynthesisUtterance(chunk)
        utter.lang = 'en-US'
        utter.rate = 1
        utter.pitch = 1
        try {
          if (voice) utter.voice = voice
        } catch { /* default voice */ }
        if (index === 0) {
          utter.onstart = () => {
            started = true
            window.clearTimeout(startTimer)
          }
        }
        utter.onend = () => {
          if (index !== last || settled) return
          finish(my === token ? 'spoken' : 'interrupted')
        }
        utter.onerror = (event) => {
          const err = event?.error || ''
          if (my !== token || err === 'interrupted' || err === 'canceled' || err === 'cancelled') finish('interrupted')
          else if (err === 'not-allowed') finish('blocked')
          else if (index === last || !started) finish('error')
        }
        synth.speak(utter)
      })
      // One queue, no gaps and no cancel between sentences.
      startTimer = window.setTimeout(() => {
        if (settled || started || my !== token) return
        cancelNow()
        finish('blocked')
      }, 2500)
      safetyTimer = window.setTimeout(safety, Math.min(180000, 8000 + totalChars * 90))
    }
    const go = async () => {
      try {
        const voices = await voicesReady(synth)
        if (my !== token) { finish('interrupted'); return }
        // A newer line replaced this one. That cancel already happened.
        if (synth.speaking || synth.pending) {
          cancelNow()
          await new Promise((r) => { window.setTimeout(r, 70) })
        }
        if (my !== token) { finish('interrupted'); return }
        synth.resume?.()
        queue(pickVoice(voices))
      } catch {
        finish('blocked')
      }
    }
    // A different line may interrupt. Chunks of this line are queued together
    // and are not cancelled. Chrome drops speech started in the same turn as cancel.
    const busy = synth.speaking || synth.pending
    if (busy) cancelNow()
    window.setTimeout(go, busy ? 70 : 0)
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
