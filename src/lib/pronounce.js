// Ashkenazi / Chabad pronunciations for the virtual commander.
//
// This changes only the string handed to speech. The chat keeps the normal
// spelling. speechSynthesis has no pronunciation dictionary and ignores SSML
// phoneme tags, and this app does not call ElevenLabs, so the words are
// respelled the way an English voice can say them. A voice that did have a
// lexicon would still receive this spelling: it is the one pronunciation layer.

// Longer spellings first so "kapitlach" is never eaten by a shorter word,
// and "bentches" is replaced before "bentch".
const SPELLINGS = [
  ['Marcheshvan', 'mar-CHESH-vahn'],
  ['Frierdiker', 'FREE-er-dih-ker'],
  ['Chassidus', 'chah-SEE-dus'],
  ['Lubavitch', 'loo-BAH-vitch'],
  ['kapitlach', 'kah-PIT-lach'],
  ['Hatzlacha', 'hatz-LAH-chah'],
  ['Mevorchim', 'meh-VOR-chim'],
  ['HaMelech', 'hah-MEH-lech'],
  ['Moshiach', 'moh-SHEE-ach'],
  ['Hashanah', 'hah-SHAH-nah'],
  ['Hashana', 'hah-SHAH-nah'],
  ['Cheshvan', 'CHESH-vahn'],
  ['Heshvan', 'CHESH-vahn'],
  ['Chassidim', 'chah-SEE-dim'],
  ['bochurim', 'BOH-chur-im'],
  ['chayolim', 'CHAI-yo-lim'],
  ['davening', 'DAH-ven-ing'],
  ['bentches', 'BENTCH-ez'],
  ['mitzvos', 'MITS-voss'],
  ['mitzvot', 'MITS-voss'],
  ['mitzvah', 'MITS-vah'],
  ['Tishrei', 'tish-RAY'],
  ['Tehillim', 'teh-HILL-im'],
  ['kapitel', 'KAH-pit-el'],
  ['bentsch', 'BENTCH'],
  ['bentch', 'BENTCH'],
  ['Shabbat', 'SHAH-bes'],
  ['Shabbos', 'SHAH-bes'],
  ['Chodesh', 'CHOH-desh'],
  ['minhag', 'MIN-hog'],
  ['mivtza', 'miv-TZAH'],
  ['chizuk', 'chee-ZOOK'],
  ['chayol', 'CHAI-yol'],
  ['Hayom', 'hah-YOHM'],
  ['Dovid', 'DOH-vid'],
  ['Kislev', 'KIS-lev'],
  ['Shevat', 'SHVAHT'],
  ['Shvat', 'SHVAHT'],
  ['Teves', 'TAY-ves'],
  ['Nissan', 'NEE-sahn'],
  ['Tammuz', 'tah-MOOZ'],
  ['Sivan', 'see-VAHN'],
  ['Tzivos', 'TZEE-vos'],
  ['Hashem', 'hah-SHEM'],
  ['Shalom', 'SHOH-lom'],
  ['sholom', 'SHOH-lom'],
  ['bochur', 'BOH-chur'],
  ['Kippur', 'KIP-oor'],
  ['Elul', 'eh-LOOL'],
  ['Adar', 'AH-dar'],
  ['Iyar', 'EE-yar'],
  ['daven', 'DAH-ven'],
  ['Sefer', 'SAY-fer'],
  ['Torah', 'TOH-rah'],
  ['Rebbe', 'REB-beh'],
  ['Rabbi', 'RAH-bee'],
  ['chof', 'CHOF'],
  ['shul', 'SHOOL'],
  ['Hei', 'hay'],
  ['Rosh', 'ROSH'],
  ['Yom', 'YOHM'],
  ['Tov', 'tohv'],
  ['Gut', 'goot'],
  ['Av', 'AHV'],
]

const HEBREW_MONTHS = [
  ['אדר ב׳', 'AH-dar bet'],
  ['אדר א׳', 'AH-dar alef'],
  ['תשרי', 'tish-RAY'],
  ['חשון', 'CHESH-vahn'],
  ['כסלו', 'KIS-lev'],
  ['טבת', 'TAY-ves'],
  ['שבט', 'SHVAHT'],
  ['אדר', 'AH-dar'],
  ['ניסן', 'NEE-sahn'],
  ['אייר', 'EE-yar'],
  ['סיון', 'see-VAHN'],
  ['תמוז', 'tah-MOOZ'],
  ['אלול', 'eh-LOOL'],
  ['אב', 'AHV'],
]

function escapeReg(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
}

const SPELLING_RE = new RegExp(
  `(?<![A-Za-z])(?:${SPELLINGS.map(([word]) => escapeReg(word)).join('|')})(?![A-Za-z])`,
  'gi',
)

const BY_KEY = new Map(SPELLINGS.map(([word, said]) => [word.toLowerCase(), said]))

function sayHebrewMonths(text) {
  let out = text
  for (const [src, said] of HEBREW_MONTHS) {
    if ([...src].length <= 2) {
      out = out.replace(new RegExp(`(?<![\\u0590-\\u05FF])${src}(?![\\u0590-\\u05FF])`, 'g'), said)
    } else {
      out = out.replaceAll(src, said)
    }
  }
  return out
}

// True when this speech engine has its own lexicon (ElevenLabs does).
// The browser voices used here do not, so they get the respelling instead.
export function voiceHasPronunciationLexicon(voice) {
  const name = `${voice?.name || ''} ${voice?.voiceURI || ''}`
  return /elevenlabs|eleven labs/i.test(name)
}

export function pronounce(text) {
  const withMonths = sayHebrewMonths(String(text ?? ''))
  return withMonths.replace(SPELLING_RE, (match) => {
    const key = match.toLowerCase().replace(/\s+/g, ' ')
    return BY_KEY.get(key) ?? match
  })
}
