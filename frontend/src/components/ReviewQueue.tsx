import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CircleAlert, ClipboardCheck, FileCheck2, LoaderCircle, RefreshCw } from 'lucide-react'
import { ApiError } from '../api/client'
import { getReviewQueue, type ReviewQueueItem } from '../api/workflows'

function formatDate(value: string | null, includeTime = false) {
  if (!value) return 'Date unavailable'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(parsed)
}

function stateStyle(label: string) {
  const normalized = label.toLowerCase()
  if (normalized.includes('correction')) return 'bg-amber-100 text-amber-900'
  if (normalized.includes('review')) return 'bg-blue-50 text-blue-900'
  return 'bg-[#edf3ef] text-[#233b33]'
}

export function ReviewQueue() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ReviewQueueItem[]>([])
  const [workflow, setWorkflow] = useState('Document review')
  const [filter, setFilter] = useState('All open')
  const [loading, setLoading] = useState(true)
  const [restricted, setRestricted] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setRestricted(false)
    getReviewQueue(controller.signal)
      .then(data => { if (!controller.signal.aborted) { setItems(data.results); setWorkflow(data.workflow?.label || 'Document review') } })
      .catch(cause => {
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) navigate('/sign-in', { replace: true })
        else if (cause instanceof ApiError && cause.status === 403) setRestricted(true)
        else setError(cause instanceof Error ? cause.message : 'The review queue could not be loaded.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [navigate, reload])

  const states = useMemo(() => [...new Set(items.map(item => item.state.label))], [items])
  const visible = filter === 'All open' ? items : items.filter(item => item.state.label === filter)
  const corrections = items.filter(item => item.state.label.toLowerCase().includes('correction')).length
  const underReview = items.filter(item => item.state.label.toLowerCase() === 'under review').length
  const submitted = items.filter(item => item.state.label.toLowerCase() === 'submitted').length

  return <div>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><p className="mb-2 text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">Review operations</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Review queue</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">See what needs attention, understand its current state, and open the record to make the next decision.</p></div><button onClick={() => setReload(value => value + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-stone-100 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden />Refresh</button></div>

    {!loading && !restricted && !error && <div className="mb-6 grid gap-4 sm:grid-cols-3">
      {[{ label: 'Submitted', value: submitted, note: 'Waiting to be reviewed' }, { label: 'Under Review', value: underReview, note: 'Decision in progress' }, { label: 'Needs Correction', value: corrections, note: 'Returned for changes' }].map(summary => <button key={summary.label} onClick={() => setFilter(summary.label)} className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-[#365d4d] ${filter === summary.label ? 'border-[#365d4d] ring-2 ring-[#365d4d]/10' : 'border-stone-200'}`}><span className="text-2xl font-semibold">{summary.value}</span><span className="mt-2 block text-sm font-semibold">{summary.label}</span><span className="mt-1 block text-xs text-stone-500">{summary.note}</span></button>)}
    </div>}

    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 px-6 py-5"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><FileCheck2 size={18} className="text-[#365d4d]" aria-hidden />Open review work</h2><p className="mt-1 text-xs text-stone-500">{workflow} · Approved records leave this queue</p></div>{items.length > 0 && <div className="flex flex-wrap gap-2">{['All open', ...states].map(state => <button key={state} onClick={() => setFilter(state)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === state ? 'bg-[#233b33] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{state}{state === 'All open' ? ` (${items.length})` : ''}</button>)}</div>}</div>
      {loading ? <p role="status" className="flex items-center gap-2 p-6 text-sm text-stone-500"><LoaderCircle size={17} className="animate-spin" aria-hidden />Loading review queue…</p>
        : restricted ? <div className="p-8"><h3 className="font-semibold">Review queue unavailable</h3><p className="mt-2 text-sm leading-6 text-stone-600">Your account cannot view workflow information. Ask an administrator for workflow-view access if reviewing records is part of your role.</p></div>
        : error ? <div role="alert" className="p-8"><h3 className="font-semibold">Queue could not be loaded</h3><p className="mt-2 text-sm text-stone-600">{error}</p><button onClick={() => setReload(value => value + 1)} className="mt-4 text-sm font-semibold underline">Try again</button></div>
        : !items.length ? <div className="px-6 py-16 text-center"><ClipboardCheck size={38} className="mx-auto text-stone-400" aria-hidden /><h3 className="mt-5 text-lg font-semibold">No open review work</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">Start a workflow from a document’s Review workflow section. It will appear here until it reaches a final state.</p><Link to="/app" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#365d4d] hover:underline">Browse documents<ArrowRight size={15} aria-hidden /></Link></div>
        : !visible.length ? <div className="px-6 py-12 text-center"><CircleAlert size={32} className="mx-auto text-stone-400" aria-hidden /><h3 className="mt-4 font-semibold">No records in {filter}</h3><button onClick={() => setFilter('All open')} className="mt-3 text-sm font-semibold text-[#365d4d] underline">Show all open reviews</button></div>
        : <ul className="divide-y divide-stone-100">{visible.map(item => <li key={item.id} className="p-6 hover:bg-stone-50/70"><div className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${stateStyle(item.state.label)}`}>{item.state.label}</span><span className="text-xs text-stone-500">{item.state.completion}% complete</span></div><Link to={`/app/documents/${item.id}`} className="mt-3 block break-words text-lg font-semibold text-stone-900 hover:text-[#365d4d] hover:underline">{item.label}</Link><p className="mt-1 text-sm text-stone-500">{item.document_type?.label || 'Unspecified type'} · Created {formatDate(item.datetime_created)}</p>{item.last_action && <p className="mt-3 text-xs text-stone-500">Latest: <span className="font-medium text-stone-700">{item.last_action.label}</span> by {item.last_action.actor} · {formatDate(item.last_action.datetime, true)}</p>}</div><div className="w-full sm:w-48"><div className="mb-3 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-[#b28a42]" style={{ width: `${item.state.completion}%` }} /></div><Link to={`/app/documents/${item.id}`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#233b33] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#304e43]">Open review<ArrowRight size={15} aria-hidden /></Link></div></div></li>)}</ul>}
    </section>
  </div>
}
