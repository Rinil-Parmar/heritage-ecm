import { useEffect, useState, type FormEvent } from 'react'
import { captureRequest } from '../api/uploads'
import { ApiError } from '../api/client'

interface Comment { id: number; text: string; submit_date: string; author: string }
export function DocumentComments({ id, csrf, canWrite = false }: { id: number; csrf: string; canWrite?: boolean }) {
  const [items, setItems] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [reload, setReload] = useState(0)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    captureRequest<{ results: Comment[] }>(`records/${id}/comments`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setItems(data.results) })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load comments.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id, reload])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canWrite || busy || uncertain || !text.trim()) return
    setBusy(true); setError(''); setSaved(false)
    try {
      await captureRequest(`records/${id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ text: text.trim() }) })
      setText(''); setSaved(true); setReload(value => value + 1)
    } catch (cause) {
      setUncertain(!(cause instanceof ApiError && [400, 401, 403, 404, 422].includes(cause.status)))
      setError(cause instanceof Error ? cause.message : 'The comment could not be confirmed.')
    } finally { setBusy(false) }
  }
  return <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
    <div className="flex items-center justify-between"><h2 className="font-semibold">Discussion</h2><button disabled={busy || loading} onClick={() => setReload(value => value + 1)} className="text-sm underline disabled:opacity-50">Refresh comments</button></div>
    <p className="mt-2 text-sm text-stone-500">Share observations and questions with colleagues who can access this record.</p>
    {loading ? <p role="status" className="mt-5 text-sm">Loading comments…</p> : <ul className="mt-5 space-y-4">{items.map(item => <li key={item.id} className="rounded-xl bg-stone-50 p-4"><p className="text-sm font-semibold">{item.author}</p><time className="text-xs text-stone-500" dateTime={item.submit_date}>{new Date(item.submit_date).toLocaleString()}</time><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{item.text}</p></li>)}</ul>}
    {!loading && !error && !items.length && <p className="mt-4 text-sm text-stone-500">No comments yet.</p>}
    {saved && <p role="status" className="mt-4 text-sm text-emerald-800">Comment added.</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
    {uncertain && <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm">Refresh and check the discussion before submitting again. Your comment may already be saved.<button onClick={() => setUncertain(false)} className="mt-2 block underline">I checked; allow another submission</button></div>}
    {canWrite && <form onSubmit={submit} className="mt-5"><label className="block text-sm font-medium">Add a comment<textarea required maxLength={10000} value={text} disabled={busy || uncertain} onChange={event => setText(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-stone-300 p-3 font-normal focus:outline-emerald-700" /></label><button disabled={busy || uncertain || !text.trim()} className="mt-3 rounded-lg bg-[#233b33] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Posting…' : 'Post comment'}</button></form>}
  </section>
}
