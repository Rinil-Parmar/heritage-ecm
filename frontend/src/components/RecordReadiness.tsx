import { useEffect, useState } from 'react'
import { ArrowDown, CheckCircle2, CircleHelp, ClipboardCheck, RefreshCw } from 'lucide-react'
import type { DocumentDetail } from '../api/documents'
import { captureRequest, type MetadataField, type OrganizationOption } from '../api/uploads'

type Check = { label: string; detail: string; status: 'complete' | 'missing' | 'unknown'; target: string; required: boolean }
type Organization = { results: OrganizationOption[]; restricted?: boolean }

export function RecordReadiness({ record }: { record: DocumentDetail }) {
  const [checks, setChecks] = useState<Check[]>([])
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    const request = <T,>(path: string) => captureRequest<T>(path, { signal: controller.signal })
    Promise.allSettled([
      record.document_type ? request<{ results: MetadataField[] }>(`upload/types/${record.document_type.id}/fields`) : Promise.reject(new Error('No document type')),
      request<{ results: { id: number; value: string }[] }>(`records/${record.id}/metadata`),
      request<Organization>(`records/${record.id}/organization/cabinets`),
      request<Organization>(`records/${record.id}/organization/tags`),
    ]).then(([fields, metadata, cabinets, tags]) => {
      if (controller.signal.aborted) return
      const next: Check[] = [
        { label: 'Original file', detail: record.file_latest ? 'A file is attached.' : 'Add the original file in Version history.', status: record.file_latest ? 'complete' : 'missing', target: 'record-versions', required: true },
        { label: 'Document type', detail: record.document_type?.label || 'A document type is needed to determine metadata requirements.', status: record.document_type ? 'complete' : 'missing', target: 'record-properties', required: true },
      ]
      if (fields.status === 'fulfilled' && metadata.status === 'fulfilled') {
        const required = fields.value.results.filter(field => field.required)
        const missing = required.filter(field => !metadata.value.results.some(entry => entry.id === field.id && String(entry.value ?? '').trim()))
        next.push({ label: 'Required metadata', detail: missing.length ? `Complete: ${missing.map(field => field.label).join(', ')}.` : required.length ? `${required.length} required fields contain values.` : 'No required fields are configured for this document type.', status: missing.length ? 'missing' : 'complete', target: 'record-metadata', required: true })
      } else next.push({ label: 'Required metadata', detail: 'Could not verify the field requirements or values with your current access. Refresh to retry.', status: 'unknown', target: 'record-metadata', required: true })
      for (const [label, response] of [['Cabinet', cabinets], ['Tags', tags]] as const) {
        const available = response.status === 'fulfilled' && !response.value.restricted
        const count = available ? response.value.results.length : 0
        next.push({ label, detail: !available ? 'Could not verify this information with your current access.' : count ? `${count} assigned.` : `Add ${label === 'Cabinet' ? 'a cabinet to organize the record' : 'tags to help others discover it'}.`, status: !available ? 'unknown' : count ? 'complete' : 'missing', target: 'record-organization', required: false })
      }
      setChecks(next)
      setLoading(false)
    })
    return () => controller.abort()
  }, [record.id, record.document_type?.id, record.file_latest?.id, reload])

  const required = checks.filter(check => check.required)
  const missing = required.filter(check => check.status === 'missing').length
  const unknown = required.some(check => check.status === 'unknown')
  const headline = loading ? 'Checking record essentials…' : unknown ? 'Some checks could not be verified' : missing ? `${missing} essential ${missing === 1 ? 'check needs' : 'checks need'} attention` : 'Record essentials complete'

  return <section aria-labelledby="readiness-title" className="mb-6 overflow-hidden rounded-2xl border border-[#cedbd3] bg-white shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4 bg-[#edf3ef] p-5 sm:p-6"><div><h2 id="readiness-title" className="flex items-center gap-2 font-semibold text-[#233b33]"><ClipboardCheck size={19} aria-hidden />Record readiness</h2><p role="status" className="mt-2 text-sm font-medium">{headline}</p><p className="mt-1 max-w-2xl text-xs leading-5 text-stone-600">Check completeness before review. This does not certify accuracy or approval. Refresh after editing to check your latest changes.</p></div><button onClick={() => setReload(value => value + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50"><RefreshCw size={14} aria-hidden className={loading ? 'animate-spin' : ''} />Check again</button></div>
    {!loading && <ul className="grid divide-y divide-stone-100 sm:grid-cols-2">{checks.map(check => <li key={check.label} className="flex items-start gap-3 p-5">{check.status === 'complete' ? <CheckCircle2 size={19} aria-hidden className="mt-0.5 shrink-0 text-emerald-700" /> : <CircleHelp size={19} aria-hidden className={`mt-0.5 shrink-0 ${check.status === 'unknown' ? 'text-stone-500' : 'text-amber-700'}`} />}<div><p className="text-sm font-semibold">{check.label}<span className="ml-2 text-xs font-normal text-stone-500">{check.required ? 'Essential' : 'Recommended'}</span></p><p className="mt-1 text-xs leading-5 text-stone-600">{check.detail}</p><a href={`#${check.target}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#365d4d] underline underline-offset-4">Open section<ArrowDown size={12} aria-hidden /></a></div></li>)}</ul>}
  </section>
}
