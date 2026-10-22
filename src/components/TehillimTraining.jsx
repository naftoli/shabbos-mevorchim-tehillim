import { Card } from './ui.jsx'
import { GRADE_LABEL } from '@/data/ladders.js'
import { asset } from '@/lib/asset.js'

// The lifetime "Tehillim Training": every Tehillim occasion a soldier climbs
// through, grade by grade. Each grade has 14 missions — the 12 Shabbos
// Mevorchim months plus Rosh Hashana and Yom Kippur — numbered straight through
// from Pre-1A to 12th grade. Grades collapse so you don't see all 182 at once;
// the grade you're up to opens by default.
const OCCASIONS = ['תשרי', 'ראש השנה', 'יום כיפור', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר', 'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול']
const SHORT = { 'ראש השנה': 'ר״ה', 'יום כיפור': 'יו״כ' } // keep the long ones to one cell
const GRADES = ['pre1a', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
const PER = OCCASIONS.length // 14
const TOTAL = GRADES.length * PER // 182

const gradeTitle = (g) => (g === 'pre1a' ? 'Pre-1A' : `${GRADE_LABEL[g]} Grade`)

export default function TehillimTraining({ missionsTotal = 0 }) {
  const done = Math.max(0, Math.min(TOTAL, missionsTotal))
  const pct = Math.round((done / TOTAL) * 100)
  // The grade the soldier is up to now = the one holding the next mission.
  const currentGi = done >= TOTAL ? GRADES.length - 1 : Math.floor(done / PER)

  return (
    <Card className="relative overflow-hidden p-5 sm:p-6">
      <img
        src={asset('design/icon-soldier-hat.png')}
        alt=""
        aria-hidden="true"
        draggable="false"
        className="pointer-events-none absolute -right-5 -top-4 h-28 w-auto rotate-6 opacity-[0.06]"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="sh">My Tehillim Training</p>
          <p className="mt-1 text-[13px] font-semibold text-muted">
            Every Shabbos Mevorchim — plus Rosh Hashana and Yom Kippur — from Pre-1A all the way to 12th grade.
          </p>
        </div>
        <p className="font-cond text-sm font-bold uppercase tracking-wide text-green">{done} / {TOTAL} missions</p>
      </div>

      <div className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-track">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(pct, 2)}%`, background: 'var(--grad-progress)' }} />
      </div>

      <div className="relative mt-5 space-y-2">
        {GRADES.map((g, gi) => {
          const gradeDone = Math.max(0, Math.min(PER, done - gi * PER))
          const isCurrent = gi === currentGi
          const complete = gradeDone === PER
          return (
            <details key={g} open={isCurrent} className="group rounded-2xl bg-track/50 ring-1 ring-line/70 open:bg-track/70">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                <svg viewBox="0 0 12 12" className="h-3 w-3 flex-none text-muted transition-transform group-open:rotate-90" aria-hidden="true">
                  <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-display text-[13px] font-black uppercase tracking-wide text-navy">My {gradeTitle(g)} Missions</span>
                {isCurrent ? (
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 font-cond text-[11px] font-bold uppercase tracking-wide text-navy">You’re here</span>
                ) : null}
                <span className={`ml-auto flex items-center gap-1 font-cond text-[12px] font-bold uppercase tracking-wide ${complete ? 'text-green' : 'text-muted'}`}>
                  {complete ? '✓ ' : ''}{gradeDone}/{PER}
                </span>
              </summary>
              <div className="grid grid-cols-7 gap-1.5 px-4 pb-3 sm:grid-cols-[repeat(14,minmax(0,1fr))]">
                {OCCASIONS.map((occ, oi) => {
                  const n = gi * PER + oi + 1
                  const state = n <= done ? 'done' : n === done + 1 ? 'now' : 'ahead'
                  const cls = {
                    done: 'bg-green/15 text-green ring-1 ring-green/30',
                    now: 'bg-gold/20 text-navy ring-2 ring-gold',
                    ahead: 'bg-card text-muted ring-1 ring-line',
                  }[state]
                  return (
                    <span
                      key={occ}
                      className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1.5 text-center ${cls}`}
                      title={`Mission ${n} · ${occ}${state === 'done' ? ' · done' : state === 'now' ? ' · this one' : ''}`}
                    >
                      <span className="font-heb text-[13px] font-bold leading-none">{SHORT[occ] || occ}</span>
                      <span className="text-[8.5px] font-semibold leading-none opacity-70">{n}</span>
                    </span>
                  )
                })}
              </div>
            </details>
          )
        })}
      </div>

      <div className="relative mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green" /> Done</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-gold" /> This mission</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-track ring-1 ring-line" /> Still ahead</span>
      </div>
    </Card>
  )
}
