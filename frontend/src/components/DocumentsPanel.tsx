import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileText, FolderOpen, RefreshCw } from 'lucide-react'
import { listDocuments, type DocumentPage } from '../api/documents'
import { ApiError } from '../api/client'

function createdDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not available' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

export function DocumentsPanel() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [data, setData] = useState<DocumentPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setData(null)
    listDocuments(page, controller.signal).then(result => {
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
  }, [page, refresh, navigate])

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

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-6 py-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><FolderOpen size={18} aria-hidden className="text-[#365d4d]" />All documents</h2>
          <span className="text-xs text-stone-500">{data ? `${data.count.toLocaleString()} accessible ${data.count === 1 ? 'record' : 'records'}` : 'Records available to your account'}</span>
        </div>

        {loading && <div className="p-6"><p role="status" className="mb-6 text-sm text-stone-500">Loading your documents…</p><div aria-hidden className="space-y-4">{[1, 2, 3, 4].map(row => <div key={row} className="h-14 animate-pulse rounded-lg bg-stone-100" />)}</div></div>}

        {!loading && error && <div className="px-6 py-12" role="alert"><h3 className="font-semibold">Documents couldn’t be loaded</h3><p className="mt-2 text-sm leading-6 text-stone-600">{error}</p><div className="mt-5 flex gap-5"><button onClick={() => setRefresh(value => value + 1)} className="text-sm font-semibold text-[#365d4d] underline underline-offset-4">Try again</button>{page > 1 && <button onClick={() => setPage(1)} className="text-sm font-semibold underline underline-offset-4">First page</button>}</div></div>}

        {!loading && data && data.results.length === 0 && <div className="px-6 py-16 text-center"><FolderOpen aria-hidden size={36} className="mx-auto mb-5 text-stone-400" /><h3 className="text-lg font-semibold">No documents to display</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">There are no records available to your account on this page. Access depends on the permissions assigned to you.</p></div>}

        {!loading && data && data.results.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><caption className="sr-only">Documents available to your account. Select a title to open its details and file preview.</caption><thead className="bg-stone-50 text-xs text-stone-500"><tr><th scope="col" className="px-6 py-3 font-medium">Document</th><th scope="col" className="px-4 py-3 font-medium">Document type</th><th scope="col" className="px-6 py-3 font-medium">Created</th></tr></thead><tbody className="divide-y divide-stone-100">{data.results.map(document => <tr key={document.id} className="hover:bg-stone-50"><td className="max-w-sm px-6 py-5"><div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf3ef] text-[#365d4d]"><FileText aria-hidden size={19} /></span><div className="min-w-0"><Link to={`/app/documents/${document.id}`} className="block max-w-full truncate text-left font-medium text-stone-900 hover:text-[#365d4d] hover:underline" title={document.label}>{document.label || `Untitled document ${document.id}`}</Link><p className="mt-1 text-xs text-stone-500">Record #{document.id}</p></div></div></td><td className="px-4 py-5 text-stone-600">{document.document_type?.label || 'Not specified'}</td><td className="whitespace-nowrap px-6 py-5 text-stone-600">{createdDate(document.datetime_created)}</td></tr>)}</tbody></table></div>}

        {!loading && data && <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stone-200 px-6 py-4"><p className="text-xs text-stone-500">Page {data.page} · {data.results.length} {data.results.length === 1 ? 'record' : 'records'} shown</p><nav aria-label="Document pages" className="flex gap-2"><button disabled={!data.previous_page} onClick={() => { if (data.previous_page) setPage(data.previous_page) }} className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={15} aria-hidden />Previous</button><button disabled={!data.next_page} onClick={() => { if (data.next_page) setPage(data.next_page) }} className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40">Next<ChevronRight size={15} aria-hidden /></button></nav></div>}
      </div>

    </div>
  )
}
