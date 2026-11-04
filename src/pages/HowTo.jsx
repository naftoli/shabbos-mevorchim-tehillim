import { useEffect, useRef, useState } from 'react'
import { Card, Button } from '@/components/ui.jsx'
import { asset } from '@/lib/asset.js'

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

// Small section marks. Same rendered height on every section (56px, 64px from sm).
const ICONS = {
  training: {
    src: 'design/how/training-arrow.webp',
    width: 256,
    height: 153,
    alt: 'Glossy blue arrow climbing in steps',
  },
  platoon: {
    src: 'design/how/perfect-platoon.webp',
    width: 256,
    height: 196,
    alt: 'Classroom with desks, a chalkboard, books, and a clock',
  },
  base: {
    src: 'design/how/base.webp',
    width: 105,
    height: 79,
    alt: 'School building',
  },
  army: {
    src: 'design/how/army.webp',
    width: 256,
    height: 231,
    alt: 'Tzivos Hashem shield: Army of Hashem, We Want Moshiach Now',
  },
}

function Block({ title, icon, children }) {
  return (
    <Card className="p-6 sm:p-8">
      <div className="flex items-center gap-3 sm:gap-4">
        {icon ? (
          <img
            src={asset(icon.src)}
            alt={icon.alt}
            width={icon.width}
            height={icon.height}
            draggable="false"
            className="h-14 w-auto shrink-0 object-contain sm:h-16"
          />
        ) : null}
        <h2 className="min-w-0 font-display text-2xl font-black text-navy">{title}</h2>
      </div>
      <div className="mt-3 space-y-3 text-[16px] leading-relaxed text-navy/85">{children}</div>
    </Card>
  )
}

function Banner({ src, alt, width, height, scroll }) {
  const scroller = useRef(null)
  const [more, setMore] = useState(false)
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const update = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [scroll])

  const img = (
    <img
      src={asset(src)}
      alt={alt}
      width={width}
      height={height}
      draggable="false"
      className={`block h-auto w-full ${scroll ? 'min-w-[40rem]' : ''}`}
    />
  )
  if (!scroll) return img
  // The medal row is very wide. On a phone, content width would shrink each
  // coin to a sliver, so the row scrolls until the card is wide enough.
  // The fade shows only while more coins are waiting off to the right.
  return (
    <div className="relative">
      <div ref={scroller} className="overflow-x-auto touch-pan-x [scrollbar-width:thin]">{img}</div>
      {more ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#c3dcff] to-transparent"
        />
      ) : null}
    </div>
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
          <Banner
            src="design/how/goal-mipi-olelim.webp"
            width={1600}
            height={317}
            alt="Banner reading מפי עוללים ויונקים יסדת עז — From the mouths of children and infants You established strength"
          />
          <p>The Tehillim of children has a special power: it protects and foils the plans of our enemies. Every word - matters.</p>
        </Block>

        <Block title="Training" icon={ICONS.training}>
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
          <Banner
            src="design/how/medals.webp"
            width={1600}
            height={146}
            scroll
            alt="Row of Tehillim medals for 5 white, 11 red, 18 orange, 26 yellow, 35 green, 45 blue, 56 purple, 68 brown, 81 gray, and 95 black missions"
          />
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
          <Banner
            src="design/how/streaks.webp"
            width={1600}
            height={356}
            alt="Streak bar from Month 1 through Month 6, with Month 4 highlighted and a flame at the end"
          />
        </Block>

        <Block title="Perfect Platoons" icon={ICONS.platoon}>
          <p>Your class is your platoon. When every soldier in your class completes their own quota, your class is listed as a Perfect Platoon for that mission.</p>
        </Block>

        <Block title="Base" icon={ICONS.base}>
          <p>Your school is your base. Its quota is all the individual soldiers' quotas added together.</p>
        </Block>

        <Block title="Army" icon={ICONS.army}>
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
