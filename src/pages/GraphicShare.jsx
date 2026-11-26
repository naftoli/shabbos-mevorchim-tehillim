import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PageHero } from './_page.jsx'
import { Button, Card, Spinner } from '@/components/ui.jsx'
import PlatoonGraphicPreview from '@/components/PlatoonGraphicPreview.jsx'
import { useLiveData } from '@/lib/useLiveData.js'
import { CAMPAIGN_YEAR, CURRENT_MONTH, getPublicPlatoonGraphics } from '@/services/api.js'
import { IS_DEMO } from '@/lib/liveMode.js'
import { downloadPoster } from '@/lib/graphicPoster.js'
import { parentShareMessage, withDemoFlag } from '@/lib/monthGraphics.js'
import {
  absoluteGraphicShareUrl,
  downloadUrl,
  graphicDownloadName,
  shareOrDownload,
} from '@/lib/platoonGraphics.js'

// One public picture. School name and, for a platoon, the class name.
// No other graphics, no phone numbers, no soldier names.
export default function GraphicShare() {
  const { schoolId, graphicId } = useParams()
  const [params] = useSearchParams()
  const year = params.get('year') || String(CAMPAIGN_YEAR)
  const month = params.get('month') || CURRENT_MONTH
  const period = useMemo(() => ({ year, month }), [year, month])
  const { data, loading, error, reload } = useLiveData(
    () => getPublicPlatoonGraphics(period),
    [year, month],
  )
  const [note, setNote] = useState('')
  const school = (data?.schools || []).find((item) => String(item.id) === String(schoolId)) || null
  const graphic = school?.graphics?.find((item) => String(item.id) === String(graphicId)) || null
  const placeholder = IS_DEMO || data?.renderer === 'placeholder'
  const stillLoading = loading && data == null
  const link = school && graphic ? withDemoFlag(absoluteGraphicShareUrl(school.id, graphic.id, period)) : ''

  async function onShare() {
    if (!school || !graphic) return
    setNote('')
    try {
      const action = await shareOrDownload({
        title: graphic.kind === 'top10' ? `${school.name} Top 10` : `${school.name} ${graphic.classLabel}`,
        text: parentShareMessage({
          schoolName: school.name,
          month,
          year,
          link,
          platoonName: graphic.classLabel,
          kind: graphic.kind,
        }),
        url: link,
        fileUrl: graphic.fileUrl || null,
        filename: graphicDownloadName({ ...graphic, month, year }),
      })
      setNote(action === 'copy-link' ? 'Link copied.' : action === 'download' ? 'Download started.' : 'Share sheet opened.')
    } catch (err) {
      if (err?.name === 'AbortError') return
      setNote('Could not share. Use Download.')
    }
  }

  async function onDownload() {
    if (!school || !graphic) return
    if (graphic.fileUrl) {
      downloadUrl(graphic.fileUrl, graphicDownloadName({ ...graphic, month, year }))
      setNote('Download started.')
      return
    }
    const ok = await downloadPoster({ school, graphic, month, year })
    setNote(ok ? 'Download started.' : 'Could not build the picture.')
  }

  const title = graphic?.kind === 'top10' ? 'Top 10 School' : (graphic?.classLabel || 'Graphic')

  return (
    <>
      <PageHero eyebrow="Tzivos Hashem" title={stillLoading ? 'Graphic' : title}>
        {school ? school.name : 'A picture from the Worldwide Tehillim Club.'}
      </PageHero>
      <div className="mx-auto max-w-[560px] px-4 py-8 sm:px-6">
        {stillLoading ? <Spinner label="Getting the graphic" /> : null}
        {error ? (
          <p className="text-sm text-navy">
            Couldn’t load the graphic.{' '}
            <button type="button" className="underline" onClick={reload}>Try again</button>
          </p>
        ) : null}
        {!stillLoading && !error && (!school || !graphic) ? (
          <Card className="p-5">
            <p className="font-display text-lg text-navy">This graphic is not posted for {month}.</p>
            <Link to="/platoon-graphics" className="mt-3 inline-block text-sm font-semibold text-blue">Find a school</Link>
          </Card>
        ) : null}
        {school && graphic ? (
          <Card className="p-4 sm:p-5">
            <PlatoonGraphicPreview school={school} graphic={graphic} placeholder={placeholder} month={month} year={year} />
            <h2 className="mt-4 font-display text-2xl font-black text-navy">{school.name}</h2>
            <p className="mt-1 text-base text-navy">
              {graphic.kind === 'top10' ? `Top 10 School · ${month} ${year}` : `${graphic.classLabel || graphic.className} · ${month} ${year}`}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="navy" className="w-full" onClick={onDownload}>Download</Button>
              <Button variant="green" className="w-full" onClick={onShare}>Share</Button>
            </div>
          </Card>
        ) : null}
        {note ? <p className="mt-4 text-sm text-navy" role="status">{note}</p> : null}
      </div>
    </>
  )
}
