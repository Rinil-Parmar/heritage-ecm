import { useEffect, useState, type FormEvent } from 'react'
import { captureRequest, type MetadataField } from '../api/uploads'

interface Props { id: number; typeId: number; csrf: string; onClose: (saved: boolean) => void }

export function MetadataEditor({ id, typeId, csrf, onClose }: Props) {
  const [fields, setFields] = useState<MetadataField[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setReady(false)
    setErrors([])
    Promise.all([
      captureRequest<{ results: MetadataField[] }>(`upload/types/${typeId}/fields`, { signal: controller.signal }),
      captureRequest<{ results: { id: number; value: string }[] }>(`records/${id}/metadata`, { signal: controller.signal }),
    ]).then(([configuration, current]) => {
      if (controller.signal.aborted) return
      setFields(configuration.results)
      setValues(Object.fromEntries(configuration.results.map(field => [String(field.id), current.results.find(entry => entry.id === field.id)?.value || ''])))
      setReady(true)
    }).catch(cause => { if (!controller.signal.aborted) setErrors([cause instanceof Error ? cause.message : 'Unable to load editable metadata.']) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id, typeId, reload])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy || !ready) return
    setBusy(true)
    setErrors([])
    try {
      const result = await captureRequest<{ metadata_saved: boolean; errors: string[] }>(`records/${id}/metadata`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ metadata: values }),
      })
      if (result.metadata_saved) onClose(true)
      else setErrors(result.errors)
    } catch (cause) {
      setErrors([cause instanceof Error ? cause.message : 'Save could not be confirmed. Review current values before retrying.'])
    } finally { setBusy(false) }
  }

  return <form onSubmit={save} className="mt-5">
    <p className="text-sm leading-6 text-stone-500">Update the fields configured for this document type. Required fields are marked with an asterisk.</p>
    {!!errors.length && <div role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{errors.map((message, index) => <p key={index}>{message}</p>)}<button type="button" disabled={busy} onClick={() => setReload(value => value + 1)} className="mt-2 font-medium underline">Reload current values (discard unsaved edits)</button></div>}
    {loading ? <p role="status" className="py-6 text-sm text-stone-500">Loading current metadata…</p> : ready && <>
      <fieldset disabled={busy} className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><legend className="sr-only">Metadata fields</legend>{fields.map(field => <label key={field.id} htmlFor={`edit-metadata-${field.id}`} className="text-sm font-medium">{field.label} {field.required && <span className="text-red-700">*</span>}<input id={`edit-metadata-${field.id}`} value={values[field.id] || ''} onChange={event => setValues(previous => ({ ...previous, [field.id]: event.target.value }))} required={field.required} maxLength={10000} className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5 font-normal outline-none focus:border-[#365d4d] focus:ring-2 focus:ring-[#365d4d]/20" />{field.constrained && <span className="mt-2 block text-xs font-normal text-stone-500">Follow your organization’s approved format or value.</span>}</label>)}</fieldset>
      {!fields.length && <p className="mt-4 text-sm text-stone-500">No editable metadata fields are configured for this document type.</p>}
    </>}
    <div className="mt-6 flex flex-wrap gap-3"><button disabled={busy || loading || !ready || !fields.length} className="rounded-xl bg-[#233b33] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save metadata'}</button><button type="button" disabled={busy} onClick={() => onClose(false)} className="rounded-xl border border-stone-200 px-5 py-3 text-sm">Cancel</button></div>
  </form>
}
