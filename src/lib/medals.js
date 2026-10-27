// Medals are awarded at cumulative missions (a mission = finishing a month's
// quota). Eleven tiers, each its own color.
export const MEDAL_THRESHOLDS = [5, 11, 18, 26, 35, 45, 56, 68, 81, 95, 110]

// Names and colours taken straight from the Mashpia medal board source
// (לבן/אדום/כתום/צהוב/ירוק/כחול/סגול/חום/אפור/שחור/ברונזה). `ink` is the number
// colour for contrast on light vs. dark medals.
// `coin` names the real medal graphic (public/design/coin-<name>.png) — the
// shield coin the client supplied in each ladder colour. Bronze has no coin
// art yet, so it keeps the CSS-rendered fallback (coin: null).
export const MEDALS = [
  { name: 'White', color: '#d8dbde', ink: '#1b2a4e', coin: 'white' },
  { name: 'Red', color: '#aa2834', ink: '#ffffff', coin: 'red' },
  { name: 'Orange', color: '#d55027', ink: '#ffffff', coin: 'orange' },
  { name: 'Yellow', color: '#d29020', ink: '#ffffff', coin: 'yellow' },
  { name: 'Green', color: '#23914b', ink: '#ffffff', coin: 'green' },
  { name: 'Blue', color: '#2b3078', ink: '#ffffff', coin: 'blue' },
  { name: 'Purple', color: '#4d297b', ink: '#ffffff', coin: 'purple' },
  { name: 'Brown', color: '#6d4c38', ink: '#ffffff', coin: 'brown' },
  { name: 'Gray', color: '#71707b', ink: '#ffffff', coin: 'gray' },
  { name: 'Black', color: '#0a0515', ink: '#ffffff', coin: 'black' },
  { name: 'Bronze', color: '#bcaaa4', ink: '#1b2a4e', coin: null },
].map((m, i) => ({ ...m, threshold: MEDAL_THRESHOLDS[i], index: i }))

// A medal's own colour can be too light to read as text on a light card
// (White, Platinum, Gray). Fall back to navy for those so the name stays legible.
export function legibleInk(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return L > 0.62 ? '#1b2a4e' : hex
}

// Given a cumulative mission count, what's earned / current / next.
export function medalState(missions) {
  const earned = MEDAL_THRESHOLDS.filter((t) => missions >= t).length
  const currentIndex = earned - 1 // -1 = none yet
  const nextIndex = earned < MEDALS.length ? earned : null
  const next = nextIndex != null ? MEDALS[nextIndex] : null
  return {
    missions,
    earnedCount: earned,
    current: currentIndex >= 0 ? MEDALS[currentIndex] : null,
    next,
    missionsToNext: next ? next.threshold - missions : 0,
  }
}
