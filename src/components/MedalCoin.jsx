import { asset } from '@/lib/asset.js'
import { medalFace } from '@/lib/medals.js'

// A single medal. Crest files are public/design/coin-<name>.png. The numbered
// reverse for those ten tiers is cropped from the official How It Works strip.
// Tiers without that art keep the plain disc. `faces` is the dashboard strip:
// earned shows the reverse (or a colored disc), unearned stays a pale crest.
export default function MedalCoin({ medal, size = 44, locked = false, active = false, faces = false, className = '' }) {
  const earned = !locked
  const face = medalFace(medal, earned)
  const label = `${medal.name} medal, ${earned ? 'earned' : 'not earned'}, ${medal.threshold} missions`
  if (faces && face === 'reverse') {
    return (
      <span className={`medal-flip flex-none ${className}`} style={{ height: size, width: size }} role="img" aria-label={label}>
        <img src={asset(`design/coin-reverse-${medal.coin}.png`)} alt="" draggable="false" />
        <img className="medal-flip-front" src={asset(`design/coin-${medal.coin}.png`)} alt="" draggable="false" />
      </span>
    )
  }
  if (faces && face === 'pale-front') {
    return (
      <span className={`inline-grid flex-none place-items-center ${className}`} style={{ height: size, width: size }} role="img" aria-label={label}>
        <img src={asset(`design/coin-${medal.coin}.png`)} alt="" draggable="false" className="medal-unearned" />
      </span>
    )
  }
  if (faces && face === 'color-disc') {
    return (
      <span
        className={`inline-grid flex-none place-items-center rounded-full font-cond font-bold tabular-nums ${className}`}
        style={{
          height: size,
          width: size,
          fontSize: size * 0.28,
          background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,.55), rgba(255,255,255,0) 58%), ${medal.color}`,
          color: medal.ink,
          boxShadow: '0 1px 2px rgba(29, 38, 85, 0.12)',
        }}
        role="img"
        aria-label={label}
      >
        {medal.threshold}
      </span>
    )
  }
  if (faces && face === 'pale-disc') {
    return (
      <span
        className={`relative inline-grid flex-none place-items-center ${className}`}
        style={{ height: size, width: size, boxShadow: '0 1px 2px rgba(29, 38, 85, 0.12)' }}
        role="img"
        aria-label={label}
      >
        <span
          aria-hidden="true"
          className="medal-unearned absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,.72), rgba(255,255,255,0) 60%), ${medal.color}` }}
        />
      </span>
    )
  }
  if (medal.coin) {
    return (
      <span className={`inline-grid flex-none place-items-center ${className}`} style={{ height: size, width: size }} title={label}>
        <img
          src={asset(`design/coin-${medal.coin}.png`)}
          alt={medal.name}
          draggable="false"
          className={locked ? 'medal-unearned' : ''}
          style={{ maxHeight: '100%', maxWidth: '100%', filter: !locked && active ? 'drop-shadow(0 0 4px var(--color-gold))' : undefined }}
        />
      </span>
    )
  }
  if (locked) {
    return (
      <span
        className={`relative inline-grid flex-none place-items-center rounded-full font-cond font-bold tabular-nums ${className}`}
        style={{
          height: size,
          width: size,
          fontSize: size * 0.3,
          color: '#9aa6b8',
          boxShadow: active ? '0 0 0 3px var(--color-gold), 0 1px 3px rgba(0,0,0,.25)' : '0 1px 3px rgba(0,0,0,.25)',
        }}
        title={label}
      >
        <span
          aria-hidden="true"
          className="medal-unearned absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,.72), rgba(255,255,255,0) 60%), ${medal.color}` }}
        />
        <span className="relative">{medal.threshold}</span>
      </span>
    )
  }
  return (
    <span
      className={`inline-grid flex-none place-items-center rounded-full font-cond font-bold tabular-nums ${className}`}
      style={{
        height: size,
        width: size,
        fontSize: size * 0.3,
        background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,.55), rgba(255,255,255,0) 58%), ${medal.color}`,
        color: medal.ink,
        boxShadow: active ? '0 0 0 3px var(--color-gold), 0 1px 3px rgba(0,0,0,.25)' : '0 1px 3px rgba(0,0,0,.25)',
      }}
      title={label}
    >
      {medal.threshold}
    </span>
  )
}
