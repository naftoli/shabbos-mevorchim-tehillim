// French is a static locale. The page does not call POST /translate.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
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
const { FRENCH_ENTRY_COUNT } = await import('../../src/lib/i18n.js')

test('french is left to right and english stays the default', () => {
  assert.deepEqual(htmlAttrsFor('fr'), { dir: 'ltr', lang: 'fr' })
  assert.deepEqual(htmlAttrsFor('en'), { dir: 'ltr', lang: 'en' })
  assert.deepEqual(htmlAttrsFor('he'), { dir: 'ltr', lang: 'en' })
  assert.deepEqual(TARGET_LANGS.map((item) => item.code), ['fr'])
})

test('the language choice is remembered only as english or french', () => {
  const box = new Map()
  const storage = {
    getItem: (key) => (box.has(key) ? box.get(key) : null),
    setItem: (key, value) => box.set(key, value),
  }
  assert.equal(LANG_STORAGE_KEY, 'wwtc.lang')
  assert.equal(readStoredLang(storage), 'en')
  writeStoredLang(storage, 'fr')
  assert.equal(readStoredLang(storage), 'fr')
  writeStoredLang(storage, 'he')
  assert.equal(readStoredLang(storage), 'en')
  writeStoredLang(storage, 'ru')
  assert.equal(readStoredLang(storage), 'en')
  writeStoredLang(storage, 'it')
  assert.equal(readStoredLang(storage), 'en')
  writeStoredLang(storage, 'es')
  assert.equal(readStoredLang(storage), 'en')
  writeStoredLang(storage, 'pt')
  assert.equal(readStoredLang(storage), 'en')
})

test('secrets and hebrew are not treated as copy to translate', () => {
  assert.equal(shouldTranslateText('Home'), true)
  assert.equal(shouldTranslateText('2015-05-05'), false)
  assert.equal(looksLikeSecret('123456'), true)
  assert.equal(shouldTranslateText('שַׁבָּת מְבָרְכִים'), false)
  const { lead, core, tail } = splitEdges('  Home  ')
  assert.equal(core, 'Home')
  assert.equal(`${lead}${core}${tail}`, '  Home  ')
})

test('the approved french sheet is used exactly', () => {
  assert.equal(FRENCH_ENTRY_COUNT, 514)
  assert.equal(lookup('en', 'Home'), 'Home')
  assert.equal(lookup('fr', 'Home'), 'Accueil')
  assert.equal(lookup('fr', 'How It Works'), 'Comment ça marche')
  assert.equal(lookup('fr', 'Quota reached!'), 'Quota atteint !')
  assert.equal(lookup('fr', 'Menu'), 'Menu')
  assert.equal(lookup('fr', 'Graphics'), 'Graphismes')
  assert.equal(lookup('fr', 'Since 5778'), 'Depuis 5778')
  assert.equal(lookup('fr', 'Yes, submit'), 'Oui, envoyer')
  assert.equal(lookup('fr', 'Yes, that’s correct'), "Oui, c'est exact")
  assert.equal(lookup('fr', 'Language'), 'Langue')
  assert.equal(lookup('fr', '42% of goal'), "42 % de l'objectif")
  assert.equal(
    lookup('fr', 'Saved. Rivka Cohen finishes 80 kapitlach by 5th grade.'),
    "Enregistré. Rivka Cohen termine 80 chapitres d'ici 5th grade.",
  )
  assert.equal(
    lookup('fr', 'תשרי — your school in the world, your platoon in your base, and you among the Chayolim in your base.'),
    'תשרי — votre école dans le monde, votre peloton dans votre base, et vous parmi les Chayolim de votre base.',
  )
  assert.equal(lookup('fr', 'This string is not on the sheet.'), 'This string is not on the sheet.')
  assert.equal(lookup('he', 'Home'), 'Home')
  assert.equal(lookup('ru', 'Home'), 'Home')
})

test('the header offers english and french only', () => {
  const layout = read('src/components/Layout.jsx')
  const buttons = read('src/components/LanguageSwitch.jsx') + read('src/lib/pageTranslate.js')
  assert.equal(layout.split('<LanguageSwitch').length - 1, 2)
  assert.match(buttons, /label: 'French'/)
  assert.match(buttons, /label: 'English'/)
  assert.doesNotMatch(buttons, /label: 'Hebrew'|label: 'Russian'|label: 'Italian'|label: 'Spanish'|label: 'Portuguese'/)
})

test('the frontend does not call a translation service', () => {
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'dist') continue
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.(js|jsx|php|mjs)$/.test(name)) files.push(path)
    }
  }
  walk(join(root, 'src'))
  walk(join(root, 'api'))
  const bundled = files.map((path) => readFileSync(path, 'utf8')).join('\n')
  assert.equal(bundled.includes('/translate'), false)
  assert.equal(bundled.includes('translate.php'), false)
  assert.equal(read('src/lib/i18n.js').includes('WWTC_AI_KEY'), false)
  assert.equal(read('src/lib/pageTranslate.js').includes('fetch('), false)
  assert.equal(read('src/context/LanguageContext.jsx').includes('fetch('), false)
  assert.equal(read('src/services/api.js').includes("'/translate'"), false)
})
