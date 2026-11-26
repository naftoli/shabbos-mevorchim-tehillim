import { useEffect, useRef, useState } from 'react'
import { asset } from '@/lib/asset.js'
import { LADDER_CHART, ladderChartSlices, ladderKeyScroll, sliceStyle } from '@/lib/ladderChart.js'

const ALT = 'Shabbos Mevorchim Tehillim ladders for Tishrei. Each ladder’s rungs line up with the grades fixed on the left, 12th grade at the top through Pre-1A at the bottom.'

export default function LadderComparisonChart() {
  const slices = ladderChartSlices()
  const src = asset(LADDER_CHART.src)
  const scroller = useRef(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const update = () => {
      setEdges({
        left: el.scrollLeft > 2,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
      })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [])

  function onKeyDown(event) {
    const el = event.currentTarget
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const next = ladderKeyScroll(event.key, {
      left: el.scrollLeft,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      reduceMotion,
    })
    if (!next) return
    event.preventDefault()
    el.scrollTo(next)
  }

  const paint = (slice) => ({
    ...sliceStyle(slice, slices.image),
    backgroundImage: `url("${src}")`,
  })

  return (
    <div className="ladder-compare flex w-full min-w-0 items-stretch" data-ladder-chart>
      <div data-ladder-slice="grade" aria-hidden="true" className="shrink-0" style={paint(slices.grade)} />
      <div className="relative min-w-0 flex-1">
        <div
          ref={scroller}
          data-ladder-scroll
          tabIndex={0}
          role="region"
          aria-label="Ladders. Grades stay fixed on the left. Use arrow keys, or scroll sideways, to move the ladders."
          className="ladder-compare-scroll h-full overflow-x-auto touch-pan-x focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a5fb8] [scrollbar-width:thin]"
          onKeyDown={onKeyDown}
        >
          <div data-ladder-slice="ladders" role="img" aria-label={ALT} style={paint(slices.ladders)} />
        </div>
        {edges.left ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#c3dcff] to-transparent" />
        ) : null}
        {edges.right ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#c3dcff] to-transparent" />
        ) : null}
      </div>
    </div>
  )
}
