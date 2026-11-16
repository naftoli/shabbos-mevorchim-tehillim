// Downloadable 1080×1080 PNG of Tab's poster. The on-screen card is the same
// blank, name, and logo; this draws that poster into a file.

import { asset } from './asset.js'
import layout from './graphicLayout.json'
import { fitGraphicSize } from './graphicFit.js'
import { downloadUrl, graphicDownloadName } from './platoonGraphics.js'

const DISPLAY = '"Bebas Neue", Impact, sans-serif'
const ITALIC = '"Montserrat ExtraBold Italic", Georgia, serif'

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src || typeof Image === 'undefined') {
      resolve(null)
      return
    }
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

function paintWords(ctx, box, text, { fontFamily, scaleX, upper, capFraction, color }) {
  const side = ctx.canvas.width
  const shown = upper ? String(text || '').toUpperCase() : String(text || '')
  const words = shown.split(/\s+/).filter(Boolean)
  if (!words.length) return
  const maxWidth = box.w * side
  const maxHeight = box.h * side
  const capAt = (size) => {
    ctx.font = `${size}px ${fontFamily}`
    const metrics = ctx.measureText('H')
    return (metrics.actualBoundingBoxAscent || 0) + (metrics.actualBoundingBoxDescent || 0) || size * 0.72
  }
  const probe = capAt(100)
  const packed = fitGraphicSize({
    words,
    maxWidth,
    maxHeight,
    maxSize: probe > 0 ? (capFraction * side * 100) / probe : capFraction * side,
    minSize: 8,
    measure: (size, line) => {
      ctx.font = `${size}px ${fontFamily}`
      return ctx.measureText(line).width * scaleX
    },
    capHeight: capAt,
    linePitch: (size) => capAt(size) * layout.linePitch,
  })
  if (!packed.lines.length) return
  const cap = capAt(packed.size)
  const step = cap * layout.linePitch
  const block = (packed.lines.length - 1) * step + cap
  let y = box.y * side + Math.max(0, (maxHeight - block) / 2) + cap
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `${packed.size}px ${fontFamily}`
  const cx = (box.x + box.w / 2) * side
  for (const line of packed.lines) {
    ctx.save()
    ctx.translate(cx, y)
    ctx.scale(scaleX, 1)
    ctx.fillText(line, 0, 0)
    ctx.restore()
    y += step
  }
}

function containLogo(ctx, image, box) {
  const side = ctx.canvas.width
  const bw = box.w * side
  const bh = box.h * side
  const scale = Math.min(bw / image.width, bh / image.height)
  const dw = image.width * scale
  const dh = image.height * scale
  ctx.drawImage(image, box.x * side + (bw - dw) / 2, box.y * side + (bh - dh) / 2, dw, dh)
}

export async function downloadPoster({ school, graphic, month, year }) {
  if (typeof document === 'undefined') return false
  if (document.fonts?.load) {
    await Promise.all([
      document.fonts.load('120px "Bebas Neue"'),
      document.fonts.load('italic 80px "Montserrat ExtraBold Italic"'),
    ])
  }
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1080
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  const top = graphic?.kind === 'top10'
  const rank = Math.round(Number(graphic?.rank))
  const background = top
    ? (rank >= 1 && rank <= 10 ? asset(`graphics/top-base-blank-${rank}.jpg`) : null)
    : asset('graphics/perfect-platoon-blank.jpg')
  const photo = await loadImage(background)
  if (photo) ctx.drawImage(photo, 0, 0, 1080, 1080)
  if (top) {
    paintWords(ctx, layout.top.name, school?.name || '', {
      fontFamily: DISPLAY,
      scaleX: layout.displayScaleX,
      upper: true,
      capFraction: layout.top.cap,
      color: layout.navy,
    })
  } else {
    paintWords(ctx, layout.platoon.className, graphic?.classLabel || graphic?.className || '', {
      fontFamily: DISPLAY,
      scaleX: layout.displayScaleX,
      upper: true,
      capFraction: layout.platoon.classCap,
      color: layout.navy,
    })
    paintWords(ctx, layout.platoon.name, school?.name || '', {
      fontFamily: ITALIC,
      scaleX: layout.italicScaleX,
      upper: false,
      capFraction: layout.platoon.nameCap,
      color: layout.blue,
    })
  }
  const logo = await loadImage(school?.logo)
  if (logo) containLogo(ctx, logo, top ? layout.top.logo : layout.platoon.logo)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return false
  const url = URL.createObjectURL(blob)
  downloadUrl(url, graphicDownloadName({ ...graphic, month, year }))
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
