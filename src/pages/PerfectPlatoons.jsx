import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHero } from './_page.jsx'
import { Input } from '@/components/ui.jsx'
import { getPerfectPlatoons, getSchool, CURRENT_MONTH } from '@/services/api.js'
import { MONTH_HEB } from '@/data/ladders.js'
import { fmt } from '@/lib/format.js'
import { asset } from '@/lib/asset.js'

// Every perfect platoon this month — the full, searchable list behind the
// "+N more" buttons. A perfect platoon is a class where every single soldier
// completed their quota. With ?school=<id> it narrows to one school and drops
// the school name from each chip (you're already inside that school).
export default function PerfectPlatoons() {
  const [params] = useSearchParams()
  const schoolId = params.get('school')
  const perSchool = !!schoolId
  const schoolName = useMemo(() => (schoolId ? getSchool(schoolId)?.name ?? null : null), [schoolId])

  const all = useMemo(() => {
    const list = getPerfectPlatoons()
    return schoolId ? list.filter((p) => p.schoolId === schoolId) : list
  }, [schoolId])

  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () => (q ? all.filter((p) => `${p.className} ${perSchool ? '' : p.school} ${p.teacher || ''}`.toLowerCase().includes(q)) : all),
    [all, q, perSchool],
  )

  return (
    <>
      <PageHero eyebrow={perSchool ? schoolName || 'School' : 'Every single soldier finished'} title="Perfect Platoons">
        A platoon is a class — and it’s <span className="font-semibold text-white">perfect</span> when
        every single soldier in it completed their full quota this month
        {perSchool && schoolName ? <> at {schoolName}</> : null}.
      </PageHero>

      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 sm:py-12 lg:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-green/15 px-4 py-1.5 font-cond text-base font-bold uppercase tracking-wide text-green">
            🎉 {fmt(all.length)} this month · <span className="font-heb">{MONTH_HEB[CURRENT_MONTH]}</span>
          </span>
          {all.length ? (
            <span className="text-sm font-semibold text-muted">
              {q ? `${fmt(filtered.length)} match${filtered.length === 1 ? '' : 'es'}` : 'Tap any platoon to open its school'}
            </span>
          ) : null}
        </div>

        {all.length ? (
          <>
            <div className="mb-6 max-w-md">
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={perSchool ? 'Search by class or teacher…' : 'Search by class, school or teacher…'}
                aria-label="Search perfect platoons"
              />
            </div>

            {filtered.length ? (
              <div className="flex flex-wrap gap-2">
                {filtered.map((p) => (
                  <Link
                    key={`${p.schoolId}-${p.className}`}
                    to={`/s/${p.schoolId}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1.5 text-sm ring-1 ring-gold/40 transition hover:-translate-y-px hover:bg-gold/20"
                    title={`${p.className}${p.teacher ? ' · ' + p.teacher : ''} · ${p.size} soldiers`}
                  >
                    <img src={asset('design/medal-gold.png')} alt="" aria-hidden="true" draggable="false" className="h-4 w-auto flex-none" />
                    <span className="font-display font-bold text-navy">{p.className}</span>
                    {p.teacher ? <span className="text-green">· {p.teacher}</span> : null}
                    {perSchool ? null : <span className="text-navy/55">· {p.school}</span>}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="font-display text-[16px] italic text-muted">No perfect platoons match “{query}”.</p>
            )}
          </>
        ) : (
          <p className="font-display text-[16px] italic text-muted">
            No perfect platoons yet this month — a class turns perfect when every soldier in it completes their quota. Keep going! 💪
          </p>
        )}
      </div>
    </>
  )
}
