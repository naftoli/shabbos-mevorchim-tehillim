// Test harness for the SPA data layer. Registers the `@/` loader, stubs the few
// browser globals the client touches, and installs a controllable mock `fetch`
// so a test can assert exactly which API endpoint each facade call hits (method,
// path, auth header, body) and what it returns. Importing this module performs
// the setup; it must be imported before any dynamic import of the facade.
import { register } from 'node:module'

register('./loader.mjs', import.meta.url)

// liveMode.js reads window.location at load (IS_DEMO); an empty search => live.
globalThis.window = globalThis.window || {
  location: { search: '' },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  setInterval() { return 0 },
  clearInterval() {},
}
globalThis.CustomEvent = globalThis.CustomEvent || class CustomEvent {
  constructor(type, opts = {}) { this.type = type; Object.assign(this, opts) }
}

let routes = {}
let calls = []

// url is `${BASE}${path}` e.g. /shabbos-mevorchim-tehillim/api/me/progress; match
// on the part after `/api` so route keys read like the backend's own routes.
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url, 'http://test.local')
  const apiPath = u.pathname.replace(/^.*\/api/, '') + (u.search || '')
  const method = opts.method || 'GET'
  calls.push({ method, apiPath, opts, headers: opts.headers || {}, body: opts.body ? JSON.parse(opts.body) : undefined })

  const handler = routes[`${method} ${apiPath}`] ?? routes[`${method} ${u.pathname.replace(/^.*\/api/, '')}`]
  if (handler === undefined) {
    return { ok: false, status: 404, json: async () => ({ error: `no mock for ${method} ${apiPath}` }) }
  }
  const res = typeof handler === 'function' ? handler(opts) : handler
  const status = res.status || 200
  return { ok: status < 400, status, json: async () => res.body }
}

export function mock(routeMap) { routes = routeMap }
export function calledWith() { return calls }
export function lastCall() { return calls[calls.length - 1] }
export function reset() { routes = {}; calls = [] }
