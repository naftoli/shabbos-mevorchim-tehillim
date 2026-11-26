// Wrap and shrink the words that go on Tab's posters. The measure function
// returns the unscaled text width at the current font size.

export function wrapGraphicLines(words, maxWidth, measure) {
  const lines = []
  let current = ''
  for (const word of words) {
    const piece = String(word || '').trim()
    if (!piece) continue
    const trial = current ? `${current} ${piece}` : piece
    if (!current || measure(trial) <= maxWidth) current = trial
    else {
      lines.push(current)
      current = piece
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * Largest font size at or below maxSize whose wrapped lines fit the box.
 * measure(size, text) is the width after horizontal scaling.
 * capHeight(size) is the ink height of one line. linePitch(size) is the
 * distance from the top of one line to the top of the next.
 */
export function fitGraphicSize({ words, maxWidth, maxHeight, maxSize, minSize, measure, capHeight, linePitch }) {
  const list = (words || []).map((word) => String(word).trim()).filter(Boolean)
  if (!list.length || maxWidth <= 0 || maxHeight <= 0) {
    return { size: minSize, lines: [] }
  }
  const pack = (size) => {
    const lines = wrapGraphicLines(list, maxWidth, (text) => measure(size, text))
    const cap = capHeight(size)
    const height = lines.length ? (lines.length - 1) * linePitch(size) + cap : 0
    const width = lines.reduce((widest, line) => Math.max(widest, measure(size, line)), 0)
    return { size, lines, height, width }
  }
  let low = minSize
  let high = maxSize
  let best = pack(minSize)
  for (let step = 0; step < 18; step += 1) {
    const size = (low + high) / 2
    const packed = pack(size)
    if (packed.height <= maxHeight + 0.5 && packed.width <= maxWidth + 0.5) {
      best = packed
      low = size
    } else {
      high = size
    }
  }
  return best
}
