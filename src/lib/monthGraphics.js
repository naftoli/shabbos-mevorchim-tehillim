// Month archive, public share links, and the teacher-share channel for
// Perfect Platoon and Top 10 graphics. Ranking lives in schoolRace.js.

import { campaignMonths } from './hebrewYear.js'
import { normalizeCampaignMonth } from './platoonGrade.js'
import { IS_DEMO } from './liveMode.js'

export function previousCampaignMonth(year, month) {
  const y = Number(year)
  const name = normalizeCampaignMonth(month)
  const months = campaignMonths(Number.isFinite(y) ? y : year)
  const index = months.indexOf(name)
  if (index > 0) return { year: Number.isFinite(y) ? y : year, month: months[index - 1] }
  const prevYear = Number.isFinite(y) ? y - 1 : y
  const prevMonths = campaignMonths(prevYear)
  return { year: prevYear, month: prevMonths[prevMonths.length - 1] || 'Elul' }
}

/** Months a graphics page can open. Includes last month when it falls in the previous year. */
export function graphicMonthChoices(campaignYear, currentMonth) {
  const year = Number(campaignYear)
  const months = campaignMonths(year)
  const choices = months.map((month) => ({
    year,
    month,
    value: `${year}|${month}`,
    label: `${month} ${year}`,
  }))
  const prev = previousCampaignMonth(year, normalizeCampaignMonth(currentMonth))
  if (!choices.some((choice) => choice.year === Number(prev.year) && choice.month === prev.month)) {
    choices.unshift({
      year: Number(prev.year),
      month: prev.month,
      value: `${prev.year}|${prev.month}`,
      label: `${prev.month} ${prev.year}`,
    })
  }
  return choices
}

export function topGraphicId(schoolId) {
  return `top-${schoolId}`
}

export function compareSchoolGraphics(a, b) {
  const group = (graphic) => (graphic?.kind === 'top10' ? 0 : 1)
  return group(a) - group(b) || String(a?.classLabel || a?.className || '').localeCompare(String(b?.classLabel || b?.className || ''))
}

export function graphicSharePath(schoolId, graphicId, period) {
  const params = new URLSearchParams()
  if (period?.year) params.set('year', String(period.year))
  if (period?.month) params.set('month', String(period.month))
  const query = params.toString()
  return `/platoon-graphics/${encodeURIComponent(schoolId)}/share/${encodeURIComponent(graphicId)}${query ? `?${query}` : ''}`
}

/**
 * There is no channel that delivers a graphic to teachers.
 * Class teachers are names. The Wednesday notify job can text a follow-up
 * report when WhatsApp or SMS is configured, and it does not send these pictures.
 * Email is not sent. Share with all teachers opens the share sheet or copies a link.
 */
export const TEACHER_GRAPHICS_CHANNEL = {
  deliversToTeachers: false,
  method: 'web-share-or-copy-link',
  summary: 'Share with all teachers opens the share sheet or copies a link. It does not text or email teachers.',
  detail: 'Class teachers are names on a class, not phone numbers. The Wednesday follow-up can text a separate report when WhatsApp or SMS is configured on the server, and that job does not send these pictures. Email is not sent.',
}

export function teacherPacketMessage({ schoolName, month, year, link }) {
  return `Mazel tov from the Tzivos Hashem Worldwide Tehillim Club! ${schoolName}'s graphics for ${month} ${year} are ready for teachers: ${link}`
}

export function parentShareMessage({ schoolName, month, year, link, platoonName, kind }) {
  if (kind === 'top10') {
    return `Mazel tov! ${schoolName} is a Top 10 school for ${month} ${year}. ${link}`
  }
  const who = platoonName ? `${schoolName}, ${platoonName},` : `${schoolName}`
  return `Mazel tov! ${who} earned Perfect Platoon for ${month} ${year}. ${link}`
}

export function withDemoFlag(url) {
  if (!IS_DEMO || typeof window === 'undefined' || !url) return url
  try {
    const next = new URL(url, window.location.origin)
    next.searchParams.set('demo', '1')
    return next.href
  } catch {
    return url
  }
}
