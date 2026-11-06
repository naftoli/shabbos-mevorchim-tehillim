import { useEffect, useRef, useState } from 'react'
import { Card, Button } from '@/components/ui.jsx'
import { asset } from '@/lib/asset.js'
import { guideSection } from '@/data/siteGuide.js'

// Milestone copy stays exactly as published. The first ten names are crops of
// design/how/medals.webp (1600×146); left/width are the opaque coin bounds.
// Bronze, Silver, and Gold are milestones on this page but are not drawn in
// that strip. Their disc colors are the ones already used in src/lib/medals.js.
const SPRITE_W = 1600
const SPRITE_H = 146
const MEDALS = [
  ['5', 'White', { left: 1, width: 148 }],
  ['11', 'Red', { left: 162, width: 148 }],
  ['18', 'Orange', { left: 323, width: 148 }],
  ['26', 'Yellow', { left: 485, width: 147 }],
  ['35', 'Green', { left: 646, width: 147 }],
  ['45', 'Blue', { left: 807, width: 147 }],
  ['56', 'Purple', { left: 968, width: 147 }],
  ['68', 'Brown', { left: 1129, width: 148 }],
  ['81', 'Gray', { left: 1290, width: 148 }],
  ['95', 'Black', { left: 1451, width: 148 }],
  ['110', 'Bronze', { color: '#8c6239', ink: '#ffffff' }],
  ['126', 'Silver', { color: '#c5ced6', ink: '#1b2a4e' }],
  ['143', 'Gold', { color: '#e0b000', ink: '#1b2a4e' }],
]

function MedalMark({ n, art }) {
  if (art.left != null) {
    return (
      <span
        aria-hidden="true"
        className="mx-auto block w-[5.75rem] bg-no-repeat sm:w-[7.25rem] md:w-36"
        style={{
          aspectRatio: `${art.width} / ${SPRITE_H}`,
          backgroundImage: `url("${asset('design/how/medals.webp')}")`,
          backgroundSize: `${(SPRITE_W / art.width) * 100}% 100%`,
          backgroundPosition: `${(100 * art.left) / (SPRITE_W - art.width)}% 0`,
        }}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="mx-auto grid w-[5.75rem] place-items-center rounded-full font-display text-2xl font-black tabular-nums sm:w-[7.25rem] sm:text-3xl md:w-36 md:text-4xl"
      style={{
        aspectRatio: '1',
        background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,.62), rgba(255,255,255,0) 46%), ${art.color}`,
        color: art.ink,
        boxShadow: 'inset 0 0 0 3px rgba(255,255,255,.7), inset 0 0 0 5px rgba(29,38,85,.16), 0 6px 14px rgba(29, 38, 85, 0.22)',
      }}
    >
      {n}
    </span>
  )
}

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

function Block({ id, title, icon, children }) {
  return (
    <Card id={id} className="scroll-mt-24 p-6 sm:p-8">
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
  // A wide chart would shrink to a sliver if it had to fit the card, so it
  // scrolls until the card is wide enough. The fade shows only while more
  // of the chart is waiting off to the right.
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
  const goal = guideSection('goal')
  const training = guideSection('training')
  const ladders = guideSection('ladders')
  const medals = guideSection('medals')
  const streaks = guideSection('streaks')
  const platoon = guideSection('platoon')
  const base = guideSection('base')
  const army = guideSection('army')
  const report = guideSection('report')
  return (
    <>
      <section className="hero-navy">
        <div className="mx-auto max-w-[1000px] px-4 py-12 text-white sm:px-6">
          <h1 className="font-display text-4xl font-black md:text-5xl">How It Works</h1>
        </div>
      </section>

      <div className="mx-auto max-w-[1000px] space-y-6 px-4 py-10 sm:px-6">
        <Block id={goal.id} title={goal.title}>
          <p>{goal.paragraphs[0]}</p>
          <Banner
            src="design/how/goal-mipi-olelim.webp"
            width={1600}
            height={317}
            alt="Banner reading מפי עוללים ויונקים יסדת עז — From the mouths of children and infants You established strength"
          />
          <p>{goal.paragraphs[1]}</p>
        </Block>

        <Block id={training.id} title={training.title} icon={ICONS.training}>
          <p>{training.paragraphs[0]}</p>
          <p>{training.paragraphs[1]}</p>
        </Block>

        <Block id={ladders.id} title={ladders.title}>
          <p>{ladders.paragraphs[0]}</p>
          <p>{ladders.paragraphs[1]}</p>
          <p>{ladders.paragraphs[2]}</p>
          <Banner
            src="design/how/ladders.webp"
            width={2000}
            height={741}
            scroll
            alt="שבת מברכים תהלים תשרי — Shabbos Mevorchim Tehillim ladders chart for Tishrei"
          />
        </Block>

        <Block id={medals.id} title={medals.title}>
          <p>{medals.paragraphs[0]}</p>
          <p>{medals.paragraphs[1]}</p>
          <p>Your medal milestones, in total completed missions:</p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-6">
            {MEDALS.map(([n, name, art]) => (
              <li key={name} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                <MedalMark n={n} art={art} />
                <span className="font-semibold leading-tight text-navy">{n} - {name}</span>
              </li>
            ))}
          </ul>
          <p>{medals.paragraphs[2]}</p>
          <p>{medals.paragraphs[3]}</p>
        </Block>

        <Block id={streaks.id} title={streaks.title}>
          <p>{streaks.paragraphs[0]}</p>
          <p>{streaks.paragraphs[1]}</p>
          <Banner
            src="design/how/streaks.webp"
            width={1600}
            height={356}
            alt="Streak bar from Month 1 through Month 6, with Month 4 highlighted and a flame at the end"
          />
        </Block>

        <Block id={platoon.id} title={platoon.title} icon={ICONS.platoon}>
          <p>{platoon.paragraphs[0]}</p>
        </Block>

        <Block id={base.id} title={base.title} icon={ICONS.base}>
          <p>{base.paragraphs[0]}</p>
        </Block>

        <Block id={army.id} title={army.title} icon={ICONS.army}>
          <p>{army.paragraphs[0]}</p>
          <p>{army.paragraphs[1]}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button to="/login" variant="navy">I'm a Soldier</Button>
            <Button to="/" variant="gold">See the Army Report</Button>
          </div>
        </Block>

        <Block id={report.id} title={report.title}>
          <p>{report.paragraphs[0]}</p>
          <p>{report.paragraphs[1]}</p>
        </Block>
      </div>
    </>
  )
}
