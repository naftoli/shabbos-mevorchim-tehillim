import { Card } from '@/components/ui.jsx'

// Shared page chrome for the scaffold. Real pages replace <Scaffold> bodies with
// live content ported/adapted from Mivtza Lulav.

export function PageHero({ eyebrow, title, children }) {
  return (
    <section className="hero-navy">
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-white sm:px-6 lg:px-10">
        {eyebrow ? (
          <p className="font-display text-[13px] font-semibold uppercase tracking-[0.1em] text-gold sm:text-[15px]">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 font-display text-4xl font-black text-white md:text-5xl">{title}</h1>
        {children ? <div className="mt-3 max-w-2xl text-white/85">{children}</div> : null}
      </div>
    </section>
  )
}

export function Scaffold({ note, items }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Card className="p-6">
        <p className="text-sm text-muted">{note}</p>
        {items?.length ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {items.map((it) => (
              <li
                key={it}
                className="rounded-xl border border-[var(--color-line)] bg-[var(--color-track)]/50 px-3 py-2 text-sm text-navy"
              >
                {it}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  )
}
