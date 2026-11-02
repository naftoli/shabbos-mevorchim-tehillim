import { Card, Button } from '@/components/ui.jsx'

const MEDALS = [
  ['5', 'White'],
  ['11', 'Red'],
  ['18', 'Orange'],
  ['26', 'Yellow'],
  ['35', 'Green'],
  ['45', 'Blue'],
  ['56', 'Purple'],
  ['68', 'Brown'],
  ['81', 'Gray'],
  ['95', 'Black'],
  ['110', 'Bronze'],
  ['126', 'Silver'],
  ['143', 'Gold'],
]

function Block({ title, children }) {
  return (
    <Card className="p-6 sm:p-8">
      <h2 className="font-display text-2xl font-black text-navy">{title}</h2>
      <div className="mt-3 space-y-3 text-[16px] leading-relaxed text-navy/85">{children}</div>
    </Card>
  )
}

export default function HowTo() {
  return (
    <>
      <section className="hero-navy">
        <div className="mx-auto max-w-[1000px] px-4 py-12 text-white sm:px-6">
          <h1 className="font-display text-4xl font-black md:text-5xl">How It Works</h1>
        </div>
      </section>

      <div className="mx-auto max-w-[1000px] space-y-6 px-4 py-10 sm:px-6">
        <Block title="The Goal">
          <p>Say the entire Tehillim each Shabbos Mevorchim.</p>
          <p className="font-heb text-xl text-navy">מפי עוללים ….</p>
          <p>The Tehillim of children has a special power: it protects and foils the plans of our enemies. Every word - matters.</p>
        </Block>

        <Block title="Training">
          <p>Saying the entire Tehillim right now may feel like an impossible challenge. But you have your years in school to train, one step at a time.</p>
          <p>Training can begin in Pre1A with a quota of just one kapitel. Each Shabbos Mevorchim, that quota grows a little more. Month by month, year by year, you work toward saying the entire Tehillim - building a Shabbos Mevorchim habit you can carry with you for the rest of your life.</p>
        </Block>

        <Block title="Ladders">
          <p>Your ladder is your training path toward saying the entire Tehillim. Which ladder will you choose to climb?</p>
          <p>Ladder 12 builds toward completing your training by 12th grade. Ladder 5 builds toward completing it by 5th grade.</p>
          <p>Every ladder leads to the same goal. Choose the pace that's right for you, to determine your quota of tehillim to say each month.</p>
        </Block>

        <Block title="Medals">
          <p>Celebrate your progress, one medal at a time.</p>
          <p>Complete your quota for 5 missions to earn your white Tehillim medal. Complete 6 more missions - 11 in total - to earn your red medal. Each new medal takes one more mission than the last step.</p>
          <p>Your medal milestones, in total completed missions:</p>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
            {MEDALS.map(([n, name]) => (
              <li key={name} className="font-semibold text-navy">{n} - {name}</li>
            ))}
          </ul>
          <p>Every completed mission brings you closer to your next medal. If you miss a mission, the progress you've earned stays with you.</p>
          <p>What color medal will you earn? Be all you can be in Hashem's army.</p>
        </Block>

        <Block title="Streaks">
          <p>A streak is the number of missions you complete in a row without missing one.</p>
          <p>Longest Streak: The most missions you've ever completed in a row without missing one.</p>
        </Block>

        <Block title="Perfect Platoons">
          <p>Your class is your platoon. When every soldier in your class completes their own quota, your class is listed as a Perfect Platoon for that mission.</p>
        </Block>

        <Block title="Base">
          <p>Your school is your base. Its quota is all the individual soldiers' quotas added together.</p>
        </Block>

        <Block title="Army">
          <p>Together, all the soldiers' quotas around the world make up the army's quota.</p>
          <p>When you choose your ladder, choose one with a quota you're confident you can complete. Your platoon, your base, and the entire army are counting on you.</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button to="/login" variant="navy">I'm a Soldier</Button>
            <Button to="/" variant="gold">See the Army Report</Button>
          </div>
        </Block>
      </div>
    </>
  )
}
