// Resolves the app's `@/` alias (Vite) to ./src for the Node test runner, so the
// real facade/client modules can be imported and exercised under `node --test`.
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const SRC = pathToFileURL(path.resolve(process.cwd(), 'src') + path.sep).href

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    return { url: new URL(specifier.slice(2), SRC).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
