import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, Folder, RefreshCw } from 'lucide-react'
import { captureRequest, type OrganizationOption } from '../api/uploads'

export function CabinetNavigation() {
  const location = useLocation()
  const selected = Number(new URLSearchParams(location.search).get('cabinet'))
  const [items, setItems] = useState<OrganizationOption[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    captureRequest<{ results: OrganizationOption[] }>('upload/cabinets', { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setItems(data.results) })
      .catch(() => { if (!controller.signal.aborted) setError('Folders could not be loaded.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reload])
  function branch(item: OrganizationOption, ancestors: number[] = []): ReactNode {
    if (ancestors.includes(item.id)) return null
    const children = items.filter(child => child.parent_id === item.id)
    const open = expanded.has(item.id)
    return <li key={item.id}><div className="flex items-center gap-1">
      {children.length > 0 ? <button aria-label={`${open ? 'Collapse' : 'Expand'} ${item.label}`} aria-expanded={open} onClick={() => setExpanded(previous => { const next = new Set(previous); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next })} className="rounded p-1 hover:bg-white/10">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button> : <span className="w-6 shrink-0" />}
      <Link to={`/app?cabinet=${item.id}`} title={item.full_path || item.label} aria-current={selected === item.id ? 'page' : undefined} className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-sm ${selected === item.id ? 'bg-white/15 text-white' : 'text-stone-300 hover:bg-white/10'}`}><Folder size={15} className="shrink-0 text-amber-200" /><span className="truncate">{item.label}</span></Link>
    </div>{open && children.length > 0 && <ul className="ml-3 border-l border-white/15 pl-2">{children.map(child => branch(child, [...ancestors, item.id]))}</ul>}</li>
  }
  return <nav aria-label="Cabinet folders" className="my-6 min-h-0 lg:flex-1 lg:overflow-y-auto"><div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-semibold tracking-widest text-stone-300 uppercase">Cabinets</h2><button aria-label="Refresh cabinets" disabled={loading} onClick={() => setReload(value => value + 1)} className="rounded p-1 hover:bg-white/10"><RefreshCw size={13} /></button></div><input aria-label="Find a cabinet" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a folder…" className="mb-3 w-full rounded-lg border border-white/20 bg-white/5 p-2 text-sm text-white placeholder:text-stone-400" />
    {loading ? <p role="status" className="text-xs text-stone-300">Loading folders…</p> : error ? <p role="alert" className="text-xs text-amber-200">{error}</p> : !items.length ? <p className="text-xs text-stone-300">No cabinets available.</p> : query ? <ul>{items.filter(item => (item.full_path || item.label).toLowerCase().includes(query.toLowerCase())).map(item => <li key={item.id}><Link className="block rounded-lg p-2 text-xs hover:bg-white/10" to={`/app?cabinet=${item.id}`}>{item.full_path || item.label}</Link></li>)}</ul> : <ul>{items.filter(item => !items.some(parent => parent.id === item.parent_id)).map(item => branch(item))}</ul>}
  </nav>
}
