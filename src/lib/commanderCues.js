// Short lines for Your Virtual Commander. Draft wording from the Oct 30 plan.
// Warm army language. Never guilt, never an accusation, never a ladder change
// the chayol did not choose.

export function cueWelcome() {
  return "Welcome, soldier! Here, every kapitel counts — even one word of Tehillim makes a difference. There is also a big mission ahead: training, step by step, until you can say the entire Tehillim on Shabbos Mevorchim. Two choices are yours: do you want to make it YOUR mission? And which ladder will you climb to get there?"
}

export function cueLadder() {
  return "Your ladder is your training path — it's built to get you to the entire Tehillim by the grade you choose. Ladder 12 builds you up step by step toward 12th grade; Ladder 9 aims for 9th. Pick the one you're ready to take on. It's your choice, and you can change it later."
}

export function cueNewMonth(kapitlach, minutes) {
  const kap = Number(kapitlach)
  const min = Number(minutes)
  if (!Number.isFinite(kap)) return "New month, new mission! You've got this."
  const time = Number.isFinite(min) ? `, about ${min} minutes` : ''
  return `New month, new mission! This month: ${kap} kapitlach${time}, every Shabbos Mevorchim. You've got this.`
}

export function cueReport() {
  return 'What did you say this Shabbos Mevorchim? Enter your kapitlach and minutes.'
}

export function cueAboveQuota(kapitlach) {
  const n = Number(kapitlach)
  const shown = Number.isFinite(n) ? `${n} kapitlach` : 'that amount'
  return `Wow — ${shown}! That's more than your mission. These numbers go into the official report, so just to be sure: is that 100% correct?`
}

export function cueAboveFixed() {
  return 'No problem — fixed. Thanks for getting it right!'
}

export function cueAboveConfirmed() {
  return "Incredible. Above and beyond — that's what a real soldier looks like. Every single word counts."
}

export function cueMissionComplete() {
  return 'Mission complete! Every kapitel you said counts — for you, for your platoon, for your base, and for the whole army.'
}

export function cuePerfectPlatoon() {
  return 'PERFECT PLATOON! Every single soldier in your platoon completed their mission.'
}

export function cueMissed() {
  return "Looks like this month's mission isn't checked off. Did you say your Tehillim and just not report it yet? It takes ten seconds."
}

export function cueMissedFresh() {
  return 'No problem — a new month means a fresh mission. Your streak starts again, and your longest streak is still yours.'
}

export function cueInviteHarder() {
  return "For three months straight you've done more than your ladder asks. Would you like to move up to a faster ladder? Totally your call — staying put is perfectly fine too."
}

export function cueInviteGentler() {
  return 'This has been tough a few months in a row. Want to try an easier ladder for a while? The mission stays the same — Tehillim every Shabbos Mevorchim — and every word still counts.'
}

export function cueMedalInfo(name, threshold) {
  const medal = name ? String(name).toLowerCase() : 'next'
  const n = Number(threshold)
  const count = Number.isFinite(n) ? `${n} completed missions` : 'completed missions'
  return `The ${medal} medal: ${count}. They don't need to be in a row — every completed mission counts, forever.`
}

export function cueMedalEarned(name, threshold, nextName, nextThreshold, when) {
  const medal = String(name || 'next').toUpperCase()
  const n = Number(threshold)
  let line = `THE ${medal} MEDAL IS YOURS!${Number.isFinite(n) ? ` ${n} missions complete.` : ''} You'll get the real medal at school, and your rank book is updated.`
  if (nextName && nextThreshold) {
    line += ` Next stop: the ${String(nextName).toLowerCase()} medal at ${nextThreshold}!`
  }
  if (when) line += ` You can reach it by ${when}.`
  return line
}

export function cuePromotion(rank) {
  const title = String(rank || '').toUpperCase()
  if (!title) return ''
  const nice = title.charAt(0) + title.slice(1).toLowerCase()
  return `Attention! You've been promoted to ${title}. Congratulations, ${nice}.`
}

export function cueJourney() {
  return "See that bar? That's your whole training path. You're here now. At the end: the entire Tehillim, every Shabbos Mevorchim."
}

export function cueRankings({ myRank, classRank, schoolRank } = {}) {
  const bits = []
  if (myRank) bits.push(`You're #${myRank} in your platoon`)
  if (classRank) bits.push(`your platoon is #${classRank} in your base`)
  if (schoolRank) bits.push(`your base is #${schoolRank} in the whole army`)
  if (!bits.length) return 'Your rankings are on your page. Every kapitel you say lifts your platoon and your base.'
  const text = bits.join(', ').replace(/^your/, 'Your')
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`
}

export function cueAheadOne() {
  return "You did more than your mission. Above and beyond — that's what a real soldier looks like."
}
