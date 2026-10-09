import { useState } from 'react'
import { Card, Button } from '@/components/ui.jsx'
import { PageHero } from './_page.jsx'

const WHATSAPP = [
  {
    title: 'Sign-up message',
    text:
      '🎖️ Our class joined the Worldwide Tehillim Club! Every Shabbos Mevorchim your child says Tehillim and climbs toward finishing the whole Sefer Tehillim. Please help them pick a ladder and report each month. Join: https://mashpia.com/mivtzoim/tehillim/',
  },
  {
    title: 'Monthly reminder',
    text:
      '📖 Reminder: this Shabbos is Shabbos Mevorchim! Please help your child say their Tehillim for the month and mark it done so our class can become a Perfect Platoon. 💪',
  },
  {
    title: 'Deadline nudge',
    text:
      '⏰ Last call! A few soldiers still need to finish this month’s Tehillim. One more push and our whole class earns Perfect Platoon! Thank you!',
  },
]

function CopyCard({ title, text }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* noop */ }
  }
  return (
    <Card className="flex flex-col p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display font-black text-navy">{title}</h3>
        <Button variant="outline" className="!px-3 !py-1.5 !text-[13px]" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</Button>
      </div>
      <p className="flex-1 whitespace-pre-wrap rounded-xl bg-track/40 p-3 text-sm text-navy/80">{text}</p>
    </Card>
  )
}

export default function Resources() {
  return (
    <>
      <PageHero eyebrow="For Parents & Teachers" title="Resources">
        Everything you need to run the club at home and in the classroom.
      </PageHero>

      <div className="mx-auto max-w-[1100px] space-y-12 px-4 py-10 sm:px-6 lg:px-10">
        {/* Printable quota cards */}
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="sh">Printables</p>
              <h2 className="font-display text-2xl font-black text-navy">Quota Cards</h2>
              <p className="text-sm text-muted">A pocket card for each child showing exactly what to say each month.</p>
            </div>
            <Button variant="navy" onClick={() => window.print()}>🖨 Print</Button>
          </div>
          <Card className="p-6">
            <p className="text-navy/80">
              Each child’s quota card lists their ladder and the Shabbos-Mevorchim portion for every
              month of the year. Open a soldier’s dashboard to print their personalized card, or print
              a blank set for the whole class from here.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pll>Ladder 1 → finish by 5th</Pll>
            </div>
          </Card>
        </section>

        {/* WhatsApp messages */}
        <section>
          <p className="sh">For Parents</p>
          <h2 className="mb-4 font-display text-2xl font-black text-navy">WhatsApp Messages</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {WHATSAPP.map((m) => <CopyCard key={m.title} {...m} />)}
          </div>
        </section>

        {/* Background */}
        <section>
          <p className="sh">About</p>
          <h2 className="mb-4 font-display text-2xl font-black text-navy">Campaign Background</h2>
          <Card className="space-y-3 p-6 text-navy/85">
            <p>
              The Worldwide Tehillim Club is a Tzivos Hashem campaign built around <strong>Shabbos
              Mevorchim</strong> — the Shabbos when we bless the coming month. On each Shabbos
              Mevorchim, children say Tehillim, exactly as the Rebbe’s minhag teaches.
            </p>
            <p>
              Every child picks a <strong>ladder</strong>: the grade by which they’ll have said the
              entire Sefer Tehillim. The ladder sets a gentle, growing amount each month, so that
              kapitel by kapitel, year by year, every soldier reaches the finish line of all 150
              kapitlach — together with the whole worldwide army.
            </p>
            <p>
              Classes where every child finishes become <strong>Perfect Platoons</strong>, and
              completed months earn <strong>medals</strong>. Quotas roll up from each child to the
              class, the school, and the worldwide army.
            </p>
          </Card>
        </section>

        {/* Video */}
        <section>
          <p className="sh">Watch</p>
          <h2 className="mb-4 font-display text-2xl font-black text-navy">Video Tutorial</h2>
          <Card className="overflow-hidden">
            <div className="grid aspect-video place-items-center bg-navy text-white/70">
              <div className="text-center">
                <div className="text-5xl">▶</div>
                <p className="mt-2 font-cond text-xl uppercase tracking-wide">Tutorial video</p>
                <p className="text-sm text-white/50">Embeds here once the clip is ready.</p>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </>
  )
}

// small inline pill (typo-safe local)
function Pll({ children }) {
  return <span className="inline-flex items-center rounded-full bg-track px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-green">{children}</span>
}
