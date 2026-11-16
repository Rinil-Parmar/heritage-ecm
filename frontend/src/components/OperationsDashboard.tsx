import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Bot, CircleAlert, FileCheck2, FileText, FolderOpen, RefreshCw, Search, Upload, Users } from 'lucide-react'
import { ApiError } from '../api/client'
import { listDocuments, type DocumentPage } from '../api/documents'
import { getSmartSearchStatus, type SmartSearchStatus } from '../api/smartSearch'
import { getReviewQueue, type BlockedReview, type ReviewQueueItem } from '../api/workflows'

function displayDate(value: string | null) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function stateClass(label: string) {
  const value = label.toLowerCase()
  if (value.includes('correction')) return 'bg-amber-100 text-amber-900'
  if (value.includes('review')) return 'bg-blue-50 text-blue-900'
  return 'bg-stone-100 text-stone-700'
}

export function OperationsDashboard({ username, adminAllowed }: { username: string; adminAllowed: boolean }) {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<DocumentPage | null>(null)
  const [reviews, setReviews] = useState<ReviewQueueItem[]>([])
  const [blockedReviews, setBlockedReviews] = useState<BlockedReview[]>([])
  const [searchStatus, setSearchStatus] = useState<SmartSearchStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setReviews([])
    setBlockedReviews([])
    Promise.allSettled([
      listDocuments(1, {}, controller.signal),
      getReviewQueue(controller.signal),
      getSmartSearchStatus(controller.signal),
    ]).then(outcomes => {
      if (controller.signal.aborted) return
      const unauthorized = outcomes.some(item => item.status === 'rejected' && item.reason instanceof ApiError && item.reason.status === 401)
      if (unauthorized) { navigate('/sign-in', { replace: true }); return }
      const [documentResult, reviewResult, searchResult] = outcomes
      if (documentResult.status === 'fulfilled') setDocuments(documentResult.value)
      if (reviewResult.status === 'fulfilled') { setReviews(reviewResult.value.results); setBlockedReviews(reviewResult.value.blocked || []) }
      if (searchResult.status === 'fulfilled') setSearchStatus(searchResult.value)
      if (outcomes.some(item => item.status === 'rejected')) setNotice('Some workspace information is unavailable. You can still use the available actions below.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [navigate, reload])

  const myReviews = useMemo(() => reviews.filter(item => item.assignment?.assignee_username === username), [reviews, username])
  const blockedReviewCount = blockedReviews.length
  const corrections = useMemo(() => myReviews.filter(item => item.state.label.toLowerCase().includes('correction')).length, [myReviews])
  const firstName = username.split(/[.@_-]/)[0] || username
  function refreshDashboard() {
    setLoading(true)
    setNotice('')
    setReload(value => value + 1)
  }
  const summary = [
    { label: 'Accessible records', value: documents?.count ?? '—', note: 'Based on your permissions', icon: FolderOpen, to: '/app' },
    { label: 'Assigned to me', value: myReviews.length + blockedReviewCount, note: blockedReviewCount ? `${blockedReviewCount} assignment needs access` : 'Your open review work', icon: FileCheck2, to: '/app/reviews' },
    { label: 'Needs correction', value: corrections, note: 'Returned for updates', icon: CircleAlert, to: '/app/reviews' },
    { label: 'Assisted search', value: searchStatus?.ai_enabled ? 'AI ready' : 'Standard', note: searchStatus?.ai_enabled ? 'Secure interpretation active' : 'Keyword interpretation active', icon: Bot, to: '/app/smart-search' },
  ]

  return <div className="space-y-7">
    <section className="flex flex-wrap items-end justify-between gap-5">
      <div><p className="mb-2 text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">Workspace overview</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back, <span className="font-serif text-[#365d4d] italic">{firstName}</span>.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">Continue priority reviews, find records, or add new evidence to the archive.</p></div>
      <button onClick={refreshDashboard} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-stone-100 disabled:opacity-50"><RefreshCw aria-hidden size={16} className={loading ? 'animate-spin' : ''} />Refresh overview</button>
    </section>

    {notice && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice}</p>}

    <section aria-label="Workspace summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {summary.map(item => <Link key={item.label} to={item.to} className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#365d4d] hover:shadow-md"><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#edf3ef] text-[#365d4d]"><item.icon aria-hidden size={19} /></span><ArrowRight aria-hidden size={16} className="text-stone-300 group-hover:text-[#365d4d]" /></div><p className="mt-5 text-2xl font-semibold">{loading ? '…' : item.value}</p><p className="mt-1 text-sm font-semibold">{item.label}</p><p className="mt-1 text-xs text-stone-500">{item.note}</p></Link>)}
    </section>

    <section className="rounded-2xl border border-stone-200 bg-[#233b33] p-5 text-white shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-5"><div><p className="text-xs font-semibold tracking-[0.16em] text-amber-100/70 uppercase">Quick actions</p><h2 className="mt-2 text-xl font-semibold">What do you need to do?</h2></div><div className="flex flex-wrap gap-3"><Link to="/app/upload" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#233b33] hover:bg-stone-100"><Upload aria-hidden size={16} />Upload document</Link><Link to="/app/smart-search" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"><Search aria-hidden size={16} />Smart search</Link>{adminAllowed && <Link to="/app/users" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"><Users aria-hidden size={16} />Manage users</Link>}</div></div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[1fr_0.78fr]">
      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-stone-200 px-6 py-5"><div><h2 className="font-semibold">Documents at a glance</h2><p className="mt-1 text-xs text-stone-500">Records currently visible to your account</p></div><Link to="/app" className="text-xs font-semibold text-[#365d4d] hover:underline">View all</Link></div>
        {loading && !documents ? <div className="space-y-3 p-6">{[1, 2, 3].map(item => <div key={item} className="h-14 animate-pulse rounded-xl bg-stone-100" />)}</div> : !documents?.results.length ? <div className="px-6 py-12 text-center"><FileText aria-hidden size={32} className="mx-auto text-stone-400" /><p className="mt-3 text-sm font-medium">No accessible documents</p><Link to="/app/upload" className="mt-3 inline-block text-sm font-semibold text-[#365d4d] underline">Upload the first record</Link></div> : <ul className="divide-y divide-stone-100">{documents.results.slice(0, 5).map(document => <li key={document.id}><Link to={`/app/documents/${document.id}`} className="group flex items-center gap-4 px-6 py-4 hover:bg-stone-50"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-600"><FileText aria-hidden size={18} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold group-hover:text-[#365d4d]">{document.label || `Document ${document.id}`}</span><span className="mt-1 block text-xs text-stone-500">{document.document_type?.label || 'Unspecified type'} · {displayDate(document.datetime_created)}</span></span><ArrowRight aria-hidden size={15} className="text-stone-300 group-hover:text-[#365d4d]" /></Link></li>)}</ul>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-stone-200 px-6 py-5"><div><h2 className="font-semibold">My assigned reviews</h2><p className="mt-1 text-xs text-stone-500">Corrections appear first</p></div><Link to="/app/reviews" className="text-xs font-semibold text-[#365d4d] hover:underline">Open queue</Link></div>
        {loading && !reviews.length && !blockedReviews.length ? <div className="space-y-3 p-6">{[1, 2, 3].map(item => <div key={item} className="h-14 animate-pulse rounded-xl bg-stone-100" />)}</div> : !myReviews.length && !blockedReviews.length ? <div className="px-6 py-12 text-center"><FileCheck2 aria-hidden size={32} className="mx-auto text-stone-400" /><p className="mt-3 text-sm font-medium">No reviews assigned to you</p><p className="mt-1 text-xs text-stone-500">New assignments will appear here and in notifications.</p></div> : <ul className="divide-y divide-stone-100">{myReviews.slice(0, 5).map(item => <li key={item.id}><Link to={`/app/documents/${item.id}`} className="block px-6 py-4 hover:bg-stone-50"><div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-semibold">{item.label}</span><span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${stateClass(item.state.label)}`}>{item.state.label}</span></div><p className="mt-2 text-xs text-stone-500">{item.document_type?.label || 'Document'} · {item.state.completion}% complete</p></Link></li>)}{blockedReviews.slice(0, Math.max(0, 5 - myReviews.length)).map(item => <li key={`blocked-${item.assignment.workflow_instance_id}`}><Link to="/app/reviews" className="block bg-amber-50/50 px-6 py-4 hover:bg-amber-50"><div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-semibold">{item.label}</span><span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[0.68rem] font-semibold text-amber-900">Access pending</span></div><p className="mt-2 text-xs text-amber-900">Assigned to you · Open queue for access details</p></Link></li>)}</ul>}
      </section>
    </div>
  </div>
}
