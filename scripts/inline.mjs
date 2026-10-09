// Build a single, fully self-contained index.html from a root-base dist:
// inlines the CSS and the JS module, and inlines every public/ image as a
// data-URI asset map (window.__WWTC_ASSETS__) that src/lib/asset.js consults.
// Nothing is left to load separately — drop the one file anywhere.
//
//   node scripts/inline.mjs <distDir> <outFile>
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const [distDir = 'dist-netlify', outFile = 'wwtc-single.html'] = process.argv.slice(2)

const MIME = { '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }

// Collect every image under dist, keyed by its path relative to dist root
// ("th-logo.png", "design/flag.png") — exactly the keys asset() uses.
const assets = {}
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) { if (name !== 'assets') walk(p); continue }
    const ext = extname(name).toLowerCase()
    if (!MIME[ext]) continue
    const key = relative(distDir, p).replace(/\\/g, '/')
    assets[key] = `data:${MIME[ext]};base64,${readFileSync(p).toString('base64')}`
  }
}
walk(distDir)

let html = readFileSync(join(distDir, 'index.html'), 'utf8')

// Inline <link rel="stylesheet" href="/assets/x.css">
html = html.replace(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"[^>]*>/g, (_m, href) => {
  const css = readFileSync(join(distDir, href.replace(/^\//, '')), 'utf8')
  return `<style>\n${css}\n</style>`
})

// Inline <script type="module" ... src="/assets/x.js"></script>
html = html.replace(/<script[^>]*src="([^"]+\.js)"[^>]*><\/script>/g, (_m, src) => {
  const js = readFileSync(join(distDir, src.replace(/^\//, '')), 'utf8')
  return `<script type="module">\n${js}\n</script>`
})

// Favicon → data URI (so no external request)
html = html.replace(/href="\/(th-logo\.png|favicon\.svg)"/g, (_m, f) => (assets[f] ? `href="${assets[f]}"` : _m))

// Inject the asset map just before the first <script>.
const mapTag = `<script>window.__WWTC_ASSETS__=${JSON.stringify(assets)}</script>\n`
html = html.replace(/<script/, mapTag + '<script')

writeFileSync(outFile, html)
const kb = (Buffer.byteLength(html) / 1024).toFixed(0)
console.log(`Wrote ${outFile} (${kb} KB) with ${Object.keys(assets).length} inlined images`)
