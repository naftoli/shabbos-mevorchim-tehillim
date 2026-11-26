// Approved explanations the site shows and the commander looks up.
// How It Works renders these paragraphs. The commander searches the same
// strings, so a wording change on the page is the wording it can quote.

export const SITE_GUIDE = [
  {
    id: 'goal',
    title: 'The Goal',
    href: '/how-to#goal',
    synonyms: ['goal', 'point', 'aim', 'entire', 'whole', 'enemies', 'power', 'children', 'word'],
    paragraphs: [
      'Say the entire Tehillim each Shabbos Mevorchim.',
      'The Tehillim of children has a special power: it protects and foils the plans of our enemies. Every word - matters.',
    ],
  },
  {
    id: 'training',
    title: 'Training',
    href: '/how-to#training',
    synonyms: ['training', 'train', 'practice', 'habit', 'pre1a', 'impossible', 'step'],
    paragraphs: [
      'Saying the entire Tehillim right now may feel like an impossible challenge. But you have your years in school to train, one step at a time.',
      'Training can begin in Pre1A with a quota of just one kapitel. Each Shabbos Mevorchim, that quota grows a little more. Month by month, year by year, you work toward saying the entire Tehillim - building a Shabbos Mevorchim habit you can carry with you for the rest of your life.',
    ],
  },
  {
    id: 'ladders',
    title: 'Ladders',
    href: '/how-to#ladders',
    synonyms: ['ladder', 'ladders', 'pace', 'path', '12th', '5th', 'quota', 'choose', 'climb'],
    paragraphs: [
      'Your ladder is your training path toward saying the entire Tehillim. Which ladder will you choose to climb?',
      'Ladder 12 builds toward completing your training by 12th grade. Ladder 5 builds toward completing it by 5th grade.',
      'Every ladder leads to the same goal. Choose the pace that\'s right for you, to determine your quota of tehillim to say each month.',
    ],
  },
  {
    id: 'medals',
    title: 'Medals',
    href: '/how-to#medals',
    synonyms: ['medal', 'medals', 'white', 'red', 'mission', 'missions', 'award', 'color', 'milestone'],
    paragraphs: [
      'Celebrate your progress, one medal at a time.',
      'Complete your quota for 5 missions to earn your white Tehillim medal. Complete 6 more missions - 11 in total - to earn your red medal. Each new medal takes one more mission than the last step.',
      'Every completed mission brings you closer to your next medal. If you miss a mission, the progress you\'ve earned stays with you.',
      'What color medal will you earn? Be all you can be in Hashem\'s army.',
    ],
  },
  {
    id: 'streaks',
    title: 'Streaks',
    href: '/how-to#streaks',
    synonyms: ['streak', 'streaks', 'row', 'longest', 'flame', 'miss'],
    paragraphs: [
      'A streak is the number of missions you complete in a row without missing one.',
      'Longest Streak: The most missions you\'ve ever completed in a row without missing one.',
    ],
  },
  {
    id: 'platoon',
    title: 'Perfect Platoons',
    href: '/how-to#platoon',
    synonyms: ['platoon', 'platoons', 'class', 'perfect', 'soldiers'],
    paragraphs: [
      'Your class is your platoon. When every soldier in your class completes their own quota, your class is listed as a Perfect Platoon for that mission.',
    ],
  },
  {
    id: 'base',
    title: 'Base',
    href: '/how-to#base',
    synonyms: ['base', 'school', 'quota'],
    paragraphs: [
      'Your school is your base. Its quota is all the individual soldiers\' quotas added together.',
    ],
  },
  {
    id: 'army',
    title: 'Army',
    href: '/how-to#army',
    synonyms: ['army', 'world', 'worldwide', 'tzivos', 'counting'],
    paragraphs: [
      'Together, all the soldiers\' quotas around the world make up the army\'s quota.',
      'When you choose your ladder, choose one with a quota you\'re confident you can complete. Your platoon, your base, and the entire army are counting on you.',
    ],
  },
  {
    id: 'report',
    title: 'Mark what you said',
    href: '/how-to#report',
    synonyms: ['report', 'save', 'enter', 'type', 'put', 'log', 'kapitlach', 'minutes', 'direct'],
    paragraphs: [
      'I can direct you how to do it. On your page, under Kapitlach I said, type how many kapitlach you said. Under Minutes I said, type how many minutes you spent saying Tehillim. Then tap Save.',
      'I can show you where to type it. I cannot type your Tehillim in for you, and I cannot save a report by myself.',
    ],
  },
]

export function guideSection(id) {
  return SITE_GUIDE.find((section) => section.id === id)
}
