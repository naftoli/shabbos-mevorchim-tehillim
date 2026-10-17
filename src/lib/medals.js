// Medals are awarded at cumulative missions (a mission = finishing a month's
// quota). Eleven tiers, each its own color.
export const MEDAL_THRESHOLDS = [5, 11, 18, 26, 35, 45, 56, 68, 81, 95, 110]

// Named by colour to match the Mashpia medal board. `ink` is the number colour
// for contrast on light vs. dark medals. 5 / 95 / 110 were still locked in the
// reference screenshots — best read; easy to adjust.
export const MEDALS = [
  { name: 'Silver', color: '#c3c8d0', ink: '#1b2a4e' },
  { name: 'Red', color: '#e23b3b', ink: '#ffffff' },
  { name: 'Orange', color: '#ef8a2b', ink: '#ffffff' },
  { name: 'Gold', color: '#efb11d', ink: '#1b2a4e' },
  { name: 'Green', color: '#3aa64a', ink: '#ffffff' },
  { name: 'Blue', color: '#3b5bdb', ink: '#ffffff' },
  { name: 'Purple', color: '#9c36b5', ink: '#ffffff' },
  { name: 'Bronze', color: '#a56a2e', ink: '#ffffff' },
  { name: 'Gray', color: '#868e96', ink: '#ffffff' },
  { name: 'Black', color: '#343a40', ink: '#ffffff' },
  { name: 'Platinum', color: '#cfd4da', ink: '#1b2a4e' },
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
