import { useEffect, useState } from 'react'
import { FolderOpen, Search, Tags } from 'lucide-react'
import { captureRequest, type OrganizationOption } from '../api/uploads'

interface Props {
  kind: 'tags' | 'cabinets'
  selected: number[]
  onChange: (ids: number[]) => void
  allowedAdd?: number[]
  allowedRemove?: number[]
  disabled: boolean
}

export function OrganizationPicker({ kind, selected, onChange, disabled, allowedAdd, allowedRemove }: Props) {
  const [options, setOptions] = useState<OrganizationOption[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const title = kind === 'tags' ? 'Tags' : 'Cabinets / folders'
  const name = (option: OrganizationOption) => kind === 'cabinets' ? option.full_path || option.label : option.label

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    captureRequest<{ results: OrganizationOption[] }>(`upload/${kind}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setOptions(data.results) })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : `Unable to load ${kind}.`) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [kind, attempt])

  const filtered = options.filter(option => name(option).toLowerCase().includes(query.toLowerCase()))
  const unavailable = selected.filter(id => !options.some(option => option.id === id))
  const mayToggle = (id: number) => selected.includes(id) ? !allowedRemove || allowedRemove.includes(id) : !allowedAdd || allowedAdd.includes(id)
  function toggle(id: number) {
    if (!mayToggle(id) || disabled) return
    onChange(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id])
  }

  return <fieldset disabled={disabled} className="min-w-0 rounded-xl border border-stone-200 p-5">
    <legend className="px-2 text-sm font-semibold">{title} <span className="font-normal text-stone-400">(optional)</span></legend>
    <p className="mb-4 flex items-center gap-2 text-xs text-stone-500">{kind === 'tags' ? <Tags size={15} aria-hidden /> : <FolderOpen size={15} aria-hidden />}{selected.length} selected · up to 50</p>
    {loading ? <p role="status" className="text-sm text-stone-500">Loading {kind}…</p> : error ? <div role="alert" className="text-sm leading-6 text-stone-600"><p>{error}</p><p className="mt-1">You can leave {kind} unassigned, or retry loading.</p><button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-2 font-medium underline">Retry loading {kind}</button></div> : <>
      {!!options.length && <label className="relative mb-3 block"><span className="sr-only">Search {kind}</span><Search size={15} aria-hidden className="absolute top-3.5 left-3 text-stone-400" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Find ${kind}…`} className="w-full rounded-lg border border-stone-200 py-3 pr-3 pl-9 text-sm outline-none focus:border-[#365d4d]" /></label>}
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {filtered.map(option => <label key={option.id} style={kind === 'cabinets' ? { paddingLeft: `${12 + (option.depth || 0) * 18}px` } : undefined} className={`flex cursor-pointer items-start gap-3 rounded-lg p-3 text-sm ${selected.includes(option.id) ? 'bg-[#edf3ef]' : 'hover:bg-stone-50'}`}><input type="checkbox" checked={selected.includes(option.id)} onChange={() => toggle(option.id)} disabled={disabled || !mayToggle(option.id) || (!selected.includes(option.id) && selected.length >= 50)} className="mt-0.5 size-4 shrink-0 accent-[#365d4d]" />{kind === 'tags' ? <span aria-hidden className="mt-1 size-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: option.color || '#6b7280' }} /> : <FolderOpen aria-hidden size={15} className="mt-0.5 shrink-0 text-amber-700" />}<span className="break-words">{name(option)}</span></label>)}
        {!filtered.length && <p className="py-3 text-sm leading-6 text-stone-500">{options.length ? `No ${kind} match your search.` : `No ${kind} are available to your account.`}</p>}
      </div>
      {!!selected.length && <div className="mt-4 border-t border-stone-100 pt-3"><p className="text-xs font-medium text-stone-500">Selected {kind}</p><ul className="mt-2 space-y-2 text-xs text-stone-600">{options.filter(option => selected.includes(option.id)).map(option => <li key={option.id} className="flex items-start gap-2 break-words">{kind === 'tags' ? <span aria-hidden className="mt-0.5 size-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: option.color || '#6b7280' }} /> : <FolderOpen aria-hidden size={13} className="shrink-0 text-amber-700" />}<span>{name(option)}</span></li>)}</ul></div>}
    </>}
    {!loading && !error && <button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-3 text-xs text-stone-500 underline">Refresh {kind}</button>}
    {!loading && !!unavailable.length && <p className="mt-3 text-xs text-amber-800">Some selected {kind} could not be loaded. <button type="button" onClick={() => onChange(selected.filter(id => !unavailable.includes(id) || !mayToggle(id)))} className="underline">Clear unavailable selections</button></p>}
  </fieldset>
}
