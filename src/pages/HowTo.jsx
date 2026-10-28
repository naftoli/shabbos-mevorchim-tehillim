import { Card, Button } from '@/components/ui.jsx'
import { PageHero } from './_page.jsx'
import { asset } from '@/lib/asset.js'
import { MEDAL_THRESHOLDS } from '@/lib/medals.js'

const STEPS = [
  {
    n: 1,
    title: 'Pick your ladder',
    body: 'Your ladder is your training plan — the grade by which you’ll finish training to say the whole Tehillim (Ladder 5 finishes training by 5th grade, up to Ladder 12 by 12th). A steeper ladder trains faster. Saying the whole Tehillim every Shabbos Mevorchim is the goal; the ladder gets you there.',
  },
  {
    n: 2,
    title: 'Say your Tehillim',
    body: 'Every Shabbos Mevorchim your ladder tells you exactly which kapitlach to say — always from the beginning up to a set point — and a few more each month.',
  },
  {
    n: 3,
    title: 'Report it',
    body: 'Mark the month done on your dashboard. Finishing a month’s quota is a mission — and when every child in a class finishes, the class becomes a Perfect Platoon.',
  },
  {
    n: 4,
    title: 'Earn medals',
    body: `Missions add up to medals, awarded at ${MEDAL_THRESHOLDS.join(', ')} cumulative missions — eleven medals, each its own color, all the way to Platinum.`,
  },
]

export default function HowTo() {
  return (
    <>
      <PageHero eyebrow="Start Here" title="How It Works">
        Pick a ladder, say your kapitlach each Shabbos Mevorchim, report it, and earn medals — all
        the way to finishing the entire Sefer Tehillim.
      </PageHero>

      <div className="mx-auto max-w-[1000px] space-y-10 px-4 py-10 sm:px-6 lg:px-10">
        {/* The goal */}
        <img
          src={asset('brand/goal.jpg')}
          alt="Goal: to say the entire Tehillim on Shabbos Mevorchim"
          className="w-full rounded-[22px] shadow-sm sm:rounded-[28px]"
        />

        <div className="grid gap-5 sm:grid-cols-2">
          {STEPS.map((s) => (
            <Card key={s.n} className="p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full font-cond text-xl text-white" style={{ background: 'var(--grad-blue-lilac)' }}>{s.n}</span>
                <h3 className="font-display text-xl font-black text-navy">{s.title}</h3>
              </div>
              <p className="mt-3 text-navy/80">{s.body}</p>
            </Card>
          ))}
        </div>

        {/* The source — Hayom Yom, Chof Hei Shvat */}
        <div>
          <p className="sh mb-3">Why Shabbos Mevorchim Tehillim</p>
          <img
            src={asset('brand/hayom-yom.jpg')}
            alt="One should be careful to say the whole Tehillim on Shabbos Mevorchim — Hayom Yom, Chof Hei Shvat"
            className="w-full rounded-[22px] shadow-sm sm:rounded-[28px]"
          />
        </div>

        <Card className="p-6 sm:p-8">
          <p className="sh">The Big Picture</p>
          <h2 className="font-display text-2xl font-black text-navy">One army, one Sefer Tehillim</h2>
          <p className="mt-3 text-navy/85">
            Every child is climbing toward the same summit — saying all 150 kapitlach. Your quota
            rolls up into your class, your class into your school, and every school into the
            worldwide army. The Home page shows the whole army’s Tehillim climbing together.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button to="/login" variant="navy">I’m a Soldier</Button>
            <Button to="/" variant="gold">See the Worldwide Totals</Button>
          </div>
        </Card>
      </div>
    </>
  )
}
