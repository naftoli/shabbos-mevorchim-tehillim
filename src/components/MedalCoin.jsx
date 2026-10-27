import { asset } from '@/lib/asset.js'

// A single medal. When the tier has real coin art (public/design/coin-<name>.png,
// the shield coins the client supplied) we show it; otherwise we fall back to a
// CSS-rendered coin carrying the mission threshold. `locked` dims unearned tiers,
// `active` gives the tier in progress a gold glow.
export default function MedalCoin({ medal, size = 44, locked = false, active = false, className = '' }) {
  const label = `${medal.name} — ${medal.threshold} missions${locked ? '' : ' · earned'}`
  if (medal.coin) {
    return (
      <span className={`inline-grid flex-none place-items-center ${className}`} style={{ height: size, width: size }} title={label}>
        <img
          src={asset(`design/coin-${medal.coin}.png`)}
          alt={medal.name}
          draggable="false"
          className={locked ? 'opacity-40 grayscale' : ''}
          style={{ maxHeight: '100%', maxWidth: '100%', filter: active ? 'drop-shadow(0 0 4px var(--color-gold))' : 'drop-shadow(0 1px 2px rgba(0,0,0,.25))' }}
        />
      </span>
    )
  }
  // No coin art for this tier — fall back to a CSS coin with its threshold number.
  return (
    <span
      className={`inline-grid flex-none place-items-center rounded-full font-cond font-bold tabular-nums ${className}`}
      style={{
        height: size,
        width: size,
        fontSize: size * 0.3,
        background: locked ? '#c7ccd6' : `radial-gradient(circle at 34% 28%, rgba(255,255,255,.55), rgba(255,255,255,0) 58%), ${medal.color}`,
        color: locked ? '#7e8795' : medal.ink,
        boxShadow: active ? '0 0 0 3px var(--color-gold), 0 1px 3px rgba(0,0,0,.25)' : '0 1px 3px rgba(0,0,0,.25)',
      }}
      title={label}
    >
      {medal.threshold}
    </span>
  )
}
