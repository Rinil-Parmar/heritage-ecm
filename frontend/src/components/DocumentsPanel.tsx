import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileText, FolderOpen, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react'
import { listDocuments, type DocumentFilters, type DocumentPage } from '../api/documents'
import { captureRequest } from '../api/uploads'
import { ApiError } from '../api/client'

function createdDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not available' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

export function DocumentsPanel() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const filters: DocumentFilters = {
    query: searchParams.get('q')?.trim() || undefined,
    documentTypeId: Number(searchParams.get('type')) || undefined,
    createdFrom: searchParams.get('from') || undefined,
    createdTo: searchParams.get('to') || undefined,
  }
  const [draftQuery, setDraftQuery] = useState(filters.query || '')
  const [draftType, setDraftType] = useState(filters.documentTypeId ? String(filters.documentTypeId) : '')
  const [draftFrom, setDraftFrom] = useState(filters.createdFrom || '')
  const [draftTo, setDraftTo] = useState(filters.createdTo || '')
  const [types, setTypes] = useState<{ id: number; label: string }[]>([])
  const [data, setData] = useState<DocumentPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const filtersActive = Boolean(filters.query || filters.documentTypeId || filters.createdFrom || filters.createdTo)

  useEffect(() => {
    const controller = new AbortController()
    captureRequest<{ results: { id: number; label: string }[] }>('upload/types', { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setTypes(value.results) })
      .catch(() => { /* Search remains usable without the optional type choices. */ })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setData(null)
    listDocuments(page, filters, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result)
    }).catch(cause => {
      if (controller.signal.aborted) return
      if (cause instanceof ApiError && cause.status === 401) {
        navigate('/sign-in', { replace: true })
      } else {
        setError(cause instanceof ApiError ? cause.message : 'Unable to load documents. Check your connection and try again.')
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, filters.query, filters.documentTypeId, filters.createdFrom, filters.createdTo, refresh, navigate])

  function applyFilters(event: FormEvent) {
    event.preventDefault()
    const next = new URLSearchParams()
    if (draftQuery.trim()) next.set('q', draftQuery.trim())
    if (draftType) next.set('type', draftType)
    if (draftFrom) next.set('from', draftFrom)
    if (draftTo) next.set('to', draftTo)
    setSearchParams(next)
  }

  function clearFilters() {
    setDraftQuery('')
    setDraftType('')
    setDraftFrom('')
    setDraftTo('')
    setSearchParams(new URLSearchParams())
  }

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams)
    if (nextPage > 1) next.set('page', String(nextPage))
    else next.delete('page')
    setSearchParams(next)
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">Research library</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Documents</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">Your organization’s records, with their context close at hand.</p>
        </div>
        <div className="flex flex-wrap gap-3"><Link to="/app/upload" className="inline-flex items-center rounded-xl bg-[#233b33] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#304e43]">Upload document</Link><button onClick={() => setRefresh(value => value + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-stone-100 disabled:opacity-50">
          <RefreshCw aria-hidden size={16} className={loading ? 'animate-spin' : ''} />Refresh
        </button></div>
      </div>

      <form onSubmit={applyFilters} className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" aria-label="Search documents">
        <div className="grid gap-4 xl:grid-cols-[minmax(18rem,1fr)_minmax(12rem,0.45fr)_minmax(10rem,0.32fr)_minmax(10rem,0.32fr)_auto] xl:items-end">
          <label className="block text-sm font-medium" htmlFor="document-search">Search the collection
            <span className="relative mt-2 block"><Search aria-hidden size={17} className="absolute top-3.5 left-3.5 text-stone-400" /><input id="document-search" type="search" value={draftQuery} onChange={event => setDraftQuery(event.target.value)} maxLength={200} placeholder="Title, metadata, OCR text…" className="w-full rounded-xl border border-stone-300 py-3 pr-4 pl-10 text-sm outline-none focus:border-[#365d4d] focus:ring-2 focus:ring-[#365d4d]/20" /></span>
          </label>
          <label className="block text-sm font-medium" htmlFor="document-type-filter">Document type
            <select id="document-type-filter" value={draftType} onChange={event => setDraftType(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#365d4d]"><option value="">All types</option>{types.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}</select>
          </label>
          <label className="block text-sm font-medium" htmlFor="created-from">Created from<input id="created-from" type="date" value={draftFrom} max={draftTo || undefined} onChange={event => setDraftFrom(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-3 text-sm outline-none focus:border-[#365d4d]" /></label>
          <label className="block text-sm font-medium" htmlFor="created-to">Created to<input id="created-to" type="date" value={draftTo} min={draftFrom || undefined} onChange={event => setDraftTo(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-3 text-sm outline-none focus:border-[#365d4d]" /></label>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#233b33] px-5 py-3 text-sm font-semibold text-white hover:bg-[#304e43]"><SlidersHorizontal aria-hidden size={16} />Apply</button>
        </div>
        {filtersActive && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4"><p className="text-xs text-stone-500">Showing records that match all active filters.</p><button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#365d4d] hover:underline"><X aria-hidden size={14} />Clear filters</button></div>}
      </form>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-6 py-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><FolderOpen size={18} aria-hidden className="text-[#365d4d]" />{filtersActive ? 'Search results' : 'All documents'}</h2>
          <span className="text-xs text-stone-500">{data ? `${data.count.toLocaleString()} accessible ${data.count === 1 ? 'record' : 'records'}` : 'Records available to your account'}</span>
        </div>

        {loading && <div className="p-6"><p role="status" className="mb-6 text-sm text-stone-500">Loading your documents…</p><div aria-hidden className="space-y-4">{[1, 2, 3, 4].map(row => <div key={row} className="h-14 animate-pulse rounded-lg bg-stone-100" />)}</div></div>}

        {!loading && error && <div className="px-6 py-12" role="alert"><h3 className="font-semibold">Documents couldn’t be loaded</h3><p className="mt-2 text-sm leading-6 text-stone-600">{error}</p><div className="mt-5 flex gap-5"><button onClick={() => setRefresh(value => value + 1)} className="text-sm font-semibold text-[#365d4d] underline underline-offset-4">Try again</button>{page > 1 && <button onClick={() => goToPage(1)} className="text-sm font-semibold underline underline-offset-4">First page</button>}</div></div>}

        {!loading && data && data.results.length === 0 && <div className="px-6 py-16 text-center"><FolderOpen aria-hidden size={36} className="mx-auto mb-5 text-stone-400" /><h3 className="text-lg font-semibold">{filtersActive ? 'No matching documents' : 'No documents to display'}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">{filtersActive ? 'Try a broader search, remove a filter, or check the spelling.' : 'There are no records available to your account. Access depends on the permissions assigned to you.'}</p>{filtersActive && <button onClick={clearFilters} className="mt-5 text-sm font-semibold text-[#365d4d] underline underline-offset-4">Clear all filters</button>}</div>}

        {!loading && data && data.results.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><caption className="sr-only">Documents available to your account. Select a title to open its details and file preview.</caption><thead className="bg-stone-50 text-xs text-stone-500"><tr><th scope="col" className="px-6 py-3 font-medium">Document</th><th scope="col" className="px-4 py-3 font-medium">Document type</th><th scope="col" className="px-6 py-3 font-medium">Created</th></tr></thead><tbody className="divide-y divide-stone-100">{data.results.map(document => <tr key={document.id} className="hover:bg-stone-50"><td className="max-w-sm px-6 py-5"><div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf3ef] text-[#365d4d]"><FileText aria-hidden size={19} /></span><div className="min-w-0"><Link to={`/app/documents/${document.id}`} className="block max-w-full truncate text-left font-medium text-stone-900 hover:text-[#365d4d] hover:underline" title={document.label}>{document.label || `Untitled document ${document.id}`}</Link><p className="mt-1 text-xs text-stone-500">Record #{document.id}</p></div></div></td><td className="px-4 py-5 text-stone-600">{document.document_type?.label || 'Not specified'}</td><td className="whitespace-nowrap px-6 py-5 text-stone-600">{createdDate(document.datetime_created)}</td></tr>)}</tbody></table></div>}

        {!loading && data && <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stone-200 px-6 py-4"><p className="text-xs text-stone-500">Page {data.page} · {data.results.length} {data.results.length === 1 ? 'record' : 'records'} shown</p><nav aria-label="Document pages" className="flex gap-2"><button disabled={!data.previous_page} onClick={() => { if (data.previous_page) goToPage(data.previous_page) }} className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={15} aria-hidden />Previous</button><button disabled={!data.next_page} onClick={() => { if (data.next_page) goToPage(data.next_page) }} className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40">Next<ChevronRight size={15} aria-hidden /></button></nav></div>}
      </div>

    </div>
  )
}
