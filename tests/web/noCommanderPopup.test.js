import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { peekText, openingGreeting } from '../../src/lib/general613.js'
import { fillWelcome } from '../../src/lib/commanderScripts.js'

// User-facing offers to pop up, open, or show the commander. Automatic
// guidance and the approved Wednesday scripts stay; these phrases must not
// render on any page, menu, setting, or helper answer.
const BANNED = [
  /pop[\s-]*up\s+(?:my|the|your)\s+(?:virtual\s+)?commander/i,
  /(?:open|show)\s+(?:my|the|your)\s+(?:virtual\s+)?commander/i,
  /commander\s+to\s+pop[\s-]*up/i,
  /pop[\s-]*up\s+when\s+(?:i|you)\s+sign\s+in/i,
  /commander\s+pop[\s-]*up/i,
  /wwtc\.commander\.auto\b/,
  /\bCOMMANDER_AUTO_DEFAULT\b/,
]

const root = path.resolve(import.meta.dirname, '../..')
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git'])

async function sourceFiles(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await sourceFiles(full))
    else if (/\.(jsx?|html|php|md)$/.test(entry.name)) out.push(full)
  }
  return out
}

function hitsIn(text) {
  const found = []
  for (const pattern of BANNED) {
    const match = text.match(pattern)
    if (match) found.push(match[0])
  }
  return found
}

test('no pop-up-my-commander option text renders', async () => {
  const hits = []
  for (const file of await sourceFiles(root)) {
    const rel = path.relative(root, file)
    if (rel === path.normalize('tests/web/noCommanderPopup.test.js')) continue
    const text = await readFile(file, 'utf8')
    for (const phrase of hitsIn(text)) hits.push(`${rel}: ${phrase}`)
  }
  assert.deepEqual(hits, [])

  const guidance = [
    peekText({ situation: 'pick', firstName: 'Meir' }),
    openingGreeting({ situation: 'ontrack', firstName: 'Meir', ladder: 8 }),
    fillWelcome('Mushky'),
  ]
  for (const line of guidance) assert.deepEqual(hitsIn(line), [])

  const dashboard = await readFile(path.join(root, 'src/pages/KidDashboard.jsx'), 'utf8')
  const chat = await readFile(path.join(root, 'src/components/ChatBuddy.jsx'), 'utf8')
  assert.equal(dashboard.includes('type="checkbox"'), false)
  assert.match(chat, /Hi! Need help\?/)
  assert.match(chat, /autoOpenFor\(openedFor, kidId\)/)
  assert.equal(chat.includes('commanderPref'), false)
})
