import test from 'node:test'
import assert from 'node:assert/strict'
import { confirmLadderChoice, openingGreeting } from '../../src/lib/general613.js'
import { pronounce, voiceHasPronunciationLexicon } from '../../src/lib/pronounce.js'
import { spokenText } from '../../src/lib/speech.js'

const SAY = {
  Tehillim: 'teh-HILL-im',
  kapitlach: 'kah-PIT-lach',
  kapitel: 'KAH-pit-el',
  'Tzivos Hashem': 'TZEE-vos hah-SHEM',
  Hashem: 'hah-SHEM',
  Cheshvan: 'CHESH-vahn',
  Shabbos: 'SHAH-bes',
  Mevorchim: 'meh-VOR-chim',
  Moshiach: 'moh-SHEE-ach',
  Rebbe: 'REB-beh',
  mitzvah: 'MITS-vah',
  mitzvos: 'MITS-voss',
  Chassidus: 'chah-SEE-dus',
  Lubavitch: 'loo-BAH-vitch',
  Kislev: 'KIS-lev',
  Teves: 'TAY-ves',
  Shevat: 'SHVAHT',
  Shvat: 'SHVAHT',
  Adar: 'AH-dar',
  Nissan: 'NEE-sahn',
  Iyar: 'EE-yar',
  Sivan: 'see-VAHN',
  Tammuz: 'tah-MOOZ',
  Av: 'AHV',
  Elul: 'eh-LOOL',
  Tishrei: 'tish-RAY',
  'Yom Tov': 'YOHM tohv',
  'Rosh Chodesh': 'ROSH CHOH-desh',
  bochur: 'BOH-chur',
  Hatzlacha: 'hatz-LAH-chah',
  hatzlacha: 'hatz-LAH-chah',
}

test('each Hebrew word is respelled for speech', () => {
  for (const [word, said] of Object.entries(SAY)) {
    assert.equal(spokenText(word), said, word)
  }
})

test('kapitlach is not read as kapitel, and Hashem stays inside Tzivos Hashem', () => {
  assert.equal(spokenText('one kapitel and 2 kapitlach'), 'one KAH-pit-el and 2 kah-PIT-lach')
  assert.equal(spokenText('Tzivos Hashem made me!'), 'TZEE-vos hah-SHEM made me!')
  assert.equal(spokenText("in Hashem's army"), "in hah-SHEM's army")
})

test('other words the commander says are Ashkenazi too', () => {
  const line = 'Shabbos Mevorchim bentches Cheshvan. The minhag is to daven Tehillim, say a kapitel in shul, and wish hatzlacha. Gut Shabbos. The Hayom Yom on Chof Hei Shvat. Dovid HaMelech. Rosh Hashana and Yom Kippur. A Frierdiker Rebbe mivtza.'
  const said = spokenText(line)
  assert.match(said, /SHAH-bes meh-VOR-chim BENTCH-ez CHESH-vahn/)
  assert.match(said, /MIN-hog/)
  assert.match(said, /DAH-ven teh-HILL-im/)
  assert.match(said, /KAH-pit-el in SHOOL/)
  assert.match(said, /hatz-LAH-chah/)
  assert.match(said, /goot SHAH-bes/)
  assert.match(said, /hah-YOHM YOHM on CHOF hay SHVAHT/)
  assert.match(said, /DOH-vid hah-MEH-lech/)
  assert.match(said, /ROSH hah-SHAH-nah and YOHM KIP-oor/)
  assert.match(said, /FREE-er-dih-ker REB-beh miv-TZAH/)
  assert.equal(spokenText('חשון'), 'CHESH-vahn')
})

test('the chat spelling stays put; only spokenText changes', () => {
  const greeting = openingGreeting({
    ladder: null,
    firstName: 'Meir',
    grade: '1',
    monthEn: 'Cheshvan',
    situation: 'pick',
    progress: { missionsTotal: 0, months: [] },
  })
  assert.match(greeting, /Shabbos Mevorchim Tehillim/)
  assert.match(greeting, /Cheshvan/)
  assert.match(greeting, /kapitlach/)
  assert.equal(greeting.includes('teh-HILL-im'), false)
  const said = spokenText(greeting)
  assert.match(said, /SHAH-bes meh-VOR-chim teh-HILL-im/)
  assert.match(said, /CHESH-vahn/)
  assert.match(said, /kah-PIT-lach/)
  assert.equal(said.includes('Tehillim'), false)
  assert.equal(said.includes('Shabbos'), false)

  const wish = confirmLadderChoice({ firstName: 'Meir' })
  assert.match(wish, /hatzlacha/)
  assert.match(spokenText(wish), /hatz-LAH-chah/)
  assert.equal(wish.includes('hatz-LAH-chah'), false)
})

test('ordinary English and a lexicon voice are left alone', () => {
  assert.equal(spokenText('Save the ladder. I have time.'), 'Save the ladder. I have time.')
  assert.equal(spokenText('613 Tehillim'), 'six thirteen teh-HILL-im')
  const eleven = { name: 'ElevenLabs Rachel', voiceURI: 'elevenlabs-rachel' }
  assert.equal(voiceHasPronunciationLexicon(eleven), true)
  assert.equal(spokenText('Say Tehillim. Hatzlacha!', eleven), 'Say Tehillim. Hatzlacha!')
  assert.equal(voiceHasPronunciationLexicon({ name: 'Google US English' }), false)
  assert.equal(pronounce('Av'), 'AHV')
})
