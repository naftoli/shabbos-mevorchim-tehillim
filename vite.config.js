import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// PRIVACY guard: the only roster allowed into the bundle is the anonymized demo.
// Any src/data/roster*.js module whose first line is not a comment carrying the
// marker fails the build (and the dev server), so a real Tzivos Hashem roster —
// e.g. the converter's git-ignored roster.generated.js — can never be published.
const ROSTER_MARKER = 'ANONYMIZED DEMO DATA'
const ROSTER_ID = /\/src\/data\/roster[^/]*\.js$/

function rosterGuard() {
  return {
    name: 'roster-guard',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0].replace(/\\/g, '/')
      if (!ROSTER_ID.test(file)) return
      const firstLine = code.split(/\r?\n/, 1)[0].trim()
      if (firstLine.startsWith('//') && firstLine.includes(ROSTER_MARKER)) return
      this.error(
        `Refusing to bundle ${file}: its first line must be a comment containing ` +
          `"${ROSTER_MARKER}". Only the anonymized demo roster may be built or deployed.`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/mivtzoim/tehillim/',
  plugins: [rosterGuard(), react(), tailwindcss()],
  // `@/…` is what shadcn components import themselves by (see components.json).
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    proxy: {
      '/mivtzoim/tehillim/api': {
        target: process.env.WWTC_API_TARGET || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
