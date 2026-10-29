import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { confirmLadderChoice, openingGreeting } from '../../src/lib/general613.js'
import { CHES_WORDS, phonemeOf, phonemeScript, pronounce } from '../../src/lib/pronounce.js'
import { spokenText } from '../../src/lib/speech.js'

const CHES = {
  kapitlach: "k0p'Itl0x",
  Cheshvan: "x'ESvn",
  Hatzlacha: "hatsl'Ox@",
  hatzlacha: "hatsl'Ox@",
  Moshiach: "moS'iax",
  Chassidus: "xas'id@s",
  Chodesh: "x'odES",
  bochur: "b'oxur",
  Mevorchim: "m@v'ORxIm",
  chayol: "x'ajol",
  chizuk: "xiz'uk",
  Chof: "x'of",
  HaMelech: "ham'El@x",
}

test('every ches and chaf is the guttural phoneme x, not k and not tch', () => {
  for (const [word, phone] of Object.entries(CHES)) {
    assert.equal(phonemeOf(word), phone, word)
    assert.match(phone, /x/, word)
    assert.equal(phone.includes('tS'), false, word)
  }
  for (const word of CHES_WORDS) {
    const phone = phonemeOf(word)
    assert.ok(phone, word)
    assert.match(phone, /x/, word)
    assert.equal(phone.includes('tS'), false, word)
  }
})

test('the spoken script uses those phonemes and does not leave the spelling', () => {
  const line = 'Tehillim, kapitlach, Tzivos Hashem, Hatzlacha, Shabbos Mevorchim, Cheshvan, Moshiach, Chassidus, Chodesh, bochur.'
  const script = phonemeScript(line)
  assert.equal(
    script,
    "[[tE'hIlIm]], [[k0p'Itl0x]], [[ts'ivos]] [[haS'Em]], [[hatsl'Ox@]], [[S'0b@s]] [[m@v'ORxIm]], [[x'ESvn]], [[moS'iax]], [[xas'id@s]], [[x'odES]], [[b'oxur]].",
  )
  assert.equal(script.includes('tS'), false)
  assert.equal(script.includes('Cheshvan'), false)
  assert.equal(script.includes('kapitlach'), false)
  assert.equal(phonemeScript('חשון'), "[[x'ESvn]]")
  assert.equal(phonemeScript('Say Tehillim today.'), "Say [[tE'hIlIm]] today.")
  assert.equal(phonemeScript('Save the ladder. I have time.'), 'Save the ladder. I have time.')
})

test('eSpeak keeps x in the phoneme string it will speak', () => {
  let espeak
  try {
    espeak = execFileSync('espeak-ng', ['-v', 'en-us', '-x', '-q', phonemeScript(
      'kapitlach Cheshvan Hatzlacha Moshiach Chassidus Chodesh bochur Mevorchim',
    )], { encoding: 'utf8' })
  } catch {
    return
  }
  assert.match(espeak, /k0p'Itl0x/)
  assert.match(espeak, /x'ESvn/)
  assert.match(espeak, /hatsl'Ox@/)
  assert.match(espeak, /ax/)
  assert.match(espeak, /xas'id@s/)
  assert.match(espeak, /x'odES/)
  assert.match(espeak, /b'oxur/)
  assert.match(espeak, /ORxIm/)
  assert.equal(espeak.includes('tS'), false)
})

test('the chat spelling stays put', () => {
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
  assert.equal(greeting.includes('[['), false)
  assert.equal(greeting.includes("x'ESvn"), false)
  const wish = confirmLadderChoice({ firstName: 'Meir' })
  assert.match(wish, /hatzlacha/)
  assert.equal(wish.includes('hatsl'), false)
  assert.match(phonemeScript(wish), /\[\[hatsl'Ox@\]\]/)
  assert.match(spokenText('Hatzlacha'), /hatz-LAH-chah/)
  assert.equal(pronounce('613 Tehillim').includes('[['), false)
})
