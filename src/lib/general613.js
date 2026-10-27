// General 613 — the Tehillim Club's talking general. Situation drives the
// spoken greeting when a soldier signs in. "Ahead" is last month only: they
// said more than that month's quota (not a three-month streak).

export const BOT_NAME = 'General 613'

function priorMonths(progress) {
  return (progress?.months ?? []).filter((m) => !m.isCurrent)
}

export function readSituation(ctx) {
  const { ladder, progress } = ctx ?? {}
  if (!ladder) return 'pick'
  const prior = priorMonths(progress)
  const last = prior[prior.length - 1]
  const quota = Number(last?.quota)
  if (!last || !Number.isFinite(quota) || quota <= 0) return 'ontrack'
  // Missed last month's quota.
  if (!last.met) return 'behind'
  // Beat last month's quota (more kapitlach than required).
  if (Number(last.said) > quota) return 'ahead'
  return 'ontrack'
}

export function openingGreeting(ctx) {
  const missions = ctx?.progress?.missionsTotal ?? 0
  switch (ctx?.situation) {
    case 'pick':
      return `Hi, I'm ${BOT_NAME}. I see you didn't pick a ladder yet. Let's pick the ladder.`
    case 'behind':
      return `Hi, I'm ${BOT_NAME}. Where were you last month?`
    case 'ahead':
      return `Hi, I'm ${BOT_NAME}. I see you did a great job last month. You did more than your quota. Would you like to go to a higher quota?`
    default:
      return `Hi, I'm ${BOT_NAME}. 👋 So good to see you — you're doing beautifully, ${missions} missions done. Need anything? I can show your mission this month or how you're doing.`
  }
}

export function quickRepliesFor(ctx) {
  switch (ctx?.situation) {
    case 'pick':
      return ['Help me pick my ladder', 'How does it work?']
    case 'behind':
      return ['What do I say this month?', 'How does it work?']
    case 'ahead':
      return ctx.ladder > 5
        ? [`Tell me about Ladder ${ctx.ladder - 1}`, 'How am I doing?']
        : ['How am I doing?', 'How does it work?']
    default:
      return ['My mission this month', 'How am I doing?', 'My medals']
  }
}
