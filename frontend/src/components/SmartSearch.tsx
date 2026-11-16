import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, FileText, Lightbulb, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { ApiError } from '../api/client'
import { getSmartSearchPage, getSmartSearchStatus, runSmartSearch, type SmartSearchResult, type SmartSearchStatus } from '../api/smartSearch'

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

const FALLBACK_EXAMPLES = [
  'Find excavation reports from Canada created between 2023 and 2025',
  'Show records tagged Needs Review from 2026',
  'Find documents for Site A in the Archaeology cabinet',
]

export function SmartSearch({ csrf }: { csrf: string }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState<SmartSearchStatus | null>(null)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SmartSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(false)
  const [error, setError] = useState('')
  const activeRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getSmartSearchStatus(controller.signal).then(setStatus).catch(cause => {
      if (controller.signal.aborted) return
      if (cause instanceof ApiError && cause.status === 401) navigate('/sign-in', { replace: true })
    })
    return () => { controller.abort(); activeRequest.current?.abort() }
  }, [navigate])

  async function search(event?: FormEvent) {
    event?.preventDefault()
    const value = query.trim()
    if (value.length < 2 || loading) return
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setLoading(true)
    setError('')
    try {
      setResult(await runSmartSearch(value, csrf, controller.signal))
    } catch (cause) {
      if (controller.signal.aborted) return
      if (cause instanceof ApiError && cause.status === 401) navigate('/sign-in', { replace: true })
      else setError(cause instanceof Error ? cause.message : 'Smart search could not be completed. Try again.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  async function changePage(page: number) {
    if (!result || pageLoading) return
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setPageLoading(true)
    setError('')
    try {
      const next = await getSmartSearchPage(result.plan, page, csrf, controller.signal)
      setResult(current => current ? { ...current, ...next } : current)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (cause) {
      if (controller.signal.aborted) return
      if (cause instanceof ApiError && cause.status === 401) navigate('/sign-in', { replace: true })
      else setError(cause instanceof Error ? cause.message : 'The next result page could not be loaded.')
    } finally {
      if (!controller.signal.aborted) setPageLoading(false)
    }
  }

  const examples = status?.examples?.length ? status.examples : FALLBACK_EXAMPLES
  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-3xl bg-[#18342b] px-6 py-9 text-white shadow-sm sm:px-10 sm:py-12">
        <div aria-hidden className="absolute -top-24 -right-16 size-72 rounded-full border border-amber-100/10" />
        <div aria-hidden className="absolute -right-4 -bottom-28 size-80 rounded-full border border-amber-100/10" />
        <div className="relative max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-amber-100"><Sparkles aria-hidden size={14} />Assisted discovery</div>
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Ask your archive.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-200 sm:text-base">Describe the records you need in everyday language. ArcheoECM turns your request into verified archive filters and shows only records your account can access.</p>
          <form onSubmit={search} className="mt-8">
            <label htmlFor="smart-search" className="sr-only">Describe the documents you want to find</label>
            <div className="rounded-2xl bg-white p-2 shadow-xl shadow-black/10 focus-within:ring-3 focus-within:ring-amber-200/40">
              <div className="flex items-start gap-2">
                <Search aria-hidden size={20} className="mt-3.5 ml-3 shrink-0 text-stone-400" />
                <textarea id="smart-search" value={query} onChange={event => setQuery(event.target.value)} maxLength={500} rows={2} placeholder="Find excavation reports from Canada created between 2023 and 2025…" className="min-h-16 flex-1 resize-none border-0 bg-transparent px-2 py-3 text-sm leading-6 text-stone-900 outline-none placeholder:text-stone-400 sm:text-base" />
                <button disabled={loading || query.trim().length < 2} className="mt-1 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#b48b35] px-5 text-sm font-semibold text-white hover:bg-[#9c762b] disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Searching…' : 'Search'}<ArrowRight aria-hidden size={16} /></button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-300">
              <span>{query.length}/500 characters</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck aria-hidden size={14} />Your existing permissions are always enforced</span>
            </div>
          </form>
        </div>
      </section>

      {!result && !loading && <section className="grid gap-6 lg:grid-cols-[1fr_0.55fr]">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2"><Lightbulb aria-hidden size={19} className="text-[#9c762b]" /><h2 className="font-semibold">Try a search</h2></div>
          <div className="mt-4 grid gap-3">{examples.map(example => <button key={example} onClick={() => setQuery(example)} className="group flex items-center justify-between gap-4 rounded-xl border border-stone-200 px-4 py-3 text-left text-sm leading-6 text-stone-700 hover:border-[#365d4d] hover:bg-[#f4f8f5]"><span>{example}</span><ArrowRight aria-hidden size={16} className="shrink-0 text-stone-400 group-hover:text-[#365d4d]" /></button>)}</div>
        </div>
        <aside className="rounded-2xl border border-stone-200 bg-[#faf8f1] p-6">
          <p className="text-xs font-semibold tracking-[0.16em] text-stone-500 uppercase">Search mode</p>
          <div className="mt-4 flex items-center gap-3"><span className={`size-2.5 rounded-full ${status?.ai_enabled ? 'bg-emerald-500' : 'bg-amber-500'}`} /><h2 className="font-semibold">{status?.ai_enabled ? 'AI interpretation ready' : 'Standard interpretation active'}</h2></div>
          <p className="mt-3 text-sm leading-6 text-stone-600">{status?.ai_enabled ? 'Natural-language requests are converted into validated filters before the archive is searched.' : 'Keyword, year, type, tag, and cabinet recognition works now. AI interpretation will activate after secure server setup.'}</p>
          {status?.ai_enabled && <p className="mt-4 border-t border-stone-200 pt-4 text-xs leading-5 text-stone-500">Only your search question and available filter names are sent for interpretation—never document contents, credentials, or results.</p>}
        </aside>
      </section>}

      {loading && <section aria-live="polite" className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><span className="size-5 animate-spin rounded-full border-2 border-stone-200 border-t-[#365d4d]" /><p className="font-medium">Interpreting your request and checking accessible records…</p></div><div aria-hidden className="mt-6 space-y-3">{[1, 2, 3].map(item => <div key={item} className="h-16 animate-pulse rounded-xl bg-stone-100" />)}</div></section>}
      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900"><p className="font-semibold">Search could not be completed</p><p className="mt-1">{error}</p><button onClick={() => search()} className="mt-3 font-semibold underline underline-offset-4">Try again</button></div>}

      {result && !loading && <>
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.15em] text-stone-500 uppercase">What I understood</p><p className="mt-2 text-sm text-stone-600">{result.plan.explanation}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${result.mode === 'ai' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{result.mode === 'ai' ? 'AI assisted' : 'Standard search'}</span></div>
          <div className="mt-4 flex flex-wrap gap-2">{result.interpretation.map(item => <span key={item} className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-700">{item}</span>)}</div>
          {result.warning && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">{result.warning}</p>}
        </section>

        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm" aria-busy={pageLoading}>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 px-6 py-5"><div><p className="text-xs font-semibold tracking-[0.15em] text-stone-500 uppercase">Verified results</p><h2 className="mt-1 text-xl font-semibold">{result.count.toLocaleString()} accessible {result.count === 1 ? 'record' : 'records'}</h2></div><button onClick={() => { setResult(null); setError('') }} className="text-sm font-semibold text-[#365d4d] hover:underline">Start a new search</button></div>
          {result.results.length === 0 ? <div className="px-6 py-14 text-center"><Search aria-hidden size={34} className="mx-auto text-stone-400" /><h3 className="mt-4 font-semibold">No matching records</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">Try fewer conditions, a broader year range, or a different phrase. Results also depend on your account’s archive permissions.</p></div> :
          <div className={`divide-y divide-stone-100 transition-opacity ${pageLoading ? 'opacity-50' : ''}`}>{result.results.map(document => <article key={document.id} className="group grid gap-4 px-6 py-5 hover:bg-stone-50 sm:grid-cols-[auto_1fr_auto] sm:items-center"><span className="grid size-11 place-items-center rounded-xl bg-[#edf3ef] text-[#365d4d]"><FileText aria-hidden size={20} /></span><div className="min-w-0"><Link to={`/app/documents/${document.id}`} className="font-semibold text-stone-900 hover:text-[#365d4d] hover:underline">{document.label || `Untitled record ${document.id}`}</Link><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500"><span>{document.document_type?.label || 'Document'}</span><span className="inline-flex items-center gap-1"><CalendarDays aria-hidden size={13} />{dateLabel(document.datetime_created)}</span><span>Record #{document.id}</span></div>{document.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600">{document.description}</p>}</div><Link to={`/app/documents/${document.id}`} aria-label={`Open ${document.label}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#365d4d] group-hover:underline">Open<ArrowRight aria-hidden size={15} /></Link></article>)}</div>}
          {(result.previous_page || result.next_page) && <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stone-200 bg-stone-50 px-6 py-4"><p className="text-xs text-stone-500">Page {result.page} · {result.results.length} records shown</p><nav aria-label="Smart search result pages" className="flex gap-2"><button disabled={!result.previous_page || pageLoading} onClick={() => result.previous_page && changePage(result.previous_page)} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-stone-100 disabled:opacity-40"><ChevronLeft aria-hidden size={14} />Previous</button><button disabled={!result.next_page || pageLoading} onClick={() => result.next_page && changePage(result.next_page)} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-stone-100 disabled:opacity-40">Next<ChevronRight aria-hidden size={14} /></button></nav></div>}
        </section>
      </>}
    </div>
  )
}
