import { useState } from 'react'
import MonthGraphicArt from '@/components/MonthGraphicArt.jsx'

// The square the public page and the office share. A posted PNG is the file
// the daily job wrote. Until that file exists, the same poster is drawn in
// the browser from Tab's blank and the school's own name and logo.
export default function PlatoonGraphicPreview({ schoolName, school, graphic, month, year }) {
  const [failed, setFailed] = useState(false)
  const shown = school || { name: schoolName || '', logo: null, color: null }
  const label = `${shown.name || schoolName || ''} ${graphic?.classLabel || graphic?.className || ''}`.trim()
  if (graphic?.fileUrl && !failed) {
    return (
      <div className="w-full">
        <img
          src={graphic.fileUrl}
          alt={label}
          width={1080}
          height={1080}
          onError={() => setFailed(true)}
          className="aspect-square w-full rounded-2xl object-cover"
        />
      </div>
    )
  }
  return (
    <div className="w-full overflow-hidden rounded-2xl">
      <MonthGraphicArt school={shown} graphic={graphic} month={month} year={year} />
    </div>
  )
}
