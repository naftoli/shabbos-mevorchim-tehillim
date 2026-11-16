// A 1080×1080 PNG for Download when the daily job has not posted a file yet.
// The on-screen card is MonthGraphicArt. This draws the same words and shield.

import { asset } from './asset.js'
import { topBaseArt } from './baseRank.js'
import { PERFECT_PLATOON_ART } from './perfectPlatoonBanner.js'
import { downloadUrl, graphicDownloadName } from './platoonGraphics.js'

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

function paintLine(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  let line = ''
  let yy = y
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, yy)
      line = word
      yy += lineHeight
    } else {
      line = next
    }
  }
  if (line) ctx.fillText(line, x, yy)
}

export async function downloadPoster({ school, graphic, month, year }) {
  if (typeof document === 'undefined') return false
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1080
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  const top = graphic?.kind === 'top10'
  ctx.fillStyle = '#17356f'
  ctx.fillRect(0, 0, 1080, 1080)
  ctx.fillStyle = '#e4b23c'
  ctx.fillRect(0, 0, 1080, 28)
  ctx.fillStyle = '#e4b23c'
  ctx.textAlign = 'center'
  ctx.font = '600 36px sans-serif'
  ctx.fillText(`Shabbos Mevorchim  ${month || ''} ${year || ''}`, 540, 110)
  const artName = top ? topBaseArt(graphic.rank) : PERFECT_PLATOON_ART
  const art = await loadImage(artName ? asset(artName) : null)
  if (art) {
    const box = 480
    const scale = Math.min(box / art.width, box / art.height)
    const w = art.width * scale
    const h = art.height * scale
    ctx.drawImage(art, (1080 - w) / 2, 170, w, h)
  }
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 64px sans-serif'
  const title = top ? (school?.name || '') : (graphic?.classLabel || graphic?.className || '')
  paintLine(ctx, title, 540, 760, 960, 74)
  ctx.fillStyle = '#e4b23c'
  ctx.font = '600 40px sans-serif'
  ctx.fillText(top ? `Top 10 School  #${graphic?.rank || ''}` : (school?.name || ''), 540, 980)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return false
  const url = URL.createObjectURL(blob)
  downloadUrl(url, graphicDownloadName({ ...graphic, month, year }))
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
