import { useState } from 'react'
import { asset } from '@/lib/asset.js'

// The square the public page and the office share. When the daily job has
// posted a PNG, that file is shown. Until the real renderer is installed the
// picture is the placeholder, and the caption says so.
export default function PlatoonGraphicPreview({ schoolName, graphic, placeholder }) {
  const [failed, setFailed] = useState(false)
  const src = !failed && graphic.fileUrl
    ? graphic.fileUrl
    : (placeholder ? asset('design/platoon-graphic-placeholder.png') : null)
  const label = `${schoolName} ${graphic.classLabel || graphic.className}`
  return (
    <div className="w-full">
      {src ? (
        <img
          src={src}
          alt={placeholder ? `${label}, placeholder graphic` : label}
          width={1080}
          height={1080}
          onError={() => setFailed(true)}
          className="aspect-square w-full rounded-2xl bg-[#d9e2ef] object-cover"
        />
      ) : (
        <div className="grid aspect-square w-full place-items-center rounded-2xl bg-[#17356f] px-4 text-center text-white">
          <div>
            <p className="font-cond text-2xl uppercase tracking-[0.14em]">Placeholder</p>
            <p className="mt-2 text-sm text-white/80">Final 1080×1080 art is not in yet</p>
          </div>
        </div>
      )}
      {placeholder ? (
        <p className="mt-2 text-xs text-muted">Placeholder — the final 1080×1080 art is not in yet.</p>
      ) : null}
    </div>
  )
}
