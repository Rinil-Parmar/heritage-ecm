import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Search, Tags } from 'lucide-react'
import { captureRequest, type OrganizationOption } from '../api/uploads'

export function TagLibrary() {
  const [items, setItems] = useState<OrganizationOption[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    captureRequest<{ results: OrganizationOption[] }>('upload/tags', { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setItems(data.results) })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load tags.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reload])
  const filtered = items.filter(item => item.label.toLowerCase().includes(query.trim().toLowerCase()))
  return <section><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">Explore the library</p><h1 className="text-3xl font-semibold tracking-tight">Tags</h1><p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">Find records across folders by topic, project, or classification. Select a tag to explore its documents.</p></div><button onClick={() => setReload(value => value + 1)} disabled={loading} className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm disabled:opacity-50">Refresh tags</button></div>
    <label className="relative mb-6 block max-w-lg"><span className="sr-only">Find a tag</span><Search aria-hidden size={18} className="absolute left-4 top-4 text-stone-400" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a tag…" className="w-full rounded-xl border border-stone-300 bg-white py-3 pl-11 pr-4 focus:outline-emerald-700" /></label>
    {loading ? <p role="status">Loading tags…</p> : error ? <p role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-800">{error}</p> : <><p role="status" className="mb-4 text-xs text-stone-500">{filtered.length} tags available</p><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(item => <Link key={item.id} to={`/app?tag=${item.id}`} className="group flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-emerald-700 focus-visible:outline-emerald-700"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-stone-50"><Tags aria-hidden size={21} style={{ color: /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : '#6b7280' }} /></span><span className="min-w-0 flex-1"><span className="block break-words font-semibold">{item.label}</span><span className="mt-1 block text-xs text-stone-500">Browse documents</span></span><ArrowUpRight aria-hidden size={16} className="shrink-0 text-stone-400 group-hover:text-emerald-700" /></Link>)}</div>{!filtered.length && <div className="rounded-2xl border border-dashed border-stone-300 p-12 text-center"><h2 className="font-semibold">{items.length ? 'No matching tags' : 'No tags available'}</h2><p className="mt-2 text-sm text-stone-500">{items.length ? 'Try another search term.' : 'Tags will appear here when they are available to your account.'}</p></div>}</>}
  </section>
}
