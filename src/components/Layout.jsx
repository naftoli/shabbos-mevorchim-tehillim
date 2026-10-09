import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Brand, Button } from './ui.jsx'
import { asset } from '../lib/asset.js'
import { useAuth } from '../context/AuthContext.jsx'
import { IS_DEMO } from '../lib/liveMode.js'

const navItem = ({ isActive }) =>
  `hidden items-center rounded-full px-3.5 py-1.5 font-cond text-[20px] uppercase leading-none tracking-[0.04em] text-green transition sm:inline-flex lg:text-[22px] 2xl:text-[24px] ${
    isActive ? '[background:var(--grad-pill-green)] shadow-sm' : 'hover:bg-green/10'
  }`

const menuLink = ({ isActive }) =>
  `block rounded-xl px-3 py-2.5 font-cond text-[20px] uppercase leading-none tracking-[0.04em] text-green transition ${
    isActive ? 'bg-white/40' : 'hover:bg-white/25'
  }`

export default function Layout({ children }) {
  const { isKid, isAdmin } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const menuBtn = useRef(null)

  useEffect(() => { setMenuOpen(false) }, [pathname])
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setMenuOpen(false)
      menuBtn.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="flex min-h-screen flex-col bg-field">
      <header className="sticky top-0 z-40 bg-sky/95 backdrop-blur">
        <div className="mx-auto flex min-h-[64px] max-w-[1400px] items-center justify-between gap-2 px-4 sm:min-h-[92px] sm:gap-3 sm:px-6 lg:px-10 2xl:min-h-[100px] 2xl:max-w-[1612px] 2xl:pl-[46px] 2xl:pr-4">
          <Link to="/" className="shrink-0"><Brand size={52} phoneSize={44} wideSize={70} /></Link>
          <nav className="flex items-center gap-1.5 sm:gap-1 lg:gap-2 2xl:gap-3">
            <NavLink to="/" end className={navItem}>Home</NavLink>
            <NavLink to="/how-to" className={navItem}>How It Works</NavLink>
            <NavLink to="/reports" className={navItem}>Reports</NavLink>
            <NavLink to={isKid ? '/me' : '/login'} className={navItem}>
              <span className="lg:hidden">{isKid ? 'My Tehillim' : 'Soldier Login'}</span>
              <span className="hidden lg:inline">{isKid ? 'My Tehillim' : 'Soldier Login'}</span>
            </NavLink>
            <NavLink to={isAdmin ? '/admin' : '/admin/login'} className={navItem}>
              {isAdmin ? 'Admin' : 'School Admin'}
            </NavLink>
            {/* Phone: keep a prominent login pill beside the menu toggle. */}
            <Button to={isKid ? '/me' : '/login'} variant="green" className="px-3 text-[16px] sm:hidden">
              {isKid ? 'My Tehillim' : 'Soldier Login'}
            </Button>
            <button
              ref={menuBtn}
              type="button"
              className="btn btn-ghost -mr-2.5 px-2.5 sm:hidden"
              aria-label="Menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </nav>
        </div>
        {/* Phone-only disclosure menu. */}
        <nav id={menuId} hidden={!menuOpen} aria-label="Site menu" className="border-t border-line bg-sky/95 sm:hidden">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-0.5 px-4 py-2">
            <NavLink to="/" end className={menuLink}>Home</NavLink>
            <NavLink to="/how-to" className={menuLink}>How It Works</NavLink>
            <NavLink to="/reports" className={menuLink}>Reports</NavLink>
            <NavLink to="/resources" className={menuLink}>Resources</NavLink>
            <NavLink to={isAdmin ? '/admin' : '/admin/login'} className={menuLink}>
              {isAdmin ? 'Admin' : 'School Admin'}
            </NavLink>
            <NavLink to={isKid ? '/me' : '/login'} className={menuLink}>
              {isKid ? 'My Tehillim' : 'Soldier Login'}
            </NavLink>
          </div>
        </nav>

        {IS_DEMO ? (
          <div className="bg-gold/90 text-center text-[12px] font-semibold text-navy-dark">
            Demo data — anonymized sample. Add <code>?demo=0</code> for live data.
          </div>
        ) : null}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-auto bg-green text-white/90">
        <div className="mx-auto max-w-[1400px] px-4 pt-7 sm:px-6 lg:px-10">
          <div className="rounded-2xl bg-card px-6 py-5">
            <p className="flex flex-wrap items-center justify-center gap-x-2 text-center text-[14px] font-medium text-navy/70">
              This site was built by
              <span className="font-cond text-[22px] uppercase leading-none tracking-[0.06em] text-green">Sholem Chaskind</span>
            </p>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 px-4 py-7 text-sm sm:flex-row sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <img src={asset('th-logo.png')} alt="" className="h-10 w-auto" />
            <span className="font-cond text-[19px] uppercase leading-none tracking-[0.06em] text-gold">Worldwide Tehillim Club · Tzivos Hashem</span>
          </div>
          <p className="max-w-xl text-center text-white/80 sm:text-right font-heb text-[16px] leading-relaxed">
"גּוֹמֵר זַיין דעֶם תְּהִלִּים שַׁבָּת מְבָרְכִים — דאָס דאַרְף מעֶן אָפְּהִיטעֶן, דאָס אִיז נוֹגֵעַ אִיהְם, זַיינעֶ קִינְדעֶר אוּן קִינְד'ס קִינְדעֶר."
          </p>
        </div>
      </footer>
    </div>
  )
}
