// OpenAI Realtime speech-to-speech over WebRTC.
// The browser only ever sees a short-lived ephemeral token (ek_…).
// The API key stays on the PHP server. Any failure throws so the caller
// can keep the scripted voice.

import { getKidToken } from '@/services/mashpia.js'
import { refusalInstructions } from './topicGate.js'
import { createTurnGate } from './turnGate.js'

const BASE_URL = (import.meta.env && import.meta.env.BASE_URL) || '/shabbos-mevorchim-tehillim/'
const SESSION_URL = `${BASE_URL}api/realtime-session`
const CALLS_URL = 'https://api.openai.com/v1/realtime/calls'

function realtimeContext(context) {
  if (!context || typeof context !== 'object') return {}
  const rest = { ...context }
  delete rest.answerSheet
  return rest
}

export async function mintRealtimeSession(context) {
  const token = getKidToken()
  if (!token) throw new Error('no kid session')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(SESSION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ context: realtimeContext(context) }),
      signal: ctrl.signal,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error || `realtime ${res.status}`)
    const value = data?.value
    if (typeof value !== 'string' || value.length < 8 || value.startsWith('sk-')) {
      throw new Error('no ephemeral token')
    }
    return { value, expiresAt: data.expires_at ?? null, model: data.model ?? '' }
  } finally {
    clearTimeout(timer)
  }
}

function micStream() {
  const existing = typeof window !== 'undefined' ? window.__wwtcCallMic : null
  const live = existing?.getAudioTracks?.().some((track) => track.readyState === 'live')
  if (live) return Promise.resolve(existing)
  const ask = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
  if (!ask) return Promise.reject(new Error('no microphone'))
  return ask({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    .then((stream) => {
      window.__wwtcCallMic = stream
      return stream
    })
}

function responseEvent(extra) {
  return { type: 'response.create', response: extra || {} }
}

export async function connectRealtimeCall({ demo, context, handlers }) {
  if (demo) throw new Error('demo uses the scripted voice')
  if (typeof RTCPeerConnection !== 'function') throw new Error('no webrtc')
  const session = await mintRealtimeSession(context)
  const pc = new RTCPeerConnection()
  const audio = document.createElement('audio')
  audio.autoplay = true
  audio.setAttribute('playsinline', '')
  pc.ontrack = (event) => {
    audio.srcObject = event.streams[0]
    audio.play?.().catch(() => {})
  }

  const stream = await micStream()
  const tracks = stream.getAudioTracks()
  if (!tracks.length) throw new Error('no microphone')
  tracks.forEach((track) => {
    track.enabled = true
    pc.addTrack(track, stream)
  })

  const dc = pc.createDataChannel('oai-events')
  const call = createCall({ pc, audio, dc, handlers })

  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  const sdpRes = await fetch(CALLS_URL, {
    method: 'POST',
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${session.value}`,
      'Content-Type': 'application/sdp',
    },
  })
  if (!sdpRes.ok) throw new Error(`call ${sdpRes.status}`)
  const answer = await sdpRes.text()
  if (!answer.includes('v=0')) throw new Error('bad sdp')
  await pc.setRemoteDescription({ type: 'answer', sdp: answer })

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('connect timeout')), 10000)
    let settled = false
    const finish = (ok) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (ok) resolve()
      else reject(new Error('connect failed'))
    }
    if (dc.readyState === 'open' || pc.connectionState === 'connected') finish(true)
    dc.addEventListener('open', () => finish(true))
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'connected' || dc.readyState === 'open') finish(true)
      if (pc.connectionState === 'failed') finish(false)
    })
  })

  return call
}

function createCall({ pc, audio, dc, handlers }) {
  const seenCalls = new Set()
  let closed = false
  let muted = false
  let lastAssistant = ''
  let lastUser = ''
  let offerSpoken = false

  const send = (event) => {
    if (closed || dc.readyState !== 'open') return
    dc.send(JSON.stringify(event))
  }

  const setMic = (on) => {
    pc.getSenders?.().forEach((sender) => {
      if (sender.track && sender.track.kind === 'audio') sender.track.enabled = on && !muted
    })
  }

  const gate = createTurnGate({
    onDecide: (info) => {
      if (closed) return
      if (info.text && handlers.isEcho?.(info.text)) {
        send({ type: 'response.cancel' })
        return
      }
      if (info.text) {
        lastUser = info.text
        handlers.onUserText?.(info.text)
      }
      if (info.late && info.plan !== 'refuse') return
      if (info.plan === 'quiet') {
        handlers.onQuiet?.()
        send({ type: 'response.cancel' })
        return
      }
      if (info.plan === 'unmute') {
        handlers.onUnmute?.()
        sayExact("I'm back!")
        return
      }
      if (info.plan === 'repeat') {
        sayExact(lastAssistant || 'I am right here.')
        return
      }
      if (info.plan === 'refuse') {
        if (info.late) send({ type: 'response.cancel' })
        respondRefusal()
        return
      }
      if (!info.late) respondAnswer()
    },
  })

  function respondAnswer() {
    handlers.onSpeaking?.(true)
    send(responseEvent({}))
  }

  function respondRefusal() {
    handlers.onSpeaking?.(true)
    send(responseEvent({
      tool_choice: 'none',
      instructions: refusalInstructions(),
    }))
  }

  function sayExact(line) {
    lastAssistant = line
    handlers.onSpeaking?.(true)
    send(responseEvent({
      tool_choice: 'none',
      instructions: `Say only this, warmly, and then wait: ${line}`,
    }))
  }

  async function runTool(item) {
    const callId = item.call_id || item.callId
    const name = item.name
    if (!callId || seenCalls.has(callId)) return
    seenCalls.add(callId)
    let args = item.arguments
    if (typeof args === 'string') {
      try { args = JSON.parse(args) } catch { args = {} }
    }
    let output = 'The tool could not run.'
    try {
      output = await handlers.onTool?.(name, args || {}, { lastUser, offerSpoken })
      if (typeof output !== 'string') output = JSON.stringify(output ?? {})
    } catch (err) {
      output = err?.message || 'The tool failed.'
    }
    if (name === 'change_ladder' && /Saved\./.test(output)) offerSpoken = false
    send({
      type: 'conversation.item.create',
      item: { type: 'function_call_output', call_id: callId, output },
    })
    respondAnswer()
  }

  dc.onmessage = (event) => {
    let msg
    try { msg = JSON.parse(event.data) } catch { return }
    const type = msg.type
    if (type === 'input_audio_buffer.speech_started') {
      handlers.onListening?.(true)
      handlers.onSpeaking?.(false)
      gate.speechStarted()
      send({ type: 'response.cancel' })
      return
    }
    if (type === 'input_audio_buffer.speech_stopped') {
      handlers.onListening?.(false)
      gate.speechStopped()
      return
    }
    if (type === 'conversation.item.input_audio_transcription.completed') {
      gate.transcript(msg.transcript || '')
      return
    }
    if (type === 'response.created') {
      handlers.onSpeaking?.(true)
      return
    }
    if (type === 'response.output_audio_transcript.delta') {
      handlers.onAssistantDelta?.(msg.delta || '')
      return
    }
    if (type === 'response.output_audio_transcript.done') {
      const text = msg.transcript || ''
      if (text) lastAssistant = text
      handlers.onAssistantDone?.(text)
      if (handlers.offersLadder?.(text)) offerSpoken = true
      return
    }
    if (type === 'response.done' || type === 'response.cancelled') {
      handlers.onSpeaking?.(false)
      return
    }
    if (type === 'response.output_item.done' && msg.item?.type === 'function_call') {
      void runTool(msg.item)
      return
    }
    if (type === 'response.function_call_arguments.done') {
      void runTool({ name: msg.name, call_id: msg.call_id, arguments: msg.arguments })
    }
  }

  dc.onclose = () => {
    if (!closed) handlers.onDown?.()
  }
  pc.addEventListener('connectionstatechange', () => {
    if (!closed && pc.connectionState === 'failed') handlers.onDown?.()
  })

  return {
    greet(line) {
      sayExact(line)
    },
    sendText(text) {
      lastUser = text
      const plan = handlers.planText?.(text) || 'answer'
      send({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }],
        },
      })
      if (plan === 'refuse') respondRefusal()
      else if (plan === 'quiet') send({ type: 'response.cancel' })
      else respondAnswer()
    },
    sayExact,
    setMuted(next) {
      muted = !!next
      audio.muted = muted
      setMic(!muted)
    },
    setMicOpen(on) {
      setMic(on)
    },
    unlockAudio() {
      audio.play?.().catch(() => {})
    },
    noteOffer(text) {
      if (handlers.offersLadder?.(text)) offerSpoken = true
    },
    close() {
      closed = true
      try { dc.close() } catch { /* already closed */ }
      try { pc.close() } catch { /* already closed */ }
      audio.srcObject = null
    },
  }
}

