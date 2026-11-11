import { useMemo, useState } from 'react'
import { Card, Button, Input } from '@/components/ui.jsx'
import LadderBreakdownTable from '@/components/LadderBreakdownTable.jsx'
import { useLiveData } from '@/lib/useLiveData.js'
import {
  cellFor,
  finishGradeOptions,
  formatKapitlachQuota,
  generateCustomLadder,
} from '@/lib/customLadder.js'
import { listCustomLadderSoldiers, setCustomLadder, removeCustomLadder, CAMPAIGN_YEAR } from '@/services/api.js'
import { formatClassName } from '@/lib/formatClassName.js'

// Admin: pick one soldier, then "Finish [N] kapitlach by [grade]".
// The grid is calculated from the ladders and anchored at the soldier's
// current quota so it never drops. A one-month override still wins later.
export default function CustomLadderTool({ schoolId }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [kidId, setKidId] = useState('')
  const [target, setTarget] = useState('150')
  const [finishGrade, setFinishGrade] = useState('8')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const { data, error, reload } = useLiveData(
    () => (open && schoolId ? listCustomLadderSoldiers(schoolId) : Promise.resolve(null)),
    [open, schoolId],
  )
  const soldiers = data?.soldiers ?? []
  const kid = soldiers.find((s) => String(s.id) === String(kidId)) || null
  const options = finishGradeOptions()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return soldiers
    return soldiers.filter((s) => String(s.name || '').toLowerCase().includes(q) || String(s.className || '').toLowerCase().includes(q))
  }, [soldiers, query])

  const groups = useMemo(() => {
    const map = new Map()
    for (const soldier of filtered) {
      const key = soldier.className || 'Class'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(soldier)
    }
    return [...map.entries()]
  }, [filtered])

  function pick(soldier) {
    setKidId(soldier.id)
    setNote(null)
    const custom = soldier.customLadder
    setTarget(String(custom?.targetKapitlach || 150))
    setFinishGrade(custom?.finishGrade || (soldier.ladder ? String(soldier.ladder) : '8'))
    setReason('')
  }

  let preview = null
  let previewError = ''
  if (kid) {
    try {
      preview = generateCustomLadder({
        targetKapitlach: target,
        finishGrade,
        anchor: {
          grade: kid.grade,
          month: kid.month,
          kapitlach: kid.currentKapitlach,
          minutes: kid.currentMinutes,
        },
      })
    } catch (e) {
      previewError = e?.message || 'That target cannot be calculated.'
    }
  }
  const thisMonth = preview && kid ? cellFor(preview, kid.grade, kid.month) : null
  const thisLabel = thisMonth ? formatKapitlachQuota(thisMonth.v) : null

  async function save() {
    if (!kid || !preview) return
    setBusy(true)
    setNote(null)
    try {
      await setCustomLadder({
        kidId: kid.id,
        targetKapitlach: preview.targetKapitlach,
        finishGrade: preview.finishGrade,
        reason,
      })
      setNote({ kind: 'ok', text: `Saved. ${kid.name} finishes ${preview.targetKapitlach} kapitlach by ${preview.finishLabel}.` })
      reload()
    } catch (e) {
      setNote({ kind: 'warn', text: e?.message || 'Could not save the custom ladder.' })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!kid) return
    setBusy(true)
    setNote(null)
    try {
      await removeCustomLadder({ kidId: kid.id })
      setNote({ kind: 'ok', text: `Removed. ${kid.name} is back on the normal ladder.` })
      setTarget('150')
      setFinishGrade(kid.ladder ? String(kid.ladder) : '8')
      reload()
    } catch (e) {
      setNote({ kind: 'warn', text: e?.message || 'Could not remove the custom ladder.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div id="custom-ladder">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="sh">Custom ladder</p>
          <p className="mt-1 text-sm text-muted">Give one soldier their own finish: how many kapitlach, and by which grade.</p>
        </div>
        <Button id="custom-ladder-open" type="button" variant="navy" className="max-sm:min-h-11" onClick={() => setOpen((v) => !v)}>
          {open ? 'Close' : 'Custom ladder'}
        </Button>
      </div>
      {open ? (
        <div className="mt-4 space-y-4">
          {error ? <p className="text-sm text-navy">Couldn’t load soldiers. <button type="button" className="underline" onClick={reload}>Try again</button></p> : null}
          {!data && !error ? <p className="text-sm text-muted">Getting soldiers…</p> : null}
          {data ? (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-navy">Find a soldier</span>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" />
              </label>
              <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-line p-3">
                {groups.length === 0 ? <p className="text-sm text-muted">No soldier matches.</p> : null}
                {groups.map(([className, rows]) => (
                  <div key={className}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">{formatClassName(className)}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {rows.map((soldier) => {
                        const selected = String(soldier.id) === String(kidId)
                        return (
                          <button
                            key={soldier.id}
                            type="button"
                            onClick={() => pick(soldier)}
                            className={`min-h-11 rounded-full px-3 py-1 text-sm font-semibold ${selected ? 'bg-green text-white' : 'bg-track text-navy'}`}
                          >
                            {soldier.name}
                            {soldier.customLadder ? ' · custom' : ''}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {kid ? (
            <div className="space-y-4">
              <p className="flex flex-wrap items-center gap-2 text-base text-navy">
                <span>Finish</span>
                <Input
                  id="custom-ladder-target"
                  className="!w-24"
                  inputMode="numeric"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  aria-label="Kapitlach to finish"
                />
                <span>kapitlach by</span>
                <select
                  id="custom-ladder-grade"
                  value={finishGrade}
                  onChange={(e) => setFinishGrade(e.target.value)}
                  aria-label="Finish grade"
                  className="min-h-11 rounded-xl border border-line bg-[#eef4ff] px-3 py-2 text-navy"
                >
                  {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </p>
              <p className="text-sm text-muted">
                This month they are at {kid.currentKapitlach} kapitlach{kid.currentMinutes ? ` and ${kid.currentMinutes} minutes` : ''}.
                The new ladder continues from there and does not go down.
                A one-month “counts as met” override still wins for that month’s kapitlach.
              </p>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-navy">Reason (optional)</span>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this finish" />
              </label>
              {previewError ? <p className="text-sm text-navy">{previewError}</p> : null}
              {preview && thisLabel ? (
                <p className="text-sm font-semibold text-navy">
                  This month: {thisLabel.overTehillim ? thisLabel.label : <span className="font-heb">{thisLabel.label}</span>}
                  {thisLabel.overTehillim ? ` (${thisLabel.plain})` : ''} · {thisMonth.m} minutes
                </p>
              ) : null}
              {preview ? (
                <div className="overflow-x-auto rounded-xl bg-paper/60 p-3">
                  <LadderBreakdownTable grid={preview} highlightGrade={kid.grade} highlightMonth={kid.month} year={CAMPAIGN_YEAR} />
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="navy" className="max-sm:min-h-11" disabled={busy || !preview} onClick={save}>
                  {busy ? 'Saving…' : 'Save'}
                </Button>
                {kid.customLadder ? (
                  <Button id="custom-ladder-remove" type="button" variant="outline" className="max-sm:min-h-11" disabled={busy} onClick={remove}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          {note ? <p className={`text-sm ${note.kind === 'ok' ? 'text-green' : 'text-navy'}`}>{note.text}</p> : null}
        </div>
      ) : null}
      </div>
    </Card>
  )
}
