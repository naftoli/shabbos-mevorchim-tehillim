// Page translation: the facade posts to /translate with no credentials, and the
// pure helpers decide direction, storage, and which strings are safe to send.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mock, lastCall, reset } from './harness.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (path) => readFileSync(join(root, path), 'utf8')

const {
  TARGET_LANGS,
  LANG_STORAGE_KEY,
  htmlAttrsFor,
  looksLikeSecret,
  shouldTranslateText,
  uniqueMissing,
  translationCacheKey,
  splitEdges,
  readStoredLang,
  writeStoredLang,
  TRANSLATION_UNAVAILABLE,
} = await import('../../src/lib/pageTranslate.js')

const api = await import('@/services/api.js')
const mashpia = await import('@/services/mashpia.js')

test('html direction is rtl only for Hebrew', () => {
  assert.deepEqual(htmlAttrsFor('he'), { dir: 'rtl', lang: 'he' })
  assert.deepEqual(htmlAttrsFor('ru'), { dir: 'ltr', lang: 'ru' })
  assert.deepEqual(htmlAttrsFor('it'), { dir: 'ltr', lang: 'it' })
  assert.deepEqual(htmlAttrsFor('fr'), { dir: 'ltr', lang: 'fr' })
  assert.deepEqual(htmlAttrsFor('en'), { dir: 'ltr', lang: 'en' })
  assert.deepEqual(htmlAttrsFor('es'), { dir: 'ltr', lang: 'en' })
})

test('the language choice is remembered only as a known code', () => {
  const box = new Map()
  const storage = {
    getItem: (key) => (box.has(key) ? box.get(key) : null),
    setItem: (key, value) => box.set(key, value),
  }
  assert.equal(LANG_STORAGE_KEY, 'wwtc.lang')
  assert.equal(readStoredLang(storage), 'en')
  writeStoredLang(storage, 'he')
  assert.equal(readStoredLang(storage), 'he')
  writeStoredLang(storage, 'nope')
  assert.equal(readStoredLang(storage), 'en')
  assert.equal(readStoredLang(null), 'en')
})

test('secrets and already-Hebrew text are not sent', () => {
  assert.equal(shouldTranslateText('Home'), true)
  assert.equal(shouldTranslateText('Say 150 kapitlach'), true)
  assert.equal(shouldTranslateText('Enter a serial number and date of birth.'), true)
  assert.equal(shouldTranslateText(''), false)
  assert.equal(shouldTranslateText('150'), false)
  assert.equal(shouldTranslateText('2015-05-05'), false)
  assert.equal(looksLikeSecret('2015-05-05'), true)
  assert.equal(shouldTranslateText('123456'), false)
  assert.equal(shouldTranslateText('Bearer abc.def.ghi'), false)
  assert.equal(shouldTranslateText('sk-abcdefghijklmnop'), false)
  assert.equal(shouldTranslateText('soldier@example.com'), false)
  assert.equal(shouldTranslateText('גומר זיין דעם תהלים שבת מברכים'), false)
  const { lead, core, tail } = splitEdges('  Home  ')
  assert.equal(lead, '  ')
  assert.equal(core, 'Home')
  assert.equal(tail, '  ')
})

test('a cached string is not requested again', () => {
  const cache = new Map([[translationCacheKey('he', 'Home'), 'בית']])
  assert.deepEqual(uniqueMissing(['Home', 'Home', 'Schools', '150'], 'he', cache), ['Schools'])
})

test('translatePage posts the copy and does not send a token', async () => {
  reset()
  mashpia.saveToken('kid', 'secret-token', 3600)
  mock({ 'POST /translate': { body: { targetLang: 'he', translations: ['בית', 'בתי ספר'] } } })
  const data = await api.translatePage('he', ['Home', 'Schools'])
  assert.deepEqual(data.translations, ['בית', 'בתי ספר'])
  const call = lastCall()
  assert.equal(call.method, 'POST')
  assert.equal(call.apiPath, '/translate')
  assert.deepEqual(call.body, { targetLang: 'he', content: ['Home', 'Schools'] })
  assert.equal(call.headers.Authorization, undefined)
  assert.equal(JSON.stringify(call.body).includes('secret-token'), false)
  assert.deepEqual(Object.keys(call.body).sort(), ['content', 'targetLang'])
  mashpia.endSession('kid')
})

test('a string payload is passed through as a string', async () => {
  reset()
  mock({ 'POST /translate': { body: { targetLang: 'ru', translation: 'Главная' } } })
  await api.translatePage('ru', 'Home')
  assert.deepEqual(lastCall().body, { targetLang: 'ru', content: 'Home' })
  assert.equal(lastCall().headers.Authorization, undefined)
})

test('a 503 rejects and names no partial translation', async () => {
  reset()
  mock({ 'POST /translate': { status: 503, body: { error: 'Translation is not configured yet.' } } })
  await assert.rejects(() => api.translatePage('fr', ['Home']), /not configured/)
})

test('the header and the phone menu both offer the four languages and English', () => {
  const layout = read('src/components/Layout.jsx')
  const buttons = read('src/components/LanguageSwitch.jsx') + read('src/lib/pageTranslate.js')
  assert.equal(layout.split('<LanguageSwitch').length - 1, 2)
  for (const label of ['English', 'Hebrew', 'Russian', 'Italian', 'French']) {
    assert.match(buttons, new RegExp(`label: '${label}'`))
  }
  assert.deepEqual(TARGET_LANGS.map((item) => item.code), ['he', 'ru', 'it', 'fr'])
  assert.match(layout, /role="status"/)
  assert.match(read('src/main.jsx'), /LanguageProvider/)
  assert.match(read('src/lib/pageTranslate.js'), /TRANSLATION_UNAVAILABLE/)
  assert.match(TRANSLATION_UNAVAILABLE, /stays in English/)
  const apiSource = read('src/services/api.js')
  assert.match(apiSource, /export async function translatePage/)
  const fn = apiSource.slice(apiSource.indexOf('export async function translatePage'))
  assert.equal(fn.slice(0, 180).includes('serial'), false)
  assert.equal(fn.slice(0, 180).includes('Authorization'), false)
})

test('the PHP route is the existing API and reuses the chat key', () => {
  const index = read('api/index.php')
  assert.match(index, /\$path === '\/translate'/)
  assert.match(index, /wwtcTranslateRequest\(wwtcInput\(\), wwtcAiKey\(\)\)/)
  assert.match(index, /wwtcAiKey\(\)/)
  assert.equal(index.includes('WWTC_TRANSLATE'), false)
  const client = read('src/services/mashpia.js')
  const start = client.indexOf('export const translatePage')
  const body = client.slice(start, start + 220)
  assert.match(body, /\/translate/)
  assert.equal(body.includes('Authorization'), false)
  assert.equal(body.includes("as:"), false)
})
