import confetti from 'canvas-confetti'

const GOLD = ['#ffd54a', '#e0a21a', '#ffe9a6']
const BLUE = ['#2a5fb8', '#17356f', '#7aa0f0']
const COLORS = [...GOLD, ...BLUE, '#ffffff']

// A celebratory burst when a soldier completes a month's mission (Lulav-style).
export function celebrate() {
  try {
    // center pop
    confetti({ particleCount: 140, spread: 95, startVelocity: 45, origin: { y: 0.6 }, colors: COLORS })
    // side cannons for ~0.9s
    const end = Date.now() + 900
    ;(function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 65, origin: { x: 0, y: 0.7 }, colors: COLORS })
      confetti({ particleCount: 5, angle: 120, spread: 65, origin: { x: 1, y: 0.7 }, colors: COLORS })
      if (Date.now() < end) requestAnimationFrame(frame)
    })()
  } catch {
    /* confetti is decorative — never let it break a save */
  }
}
