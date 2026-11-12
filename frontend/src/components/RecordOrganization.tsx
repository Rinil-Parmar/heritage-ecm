import type { DocumentAccess } from '../api/access'
import { useEffect, useState } from 'react'
import { CheckCircle2, FolderOpen, LoaderCircle, Tags } from 'lucide-react'
import { captureRequest, type OrganizationOption } from '../api/uploads'
import { OrganizationPicker } from './OrganizationPicker'

interface OrganizationResult {
  organization_saved: boolean
  errors: string[]
  tags: OrganizationOption[]
  cabinets: OrganizationOption[]
}

function AssignmentList({ items, kind }: { items: OrganizationOption[]; kind: 'tags' | 'cabinets' }) {
  if (!items.length) return <p className="mt-3 text-sm text-stone-500">No {kind} assigned.</p>
  return <ul className={kind === 'tags' ? 'mt-3 flex flex-wrap gap-2' : 'mt-3 space-y-2'}>{items.map(item => kind === 'tags'
    ? <li key={item.id} className="flex max-w-full items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700"><span aria-hidden className="size-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: item.color || '#6b7280' }} /><span className="break-words">{item.label}</span></li>
    : <li key={item.id} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-stone-700"><FolderOpen aria-hidden size={15} className="mt-0.5 shrink-0 text-amber-700" /><span className="break-words">{item.full_path || item.label}</span></li>
  )}</ul>
}

export function RecordOrganization({ id, csrf, access }: { id: number; csrf: string; access: DocumentAccess | null }) {
  const [tags, setTags] = useState<OrganizationOption[] | null>(null)
  const [cabinets, setCabinets] = useState<OrganizationOption[] | null>(null)
  const [tagIds, setTagIds] = useState<number[]>([])
  const [cabinetIds, setCabinetIds] = useState<number[]>([])
  const [originalTagIds, setOriginalTagIds] = useState<number[]>([])
  const [originalCabinetIds, setOriginalCabinetIds] = useState<number[]>([])
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setTags(null)
    setCabinets(null)
    setError('')
    setSaved(false)
    Promise.all([
      captureRequest<{ results: OrganizationOption[] }>(`records/${id}/organization/tags`, { signal: controller.signal }),
      captureRequest<{ results: OrganizationOption[] }>(`records/${id}/organization/cabinets`, { signal: controller.signal }),
    ]).then(([tagData, cabinetData]) => {
      if (controller.signal.aborted) return
      const nextTags = tagData.results.map(item => item.id)
      const nextCabinets = cabinetData.results.map(item => item.id)
      setTags(tagData.results)
      setCabinets(cabinetData.results)
      setTagIds(nextTags)
      setCabinetIds(nextCabinets)
      setOriginalTagIds(nextTags)
      setOriginalCabinetIds(nextCabinets)
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load document organization.')
    })
    return () => controller.abort()
  }, [id, attempt])

  async function save() {
    if (busy) return
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      const result = await captureRequest<OrganizationResult>(`records/${id}/organization`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({
          tag_ids: tagIds, cabinet_ids: cabinetIds,
          original_tag_ids: originalTagIds, original_cabinet_ids: originalCabinetIds,
        }),
      })
      const nextTags = result.tags.map(item => item.id)
      const nextCabinets = result.cabinets.map(item => item.id)
      setTags(result.tags)
      setCabinets(result.cabinets)
      setTagIds(nextTags)
      setCabinetIds(nextCabinets)
      setOriginalTagIds(nextTags)
      setOriginalCabinetIds(nextCabinets)
      if (result.organization_saved) {
        setEditing(false)
        setSaved(true)
      } else {
        setError(result.errors.join(' ') || 'Some assignments could not be saved. Review the current selections.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save document organization.')
    } finally {
      setBusy(false)
    }
  }

  const canWrite = !!access && [access.tags_add, access.tags_remove, access.cabinets_add, access.cabinets_remove].some(ids => ids.length > 0)
  const loading = tags === null || cabinets === null
  return <section aria-label="Document organization" className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="font-semibold">Tags and cabinets</h2><p className="mt-2 text-sm leading-6 text-stone-500">Classify the record and place it in one or more cabinet folders.</p></div>
      {canWrite && !loading && !editing && <button onClick={() => { setEditing(true); setSaved(false); setError('') }} className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium hover:bg-stone-50">Edit organization</button>}
    </div>
    {saved && <p role="status" className="mt-5 flex items-center gap-2 rounded-lg bg-[#edf3ef] p-3 text-sm text-[#365d4d]"><CheckCircle2 aria-hidden size={17} />Tags and cabinets saved.</p>}
    {error && <div role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm leading-6 text-red-800">{error}{!editing && <button onClick={() => setAttempt(value => value + 1)} className="ml-3 underline">Reload</button>}</div>}
    {loading && !error ? <p role="status" className="mt-5 text-sm text-stone-500">Loading tags and cabinets…</p> : !loading && editing && canWrite ? <div className="mt-6">
      <div className="grid gap-5 md:grid-cols-2"><OrganizationPicker kind="tags" allowedAdd={access?.tags_add || []} allowedRemove={access?.tags_remove || []} selected={tagIds} onChange={setTagIds} disabled={busy} /><OrganizationPicker kind="cabinets" allowedAdd={access?.cabinets_add || []} allowedRemove={access?.cabinets_remove || []} selected={cabinetIds} onChange={setCabinetIds} disabled={busy} /></div>
      <div className="mt-5 flex flex-wrap gap-3"><button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#233b33] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy && <LoaderCircle aria-hidden size={15} className="animate-spin" />}{busy ? 'Saving…' : 'Save organization'}</button><button onClick={() => { setEditing(false); setTagIds(originalTagIds); setCabinetIds(originalCabinetIds); setError('') }} disabled={busy} className="px-3 py-2.5 text-sm font-medium">Cancel</button></div>
    </div> : !loading && <div className="mt-6 grid gap-7 sm:grid-cols-2"><div><h3 className="flex items-center gap-2 text-sm font-semibold"><Tags aria-hidden size={17} />Tags</h3><AssignmentList items={tags} kind="tags" /></div><div><h3 className="flex items-center gap-2 text-sm font-semibold"><FolderOpen aria-hidden size={17} />Cabinets / folders</h3><AssignmentList items={cabinets} kind="cabinets" /></div></div>}
  </section>
}
