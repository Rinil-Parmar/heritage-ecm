import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock3, LockKeyhole, RefreshCw } from 'lucide-react'
import { captureRequest } from '../api/uploads'
import { ApiError } from '../api/client'

type Activity = { id: number; timestamp: string; action: string; actor: string }

export function DocumentActivity({ id }: { id: number }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Activity[]>([])
  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [next, setNext] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [restricted, setRestricted] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setBusy(true); setError(''); setRestricted(false); setRows([]); setNext(false)
    captureRequest<{ results: Activity[]; has_next: boolean }>(`records/${id}/activity?page=${page}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setRows(result.results); setNext(result.has_next) } })
      .catch(cause => {
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) navigate('/sign-in', { replace: true })
        else if (cause instanceof ApiError && cause.status === 403) setRestricted(true)
        else setError(cause instanceof Error ? cause.message : 'Activity could not be loaded.')
      }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [id, page, reload, navigate])
  return <section aria-labelledby="activity-heading" className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
    <div className="flex items-start justify-between gap-4"><div><h2 id="activity-heading" className="flex items-center gap-2 font-semibold"><Clock3 size={19} aria-hidden />Activity history</h2><p className="mt-2 text-sm text-stone-500">Recorded changes and actions for this document.</p></div><button aria-label="Refresh activity" disabled={busy} onClick={() => { setPage(1); setReload(value => value + 1) }} className="rounded-lg border border-stone-200 p-2 hover:bg-stone-50 disabled:opacity-50"><RefreshCw size={16} aria-hidden /></button></div>
    {busy ? <p role="status" className="mt-6 text-sm text-stone-500">Loading activity…</p> : restricted ? <p className="mt-6 flex items-center gap-2 rounded-xl bg-stone-50 p-4 text-sm text-stone-600"><LockKeyhole size={17} aria-hidden />Activity history is restricted for your account.</p> : error ? <p role="alert" className="mt-6 text-sm text-red-800">{error} Use refresh to try again.</p> : <>
      {!rows.length ? <p className="mt-6 text-sm text-stone-500">No recorded activity on this page.</p> : <ol className="mt-6 divide-y divide-stone-100">{rows.map(row => {
        const timestamp = new Date(row.timestamp)
        return <li key={row.id} className="flex gap-4 py-4"><span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-700" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{row.action}</p><p className="mt-1 break-words text-xs text-stone-500">{row.actor}</p></div><time dateTime={row.timestamp} className="max-w-40 text-right text-xs leading-5 text-stone-500">{Number.isNaN(timestamp.getTime()) ? 'Time unavailable' : timestamp.toLocaleString()}</time></li>
      })}</ol>}
      {(page > 1 || next) && <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4 text-sm"><button disabled={page === 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button><span className="text-stone-500">Page {page}</span><button disabled={!next} onClick={() => setPage(value => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button></div>}
    </>}
  </section>
}
