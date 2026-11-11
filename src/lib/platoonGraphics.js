// Office tabs, the public shape, and share/download for Perfect Platoon graphics.
// Phone numbers are an office concern: toPublicSchools drops them.

import { normalizeCampaignMonth, platoonClassLabel, kitahLabel } from './platoonGrade.js'

export function graphicKey(row, year, month) {
  const schoolId = String(row.schoolId ?? row.school_id ?? '')
  const className = String(row.className ?? row.class_name ?? '')
  const grade = String(row.grade ?? '')
  const y = String(row.year ?? row.campaign_year ?? year ?? '')
  const m = normalizeCampaignMonth(row.month ?? row.month_name ?? month ?? '')
  return [schoolId, className, grade, y, m].join('\n').toLowerCase()
}

/** Unsent graphics whose school already has a sent one this month are NEW. */
export function decorateGraphics(graphics) {
  const sentSchools = new Set(
    graphics.filter((graphic) => graphic.sent).map((graphic) => String(graphic.schoolId)),
  )
  return graphics.map((graphic) => ({
    ...graphic,
    sent: !!graphic.sent,
    isNew: !graphic.sent && sentSchools.has(String(graphic.schoolId)),
    classLabel: graphic.classLabel || platoonClassLabel(graphic.grade, graphic.className),
    gradeLabel: graphic.gradeLabel || kitahLabel(graphic.grade) || '',
  }))
}

export function schoolSendState(school) {
  const graphics = school.graphics || []
  if (!graphics.length) return 'none'
  return graphics.some((graphic) => !graphic.sent) ? 'to-send' : 'sent'
}

export function filterOfficeTab(schools, tab) {
  const name = tab === 'sent' || tab === 'all' ? tab : 'to-send'
  if (name === 'all') return schools
  const want = name === 'sent' ? 'sent' : 'to-send'
  return schools.filter((school) => schoolSendState(school) === want)
}

export function officeCounts(schools) {
  return {
    toSend: filterOfficeTab(schools, 'to-send').length,
    sent: filterOfficeTab(schools, 'sent').length,
    all: schools.length,
    newGraphics: schools.reduce(
      (n, school) => n + (school.graphics || []).filter((graphic) => graphic.isNew).length,
      0,
    ),
  }
}

const PUBLIC_GRAPHIC_KEYS = ['id', 'className', 'grade', 'gradeLabel', 'classLabel', 'fileUrl', 'madeAt']

export function toPublicGraphic(graphic) {
  const label = graphic.classLabel || platoonClassLabel(graphic.grade, graphic.className)
  const row = {
    id: graphic.id,
    className: graphic.className,
    grade: graphic.grade,
    gradeLabel: graphic.gradeLabel || kitahLabel(graphic.grade) || '',
    classLabel: label,
    fileUrl: graphic.fileUrl || null,
    madeAt: graphic.madeAt || null,
  }
  const out = {}
  for (const key of PUBLIC_GRAPHIC_KEYS) out[key] = row[key]
  return out
}

export function toPublicSchool(school) {
  return {
    id: school.id,
    name: school.name,
    logo: school.logo || null,
    color: school.color || null,
    graphics: (school.graphics || []).map(toPublicGraphic),
  }
}

export function toPublicSchools(schools) {
  return (schools || []).map(toPublicSchool)
}

/**
 * Empty clears the number. A usable number comes back as digits with the
 * country code kept. Anything else is an error string.
 */
export function normalizeWhatsapp(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return { digits: null }
  if (!/^[0-9+\s().-]{8,24}$/.test(text)) {
    return { error: 'Use digits and a country code, for example +1 718 555 0100.' }
  }
  const digits = text.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) {
    return { error: 'That number does not look like a full WhatsApp number with a country code.' }
  }
  return { digits }
}

export function whatsAppSchoolUrl(phone, message) {
  const parsed = normalizeWhatsapp(phone)
  if (!parsed.digits) return null
  return `https://wa.me/${parsed.digits}?text=${encodeURIComponent(message)}`
}

export function platoonGraphicsShareMessage({ schoolName, month, year, link }) {
  return `Mazel tov from the Tzivos Hashem Worldwide Tehillim Club! ${schoolName}'s Perfect Platoon graphics for ${month} ${year} are ready: ${link}`
}

export function schoolGraphicsPath(schoolId) {
  return `/platoon-graphics/${encodeURIComponent(schoolId)}`
}

export function absoluteSchoolGraphicsUrl(schoolId) {
  const base = (import.meta.env?.BASE_URL || '/shabbos-mevorchim-tehillim/').replace(/\/?$/, '/')
  const path = `${base}platoon-graphics/${encodeURIComponent(schoolId)}`.replace(/([^:])\/{2,}/g, '$1/')
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).href
}

export function graphicDownloadName(graphic) {
  const month = normalizeCampaignMonth(graphic.month || '').toLowerCase().replace(/\s+/g, '-')
  const label = String(graphic.classLabel || graphic.className || 'platoon')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${month || 'month'}-${graphic.year || 'year'}-${label || 'platoon'}.png`
}

/** What the Share button should do. The page calls this, then the browser. */
export function chooseShareAction({ hasFile, canShareFiles, canShareLink }) {
  if (hasFile && canShareFiles) return 'share-file'
  if (canShareLink) return 'share-link'
  if (hasFile) return 'download'
  return 'copy-link'
}

export async function shareOrDownload({ title, text, url, fileUrl, filename }) {
  let file = null
  if (fileUrl && typeof fetch === 'function' && typeof File === 'function') {
    try {
      const response = await fetch(fileUrl)
      if (response.ok) {
        const blob = await response.blob()
        file = new File([blob], filename || 'perfect-platoon.png', { type: blob.type || 'image/png' })
      }
    } catch { /* the link share and the download fallback still work */ }
  }
  const canShareFiles = !!(file && typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] }))
  const canShareLink = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const action = chooseShareAction({ hasFile: !!file, canShareFiles, canShareLink })
  if (action === 'share-file') {
    await navigator.share({ files: [file], title, text })
    return action
  }
  if (action === 'share-link') {
    await navigator.share({ title, text, url })
    return action
  }
  if (action === 'download' && fileUrl) {
    downloadUrl(fileUrl, filename)
    return action
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard && url) {
    await navigator.clipboard.writeText(url)
    return 'copy-link'
  }
  if (url) downloadUrl(url, filename || 'perfect-platoon.txt')
  return 'download'
}

export function downloadUrl(url, filename) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename || ''
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}
