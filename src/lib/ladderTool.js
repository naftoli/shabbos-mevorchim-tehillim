// The commander may change a ladder only after it has asked out loud and the
// child has said yes, and only for a ladder that child can actually pick.

const YES = /^(yes|yeah|yep|yup|sure|okay|ok)\b|\b(that's good|thats good|that is good|good for me|works for me|i'll take it|ill take it|please switch|go ahead)\b/i

export function transcriptOffersLadder(text) {
  const t = String(text ?? '')
  return /ladder\s*\d+/i.test(t) && /(\?|want me to switch|do you want|switch you)/i.test(t)
}

export function decideLadderChange({ ladder, allowed, lastUserText, offerSpoken }) {
  const n = Number(ladder)
  const list = (allowed || []).map(Number).filter((x) => Number.isInteger(x))
  if (!Number.isInteger(n) || !list.includes(n)) {
    const choices = list.length ? list.join(', ') : 'none'
    return {
      apply: false,
      output: `Do not switch. Ladder ${ladder} is not one this soldier can pick. They can choose: ${choices}. Tell them that in one short sentence.`,
    }
  }
  const saidYes = YES.test(String(lastUserText ?? '').trim())
  if (!offerSpoken || !saidYes) {
    return {
      apply: false,
      output: `Do not switch yet. Tell the child out loud how many kapitlach and minutes ladder ${n} is this month, and ask if they want you to switch them. Call change_ladder only after they clearly say yes.`,
    }
  }
  return { apply: true, ladder: n }
}
