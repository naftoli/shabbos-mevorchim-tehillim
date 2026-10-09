// Live Mashpia data is the default. Append ?demo=1 to a URL to switch the whole
// tab to the anonymized demo roster (fake soldiers), ?demo=0 to go back to live.
// The SPA keeps ?demo=1 in the URL while a demo session is active (see
// KeepDemoQuery in App.jsx), so a reload or a shared link stays in the demo.
//
// Mirrors Mivtza Lulav's liveMode: the older ?real=1 / ?real=0 links still work
// (real=0 is the demo, real=1 is live).

function readDemoFlag() {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  if (params.has('demo')) {
    const v = params.get('demo')
    const on = v === '1' || v === 'true' || v === ''
    try { sessionStorage.setItem('wwtc.demo', on ? '1' : '0') } catch { /* private mode */ }
    return on
  }
  if (params.has('real')) {
    const on = params.get('real') === '0'
    try { sessionStorage.setItem('wwtc.demo', on ? '1' : '0') } catch { /* private mode */ }
    return on
  }
  try { return sessionStorage.getItem('wwtc.demo') === '1' } catch { return false }
}

export const IS_DEMO = readDemoFlag()
