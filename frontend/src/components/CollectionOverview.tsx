import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Folder, FolderOpen, RefreshCw } from 'lucide-react'
import { captureRequest, type OrganizationOption } from '../api/uploads'

/** Cabinet navigation uses the same permission-filtered catalog as the sidebar. */
export function CollectionOverview({ cabinetId }: { cabinetId: number }) {
  const [folders, setFolders] = useState<OrganizationOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setFolders([])
    captureRequest<{ results: OrganizationOption[] }>('upload/cabinets', { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setFolders(data.results) })
      .catch(() => { if (!controller.signal.aborted) setError('Collection details could not be loaded.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [cabinetId, retry])

  const current = folders.find(folder => folder.id === cabinetId)
  const children = folders.filter(folder => folder.parent_id === cabinetId)
  const ancestors: OrganizationOption[] = []
  const visited = new Set([cabinetId])
  let parent = folders.find(folder => folder.id === current?.parent_id)
  while (parent && !visited.has(parent.id)) {
    ancestors.unshift(parent)
    visited.add(parent.id)
    parent = folders.find(folder => folder.id === parent?.parent_id)
  }

  return <section aria-label="Collection overview" className="mb-7 overflow-hidden rounded-2xl border border-[#cddbd3] bg-white shadow-sm">
    <div className="bg-[#233b33] p-6 text-white sm:p-8">
      <nav aria-label="Collection path" className="mb-5 flex flex-wrap items-center gap-2 text-xs text-stone-300"><Link to="/app" className="underline underline-offset-4 hover:text-white">All documents</Link>{ancestors.map(folder => <span key={folder.id} className="inline-flex items-center gap-2"><span aria-hidden>/</span><Link to={`/app?cabinet=${folder.id}`} className="underline underline-offset-4 hover:text-white">{folder.label}</Link></span>)}</nav>
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-100">Research collection</p>
      <h1 className="mt-3 flex items-start gap-3 break-words text-3xl font-semibold"><FolderOpen aria-hidden className="mt-1 shrink-0" />{loading ? 'Loading collection…' : current?.label || 'Collection unavailable'}</h1>
      {current && <p className="mt-3 break-words text-sm text-stone-300">{current.full_path || current.label}</p>}
      <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-200">Explore folders below, or search the documents filed directly in this collection. Subfolder documents are viewed by opening their folder.</p>
    </div>
    <div className="p-6">
      {loading ? <p role="status" className="text-sm text-stone-500">Loading accessible folders…</p> : error ? <div role="alert" className="text-sm text-red-800">{error}<button onClick={() => setRetry(value => value + 1)} className="ml-3 inline-flex items-center gap-1 underline"><RefreshCw size={14} aria-hidden />Retry</button></div> : !current ? <p className="text-sm text-stone-600">This cabinet is not available in your current folder list. Ask your administrator to check cabinet access.</p> : <>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Explore subfolders</h2><span className="text-xs text-stone-500">{children.length} accessible</span></div>
        {children.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children.map(folder => <li key={folder.id}><Link to={`/app?cabinet=${folder.id}`} className="flex h-full items-center gap-3 rounded-xl border border-stone-200 p-4 transition hover:border-[#365d4d] hover:bg-[#edf3ef] focus-visible:outline-2 focus-visible:outline-[#365d4d]"><Folder size={20} aria-hidden className="shrink-0 text-[#99742e]" /><span className="min-w-0 flex-1 break-words text-sm font-medium">{folder.label}</span><ArrowRight size={15} aria-hidden className="shrink-0 text-stone-400" /></Link></li>)}</ul> : <p className="mt-3 text-sm text-stone-500">No subfolders are visible to your account. Browse this collection’s documents below.</p>}
      </>}
      <p className="mt-5 border-t border-stone-100 pt-4 text-xs leading-5 text-stone-500">Folders organize records. Only documents shared with your account appear in the results.</p>
    </div>
  </section>
}
