// Resolve a file from public/ under the deploy sub-path.
// The site is served at /mivtzoim/tehillim/ (vite.config.js `base`), so nothing
// may hard-code a root-absolute path like "/th-logo.png" — always go through
// asset('th-logo.png') / asset('design/flag.png').
// import.meta.env.BASE_URL always ends with "/", so a leading slash is dropped.
//
// A fully self-contained single-file build (see scripts/inline.mjs) sets
// window.__WWTC_ASSETS__ to a { "design/flag.png": "data:…" } map so images load
// with no separate files; when it is absent this is the normal sub-path resolve.
export const asset = (name) => {
  const key = String(name).replace(/^\/+/, '')
  if (typeof window !== 'undefined' && window.__WWTC_ASSETS__ && window.__WWTC_ASSETS__[key]) {
    return window.__WWTC_ASSETS__[key]
  }
  return import.meta.env.BASE_URL + key
}
