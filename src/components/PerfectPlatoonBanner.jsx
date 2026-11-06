import { asset } from '@/lib/asset.js'
import { cuePerfectPlatoon } from '@/lib/commanderCues.js'
import { PERFECT_PLATOON_ART, PERFECT_PLATOON_ART_HEIGHT, PERFECT_PLATOON_ART_WIDTH } from '@/lib/perfectPlatoonBanner.js'

// Success line under "Where you stand". The picture is the existing Perfect
// Platoon artwork. The sentence is the whole message.
export default function PerfectPlatoonBanner() {
  return (
    <p className="mt-3 flex items-center gap-3 font-semibold leading-snug text-green" data-perfect-platoon-banner>
      <img
        src={asset(PERFECT_PLATOON_ART)}
        alt=""
        width={PERFECT_PLATOON_ART_WIDTH}
        height={PERFECT_PLATOON_ART_HEIGHT}
        draggable="false"
        className="h-12 w-auto shrink-0 object-contain sm:h-16"
      />
      <span>{cuePerfectPlatoon()}</span>
    </p>
  )
}
