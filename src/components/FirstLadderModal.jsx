import { useEffect } from 'react'
import LadderCarousel from './LadderCarousel.jsx'

// A graphic "pick your ladder" welcome shown the first time a soldier logs in,
// before they've chosen a ladder. It presents the 3-card ladder coverflow
// (centered on Ladder 4). Picking a card chooses it; X / Maybe later dismisses.
export default function FirstLadderModal({ open, name, grade, onPick, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-navy/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pick your ladder"
    >
      <div
        className="animate-pop relative my-auto w-full max-w-2xl overflow-hidden rounded-[28px] bg-paper shadow-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-40 grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/35"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        {/* Welcome banner */}
        <div className="hero-navy px-6 pb-5 pt-7 text-center">
          <h2 className="font-display text-2xl font-black text-white">
            {name ? `Welcome, ${name.split(' ')[0]}!` : 'Welcome, soldier!'}
          </h2>
          <p className="mt-1 text-sm text-white/85">
            Pick your <span className="font-bold text-gold">ladder</span> — the grade you’ll finish the whole Tehillim by.
          </p>
        </div>

        {/* A preview of the ladder situation — tapping any card (or the button)
            opens the full ladder selection page. */}
        <div className="px-3 py-6 sm:px-6">
          <LadderCarousel grade={grade} defaultLadder={8} onPick={onPick} preview height={380} cardWidth={272} spacing={232} />
          <div className="mt-5 flex flex-col items-center gap-3">
            <button className="btn btn-gold !px-8 !py-3.5 !text-[20px]" onClick={onPick}>Pick my ladder</button>
            <button className="text-sm font-semibold text-muted hover:text-navy" onClick={onClose}>Maybe later</button>
          </div>
        </div>
      </div>
    </div>
  )
}
