const spoken = new Set()

export function emitCue(id, text, { force = false } = {}) {
  if (!id || !text) return
  if (!force && spoken.has(id)) return
  spoken.add(id)
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('wwtc-cue', { detail: { id, text, force } }))
}

export function resetCues() {
  spoken.clear()
}
