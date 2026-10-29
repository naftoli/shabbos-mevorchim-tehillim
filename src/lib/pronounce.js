// Ashkenazi / Chabad pronunciations for the virtual commander.
//
// The chat keeps the normal spelling. What is spoken is an eSpeak phoneme
// script: every ches (ח) and chaf (כ) is the phoneme x, the guttural in
// Scottish "loch". It is never the English k and never tS ("tch").
//
// Words whose "ch" is Yiddish tsch (טש), not ches, stay tS: bentch, Lubavitch.
//
// The browser's speechSynthesis voice cannot say x. speak() sends this script
// to the speak API, which runs eSpeak NG, and plays that audio.

// Longer words first so "kapitlach" is not eaten by "kapitel".
const PHONEMES = [
  ['Marcheshvan', "marx'ESvn"],
  ['Frierdiker', "fr'i@rdIk@r"],
  ['Chassidim', "xas'idim"],
  ['Chassidus', "xas'id@s"],
  ['Lubavitch', "lub'avItS"],
  ['kapitlach', "k0p'Itl0x"],
  ['Hatzlacha', "hatsl'Ox@"],
  ['Mevorchim', "m@v'ORxIm"],
  ['HaMelech', "ham'El@x"],
  ['Moshiach', "moS'iax"],
  ['Hashanah', "haS'0n@"],
  ['Hashana', "haS'0n@"],
  ['Cheshvan', "x'ESvn"],
  ['Heshvan', "x'ESvn"],
  ['bochurim', "b'oxurim"],
  ['chayolim', "x'ajolim"],
  ['davening', "d'av@nIng"],
  ['bentches', "b'EntSIz"],
  ['mitzvos', "m'itsvos"],
  ['mitzvot', "m'itsvos"],
  ['mitzvah', "m'itsv@"],
  ['Tishrei', "t'ISreI"],
  ['Tehillim', "tE'hIlIm"],
  ['kapitel', "k0'pIt@l"],
  ['bentsch', "b'EntS"],
  ['bentch', "b'EntS"],
  ['Shabbat', "S'0b@s"],
  ['Shabbos', "S'0b@s"],
  ['Chodesh', "x'odES"],
  ['minhag', "m'inh0g"],
  ['mivtza', "miv'ts0"],
  ['chizuk', "xiz'uk"],
  ['chayol', "x'ajol"],
  ['Hayom', "haj'om"],
  ['Dovid', "d'OvId"],
  ['Kislev', "k'IslEv"],
  ['Shevat', "Sv'0t"],
  ['Shvat', "Sv'0t"],
  ['Teves', "t'EvEs"],
  ['Nissan', "n'is0n"],
  ['Tammuz', "t0m'uz"],
  ['Sivan', "s'iv0n"],
  ['Tzivos', "ts'ivos"],
  ['Hashem', "haS'Em"],
  ['Shalom', "S'olom"],
  ['sholom', "S'olom"],
  ['bochur', "b'oxur"],
  ['Kippur', "k'ipUr"],
  ['Elul', "El'ul"],
  ['Adar', "ad'0r"],
  ['Iyar', "'ijar"],
  ['daven', "d'av@n"],
  ['Sefer', "s'Ef@r"],
  ['Torah', "t'Or@"],
  ['Rebbe', "r'Eb@"],
  ['Rabbi', "r'0bi"],
  ['chof', "x'of"],
  ['shul', "S'ul"],
  ['Hei', "h'eI"],
  ['Rosh', "r'OS"],
  ['Yom', "j'om"],
  ['Tov', "t'ov"],
  ['Gut', "g'ut"],
  ['Av', "'0v"],
]

// Ches / chaf words. Their phoneme script must contain x and must not contain tS.
export const CHES_WORDS = [
  'kapitlach', 'Cheshvan', 'Hatzlacha', 'Moshiach', 'Chassidus', 'Chodesh',
  'bochur', 'Mevorchim', 'chayol', 'chizuk', 'Chof', 'HaMelech', 'Marcheshvan',
]

const HEBREW_MONTHS = [
  ['אדר ב׳', 'Adar'],
  ['אדר א׳', 'Adar'],
  ['תשרי', 'Tishrei'],
  ['חשון', 'Cheshvan'],
  ['כסלו', 'Kislev'],
  ['טבת', 'Teves'],
  ['שבט', 'Shvat'],
  ['אדר', 'Adar'],
  ['ניסן', 'Nissan'],
  ['אייר', 'Iyar'],
  ['סיון', 'Sivan'],
  ['תמוז', 'Tammuz'],
  ['אלול', 'Elul'],
  ['אב', 'Av'],
]

function escapeReg(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
}

const PHONEME_RE = new RegExp(
  `(?<![A-Za-z])(?:${PHONEMES.map(([word]) => escapeReg(word)).join('|')})(?![A-Za-z])`,
  'gi',
)

const PHONEME_OF = new Map(PHONEMES.map(([word, phone]) => [word.toLowerCase(), phone]))

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

export function phonemeOf(word) {
  return PHONEME_OF.get(String(word).toLowerCase()) ?? null
}

// eSpeak phoneme script. Hebrew words are wrapped in [[phonemes]]; English stays.
export function phonemeScript(text) {
  const withMonths = sayHebrewMonths(String(text ?? ''))
  return withMonths.replace(PHONEME_RE, (match) => {
    const key = match.toLowerCase().replace(/\s+/g, ' ')
    const phone = PHONEME_OF.get(key)
    return phone ? `[[${phone}]]` : match
  })
}

// Last-resort spelling if the speak API is down. The guttural x is not in this
// form; an English browser voice cannot say it.
const FALLBACK = [
  ['Marcheshvan', 'mar-CHESH-vahn'],
  ['Frierdiker', 'FREE-er-dih-ker'],
  ['Chassidus', 'chah-SEE-dus'],
  ['Lubavitch', 'loo-BAH-vitch'],
  ['kapitlach', 'kah-PIT-lach'],
  ['Hatzlacha', 'hatz-LAH-chah'],
  ['Mevorchim', 'meh-VOR-chim'],
  ['HaMelech', 'hah-MEH-lech'],
  ['Moshiach', 'moh-SHEE-ach'],
  ['Hashana', 'hah-SHAH-nah'],
  ['Hashanah', 'hah-SHAH-nah'],
  ['Cheshvan', 'CHESH-vahn'],
  ['Heshvan', 'CHESH-vahn'],
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

const FALLBACK_OF = new Map(FALLBACK.map(([word, said]) => [word.toLowerCase(), said]))

export function pronounce(text) {
  const withMonths = sayHebrewMonths(String(text ?? ''))
  return withMonths.replace(PHONEME_RE, (match) => {
    const key = match.toLowerCase().replace(/\s+/g, ' ')
    return FALLBACK_OF.get(key) ?? match
  })
}
