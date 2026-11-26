import { useLiveData } from '@/lib/useLiveData.js'
import { getCampaignCalendar, CAMPAIGN_YEAR, CURRENT_MONTH } from '@/services/api.js'

/**
 * Live pages read the campaign year/month from /campaign, not the browser
 * Hebrew calendar. Demo getCampaignCalendar already returns the demo constants.
 */
export function useCampaignClock(year) {
  const { data, loading, error } = useLiveData(
    () => getCampaignCalendar(year || undefined),
    [year || ''],
  )
  return {
    year: data?.year ?? Number(CAMPAIGN_YEAR),
    currentMonth: data?.currentMonth || CURRENT_MONTH,
    months: data?.months || [],
    calendar: data,
    loading,
    error,
  }
}

export function schoolCampaignPath(id, period) {
  if (!id) return '/s/'
  if (period?.year && period?.month) {
    return `/s/${id}?year=${encodeURIComponent(period.year)}&month=${encodeURIComponent(period.month)}`
  }
  return `/s/${id}`
}
