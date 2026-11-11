import { useEffect, useState } from 'react'
import { captureRequest } from '../api/uploads'

export function RecordMetadata({ id }: { id: number }) {
  const [entries, setEntries] = useState<{ id: number; label: string; value: string }[] | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setEntries(null)
    setError('')
    captureRequest<{ results: { id: number; label: string; value: string }[] }>(`records/${id}/metadata`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setEntries(data.results) })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load metadata.') })
    return () => controller.abort()
  }, [id, retry])
  return <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8"><h2 className="font-semibold">Research metadata</h2>
    {error ? <div role="alert" className="mt-4 text-sm text-stone-600">{error}<button onClick={() => setRetry(value => value + 1)} className="ml-3 underline">Try again</button></div> : entries === null ? <p role="status" className="mt-4 text-sm text-stone-500">Loading metadata…</p> : !entries.length ? <p className="mt-4 text-sm text-stone-500">No metadata is available for this record.</p> : <dl className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{entries.map(entry => <div key={entry.id}><dt className="text-xs text-stone-500">{entry.label}</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm">{entry.value || 'Not entered'}</dd></div>)}</dl>}
  </section>
}
