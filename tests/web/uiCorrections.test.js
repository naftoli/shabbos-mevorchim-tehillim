import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { cuePerfectPlatoon } from '../../src/lib/commanderCues.js'
import { PERFECT_PLATOON_ART } from '../../src/lib/perfectPlatoonBanner.js'
import { fillStand } from '../../src/lib/commanderScripts.js'
import { guideSection } from '../../src/data/siteGuide.js'
import { DIRECT_REPLY, searchSite } from '../../src/lib/siteSearch.js'
import {
  LADDER_CHART,
  LADDER_CHART_GRADE_BANDS,
  ladderChartSlices,
  ladderKeyScroll,
  sliceStyle,
  slicesShareGradeBands,
} from '../../src/lib/ladderChart.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (path) => readFileSync(join(root, path), 'utf8')

const BANNER_TEXT = 'PERFECT PLATOON! Every single soldier in your platoon completed their mission.'

test('the perfect platoon banner uses the short sentence and the existing artwork', () => {
  assert.equal(cuePerfectPlatoon(), BANNER_TEXT)
  assert.equal(cuePerfectPlatoon().includes('commander made it happen'), false)
  assert.equal(cuePerfectPlatoon().includes('—'), false)
  assert.equal(PERFECT_PLATOON_ART, 'design/perfect-platoon-logo.webp')
  assert.equal(PERFECT_PLATOON_ART.startsWith('/'), false)

  const banner = read('src/components/PerfectPlatoonBanner.jsx')
  assert.match(banner, /asset\(PERFECT_PLATOON_ART\)/)
  assert.match(banner, /cuePerfectPlatoon\(\)/)
  assert.match(banner, /h-12 w-auto shrink-0 object-contain sm:h-16/)
  assert.equal(banner.includes('CheckMark'), false)
  assert.equal(banner.includes('commander made it happen'), false)

  const dashboard = read('src/pages/KidDashboard.jsx')
  assert.match(dashboard, /social\.classPerfect \? <PerfectPlatoonBanner \/> : null/)
  assert.equal(dashboard.includes('CheckMark'), false)
  assert.match(dashboard, /Kapitlach I said/)
  assert.match(dashboard, />Save</)
})

test('the spoken perfect-platoon script stays the approved Wednesday wording', () => {
  const spoken = fillStand({ baseRank: 1, baseTotal: 4, perfect: true })
  assert.match(spoken, /You've also earned PERFECT PLATOON! Every single soldier in your platoon completed their mission\. You each did your part, and together you made it a perfect platoon!/)
  assert.equal(spoken.includes('commander made it happen'), false)
  assert.equal(fillStand({ baseRank: 1, baseTotal: 4, perfect: false }).includes('PERFECT PLATOON'), false)
})

test('how it works does not render the mark-what-you-said card, and the helper answer remains', () => {
  const page = read('src/pages/HowTo.jsx')
  assert.equal(page.includes('Mark what you said'), false)
  assert.equal(page.includes('I cannot save a report by myself'), false)
  assert.equal(page.includes("guideSection('report')"), false)
  assert.match(page, /<LadderComparisonChart \/>/)

  const report = guideSection('report')
  assert.equal(report.title, 'Mark what you said')
  assert.match(report.paragraphs[0], /under Kapitlach I said/)
  assert.match(report.paragraphs[1], /I cannot save a report by myself/)
  const directed = searchSite('please put in my tehillim for me')
  assert.equal(directed.reply, DIRECT_REPLY)
  assert.match(directed.reply, /Kapitlach I said/)
  assert.equal(directed.usedAi, false)
})

test('ladder grades stay in one frozen slice aligned with the scrolling ladders', () => {
  const slices = ladderChartSlices()
  assert.equal(slicesShareGradeBands(slices, LADDER_CHART_GRADE_BANDS), true)
  assert.equal(slices.grade.width, LADDER_CHART.gradeWidth)
  assert.equal(slices.ladders.x, LADDER_CHART.gradeWidth)
  assert.deepEqual(LADDER_CHART_GRADE_BANDS.map((band) => band.grade), [
    '12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'pre1a',
  ])

  const gradePaint = sliceStyle(slices.grade, slices.image)
  const ladderPaint = sliceStyle(slices.ladders, slices.image)
  assert.equal(gradePaint.height, ladderPaint.height)
  assert.equal(gradePaint.backgroundPosition, 'left top')
  assert.equal(ladderPaint.backgroundPosition, 'right top')
  assert.equal(gradePaint.width, `calc(var(--ladder-chart-h) * ${slices.grade.width} / ${slices.image.height})`)
  assert.equal(ladderPaint.width, `calc(var(--ladder-chart-h) * ${slices.ladders.width} / ${slices.image.height})`)
  assert.equal(gradePaint.backgroundSize, `${(slices.image.width / slices.grade.width) * 100}% 100%`)
  assert.equal(ladderPaint.backgroundSize, `${(slices.image.width / slices.ladders.width) * 100}% 100%`)

  const chart = read('src/components/LadderComparisonChart.jsx')
  const gradeAt = chart.indexOf('data-ladder-slice="grade"')
  const scrollAt = chart.indexOf('data-ladder-scroll')
  const laddersAt = chart.indexOf('data-ladder-slice="ladders"')
  assert.ok(gradeAt > -1 && scrollAt > gradeAt && laddersAt > scrollAt)
  assert.match(chart, /asset\(LADDER_CHART\.src\)/)
  assert.equal(chart.includes('position: sticky'), false)
  assert.equal(chart.includes('sticky'), false)

  const page = read('src/pages/HowTo.jsx')
  assert.equal(page.includes('design/how/ladders.webp'), false)
})

test('arrow keys move the ladder scroller and leave the grade column in place', () => {
  const box = { left: 200, clientWidth: 300, scrollWidth: 1200, reduceMotion: false }
  assert.deepEqual(ladderKeyScroll('ArrowRight', box), { left: 440, behavior: 'smooth' })
  assert.deepEqual(ladderKeyScroll('ArrowLeft', box), { left: 0, behavior: 'smooth' })
  assert.deepEqual(ladderKeyScroll('Home', box), { left: 0, behavior: 'smooth' })
  assert.deepEqual(ladderKeyScroll('End', box), { left: 900, behavior: 'smooth' })
  assert.equal(ladderKeyScroll('ArrowDown', box), null)
  assert.deepEqual(ladderKeyScroll('ArrowRight', { ...box, reduceMotion: true }).behavior, 'auto')
  assert.deepEqual(ladderKeyScroll('ArrowRight', { left: 800, clientWidth: 300, scrollWidth: 1000, reduceMotion: false }), {
    left: 700,
    behavior: 'smooth',
  })
})
