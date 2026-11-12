// Shared page chrome.

export function PageHero({ eyebrow, title, mark, children }) {
  const heading = (
    <h1 className="font-display text-4xl font-black text-white md:text-5xl">{title}</h1>
  )
  return (
    <section className="hero-navy">
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-white sm:px-6 lg:px-10">
        {eyebrow ? (
          <p className="font-display text-[13px] font-semibold uppercase tracking-[0.1em] text-gold sm:text-[15px]">{eyebrow}</p>
        ) : null}
        {mark ? (
          <div className="mt-1 flex items-center gap-4 sm:gap-5">
            {mark}
            <div className="min-w-0">{heading}</div>
          </div>
        ) : (
          <div className="mt-1">{heading}</div>
        )}
        {children ? <div className="mt-3 max-w-2xl text-white/85">{children}</div> : null}
      </div>
    </section>
  )
}
