import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHero } from './_page.jsx'
import { Button, Card, Input, SchoolLogo, Spinner } from '@/components/ui.jsx'
import GraphicMonthField from '@/components/GraphicMonthField.jsx'
import PlatoonGraphicPreview from '@/components/PlatoonGraphicPreview.jsx'
import { useLiveData } from '@/lib/useLiveData.js'
import { CAMPAIGN_YEAR, getPublicPlatoonGraphics, CURRENT_MONTH } from '@/services/api.js'
import { MONTH_HEB } from '@/data/ladders.js'
import { downloadPoster } from '@/lib/graphicPoster.js'
import { IS_DEMO } from '@/lib/liveMode.js'
import { parentShareMessage, withDemoFlag } from '@/lib/monthGraphics.js'
import {
  absoluteGraphicShareUrl,
  graphicDownloadName,
  shareOrDownload,
  downloadUrl,
} from '@/lib/platoonGraphics.js'

export default function PlatoonGraphics() {
  const { schoolId } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const year = params.get('year') || String(CAMPAIGN_YEAR)
  const month = params.get('month') || CURRENT_MONTH
  const period = useMemo(() => ({ year, month }), [year, month])
  const { data, loading, error, reload } = useLiveData(() => getPublicPlatoonGraphics(period), [year, month])
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('')
  const schools = data?.schools ?? []
  const placeholder = IS_DEMO || data?.renderer === 'placeholder'
  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    const list = data?.schools ?? []
    if (q.length < 2) return []
    return list.filter((school) => school.name.toLowerCase().includes(q))
  }, [data, q])
  const selected = schoolId ? schools.find((school) => String(school.id) === String(schoolId)) : null
  const stillLoading = loading && data == null

  function writeMonth({ year: nextYear, month: nextMonth }) {
    const query = new URLSearchParams(params)
    query.set('year', String(nextYear))
    query.set('month', nextMonth)
    setParams(query, { replace: true })
  }

  function openSchool(id) {
    const query = new URLSearchParams(params)
    query.set('year', String(year))
    query.set('month', month)
    navigate({ pathname: `/platoon-graphics/${id}`, search: query.toString() })
  }

  async function onShare(school, graphic) {
    setNote('')
    const link = withDemoFlag(absoluteGraphicShareUrl(school.id, graphic.id, period))
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
      setNote(action === 'download' ? 'Download started.' : action === 'copy-link' ? 'Link copied.' : 'Share sheet opened.')
    } catch (err) {
      if (err?.name === 'AbortError') return
      setNote('Could not share. Use Download instead.')
    }
  }

  async function onDownload(school, graphic) {
    if (graphic.fileUrl) {
      downloadUrl(graphic.fileUrl, graphicDownloadName({ ...graphic, month, year }))
      setNote(`Downloading ${school.name}, ${graphic.classLabel || 'Top 10 School'}.`)
      return
    }
    const ok = await downloadPoster({ school, graphic, month, year })
    setNote(ok ? `Downloading ${school.name}.` : 'This graphic has not been posted yet.')
  }

  return (
    <>
      <PageHero eyebrow="Tzivos Hashem" title="Perfect Platoon graphics">
        Search for your school and download or share the graphics for every class that finished its Tehillim quota this month.
      </PageHero>

      <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 sm:py-12">
        <GraphicMonthField
          campaignYear={CAMPAIGN_YEAR}
          currentMonth={CURRENT_MONTH}
          year={year}
          month={month}
          onChange={writeMonth}
        />
        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-semibold text-navy">Find your school</span>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type your school name…"
            aria-label="Search for your school"
            autoFocus={!schoolId}
          />
        </label>

        {stillLoading ? <Spinner label="Getting graphics" /> : null}
        {error ? (
          <p className="mt-4 text-sm text-navy">
            Couldn’t load the graphics.{' '}
            <button type="button" className="underline" onClick={reload}>Try again</button>
          </p>
        ) : null}

        {!stillLoading && q.length >= 2 ? (
          <div className="mt-4 space-y-2">
            {matches.length ? matches.map((school) => (
              <button
                key={school.id}
                type="button"
                onClick={() => { setQuery(''); openSchool(school.id) }}
                className="flex min-h-11 w-full items-center gap-3 rounded-2xl bg-card px-3 py-3 text-left shadow-card"
              >
                <SchoolLogo school={school} size={40} />
                <span className="min-w-0 flex-1 font-semibold text-navy">{school.name}</span>
                <span className="shrink-0 text-sm text-muted">{school.graphics.length}</span>
              </button>
            )) : (
              <p className="font-display text-[16px] italic text-muted">No Perfect Platoon graphics match “{query}” this month.</p>
            )}
          </div>
        ) : null}

        {!stillLoading && !schoolId && q.length < 2 ? (
          <p className="mt-6 text-sm text-muted">
            {schools.length
              ? `${schools.length} ${schools.length === 1 ? 'school has' : 'schools have'} graphics for ${month}${year ? ` ${year}` : ''}. Type a name to open yours.`
              : `No Perfect Platoon graphics have been posted for ${month || 'this month'} yet.`}
          </p>
        ) : null}

        {schoolId && !stillLoading && !selected ? (
          <Card className="mt-6 p-5">
            <p className="font-display text-lg text-navy">No Perfect Platoon graphics for this school this month.</p>
            <Link to="/platoon-graphics" className="mt-3 inline-block text-sm font-semibold text-blue">Search for a school</Link>
          </Card>
        ) : null}

        {selected ? (
          <div className="mt-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <SchoolLogo school={selected} size={48} />
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-black text-navy">{selected.name}</h2>
                <p className="text-sm text-muted">
                  <span className="font-heb">{MONTH_HEB[month] || month}</span>
                  {year ? ` · ${year}` : ''} · {selected.graphics.length} {selected.graphics.length === 1 ? 'graphic' : 'graphics'}
                </p>
              </div>
            </div>
            <ul className="space-y-4">
              {selected.graphics.map((graphic) => (
                <li key={graphic.id}>
                  <Card className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div className="w-full sm:w-56 sm:shrink-0">
                        <PlatoonGraphicPreview school={selected} graphic={graphic} placeholder={placeholder} month={month} year={year} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-xl font-black text-navy">{graphic.kind === 'top10' ? 'Top 10 School' : (graphic.classLabel || graphic.className)}</p>
                        <p className="mt-1 text-sm text-muted">{graphic.className}{graphic.gradeLabel ? ` · ${graphic.gradeLabel}` : ''}</p>
                        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
                          <Button variant="navy" className="w-full sm:w-auto" onClick={() => onDownload(selected, graphic)}>Download</Button>
                          <Button variant="green" className="w-full sm:w-auto" onClick={() => onShare(selected, graphic)}>Share</Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {note ? <p className="mt-4 text-sm text-navy" role="status">{note}</p> : null}
      </div>
    </>
  )
}
