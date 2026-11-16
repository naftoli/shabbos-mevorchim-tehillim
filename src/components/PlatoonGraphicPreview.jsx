import { useState } from 'react'
import MonthGraphicArt from '@/components/MonthGraphicArt.jsx'

// The square the public page and the office share. When the daily job has
// posted a final PNG, that file is shown. Until then the card is drawn from
// the Perfect Platoon shield or the numbered Top Base badge, and the caption
// says the final file is not in yet.
export default function PlatoonGraphicPreview({ schoolName, school, graphic, placeholder, month, year }) {
  const [failed, setFailed] = useState(false)
  const shown = school || { name: schoolName || '', logo: null, color: null }
  const showFile = !placeholder && graphic?.fileUrl && !failed
  const label = `${shown.name || schoolName || ''} ${graphic?.classLabel || graphic?.className || ''}`.trim()
  if (!showFile) {
    return (
      <div className="w-full">
        <MonthGraphicArt school={shown} graphic={graphic} month={month} year={year} />
        {placeholder ? (
          <p className="mt-2 text-xs text-muted">Placeholder — the final 1080×1080 art is not in yet.</p>
        ) : null}
      </div>
    )
  }
  return (
    <div className="w-full">
      <img
        src={graphic.fileUrl}
        alt={label}
        width={1080}
        height={1080}
        onError={() => setFailed(true)}
        className="aspect-square w-full rounded-2xl bg-[#d9e2ef] object-cover"
      />
    </div>
  )
}
