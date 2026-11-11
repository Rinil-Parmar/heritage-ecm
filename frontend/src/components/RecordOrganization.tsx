import { useEffect, useState } from 'react'
import { FolderOpen, Tags } from 'lucide-react'
import { captureRequest, type OrganizationOption } from '../api/uploads'

function Assignments({ id, kind }: { id: number; kind: 'tags' | 'cabinets' }) {
  const [items, setItems] = useState<OrganizationOption[] | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setItems(null)
    setError('')
    captureRequest<{ results: OrganizationOption[] }>(`records/${id}/organization/${kind}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setItems(data.results) })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : `Unable to load ${kind}.`) })
    return () => controller.abort()
  }, [id, kind, attempt])
  return <div className="min-w-0"><h3 className="flex items-center gap-2 text-sm font-semibold">{kind === 'tags' ? <Tags aria-hidden size={17} /> : <FolderOpen aria-hidden size={17} />}{kind === 'tags' ? 'Tags' : 'Cabinets / folders'}</h3>
    {error ? <p role="alert" className="mt-3 text-sm leading-6 text-stone-500">{error} <button onClick={() => setAttempt(value => value + 1)} className="underline">Retry</button></p> : items === null ? <p role="status" className="mt-3 text-sm text-stone-500">Loading {kind}…</p> : !items.length ? <p className="mt-3 text-sm text-stone-500">No {kind} available to display.</p> : <ul className="mt-3 flex flex-wrap gap-2">{items.map(item => <li key={item.id} className="max-w-full break-words rounded-lg bg-[#edf3ef] px-3 py-2 text-xs text-[#365d4d]">{kind === 'cabinets' ? item.full_path || item.label : item.label}</li>)}</ul>}
  </div>
}

export function RecordOrganization({ id }: { id: number }) {
  return <section aria-label="Document organization" className="mt-6 grid gap-6 rounded-2xl border border-stone-200 bg-white p-6 sm:grid-cols-2 sm:p-8"><Assignments id={id} kind="tags" /><Assignments id={id} kind="cabinets" /></section>
}
