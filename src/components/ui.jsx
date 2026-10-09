import { useState } from 'react'
import { Link } from 'react-router-dom'
import { asset } from '../lib/asset.js'

// The signature five-colour Tzivos Hashem brand band.
export function Band({ className = '' }) {
  return (
    <div className={`band ${className}`} aria-hidden="true">
      <i /><i /><i /><i /><i />
    </div>
  )
}

// Masthead logo lockup: TH shield + two-line wordmark.
// `size` is the shield's height from sm up; `phoneSize` applies below sm;
// `wideSize` applies from 2xl.
export function Brand({ size = 46, phoneSize = size, wideSize = size, dark = false }) {
  return (
    <span className="inline-flex items-center gap-2.5 sm:gap-3" style={{ '--logo-h': `${size}px`, '--logo-h-phone': `${phoneSize}px`, '--logo-h-wide': `${wideSize}px` }}>
      <img src={asset('th-logo.png')} alt="Tzivos Hashem" className="h-(--logo-h-phone) w-auto shrink-0 sm:h-(--logo-h) 2xl:h-(--logo-h-wide)" />
      <span className="flex flex-col leading-none">
        <span className="font-cond text-[1.35rem] uppercase leading-none tracking-[0.02em] sm:text-[2.1rem] 2xl:text-[2.25rem]"
          style={{ color: dark ? '#fff' : 'var(--color-green)' }}>
          Tehillim Club
        </span>
        <span className="mt-1 font-display text-[10px] font-semibold uppercase leading-none tracking-[0.04em] sm:text-[13px] 2xl:text-[15px]"
          style={{ color: dark ? 'var(--color-gold)' : 'var(--color-green)' }}>
          Worldwide · Tzivos Hashem
        </span>
      </span>
    </span>
  )
}

// School badge: the school's own logo when it has one, else an initials monogram.
export function SchoolLogo({ school, size = 56, className = '', fallback = true }) {
  const initials = school.name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  const [failedLogo, setFailedLogo] = useState(null)
  const hasLogo = school.logo && school.logo !== failedLogo
  if (!hasLogo && !fallback) return null
  if (hasLogo) {
    return (
      <span
        style={{ height: size, width: size }}
        className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1 shadow-sm ring-1 ring-line ${className}`}
      >
        <img src={school.logo} alt="" onError={() => setFailedLogo(school.logo)} className="max-h-full max-w-full object-contain" />
      </span>
    )
  }
  return (
    <span
      style={{ height: size, width: size, background: school.color || 'var(--color-green)' }}
      className={`grid shrink-0 place-items-center rounded-xl font-cond font-bold uppercase text-white shadow-sm ${className}`}
    >
      <span style={{ fontSize: size * 0.36, letterSpacing: '0.02em' }}>{initials}</span>
    </span>
  )
}

// Profile picture: the kid's photo if we have one, else a colored initials circle.
const AVATAR_BG = ['#17356f', '#3f6fd0', '#0e8aa6', '#2246a8', '#5b3fa8', '#0f2350']
export function Avatar({ name = '', src, size = 40, className = '' }) {
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  if (src) {
    return <img src={src} alt={name} style={{ height: size, width: size }} className={`shrink-0 rounded-full object-cover ring-1 ring-line ${className}`} />
  }
  const bg = AVATAR_BG[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length]
  return (
    <span style={{ height: size, width: size, background: bg }} className={`grid shrink-0 place-items-center rounded-full font-semibold text-white ring-1 ring-black/5 ${className}`}>
      <span style={{ fontSize: size * 0.4 }}>{initials || '🎖️'}</span>
    </span>
  )
}

// Sky card on the page: big radius, no border, only a whisper of shadow.
export function Card({ className = '', children }) {
  return (
    <div className={`overflow-hidden rounded-[28px] bg-card shadow-card ${className}`}>
      {children}
    </div>
  )
}

const btnClass = {
  primary: 'btn btn-p',
  gold: 'btn btn-gold',
  green: 'btn btn-green',
  blue: 'btn btn-s',
  navy: 'btn btn-navy',
  red: 'btn btn-red',
  outline: 'btn btn-o',
  outlineWhite: 'btn btn-o-white',
  ghost: 'btn btn-ghost',
}

export function Button({ variant = 'primary', className = '', as, to, ...props }) {
  const cls = `${btnClass[variant] || btnClass.primary} ${className}`
  if (to) return <Link to={to} className={cls} {...props} />
  const Comp = as || 'button'
  return <Comp className={cls} {...props} />
}

export function SectionHeader({ children, className = '' }) {
  return <p className={`sh ${className}`}>{children}</p>
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.08em] text-navy">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted/80">{hint}</span>}
    </label>
  )
}

export function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-line bg-[#eef4ff] px-3.5 py-2.5 text-[15px] text-navy outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/25 ${props.className || ''}`}
    />
  )
}

export function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-line bg-[#eef4ff] px-3.5 py-2.5 text-[15px] text-navy outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/25 ${props.className || ''}`}
    />
  )
}

export function Pill({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-track px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-green ${className}`}>
      {children}
    </span>
  )
}

// Badge is an alias of Pill, kept for components that import it by that name.
export const Badge = Pill

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-green" />
      <span className="font-cond text-sm font-semibold uppercase tracking-wide">{label}</span>
    </div>
  )
}

export function ErrorNote({ error, onRetry, what = 'this', className = '' }) {
  const detail = typeof error === 'string' ? error : error?.message
  return (
    <div className={`rounded-2xl bg-race-red/12 px-4 py-5 text-center ring-1 ring-race-red/45 ${className}`} role="alert">
      <p className="font-display text-[15px] font-bold text-navy">Could not load {what}.</p>
      {detail && <p className="mt-1 text-sm text-navy/80">{detail}</p>}
      {onRetry && (
        <Button variant="outline" className="mt-3 !px-4 !py-2 !text-[15px]" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
