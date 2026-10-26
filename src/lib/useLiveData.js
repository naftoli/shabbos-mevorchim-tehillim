import { useCallback, useEffect, useState } from 'react'
import { subscribe } from '@/services/api.js'

// Runs an async loader and re-runs it whenever the data changes (an admin edit,
// another tab, the 30s live poll) — the "live" feel for the Mashpia API. In
// demo mode the loader resolves immediately and the subscription is local.
//
// Callers MUST render `error`: this hook clears `loading` on a rejection, but
// `data` stays null, so a caller that only checks `loading || !data` would spin
// forever on a failed read with no way to tell something broke.
export function useLiveData(loader, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps)

  // Lets an error state offer "Try again" without a full page reload.
  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    let alive = true
    // One request at a time: a change that arrives mid-request asks for one more
    // run once the in-flight one finishes, so a slow read can't be overwritten
    // by a stale response that started earlier.
    let inFlight = false
    let again = false
    const refresh = () => {
      if (inFlight) {
        again = true
        return
      }
      inFlight = true
      Promise.resolve()
        .then(run)
        .then(
          (d) => {
            if (alive) {
              setData(d)
              setError(null)
              setLoading(false)
            }
          },
          (e) => {
            if (alive) {
              setError(e)
              setLoading(false)
            }
          },
        )
        .finally(() => {
          inFlight = false
          if (again && alive) {
            again = false
            refresh()
          }
        })
    }
    refresh()
    const unsub = subscribe(refresh)
    return () => {
      alive = false
      unsub()
    }
  }, [run, attempt])

  return { data, loading, error, reload }
}
