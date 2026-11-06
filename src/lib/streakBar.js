// The picture shows six steps. A longer streak fills the bar and is still
// reported as its real count. It is never labeled as month 6.

export const STREAK_BAR_STEPS = 6

export const STREAK_COPY = [
  "Your current streak shows how many missions you've completed in a row. Complete your next mission to keep it growing!",
  "Your longest streak is your best run so far. Even if you miss a mission and start a new streak, your best record stays.",
]

export function streakBarModel(current) {
  const n = Number(current)
  const value = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  const shown = Math.min(value, STREAK_BAR_STEPS)
  return {
    current: value,
    active: value >= 1 && value <= STREAK_BAR_STEPS ? value : null,
    fill: shown / STREAK_BAR_STEPS,
    overflow: value > STREAK_BAR_STEPS,
  }
}
