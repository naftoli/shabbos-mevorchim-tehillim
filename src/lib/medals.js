// Medals are awarded at cumulative missions (a mission = finishing a month's
// quota). Eleven tiers, each its own color.
export const MEDAL_THRESHOLDS = [5, 11, 18, 26, 35, 45, 56, 68, 81, 95, 110]

export const MEDALS = [
  { name: 'Copper', color: '#b87333' },
  { name: 'Steel', color: '#8f9aa6' },
  { name: 'Bronze', color: '#cd7f32' },
  { name: 'Silver', color: '#9ca3af' },
  { name: 'Gold', color: '#e0a21a' },
  { name: 'Sapphire', color: '#2a5fb8' },
  { name: 'Amethyst', color: '#8b5cf6' },
  { name: 'Ruby', color: '#e11d48' },
  { name: 'Emerald', color: '#10b981' },
  { name: 'Topaz', color: '#0ea5e9' },
  { name: 'Crown', color: '#0f2350' },
].map((m, i) => ({ ...m, threshold: MEDAL_THRESHOLDS[i], index: i }))

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
