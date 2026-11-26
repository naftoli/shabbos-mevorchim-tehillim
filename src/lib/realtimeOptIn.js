const REALTIME_KEY = 'wwtc.commander.realtime'

// Paid speech stays off until this is turned on. The typed commander never
// reads the flag and never starts a call.
export function realtimeWanted(storage) {
  const box = storage ?? (typeof localStorage === 'undefined' ? null : localStorage)
  try {
    return box?.getItem(REALTIME_KEY) === 'on'
  } catch {
    return false
  }
}
