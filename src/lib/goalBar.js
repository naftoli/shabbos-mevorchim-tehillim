// Where a progress marker sits on a goal bar.
// The painted fill never runs past the track. A report of 833% still ends at
// the right edge. The caller's own percent label is left alone.

export function goalBarEnd(percent) {
  const n = Number(percent)
  const actual = Number.isFinite(n) ? Math.max(0, n) : 0
  return { actual, end: Math.min(100, actual) }
}

// Intrinsic pixel size of the progress icons, so the marker keeps the art's
// real aspect ratio. Opaque pixels in these files sit on the canvas center,
// so centering the element centers the picture.
export const PROGRESS_ICONS = [
  ['icon-book', 420, 280],
  ['icon-clock', 255, 256],
  ['icon-soldier-hat', 99, 71],
]

export function progressIconBox(src) {
  const file = String(src || '')
  const found = PROGRESS_ICONS.find(([name]) => file.includes(name))
  return found ? { width: found[1], height: found[2] } : null
}
