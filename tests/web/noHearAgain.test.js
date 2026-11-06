import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

// Spoken "hear it again" still repeats the commander. A labeled replay
// control on a page or in the chat must not come back.
const BANNED = /hear it again|hear that again|hear again/i
const ALLOWED = new Set([path.normalize('src/lib/kidAnswers.js')])

const root = path.resolve(import.meta.dirname, '../..')

async function sourceFiles(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await sourceFiles(full))
    else if (/\.(jsx|js|html)$/.test(entry.name)) out.push(full)
  }
  return out
}

test('pages do not show a hear-again replay control', async () => {
  const hits = []
  for (const file of await sourceFiles(path.join(root, 'src'))) {
    const rel = path.relative(root, file)
    if (ALLOWED.has(path.normalize(rel))) continue
    const text = await readFile(file, 'utf8')
    if (BANNED.test(text)) hits.push(rel)
  }
  assert.deepEqual(hits, [])
})
