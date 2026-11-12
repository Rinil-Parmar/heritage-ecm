import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, FileClock, LoaderCircle, RefreshCw, Upload } from 'lucide-react'
import { listDocumentVersions, uploadDocumentVersion, type DocumentVersion } from '../api/versions'
import { ApiError } from '../api/client'

function formattedDate(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

export function DocumentVersions({ id, csrf, canWrite = false }: { id: number; csrf: string; canWrite?: boolean }) {
  const [versions, setVersions] = useState<DocumentVersion[] | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [showUpload, setShowUpload] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const operationKey = useRef(crypto.randomUUID())

  useEffect(() => {
    const controller = new AbortController()
    setVersions(null)
    setError('')
    listDocumentVersions(id, controller.signal)
      .then(data => { if (!controller.signal.aborted) setVersions(data.results) })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load version history.') })
    return () => controller.abort()
  }, [id, reload])

  useEffect(() => {
    if (!busy) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canWrite || !file || busy || uncertain) return
    if (!file.size || file.size > 50 * 1024 * 1024) { setError('Choose a non-empty file up to 50 MB.'); return }
    setBusy(true)
    setError('')
    setMessage('')
    setProgress(0)
    try {
      const result = await uploadDocumentVersion(id, file, comment.trim(), csrf, operationKey.current, setProgress)
      setMessage(result.message)
      setShowUpload(false)
      setFile(null)
      setComment('')
      operationKey.current = crypto.randomUUID()
      window.setTimeout(() => setReload(value => value + 1), 4000)
    } catch (cause) {
      const known = cause instanceof ApiError && [400, 401, 403, 404, 413, 422].includes(cause.status)
      setUncertain(!known)
      setError(cause instanceof Error ? cause.message : 'Unable to upload this version.')
    } finally { setBusy(false) }
  }

  return <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8" aria-labelledby="version-history-heading">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 id="version-history-heading" className="font-semibold">Version history</h2><p className="mt-2 text-sm leading-6 text-stone-500">Keep earlier record states available while the active file evolves.</p></div>
      <div className="flex gap-2"><button onClick={() => setReload(value => value + 1)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-50"><RefreshCw aria-hidden size={15} />Refresh</button>{canWrite && <button onClick={() => { setShowUpload(value => !value); setError(''); setUncertain(false) }} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#233b33] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Upload aria-hidden size={15} />Upload new version</button>}</div>
    </div>

    {canWrite && showUpload && <form onSubmit={submit} className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-5">
      <h3 className="text-sm font-semibold">Add a replacement file</h3><p className="mt-2 text-xs leading-5 text-stone-500">This becomes the active version after processing. Earlier versions stay in the record history.</p>
      <label htmlFor="version-file" className="mt-5 block text-sm font-medium">Replacement file <span className="text-red-700">*</span><input id="version-file" type="file" required disabled={busy || uncertain} onChange={event => setFile(event.target.files?.[0] || null)} className="mt-2 w-full rounded-lg border border-stone-300 bg-white p-3 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-[#233b33] file:px-3 file:py-2 file:text-white" /></label>
      <label htmlFor="version-comment" className="mt-4 block text-sm font-medium">Change summary <span className="text-red-700">*</span><textarea id="version-comment" required minLength={3} maxLength={255} rows={3} disabled={busy || uncertain} value={comment} onChange={event => setComment(event.target.value)} placeholder="What changed in this version?" className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#365d4d]" /></label>
      {file && <p className="mt-3 break-words text-xs text-stone-500">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
      {busy && <div role="status" className="mt-4 text-xs text-stone-600"><p>{progress < 100 ? `Transferring file: ${progress}%` : 'File transferred. Creating the new version…'}</p><progress value={progress} max={100} className="mt-2 h-2 w-full accent-[#365d4d]" /></div>}
      <div className="mt-5 flex gap-3"><button disabled={busy || uncertain || !file || comment.trim().length < 3} className="inline-flex items-center gap-2 rounded-lg bg-[#233b33] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy && <LoaderCircle aria-hidden size={15} className="animate-spin" />}{busy ? 'Uploading…' : 'Submit version'}</button><button type="button" disabled={busy} onClick={() => setShowUpload(false)} className="px-3 py-2.5 text-sm font-medium">Cancel</button></div>
    </form>}

    {message && <p role="status" className="mt-5 flex items-start gap-2 rounded-lg bg-[#edf3ef] p-4 text-sm leading-6 text-[#365d4d]"><CheckCircle2 aria-hidden size={18} className="mt-0.5 shrink-0" />{message}</p>}
    {error && <div role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm leading-6 text-red-800">{error}{uncertain && <p className="mt-2">Do not resubmit yet. Refresh the version history to check whether processing completed.</p>}</div>}
    {versions === null && !error ? <p role="status" className="mt-6 text-sm text-stone-500">Loading version history…</p> : versions && !versions.length ? <p className="mt-6 text-sm text-stone-500">No versions are available to your account.</p> : versions && <ol className="mt-6 divide-y divide-stone-100">{versions.map((version, index) => <li key={version.id} className="flex gap-4 py-4 first:pt-0 last:pb-0"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-600"><FileClock aria-hidden size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">Version {versions.length - index}</p>{version.active && <span className="rounded-full bg-[#edf3ef] px-2 py-0.5 text-[0.65rem] font-semibold text-[#365d4d]">Active</span>}</div><p className="mt-1 text-xs text-stone-500">{formattedDate(version.timestamp)} · ID {version.id}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-stone-600">{version.comment || 'No change summary was recorded.'}</p></div></li>)}</ol>}
  </section>
}
