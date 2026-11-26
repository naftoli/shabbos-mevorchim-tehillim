import { useLayoutEffect, useRef, useState } from 'react'
import { asset } from '@/lib/asset.js'
import layout from '@/lib/graphicLayout.json'
import { fitGraphicSize } from '@/lib/graphicFit.js'

const DISPLAY = '"Bebas Neue", Impact, sans-serif'
const ITALIC = '"Montserrat ExtraBold Italic", Georgia, serif'

function canvasContext() {
  if (typeof document === 'undefined') return null
  if (!canvasContext.ctx) {
    canvasContext.ctx = document.createElement('canvas').getContext('2d')
  }
  return canvasContext.ctx
}

function measureWidth(fontFamily, size, text, scaleX) {
  const ctx = canvasContext()
  if (!ctx) return text.length * size * 0.5
  ctx.font = `${size}px ${fontFamily}`
  return ctx.measureText(text).width * scaleX
}

function capHeight(fontFamily, size) {
  const ctx = canvasContext()
  if (!ctx) return size * 0.72
  ctx.font = `${size}px ${fontFamily}`
  const metrics = ctx.measureText('H')
  const ascent = metrics.actualBoundingBoxAscent || 0
  const descent = metrics.actualBoundingBoxDescent || 0
  return ascent + descent || size * 0.72
}

function GraphicWords({ box, text, fontFamily, scaleX, upper, capFraction, color }) {
  const ref = useRef(null)
  const [fit, setFit] = useState(null)
  const shown = upper ? String(text || '').toUpperCase() : String(text || '')

  useLayoutEffect(() => {
    const el = ref.current
    const square = el?.closest('[data-graphic]')
    if (!el || !square) return
    let cancel = false
    const layoutText = () => {
      if (cancel) return
      const side = square.clientWidth
      if (!side) return
      const words = shown.split(/\s+/).filter(Boolean)
      const maxCap = capFraction * side
      const probe = capHeight(fontFamily, 100)
      const maxSize = probe > 0 ? (maxCap * 100) / probe : maxCap
      const packed = fitGraphicSize({
        words,
        maxWidth: box.w * side,
        maxHeight: box.h * side,
        maxSize,
        minSize: 8,
        measure: (size, line) => measureWidth(fontFamily, size, line, scaleX),
        capHeight: (size) => capHeight(fontFamily, size),
        linePitch: (size) => capHeight(fontFamily, size) * layout.linePitch,
      })
      setFit(packed)
    }
    const fonts = typeof document !== 'undefined' && document.fonts
    if (fonts?.load) {
      Promise.all([
        fonts.load(`120px ${DISPLAY}`),
        fonts.load(`italic 80px ${ITALIC}`),
      ]).then(layoutText)
    } else {
      layoutText()
    }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(layoutText) : null
    observer?.observe(square)
    return () => {
      cancel = true
      observer?.disconnect()
    }
  }, [shown, fontFamily, scaleX, capFraction, box.w, box.h])

  const cap = fit ? capHeight(fontFamily, fit.size) : 0
  const gap = cap * (layout.linePitch - 1)

  return (
    <div
      ref={ref}
      className="absolute flex flex-col items-center justify-center overflow-hidden"
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.w * 100}%`,
        height: `${box.h * 100}%`,
      }}
    >
      {(fit?.lines || []).map((line, index) => (
        <div
          key={`${line}-${index}`}
          style={{
            color,
            fontFamily,
            fontStyle: fontFamily === ITALIC ? 'italic' : 'normal',
            fontSize: `${fit.size}px`,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            transform: `scaleX(${scaleX})`,
            marginBottom: index === fit.lines.length - 1 ? 0 : `${gap}px`,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  )
}

function logoStyle(box) {
  return {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.w * 100}%`,
    height: `${box.h * 100}%`,
  }
}

// Tab's square, with only the school logo and the words that change per school.
export default function MonthGraphicArt({ school, graphic, month, year }) {
  const top = graphic?.kind === 'top10'
  const rank = Math.round(Number(graphic?.rank))
  const background = top
    ? (rank >= 1 && rank <= 10 ? asset(`graphics/top-base-blank-${rank}.jpg`) : null)
    : asset('graphics/perfect-platoon-blank.jpg')
  const schoolName = school?.name || ''
  const platoon = graphic?.classLabel || graphic?.className || ''
  const label = top
    ? `${schoolName}, Top 10 school`
    : `${schoolName} ${platoon}`.trim()

  return (
    <div className="relative aspect-square w-full" data-graphic="" role="img" aria-label={label || `${month} ${year}`}>
      {background ? (
        <img src={background} alt="" className="absolute inset-0 h-full w-full" draggable="false" />
      ) : null}
      {top ? (
        <GraphicWords
          box={layout.top.name}
          text={schoolName}
          fontFamily={DISPLAY}
          scaleX={layout.displayScaleX}
          upper
          capFraction={layout.top.cap}
          color={layout.navy}
        />
      ) : (
        <>
          <GraphicWords
            box={layout.platoon.className}
            text={platoon}
            fontFamily={DISPLAY}
            scaleX={layout.displayScaleX}
            upper
            capFraction={layout.platoon.classCap}
            color={layout.navy}
          />
          <GraphicWords
            box={layout.platoon.name}
            text={schoolName}
            fontFamily={ITALIC}
            scaleX={layout.italicScaleX}
            upper={false}
            capFraction={layout.platoon.nameCap}
            color={layout.blue}
          />
        </>
      )}
      {school?.logo ? (
        <img
          src={school.logo}
          alt=""
          className="absolute object-contain"
          style={logoStyle(top ? layout.top.logo : layout.platoon.logo)}
          draggable="false"
        />
      ) : null}
    </div>
  )
}
