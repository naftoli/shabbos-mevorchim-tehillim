// Static site copy. English is the key. Hebrew, Russian, Italian, and French
// are pre-written. School names, soldier names, and numbers are not in here.

import { PHRASES } from '../locales/phrases.js'

const TABLES = { he: new Map(), ru: new Map(), it: new Map(), fr: new Map() }

function norm(text) {
  return String(text ?? '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

for (const row of PHRASES) {
  const [english, he, ru, it, fr] = row
  const key = norm(english)
  TABLES.he.set(key, he)
  TABLES.ru.set(key, ru)
  TABLES.it.set(key, it)
  TABLES.fr.set(key, fr)
}

const COLORS = {
  White: ['לבן', 'Белый', 'Bianco', 'Blanc'],
  Red: ['אדום', 'Красный', 'Rosso', 'Rouge'],
  Orange: ['כתום', 'Оранжевый', 'Arancione', 'Orange'],
  Yellow: ['צהוב', 'Жёлтый', 'Giallo', 'Jaune'],
  Green: ['ירוק', 'Зелёный', 'Verde', 'Vert'],
  Blue: ['כחול', 'Синий', 'Blu', 'Bleu'],
  Purple: ['סגול', 'Фиолетовый', 'Viola', 'Violet'],
  Brown: ['חום', 'Коричневый', 'Marrone', 'Marron'],
  Gray: ['אפור', 'Серый', 'Grigio', 'Gris'],
  Black: ['שחור', 'Чёрный', 'Nero', 'Noir'],
  Bronze: ['ארד', 'Бронза', 'Bronzo', 'Bronze'],
  Silver: ['כסף', 'Серебро', 'Argento', 'Argent'],
  Gold: ['זהב', 'Золото', 'Oro', 'Or'],
}

const LANG_INDEX = { he: 0, ru: 1, it: 2, fr: 3 }

function fromTemplate(lang, key) {
  const i = LANG_INDEX[lang]
  if (i == null) return null
  let m = key.match(/^(\d[\d,]*) this month$/)
  if (m) {
    const word = ['החודש', 'в этом месяце', 'questo mese', 'ce mois-ci'][i]
    return `${m[1]} ${word}`
  }
  m = key.match(/^(\d+) - ([A-Za-z]+)$/)
  if (m && COLORS[m[2]]) return `${m[1]} - ${COLORS[m[2]][i]}`
  m = key.match(/^Ladder (\d+) → finish training by (.+)$/)
  if (m) {
    const line = [
      `סולם ${m[1]} → סיום האימון עד ${m[2]}`,
      `Лестница ${m[1]} → закончить подготовку к ${m[2]}`,
      `Scala ${m[1]} → finire l'allenamento entro ${m[2]}`,
      `Échelle ${m[1]} → finir l'entraînement en ${m[2]}`,
    ]
    return line[i]
  }
  return null
}

/** The static translation of one English string, or the English when none exists. */
export function lookup(lang, text) {
  const original = String(text ?? '')
  if (!lang || lang === 'en') return original
  const table = TABLES[lang]
  if (!table) return original
  const key = norm(original)
  if (!key) return original
  const hit = table.get(key) ?? fromTemplate(lang, key)
  return hit == null ? original : hit
}

export function hasTranslation(lang, text) {
  if (!lang || lang === 'en') return false
  const key = norm(text)
  return Boolean(TABLES[lang]?.has(key) || fromTemplate(lang, key))
}
