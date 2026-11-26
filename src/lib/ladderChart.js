// The How It Works ladder comparison is one artwork (design/how/ladders.webp,
// 2000×741). Grade labels occupy the left ink (through x=118). A blank column
// at x=124 separates them from the first ladder, whose ink starts at x=125.
// Both slices keep the full image height, so each rung stays on its grade.

export const LADDER_CHART = {
  src: 'design/how/ladders.webp',
  width: 2000,
  height: 741,
  gradeWidth: 124,
  gradeInkMaxX: 118,
  ladderInkMinX: 125,
}

// Top of the artwork is 12th grade. Bottom is Pre-1A. y/height are source pixels.
export const LADDER_CHART_GRADE_BANDS = [
  { grade: '12', y: 75, height: 31 },
  { grade: '11', y: 120, height: 32 },
  { grade: '10', y: 165, height: 31 },
  { grade: '9', y: 207, height: 30 },
  { grade: '8', y: 250, height: 32 },
  { grade: '7', y: 293, height: 31 },
  { grade: '6', y: 337, height: 31 },
  { grade: '5', y: 378, height: 31 },
  { grade: '4', y: 421, height: 31 },
  { grade: '3', y: 464, height: 30 },
  { grade: '2', y: 507, height: 31 },
  { grade: '1', y: 549, height: 32 },
  { grade: 'pre1a', y: 594, height: 29 },
]

export function ladderChartSlices() {
  const { width, height, gradeWidth } = LADDER_CHART
  return {
    image: { width, height },
    grade: { x: 0, width: gradeWidth, height },
    ladders: { x: gradeWidth, width: width - gradeWidth, height },
  }
}

// Paint one horizontal slice of the shared artwork. Left slice is the grades.
// Right slice is everything after the grade column, aligned to the same height.
export function sliceStyle(slice, image) {
  const size = (image.width / slice.width) * 100
  return {
    height: 'var(--ladder-chart-h)',
    width: `calc(var(--ladder-chart-h) * ${slice.width} / ${image.height})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${size}% 100%`,
    backgroundPosition: slice.x === 0 ? 'left top' : 'right top',
  }
}

export function slicesShareGradeBands(slices = ladderChartSlices(), bands = LADDER_CHART_GRADE_BANDS) {
  if (slices.grade.height !== slices.ladders.height) return false
  if (slices.grade.x !== 0) return false
  if (slices.grade.x + slices.grade.width !== slices.ladders.x) return false
  if (slices.ladders.x + slices.ladders.width !== slices.image.width) return false
  if (LADDER_CHART.gradeInkMaxX >= LADDER_CHART.gradeWidth) return false
  if (LADDER_CHART.ladderInkMinX < LADDER_CHART.gradeWidth) return false
  let previousBottom = -1
  for (const band of bands) {
    if (band.y < 0 || band.height <= 0) return false
    if (band.y + band.height > slices.image.height) return false
    if (band.y < previousBottom) return false
    previousBottom = band.y + band.height
  }
  return bands.length > 0 && bands[0].grade === '12' && bands[bands.length - 1].grade === 'pre1a'
}

// Arrow keys move only the ladder scroller. Home/End jump to the ends.
// Reduced motion uses an instant jump.
export function ladderKeyScroll(key, { left, clientWidth, scrollWidth, reduceMotion }) {
  const max = Math.max(0, scrollWidth - clientWidth)
  const behavior = reduceMotion ? 'auto' : 'smooth'
  const step = Math.max(48, Math.round(clientWidth * 0.8))
  if (key === 'ArrowRight') return { left: Math.min(max, left + step), behavior }
  if (key === 'ArrowLeft') return { left: Math.max(0, left - step), behavior }
  if (key === 'Home') return { left: 0, behavior }
  if (key === 'End') return { left: max, behavior }
  return null
}
