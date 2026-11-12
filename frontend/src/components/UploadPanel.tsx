import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileUp, LoaderCircle } from 'lucide-react'
import { captureRequest, uploadDocument, type MetadataField, type UploadResult } from '../api/uploads'
import { ApiError } from '../api/client'
import { OrganizationPicker } from './OrganizationPicker'

const inputClass = 'mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#365d4d] focus:ring-2 focus:ring-[#365d4d]/20 disabled:opacity-60'

export function UploadPanel({ csrf }: { csrf: string }) {
  const [types, setTypes] = useState<{ id: number; label: string }[]>([])
  const [typeId, setTypeId] = useState('')
  const [fields, setFields] = useState<MetadataField[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [tagIds, setTagIds] = useState<number[]>([])
  const [cabinetIds, setCabinetIds] = useState<number[]>([])
  const [typesLoading, setTypesLoading] = useState(true)
  const [fieldsLoading, setFieldsLoading] = useState(false)
  const [fieldsReady, setFieldsReady] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [reload, setReload] = useState(0)
  const operationKey = useRef(crypto.randomUUID())

  useEffect(() => {
    const controller = new AbortController()
    setTypesLoading(true)
    setError('')
    captureRequest<{ results: typeof types }>('upload/types', { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setTypes(data.results)
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load document types.') })
      .finally(() => { if (!controller.signal.aborted) setTypesLoading(false) })
    return () => controller.abort()
  }, [reload])

  useEffect(() => {
    setFields([])
    setValues({})
    setFieldsReady(false)
    if (!typeId) { setFieldsLoading(false); return }
    const controller = new AbortController()
    setFieldsLoading(true)
    setError('')
    captureRequest<{ results: MetadataField[] }>(`upload/types/${typeId}/fields`, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setFields(data.results); setFieldsReady(true) }
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load metadata fields.') })
      .finally(() => { if (!controller.signal.aborted) setFieldsLoading(false) })
    return () => controller.abort()
  }, [typeId, reload])

  useEffect(() => {
    if (!busy) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !fieldsReady || !file || uncertain) return
    setBusy(true)
    setError('')
    try {
      if (result) {
        const updated = await captureRequest<UploadResult>(`records/${result.document_id}/complete-upload`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          body: JSON.stringify({ metadata: values, tag_ids: tagIds, cabinet_ids: cabinetIds }),
        })
        setResult(updated)
      } else {
        if (!file.size || file.size > 50 * 1024 * 1024) throw new Error('Choose a non-empty file up to 50 MB.')
        setProgress(0)
        try {
          const uploaded = await uploadDocument(file, { document_type_id: Number(typeId), label: label.trim(), description, metadata: values, tag_ids: tagIds, cabinet_ids: cabinetIds }, csrf, operationKey.current, setProgress)
          setResult(uploaded)
        } catch (cause) {
          // No automatic retries of a create operation with an unknown outcome.
          setUncertain(!(cause instanceof ApiError && [400, 401, 403, 404, 413, 422].includes(cause.status)))
          throw cause
        }
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save this record.') }
    finally { setBusy(false) }
  }

  if (result?.metadata_saved && result.organization_saved) return <section className="max-w-2xl rounded-2xl border border-stone-200 bg-white p-8 sm:p-12"><CheckCircle2 className="text-[#365d4d]" size={36} aria-hidden /><h1 className="mt-5 text-2xl font-semibold">Document submitted</h1><p className="mt-3 leading-7 text-stone-600">Record #{result.document_id} was created. Your metadata and selected tags and cabinets were saved. File processing and OCR may continue in the background.</p><div className="mt-7 flex flex-wrap gap-4"><Link to={`/app/documents/${result.document_id}`} className="rounded-xl bg-[#233b33] px-5 py-3 text-sm font-semibold text-white">Open record</Link><Link to="/app" className="px-5 py-3 text-sm font-medium">Back to documents</Link></div></section>

  return <div className="max-w-4xl">
    {!busy && <Link to="/app" className="mb-6 inline-flex items-center gap-2 text-sm text-stone-600"><ArrowLeft size={16} aria-hidden />Back to documents</Link>}
    <p className="mb-2 text-xs font-semibold tracking-widest text-stone-500 uppercase">Add to the research library</p>
    <h1 className="text-3xl font-semibold tracking-tight">Upload a document</h1>
    <p className="mt-3 text-sm leading-6 text-stone-600">Give the record a clear identity and the context your team needs to find it.</p>
    <form onSubmit={submit} className="mt-8 space-y-6">
      <fieldset disabled={busy || !!result || uncertain} className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
        <legend className="sr-only">Document information</legend>
        <h2 className="text-lg font-semibold">1. Document information</h2>
        <label className="mt-5 block text-sm font-medium" htmlFor="document-type">Document type <span className="text-red-700">*</span></label>
        <select id="document-type" required value={typeId} onChange={event => setTypeId(event.target.value)} className={inputClass} disabled={typesLoading || busy || !!result || uncertain}><option value="">{typesLoading ? 'Loading document types…' : 'Select a document type'}</option>{types.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}</select>
        {!typesLoading && types.length === 0 && <p className="mt-3 text-sm text-stone-500">No document types are available to your account. Ask your administrator to configure access.</p>}
        <label htmlFor="document-title" className="mt-5 block text-sm font-medium">Title <span className="text-red-700">*</span><input id="document-title" required maxLength={255} value={label} onChange={event => setLabel(event.target.value)} className={inputClass} /></label>
        <label htmlFor="document-description" className="mt-5 block text-sm font-medium">Description <span className="font-normal text-stone-400">(optional)</span><textarea id="document-description" maxLength={10000} rows={3} value={description} onChange={event => setDescription(event.target.value)} className={inputClass} /></label>
      </fieldset>
      <fieldset disabled={busy || uncertain} className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8"><legend className="sr-only">Research metadata</legend><h2 className="text-lg font-semibold">2. Research metadata</h2><p className="mt-2 text-sm text-stone-500">Fields follow the document type selected above. Required fields are marked with an asterisk.</p>
        {fieldsLoading ? <p role="status" className="mt-5 text-sm">Loading metadata fields…</p> : !typeId ? <p className="mt-5 text-sm text-stone-500">Select a document type to see its fields.</p> : fieldsReady && !fields.length ? <p className="mt-5 text-sm text-stone-500">No additional metadata fields are configured for this type.</p> : null}
        <div className="mt-5 grid gap-5 sm:grid-cols-2">{fields.map(field => <label key={field.id} htmlFor={`metadata-${field.id}`} className="block text-sm font-medium">{field.label} {field.required && <span className="text-red-700">*</span>}<input id={`metadata-${field.id}`} required={field.required} maxLength={10000} value={values[field.id] || ''} onChange={event => setValues(previous => ({ ...previous, [field.id]: event.target.value }))} className={inputClass} />{field.constrained && <span className="mt-2 block text-xs font-normal leading-5 text-stone-500">Use the format or approved value defined by your organization.</span>}</label>)}</div>
      </fieldset>
      <section className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8" aria-labelledby="organization-heading">
        <h2 id="organization-heading" className="text-lg font-semibold">3. Tags and cabinets</h2>
        <p className="mt-2 text-sm leading-6 text-stone-500">Choose existing labels and folders to organize this record. You can select more than one of each.</p>
        {result && <p className="mt-3 text-xs text-stone-500">Selections are fixed for this upload. Retry checks existing assignments and adds only missing ones.</p>}
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <OrganizationPicker kind="tags" selected={tagIds} onChange={setTagIds} disabled={busy || uncertain || !!result} />
          <OrganizationPicker kind="cabinets" selected={cabinetIds} onChange={setCabinetIds} disabled={busy || uncertain || !!result} />
        </div>
      </section>
      <fieldset disabled={busy || !!result || uncertain} className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8"><legend className="sr-only">Original file</legend><h2 className="text-lg font-semibold">4. Original file</h2><label htmlFor="upload-file" className="mt-5 block rounded-xl border border-dashed border-stone-300 bg-stone-50 p-6"><FileUp aria-hidden className="mb-3 text-[#365d4d]" /><span className="block text-sm font-medium">Choose one file, up to 50 MB</span><input id="upload-file" type="file" required className="mt-4 w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-[#233b33] file:px-4 file:py-2 file:text-white" onChange={event => { const selected = event.target.files?.[0] || null; setFile(selected); if (selected && !label) setLabel(selected.name) }} />{file && <span className="mt-3 block break-words text-xs text-stone-500">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>}</label></fieldset>
      {result && (!result.metadata_saved || !result.organization_saved) && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6"><p className="font-semibold">Record #{result.document_id} exists. Some details or assignments need attention.</p>{result.errors.map((message, index) => <p key={index}>{message}</p>)}<Link to={`/app/documents/${result.document_id}`} className="mt-2 inline-block underline">Open the existing record</Link></div>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-800">{error}{!uncertain && !result && <button type="button" onClick={() => setReload(value => value + 1)} className="ml-3 underline">Reload configuration</button>}</div>}
      {uncertain && <p className="text-sm leading-6 text-stone-600">Submission is paused to avoid a duplicate. <Link to="/app" className="font-semibold underline">Check your document list</Link> before starting a new upload.</p>}
      {busy && <div role="status" className="text-sm text-stone-600"><p>{result ? 'Completing details and assignments on the existing record…' : progress < 100 ? `Transferring file: ${progress}%` : 'File transferred. Creating the record, saving metadata, and assigning tags and cabinets…'}</p>{!result && <progress value={progress} max={100} aria-label="File transfer progress" className="mt-3 h-2 w-full accent-[#365d4d]" />}</div>}
      <button disabled={busy || !fieldsReady || !file || uncertain} className="inline-flex items-center gap-2 rounded-xl bg-[#233b33] px-6 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{busy && <LoaderCircle size={17} className="animate-spin" aria-hidden />}{busy ? 'Saving…' : result ? 'Retry incomplete steps' : 'Upload document'}</button>
    </form>
  </div>
}
