const spoken = new Set()

export function emitCue(id, text) {
  if (!id || !text || spoken.has(id)) return
  spoken.add(id)
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('wwtc-cue', { detail: { id, text } }))
}

export function resetCues() {
  spoken.clear()
}
