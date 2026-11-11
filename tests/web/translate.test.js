// Static locales. The page does not call POST /translate.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (path) => readFileSync(join(root, path), 'utf8')

const {
  TARGET_LANGS,
  LANG_STORAGE_KEY,
  htmlAttrsFor,
  looksLikeSecret,
  shouldTranslateText,
  splitEdges,
  readStoredLang,
  writeStoredLang,
  lookup,
} = await import('../../src/lib/pageTranslate.js')

test('html direction is rtl only for Hebrew', () => {
  assert.deepEqual(htmlAttrsFor('he'), { dir: 'rtl', lang: 'he' })
  assert.deepEqual(htmlAttrsFor('ru'), { dir: 'ltr', lang: 'ru' })
  assert.deepEqual(htmlAttrsFor('it'), { dir: 'ltr', lang: 'it' })
  assert.deepEqual(htmlAttrsFor('fr'), { dir: 'ltr', lang: 'fr' })
  assert.deepEqual(htmlAttrsFor('en'), { dir: 'ltr', lang: 'en' })
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
})

test('secrets are not treated as copy to translate', () => {
  assert.equal(shouldTranslateText('Home'), true)
  assert.equal(shouldTranslateText('2015-05-05'), false)
  assert.equal(looksLikeSecret('123456'), true)
  assert.equal(shouldTranslateText('Bearer abc.def.ghi'), false)
  const { lead, core, tail } = splitEdges('  Home  ')
  assert.equal(core, 'Home')
  assert.equal(`${lead}${core}${tail}`, '  Home  ')
})

test('static locales translate the home hero and keep campaign names', () => {
  assert.equal(lookup('en', 'Home'), 'Home')
  assert.equal(lookup('he', 'Home'), 'בית')
  assert.equal(lookup('ru', 'Home'), 'Главная')
  assert.equal(lookup('it', 'Home'), 'Inizio')
  assert.equal(lookup('fr', 'Home'), 'Accueil')
  const hero = lookup('he', 'Every Kapitel.')
  assert.match(hero, /Kapitel/)
  assert.doesNotMatch(hero, /fetch|\/translate/)
  const sentence = lookup('fr', 'Saying the entire Tehillim on Shabbos Mevorchim is important for you, your children, and your children\'s children.')
  assert.match(sentence, /Tehillim/)
  assert.match(sentence, /Shabbos Mevorchim/)
  assert.match(sentence, /important/)
  assert.equal(lookup('ru', '5 - White'), '5 - Белый')
  assert.equal(lookup('it', '12 this month'), '12 questo mese')
  assert.equal(lookup('he', 'Oholei Torah'), 'Oholei Torah')
})

test('the header and the phone menu both offer the four languages and English', () => {
  const layout = read('src/components/Layout.jsx')
  const buttons = read('src/components/LanguageSwitch.jsx') + read('src/lib/pageTranslate.js')
  assert.equal(layout.split('<LanguageSwitch').length - 1, 2)
  for (const label of ['English', 'Hebrew', 'Russian', 'Italian', 'French']) {
    assert.match(buttons, new RegExp(`label: '${label}'`))
  }
  assert.deepEqual(TARGET_LANGS.map((item) => item.code), ['he', 'ru', 'it', 'fr'])
})

test('the frontend does not call the translate endpoint', () => {
  const page = read('src/lib/pageTranslate.js')
  const context = read('src/context/LanguageContext.jsx')
  const api = read('src/services/api.js')
  assert.equal(page.includes('/translate'), false)
  assert.equal(page.includes('fetch('), false)
  assert.equal(context.includes('translatePage'), false)
  assert.equal(context.includes('/translate'), false)
  assert.equal(api.includes('function translatePage'), false)
  assert.equal(api.includes("'/translate'"), false)
})
