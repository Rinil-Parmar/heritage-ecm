import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, FileText, LoaderCircle, RefreshCw } from 'lucide-react'
import { getDocument, getDocumentFile, type DocumentDetail } from '../api/documents'
import { ApiError } from '../api/client'
import { RecordMetadata } from './RecordMetadata'
import { RecordOrganization } from './RecordOrganization'
import { DocumentComments } from './DocumentComments'
import { DocumentActivity } from './DocumentActivity'
import { DocumentPropertiesEditor } from './DocumentPropertiesEditor'
import { DocumentVersions } from './DocumentVersions'

function date(value: string | null) {
  if (!value) return 'Not available'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Not available' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(parsed)
}

function size(bytes: number | null) {
  if (bytes === null) return 'Not available'
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FilePreview({ document }: { document: DocumentDetail }) {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const file = document.file_latest
  const mime = file?.mimetype.toLowerCase().split(';')[0].trim() || ''
  const supported = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)
  const withinLimit = file?.size != null && file.size <= 20 * 1024 * 1024

  useEffect(() => {
    setUrl('')
    setError('')
    if (!file || !supported || !withinLimit) return
    const controller = new AbortController()
    let objectUrl = ''
    getDocumentFile(document.id, true, controller.signal).then(blob => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch(cause => {
      if (controller.signal.aborted) return
      if (cause instanceof ApiError && cause.status === 401) navigate('/sign-in', { replace: true })
      else setError(cause instanceof ApiError ? cause.message : 'Unable to load the preview. Please try again.')
    })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [document.id, file, supported, withinLimit, retry, navigate])

  if (!file || !supported || !withinLimit) return <div className="px-6 py-20 text-center"><FileText aria-hidden size={40} className="mx-auto text-stone-400" /><h3 className="mt-5 font-semibold">{!file ? 'No file attached yet' : 'Download to view this file'}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-500">{!file ? 'This record does not have an original file available.' : 'Inline preview supports PDFs and common images up to 20 MB. You can download the original file above.'}</p></div>
  if (error) return <div role="alert" className="p-8"><p className="text-sm leading-6 text-stone-600">{error}</p><button onClick={() => setRetry(value => value + 1)} className="mt-4 text-sm font-semibold underline">Retry preview</button></div>
  if (!url) return <p role="status" className="flex items-center justify-center gap-3 py-24 text-sm text-stone-500"><LoaderCircle aria-hidden size={18} className="animate-spin" />Loading preview…</p>
  return mime === 'application/pdf'
    ? <iframe title={`Preview: ${document.label}`} src={url} className="h-[70vh] min-h-96 w-full border-0 bg-stone-100" />
    : <div className="flex min-h-80 items-center justify-center bg-stone-100 p-5"><img src={url} alt={document.label || 'Document preview'} onError={() => setError('This image could not be displayed. Download the original instead.')} className="max-h-[70vh] max-w-full object-contain" /></div>
}

export function DocumentDetailPanel({ id, csrf }: { id: number; csrf: string }) {
  const navigate = useNavigate()
  const [document, setDocument] = useState<DocumentDetail | null>(null)
  const [error, setError] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setDocument(null)
    setError('')
    if (!Number.isSafeInteger(id) || id < 1) { setError('This document address is invalid.'); return }
    getDocument(id, controller.signal).then(value => { if (!controller.signal.aborted) setDocument(value) }).catch(cause => {
      if (controller.signal.aborted) return
      if (cause instanceof ApiError && cause.status === 401) navigate('/sign-in', { replace: true })
      else setError(cause instanceof ApiError ? cause.message : 'Unable to load this document. Please try again.')
    })
    return () => controller.abort()
  }, [id, attempt, navigate])

  async function download() {
    if (!document?.file_latest || downloading) return
    setDownloading(true)
    setDownloadError('')
    try {
      const blob = await getDocumentFile(id, false)
      const url = URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = document.file_latest.filename || `document-${id}`
      window.document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) navigate('/sign-in', { replace: true })
      else setDownloadError(cause instanceof ApiError ? cause.message : 'Download failed. Please try again.')
    } finally { setDownloading(false) }
  }

  return <div>
    <Link to="/app" className="mb-7 inline-flex items-center gap-2 text-sm text-stone-600 hover:text-stone-950"><ArrowLeft aria-hidden size={16} />Back to documents</Link>
    {document && <button onClick={() => setAttempt(value => value + 1)} className="mb-7 ml-5 inline-flex items-center gap-2 text-sm text-stone-600"><RefreshCw size={15} aria-hidden />Refresh record</button>}
    {error ? <div role="alert" className="rounded-2xl border border-stone-200 bg-white p-8"><h1 className="text-xl font-semibold">Document unavailable</h1><p className="mt-3 text-sm text-stone-600">{error}</p><button onClick={() => setAttempt(value => value + 1)} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold underline"><RefreshCw size={15} aria-hidden />Try again</button></div>
      : !document ? <p role="status" className="py-12 text-stone-500">Loading document…</p>
      : <>
        <div className="mb-8 flex flex-wrap items-start justify-between gap-5"><div className="min-w-0 flex-1"><p className="mb-2 text-xs font-semibold tracking-widest text-stone-500 uppercase">Record #{document.id}</p><h1 className="break-words text-3xl font-semibold tracking-tight">{document.label || 'Untitled document'}</h1><p className="mt-3 text-sm text-stone-500">{document.document_type?.label || 'Unspecified type'} · Created {date(document.datetime_created)}</p></div>{document.file_latest && <button onClick={download} disabled={downloading} className="inline-flex items-center gap-2 rounded-xl bg-[#233b33] px-5 py-3 text-sm font-semibold text-white hover:bg-[#304e43] disabled:opacity-60">{downloading ? <LoaderCircle aria-hidden size={17} className="animate-spin" /> : <Download aria-hidden size={17} />}{downloading ? 'Preparing download…' : 'Download original'}</button>}</div>
        {downloadError && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{downloadError}</p>}
        <DocumentPropertiesEditor canWrite document={document} csrf={csrf} onSaved={setDocument} />
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white"><div className="border-b border-stone-200 px-6 py-4"><h2 className="text-sm font-semibold">Original file preview</h2></div><FilePreview document={document} /></section>
          <aside className="rounded-2xl border border-stone-200 bg-white p-6"><h2 className="font-semibold">About this record</h2><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-stone-600">{document.description || 'No description has been added.'}</p><dl className="mt-6 space-y-5 border-t border-stone-100 pt-6 text-sm">{[
            ['Document type', document.document_type?.label || 'Not specified'],
            ['Language code', document.language || 'Not specified'],
            ['Filename', document.file_latest?.filename || 'No file'],
            ['File format', document.file_latest?.mimetype || 'Not available'],
            ['File size', document.file_latest ? size(document.file_latest.size) : 'Not available'],
            ['File added', date(document.file_latest?.timestamp || null)],
            ['Record identifier', document.uuid || String(document.id)],
          ].map(([label, value]) => <div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl></aside>
        </div>
        <RecordMetadata canWrite key={attempt} id={document.id} typeId={document.document_type?.id} csrf={csrf} />
        <RecordOrganization key={`organization-${attempt}`} id={document.id} csrf={csrf} />
        <DocumentVersions canWrite key={`versions-${attempt}`} id={document.id} csrf={csrf} />
        <DocumentComments canWrite key={`comments-${attempt}`} id={document.id} csrf={csrf} />
        <DocumentActivity key={`activity-${attempt}`} id={document.id} />
      </>}
  </div>
}
