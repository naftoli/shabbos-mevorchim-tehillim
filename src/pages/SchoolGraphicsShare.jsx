import { useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { PageHero } from './_page.jsx'
import { Button, Card, SchoolLogo, Spinner } from '@/components/ui.jsx'
import GraphicMonthField from '@/components/GraphicMonthField.jsx'
import PlatoonGraphicPreview from '@/components/PlatoonGraphicPreview.jsx'
import { useAuth } from '@/context/AuthContext.jsx'
import { useLiveData } from '@/lib/useLiveData.js'
import { CAMPAIGN_YEAR, CURRENT_MONTH, getPublicPlatoonGraphics } from '@/services/api.js'
import { IS_DEMO } from '@/lib/liveMode.js'
import { downloadPoster } from '@/lib/graphicPoster.js'
import {
  TEACHER_GRAPHICS_CHANNEL,
  parentShareMessage,
  teacherPacketMessage,
  withDemoFlag,
} from '@/lib/monthGraphics.js'
import {
  absoluteGraphicShareUrl,
  absoluteSchoolGraphicsUrl,
  downloadUrl,
  graphicDownloadName,
  shareOrDownload,
} from '@/lib/platoonGraphics.js'

function safeNext(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('://') || value.includes('\\')) {
    return '/office/share-graphics'
  }
  return value
}

function shareStatus(action) {
  if (action === 'download') return 'Download started.'
  if (action === 'copy-link') return 'Link copied.'
  if (action === 'share-file' || action === 'share-link') return 'Share sheet opened.'
  return 'Link copied.'
}

export default function SchoolGraphicsShare() {
  const { admin, isSuper } = useAuth()
  const [params, setParams] = useSearchParams()
  const year = params.get('year') || String(CAMPAIGN_YEAR)
  const month = params.get('month') || CURRENT_MONTH
  const period = useMemo(() => ({ year, month }), [year, month])
  const { data, loading, error, reload } = useLiveData(
    () => (admin ? getPublicPlatoonGraphics(period) : Promise.resolve(null)),
    [admin, year, month],
  )
  const [note, setNote] = useState('')
  const schools = data?.schools ?? []
  const requestedSchool = params.get('school')
  const selectedId = isSuper ? (requestedSchool || schools[0]?.id || '') : admin?.schoolId
  const school = schools.find((item) => String(item.id) === String(selectedId))
    || (!isSuper && admin ? { id: admin.schoolId, name: admin.name, logo: null, color: null, graphics: [] } : null)
  const placeholder = IS_DEMO || data?.renderer === 'placeholder' || !data
  const stillLoading = loading && data == null
  const teacherLink = school ? withDemoFlag(absoluteSchoolGraphicsUrl(school.id, period)) : ''

  if (!admin) {
    const next = safeNext(`/office/share-graphics?${params.toString()}`)
    return <Navigate to={`/admin/login?next=${encodeURIComponent(next)}`} replace />
  }

  function writeParams(next) {
    const query = new URLSearchParams(params)
    Object.entries(next).forEach(([key, value]) => {
      if (value == null || value === '') query.delete(key)
      else query.set(key, String(value))
    })
    setParams(query, { replace: true })
  }

  async function shareAll() {
    if (!school) return
    setNote('')
    try {
      const action = await shareOrDownload({
        title: `${school.name} graphics`,
        text: teacherPacketMessage({ schoolName: school.name, month, year, link: teacherLink }),
        url: teacherLink,
      })
      setNote(shareStatus(action))
    } catch (err) {
      if (err?.name === 'AbortError') return
      setNote('Could not open the share sheet. Copy the link below.')
    }
  }

  async function copyTeacherLink() {
    if (!teacherLink) return
    try {
      await navigator.clipboard.writeText(teacherLink)
      setNote('Link copied.')
    } catch {
      setNote(teacherLink)
    }
  }

  async function onShare(graphic) {
    if (!school) return
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
      setNote(shareStatus(action))
    } catch (err) {
      if (err?.name === 'AbortError') return
      setNote('Could not share. Use Download or copy the link.')
    }
  }

  async function onDownload(graphic) {
    if (!school) return
    if (graphic.fileUrl) {
      downloadUrl(graphic.fileUrl, graphicDownloadName({ ...graphic, month, year }))
      setNote(`Downloading ${graphic.kind === 'top10' ? 'the Top 10 graphic' : graphic.classLabel}.`)
      return
    }
    const ok = await downloadPoster({ school, graphic, month, year })
    setNote(ok ? 'Download started.' : 'Could not build the picture. Copy the link instead.')
  }

  const graphics = school?.graphics || []

  return (
    <>
      <PageHero eyebrow={isSuper ? 'HQ preview' : 'School admin'} title="Share this month's graphics">
        One press shares every graphic for the month with your teachers. Each picture also has its own link. The Top 10 picture is the one children send to their parents.
      </PageHero>

      <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 sm:py-12">
        <GraphicMonthField
          campaignYear={CAMPAIGN_YEAR}
          currentMonth={CURRENT_MONTH}
          year={year}
          month={month}
          onChange={({ year: nextYear, month: nextMonth }) => writeParams({ year: nextYear, month: nextMonth })}
        />

        {isSuper ? (
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-semibold text-navy">School</span>
            <select
              className="min-h-11 w-full rounded-2xl bg-card px-3 text-base text-navy shadow-card"
              aria-label="School"
              value={school ? String(school.id) : ''}
              onChange={(event) => writeParams({ school: event.target.value })}
            >
              {schools.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        ) : null}

        {stillLoading ? <Spinner label="Getting graphics" /> : null}
        {error ? (
          <p className="mt-4 text-sm text-navy">
            Couldn’t load the graphics.{' '}
            <button type="button" className="underline" onClick={reload}>Try again</button>
          </p>
        ) : null}
        {data?.storage === 'missing' ? (
          <Card className="mt-4 p-5">
            <p className="text-sm text-navy">Perfect Platoon graphics storage is not installed yet. Run api/sql/wwtc_platoon_graphics.sql once on the server.</p>
          </Card>
        ) : null}
        {data?.topStorage === 'missing' ? (
          <Card className="mt-4 p-5">
            <p className="text-sm text-navy">Top 10 graphics are not installed yet. Run api/sql/wwtc_top_school_graphics.sql once on the server. Perfect Platoon graphics still show.</p>
          </Card>
        ) : null}

        {school && !stillLoading ? (
          <div className="mt-6">
            <div className="mb-4 flex items-center gap-3">
              <SchoolLogo school={school} size={48} />
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-black text-navy">{school.name}</h2>
                <p className="text-sm text-muted">{month} {year} · {graphics.length} {graphics.length === 1 ? 'graphic' : 'graphics'}</p>
              </div>
            </div>

            <Card className="p-4 sm:p-5">
              <p className="text-sm text-navy">{TEACHER_GRAPHICS_CHANNEL.summary}</p>
              <p className="mt-2 text-sm text-muted">{TEACHER_GRAPHICS_CHANNEL.detail}</p>
              <Button variant="green" className="mt-4 w-full" onClick={shareAll} disabled={!graphics.length}>
                Share with all teachers
              </Button>
              <Button variant="outline" className="mt-2 w-full" onClick={copyTeacherLink} disabled={!teacherLink}>
                Copy teacher link
              </Button>
              {teacherLink ? <p className="mt-3 break-all text-sm text-navy">{teacherLink}</p> : null}
            </Card>

            {!graphics.length ? (
              <p className="mt-6 font-display text-[16px] italic text-muted">
                No Perfect Platoon or Top 10 graphic for {school.name} in {month}. A class becomes a Perfect Platoon when every soldier finishes. Top 10 follows The Race.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {graphics.map((graphic) => {
                  const parentLink = withDemoFlag(absoluteGraphicShareUrl(school.id, graphic.id, period))
                  return (
                    <li key={graphic.id}>
                      <Card className="p-4 sm:p-5">
                        <PlatoonGraphicPreview school={school} graphic={graphic} placeholder={placeholder} month={month} year={year} />
                        <p className="mt-3 font-display text-xl font-black text-navy">
                          {graphic.kind === 'top10' ? 'Top 10 School' : (graphic.classLabel || graphic.className)}
                        </p>
                        {graphic.kind === 'top10' ? (
                          <p className="mt-1 text-sm text-muted">Badge {graphic.rank}. Children can send this to a parent.</p>
                        ) : (
                          <p className="mt-1 text-sm text-muted">{graphic.className}{graphic.gradeLabel ? ` · ${graphic.gradeLabel}` : ''}</p>
                        )}
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Button variant="navy" className="w-full" onClick={() => onDownload(graphic)}>Download</Button>
                          <Button variant="green" className="w-full" onClick={() => onShare(graphic)}>
                            {graphic.kind === 'top10' ? 'Share with parents' : 'Share'}
                          </Button>
                        </div>
                        <p className="mt-3 break-all text-xs text-muted">{parentLink}</p>
                      </Card>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : null}

        {note ? <p className="mt-4 text-sm text-navy" role="status">{note}</p> : null}
      </div>
    </>
  )
}
