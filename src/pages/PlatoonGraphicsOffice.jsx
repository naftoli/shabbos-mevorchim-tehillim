import { useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { PageHero } from './_page.jsx'
import { Button, Card, Input, Pill, SchoolLogo, Spinner } from '@/components/ui.jsx'
import PlatoonGraphicPreview from '@/components/PlatoonGraphicPreview.jsx'
import { useAuth } from '@/context/AuthContext.jsx'
import { useLiveData } from '@/lib/useLiveData.js'
import { CURRENT_MONTH } from '@/services/api.js'
import {
  getOfficePlatoonGraphics,
  markPlatoonGraphicsSent,
  markSchoolGraphicsSent,
  saveSchoolWhatsapp,
} from '@/services/platoonOffice.js'
import { IS_DEMO } from '@/lib/liveMode.js'
import {
  absoluteSchoolGraphicsUrl,
  filterOfficeTab,
  normalizeWhatsapp,
  officeCounts,
  platoonGraphicsShareMessage,
  whatsAppSchoolUrl,
} from '@/lib/platoonGraphics.js'

function safeNext(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('://') || value.includes('\\')) {
    return '/office/platoon-graphics'
  }
  return value
}

export default function PlatoonGraphicsOffice() {
  const { admin, isSuper } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'sent' || params.get('tab') === 'all' ? params.get('tab') : 'to-send'
  const { data, loading, error, reload } = useLiveData(
    () => (admin ? getOfficePlatoonGraphics() : Promise.resolve(null)),
    [admin],
  )
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const phoneRefs = useRef({})

  if (!admin) {
    return <Navigate to={`/admin/login?next=${encodeURIComponent(safeNext('/office/platoon-graphics'))}`} replace />
  }

  const schools = data?.schools ?? []
  const counts = officeCounts(schools)
  const visible = filterOfficeTab(schools, tab)
  const month = data?.month || CURRENT_MONTH
  const year = data?.year || ''
  const placeholder = IS_DEMO || data?.renderer === 'placeholder'
  const stillLoading = loading && data == null

  function pickTab(next) {
    const query = new URLSearchParams(params)
    if (next === 'to-send') query.delete('tab')
    else query.set('tab', next)
    setParams(query, { replace: true })
  }

  async function saveNumber(school, raw) {
    const parsed = normalizeWhatsapp(raw)
    if (parsed.error) {
      setNote(parsed.error)
      return
    }
    setBusy(true)
    setNote('')
    try {
      await saveSchoolWhatsapp(school.id, parsed.digits)
      setNote(parsed.digits ? `Saved the WhatsApp number for ${school.name}.` : `Cleared the WhatsApp number for ${school.name}.`)
      reload()
    } catch (err) {
      setNote(err.message || 'Could not save that number.')
    } finally {
      setBusy(false)
    }
  }

  async function whatsApp(school, event) {
    const link = absoluteSchoolGraphicsUrl(school.id)
    const href = whatsAppSchoolUrl(
      school.whatsapp,
      platoonGraphicsShareMessage({ schoolName: school.name, month, year, link }),
    )
    if (!href) {
      event?.preventDefault()
      phoneRefs.current[school.id]?.focus()
      setNote(`Add a WhatsApp number for ${school.name} first.`)
      return
    }
    // The link itself opens WhatsApp. This only records the send.
    setBusy(true)
    setNote('')
    try {
      await markSchoolGraphicsSent(school.id)
      setNote(`Marked ${school.name} sent.`)
      reload()
    } catch (err) {
      setNote(err.message || 'WhatsApp opened, but the sent mark did not save. Use Mark sent on each graphic.')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(graphic, sent) {
    setBusy(true)
    setNote('')
    try {
      await markPlatoonGraphicsSent({ ids: [graphic.id], sent })
      reload()
    } catch (err) {
      setNote(err.message || 'Could not update that graphic.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHero eyebrow={isSuper ? 'HQ office' : 'School office'} title="Send Perfect Platoon graphics">
        WhatsApp a school its public graphics link. The number stays on this page — it is never on the public site.
      </PageHero>

      <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Graphics to send">
          {[
            ['to-send', `To send (${counts.toSend})`],
            ['sent', `Sent (${counts.sent})`],
            ['all', `All (${counts.all})`],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => pickTab(id)}
              className={`min-h-11 shrink-0 rounded-full px-4 font-cond text-[18px] uppercase tracking-wide ${
                tab === id ? 'bg-green text-white' : 'bg-card text-green shadow-card'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          {month}{year ? ` ${year}` : ''}. A new platoon for a school you already sent is marked NEW.
          {counts.newGraphics ? ` ${counts.newGraphics} new.` : ''}
        </p>

        {data?.storage === 'missing' ? (
          <Card className="mt-4 p-5">
            <p className="text-sm text-navy">{data.message || 'Run api/sql/wwtc_platoon_graphics.sql once on the server.'}</p>
          </Card>
        ) : null}
        {stillLoading ? <Spinner label="Getting the office" /> : null}
        {error ? (
          <p className="mt-4 text-sm text-navy">
            Couldn’t load the office.{' '}
            <button type="button" className="underline" onClick={reload}>Try again</button>
          </p>
        ) : null}
        {data?.forbidden ? (
          <Card className="mt-4 p-5"><p className="text-sm text-navy">Only HQ or a school admin can open this page.</p></Card>
        ) : null}

        {!stillLoading && !error && !visible.length && data?.storage !== 'missing' ? (
          <p className="mt-6 font-display text-[16px] italic text-muted">
            {tab === 'sent' ? 'Nothing has been marked sent yet.' : tab === 'to-send' ? 'Nothing is waiting to send.' : 'No Perfect Platoon graphics this month.'}
          </p>
        ) : null}

        <div className="mt-4 space-y-4">
          {visible.map((school) => {
            const href = whatsAppSchoolUrl(
              school.whatsapp,
              platoonGraphicsShareMessage({
                schoolName: school.name,
                month,
                year,
                link: absoluteSchoolGraphicsUrl(school.id),
              }),
            )
            return (
              <Card key={school.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <SchoolLogo school={school} size={44} />
                  <h2 className="min-w-0 flex-1 font-display text-xl font-black text-navy">{school.name}</h2>
                </div>

                <ContactEditor
                  key={`${school.id}-${school.whatsapp || ''}`}
                  school={school}
                  inputRef={(node) => { phoneRefs.current[school.id] = node }}
                  disabled={busy}
                  onSave={(raw) => saveNumber(school, raw)}
                />

                {href ? (
                  <Button as="a" href={href} target="_blank" rel="noopener noreferrer" variant="green" className="mt-3 w-full sm:w-auto" onClick={(event) => whatsApp(school, event)}>
                    WhatsApp school
                  </Button>
                ) : (
                  <Button variant="green" className="mt-3 w-full sm:w-auto" onClick={(event) => whatsApp(school, event)}>
                    Add a number to WhatsApp
                  </Button>
                )}

                <ul className="mt-4 space-y-3">
                  {school.graphics.map((graphic) => (
                    <li key={graphic.id} className="rounded-2xl bg-[#eef4ff] p-3">
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <div className="w-full sm:w-28 sm:shrink-0">
                          <PlatoonGraphicPreview schoolName={school.name} graphic={graphic} placeholder={placeholder} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-navy">{graphic.classLabel || graphic.className}</p>
                            {graphic.isNew ? <Pill>New</Pill> : null}
                            {graphic.sent ? <span className="text-xs font-semibold uppercase tracking-wide text-green">Sent</span> : null}
                          </div>
                          <Button
                            variant="outline"
                            className="mt-2 !px-3 !py-2 !text-[15px]"
                            disabled={busy}
                            onClick={() => toggle(graphic, !graphic.sent)}
                          >
                            {graphic.sent ? 'Mark not sent' : 'Mark sent'}
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })}
        </div>

        {note ? <p className="mt-4 text-sm text-navy" role="status">{note}</p> : null}
      </div>
    </>
  )
}

function ContactEditor({ school, onSave, inputRef, disabled }) {
  const [value, setValue] = useState(school.whatsapp ? `+${school.whatsapp}` : '')
  return (
    <form
      className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(e) => { e.preventDefault(); onSave(value) }}
    >
      <label className="block min-w-0 flex-1">
        <span className="mb-1 block text-[12px] font-semibold uppercase tracking-[0.08em] text-navy">WhatsApp number</span>
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="+1 718 555 0100"
          aria-label={`WhatsApp number for ${school.name}`}
        />
      </label>
      <Button type="submit" variant="outline" className="w-full sm:w-auto" disabled={disabled}>Save number</Button>
    </form>
  )
}
