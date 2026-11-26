import { asset } from '@/lib/asset.js'
import { PERFECT_PLATOON_ART, PERFECT_PLATOON_ART_HEIGHT, PERFECT_PLATOON_ART_WIDTH } from '@/lib/perfectPlatoonBanner.js'
import { topBaseArt, TOP_BASE_ART_HEIGHT, TOP_BASE_ART_WIDTH } from '@/lib/baseRank.js'

// Sholem's general Perfect Platoon shield. Decorative when the words are
// already next to it; pass alt when the picture is the only label.
export function PerfectPlatoonLogo({ className = 'h-14 w-auto', alt = '' }) {
  return (
    <img
      src={asset(PERFECT_PLATOON_ART)}
      alt={alt}
      width={PERFECT_PLATOON_ART_WIDTH}
      height={PERFECT_PLATOON_ART_HEIGHT}
      draggable="false"
      aria-hidden={alt ? undefined : true}
      className={`shrink-0 object-contain ${className}`}
    />
  )
}

// Numbered Top Base shield cropped from the existing flyer. Ranks outside 1–10
// render nothing — there is no badge for them.
export function TopBaseBadge({ rank, className = 'h-16 w-auto' }) {
  const src = topBaseArt(rank)
  if (!src) return null
  const n = Number(rank)
  return (
    <img
      src={asset(src)}
      alt={`Top Base ${n}`}
      width={TOP_BASE_ART_WIDTH}
      height={TOP_BASE_ART_HEIGHT}
      draggable="false"
      className={`shrink-0 object-contain ${className}`}
    />
  )
}
