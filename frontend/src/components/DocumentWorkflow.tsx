import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, GitBranch, LoaderCircle, LockKeyhole, RefreshCw } from 'lucide-react'
import { ApiError } from '../api/client'
import { getWorkflows, launchWorkflow, performTransition, type WorkflowInstance, type WorkflowTransition } from '../api/workflows'

function transitionNeedsReason(transition: WorkflowTransition) {
  return transition.destination_state?.label.toLowerCase().includes('correction') ?? false
}

function when(value: string | null | undefined) {
  if (!value) return 'Time unavailable'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Time unavailable' : parsed.toLocaleString()
}

export function DocumentWorkflow({ id, csrf, onChanged }: { id: number; csrf: string; onChanged: () => void }) {
  const [items, setItems] = useState<WorkflowInstance[]>([])
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [restricted, setRestricted] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [selected, setSelected] = useState<{ instance: WorkflowInstance; transition: WorkflowTransition } | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setRestricted(false); setItems([]); setConfigured(false); setSelected(null); setComment('')
    getWorkflows(id, controller.signal)
      .then(data => { if (!controller.signal.aborted) { setItems(data.results); setConfigured(data.configured) } })
      .catch(cause => {
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 403) setRestricted(true)
        else setError(cause instanceof Error ? cause.message : 'The review workflow could not be loaded.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id, reload])

  async function confirm() {
    if (!selected || busy || (transitionNeedsReason(selected.transition) && !comment.trim())) return
    setBusy(true); setError('')
    try {
      const updated = await performTransition(id, selected.instance.id, selected.transition.id, comment.trim(), csrf)
      setItems(current => current.map(item => item.id === updated.id ? updated : item))
      setSelected(null); setComment('')
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The review action could not be completed.')
    } finally { setBusy(false) }
  }

  async function startReview() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await launchWorkflow(id, csrf)
      if (result.workflow) setItems([result.workflow])
      else setReload(value => value + 1)
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The review workflow could not be started.')
    } finally { setBusy(false) }
  }

  return <section aria-labelledby="workflow-heading" className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
    <div className="flex items-start justify-between gap-4">
      <div><h2 id="workflow-heading" className="flex items-center gap-2 font-semibold"><GitBranch size={19} aria-hidden />Review workflow</h2><p className="mt-2 text-sm text-stone-500">Track review progress and move this record through permitted approval steps.</p></div>
      <button aria-label="Refresh workflow" disabled={loading || busy} onClick={() => setReload(value => value + 1)} className="rounded-lg border border-stone-200 p-2 hover:bg-stone-50 disabled:opacity-50"><RefreshCw size={16} aria-hidden /></button>
    </div>
    {loading ? <p role="status" className="mt-6 flex items-center gap-2 text-sm text-stone-500"><LoaderCircle size={17} className="animate-spin" aria-hidden />Loading review status…</p>
      : restricted ? <p className="mt-6 flex items-center gap-2 rounded-xl bg-stone-50 p-4 text-sm text-stone-600"><LockKeyhole size={17} aria-hidden />Review workflow details are restricted for your account.</p>
      : !configured ? <div className="mt-6 rounded-xl border border-dashed border-stone-300 p-5"><p className="text-sm font-semibold">No review workflow configured</p><p className="mt-1 text-sm leading-6 text-stone-500">This document type is not included in the organization’s review process.</p></div>
      : !items.length ? <div className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-xl border border-dashed border-stone-300 p-5"><div><p className="text-sm font-semibold">Review not started</p><p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">Start the configured review process for this document. Mayan will verify your workflow permission before creating it.</p></div><button disabled={busy} onClick={startReview} className="inline-flex items-center gap-2 rounded-lg bg-[#233b33] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#304e43] disabled:opacity-50">{busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <GitBranch size={16} aria-hidden />}{busy ? 'Starting review…' : 'Start review'}</button></div>
      : <div className="mt-6 space-y-5">{items.map(instance => {
        const state = instance.current_state
        return <article key={instance.id} className="rounded-xl border border-stone-200 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold">{instance.label}</p><div className="mt-2 flex items-center gap-2">{state?.final && <CheckCircle2 size={16} className="text-emerald-700" aria-hidden />}<span className="rounded-full bg-[#edf3ef] px-3 py-1 text-xs font-semibold text-[#233b33]">{state?.label || 'State unavailable'}</span></div></div><span className="text-xs font-medium text-stone-500">{state?.completion ?? 0}% complete</span></div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-label={`${instance.label} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={state?.completion ?? 0}><div className="h-full rounded-full bg-[#b28a42] transition-[width]" style={{ width: `${state?.completion ?? 0}%` }} /></div>
          {instance.last_log_entry && <div className="mt-5 rounded-lg bg-stone-50 p-4 text-sm"><p><span className="font-medium">Last action:</span> {instance.last_log_entry.transition?.label || 'Workflow started'}</p><p className="mt-1 text-xs text-stone-500">{instance.last_log_entry.actor} · {when(instance.last_log_entry.datetime)}</p>{instance.last_log_entry.comment && <p className="mt-3 whitespace-pre-wrap break-words leading-6 text-stone-600">{instance.last_log_entry.comment}</p>}</div>}
          {instance.transitions.length ? <div className="mt-5"><p className="text-xs font-semibold tracking-wider text-stone-500 uppercase">Available actions</p><div className="mt-3 flex flex-wrap gap-2">{instance.transitions.map(transition => <button key={transition.id} disabled={busy} onClick={() => { setSelected({ instance, transition }); setComment(''); setError('') }} className="inline-flex items-center gap-2 rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:border-[#365d4d] hover:bg-[#f5f8f6] disabled:opacity-50">{transition.label}<ArrowRight size={15} aria-hidden /></button>)}</div></div>
            : !state?.final && <p className="mt-5 text-sm text-stone-500">No review actions are available for your account in this state.</p>}
        </article>
      })}</div>}
    {selected && <div role="dialog" aria-modal="true" aria-labelledby="transition-title" className="mt-6 rounded-xl border-2 border-[#365d4d] bg-[#f7faf8] p-5">
      <h3 id="transition-title" className="font-semibold">Confirm {selected.transition.label}</h3>
      <p className="mt-2 text-sm leading-6 text-stone-600">This will move the record from <strong>{selected.transition.origin_state?.label || 'its current state'}</strong> to <strong>{selected.transition.destination_state?.label || 'the next state'}</strong>.</p>
      <label className="mt-4 block text-sm font-medium">{transitionNeedsReason(selected.transition) ? 'Correction instructions (required)' : 'Review note (optional)'}<textarea autoFocus rows={3} maxLength={2000} value={comment} onChange={event => setComment(event.target.value)} disabled={busy} className="mt-2 w-full rounded-xl border border-stone-300 bg-white p-3 font-normal focus:outline-[#365d4d]" /></label>
      <div className="mt-4 flex flex-wrap gap-3"><button disabled={busy || (transitionNeedsReason(selected.transition) && !comment.trim())} onClick={confirm} className="rounded-lg bg-[#233b33] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Updating review…' : `Confirm ${selected.transition.label}`}</button><button disabled={busy} onClick={() => { setSelected(null); setComment('') }} className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Cancel</button></div>
    </div>}
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  </section>
}
