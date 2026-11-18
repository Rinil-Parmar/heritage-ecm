import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CircleAlert, ClipboardCheck, FileCheck2, LoaderCircle, RefreshCw, UserRoundCheck } from 'lucide-react'
import { ApiError } from '../api/client'
import { getAssignmentAccess, getReviewAssignees, getReviewQueue, removeReviewAssignment, saveReviewAssignment, type BlockedReview, type ReviewAssignee, type ReviewAssignment, type ReviewQueueItem } from '../api/workflows'

function formatDate(value: string | null, includeTime = false) {
  if (!value) return 'Date unavailable'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(parsed)
}

function stateStyle(label: string) {
  const normalized = label.toLowerCase()
  if (normalized.includes('correction')) return 'bg-amber-100 text-amber-900'
  if (normalized.includes('review')) return 'bg-blue-50 text-blue-900'
  return 'bg-[#edf3ef] text-[#233b33]'
}

export function ReviewQueue({ username, csrf }: { username: string; csrf: string }) {
  const navigate = useNavigate()
  const [items, setItems] = useState<ReviewQueueItem[]>([])
  const [blocked, setBlocked] = useState<BlockedReview[]>([])
  const [workflow, setWorkflow] = useState('Document review')
  const [filter, setFilter] = useState('All open')
  const [loading, setLoading] = useState(true)
  const [restricted, setRestricted] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [canAssign, setCanAssign] = useState(false)
  const [assignees, setAssignees] = useState<ReviewAssignee[]>([])
  const [editing, setEditing] = useState<ReviewQueueItem | null>(null)
  const [assignee, setAssignee] = useState('')
  const [priority, setPriority] = useState<ReviewAssignment['priority']>('normal')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setRestricted(false)
    getReviewQueue(controller.signal)
      .then(data => { if (!controller.signal.aborted) { setItems(data.results); setBlocked(data.blocked || []); setWorkflow(data.workflow?.label || 'Document review') } })
      .catch(cause => {
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) navigate('/sign-in', { replace: true })
        else if (cause instanceof ApiError && cause.status === 403) setRestricted(true)
        else setError(cause instanceof Error ? cause.message : 'The review queue could not be loaded.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [navigate, reload])

  useEffect(() => {
    const controller = new AbortController()
    getAssignmentAccess(controller.signal).then(async result => {
      if (controller.signal.aborted || !result.allowed) return
      setCanAssign(true)
      const data = await getReviewAssignees(controller.signal)
      if (!controller.signal.aborted) setAssignees(data.results)
    }).catch(() => { if (!controller.signal.aborted) setCanAssign(false) })
    return () => controller.abort()
  }, [])

  const states = useMemo(() => [...new Set(items.map(item => item.state.label))], [items])
  const visible = filter === 'All open' ? items
    : filter === 'Assigned to me' ? items.filter(item => item.assignment?.assignee_username === username)
    : filter === 'Unassigned' ? items.filter(item => !item.assignment)
    : items.filter(item => item.state.label === filter)
  const corrections = items.filter(item => item.state.label.toLowerCase().includes('correction')).length
  const underReview = items.filter(item => item.state.label.toLowerCase() === 'under review').length
  const submitted = items.filter(item => item.state.label.toLowerCase() === 'submitted').length
  const selectedAssignee = assignees.find(user => user.username === assignee)

  function editAssignment(item: ReviewQueueItem) {
    setEditing(item)
    setAssignee(item.assignment?.assignee_username || '')
    setPriority(item.assignment?.priority || 'normal')
    setDueDate(item.assignment?.due_at || '')
    setError('')
  }

  async function saveAssignment() {
    if (!editing || !assignee || saving) return
    setSaving(true); setError('')
    try {
      const assignment = await saveReviewAssignment(editing.workflow_instance_id, editing.id, assignee, priority, dueDate, csrf)
      setItems(current => current.map(item => item.id === editing.id ? { ...item, assignment } : item))
      setEditing(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The review could not be assigned.') }
    finally { setSaving(false) }
  }

  async function unassign() {
    if (!editing?.assignment || saving) return
    setSaving(true); setError('')
    try {
      await removeReviewAssignment(editing.workflow_instance_id, csrf)
      setItems(current => current.map(item => item.id === editing.id ? { ...item, assignment: null } : item))
      setEditing(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The assignment could not be removed.') }
    finally { setSaving(false) }
  }

  return <div>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><p className="mb-2 text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">Review operations</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Review queue</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">See what needs attention, understand its current state, and open the record to make the next decision.</p></div><button onClick={() => setReload(value => value + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-stone-100 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden />Refresh</button></div>

    {!loading && !restricted && !error && <div className="mb-6 grid gap-4 sm:grid-cols-3">
      {[{ label: 'Submitted', value: submitted, note: 'Waiting to be reviewed' }, { label: 'Under Review', value: underReview, note: 'Decision in progress' }, { label: 'Needs Correction', value: corrections, note: 'Returned for changes' }].map(summary => <button key={summary.label} onClick={() => setFilter(summary.label)} className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-[#365d4d] ${filter === summary.label ? 'border-[#365d4d] ring-2 ring-[#365d4d]/10' : 'border-stone-200'}`}><span className="text-2xl font-semibold">{summary.value}</span><span className="mt-2 block text-sm font-semibold">{summary.label}</span><span className="mt-1 block text-xs text-stone-500">{summary.note}</span></button>)}
    </div>}

    {!loading && blocked.length > 0 && <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5" aria-labelledby="blocked-reviews-heading"><h2 id="blocked-reviews-heading" className="font-semibold text-amber-950">Assigned reviews need access</h2><p className="mt-1 text-sm text-amber-900">These assignments exist, but Mayan is preventing the reviewer from opening the workflow.</p><ul className="mt-4 space-y-3">{blocked.map(item => <li key={`${item.assignment.workflow_instance_id}-${item.document_id}`} className="rounded-xl border border-amber-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-semibold">{item.label}</p><p className="mt-1 text-sm text-stone-600">{item.reason}</p></div><Link to={`/app/documents/${item.document_id}`} className="text-sm font-semibold text-[#365d4d] underline">Open record</Link></div></li>)}</ul></section>}

    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 px-6 py-5"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><FileCheck2 size={18} className="text-[#365d4d]" aria-hidden />Open review work</h2><p className="mt-1 text-xs text-stone-500">{workflow} · Approved records leave this queue</p></div>{items.length > 0 && <div className="flex flex-wrap gap-2">{['All open', 'Assigned to me', 'Unassigned', ...states].map(state => <button key={state} onClick={() => setFilter(state)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === state ? 'bg-[#233b33] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{state}{state === 'All open' ? ` (${items.length})` : ''}</button>)}</div>}</div>
      {loading ? <p role="status" className="flex items-center gap-2 p-6 text-sm text-stone-500"><LoaderCircle size={17} className="animate-spin" aria-hidden />Loading review queue…</p>
        : restricted ? <div className="p-8"><h3 className="font-semibold">Review queue unavailable</h3><p className="mt-2 text-sm leading-6 text-stone-600">Your account cannot view workflow information. Ask an administrator for workflow-view access if reviewing records is part of your role.</p></div>
        : error ? <div role="alert" className="p-8"><h3 className="font-semibold">Queue could not be loaded</h3><p className="mt-2 text-sm text-stone-600">{error}</p><button onClick={() => setReload(value => value + 1)} className="mt-4 text-sm font-semibold underline">Try again</button></div>
        : !items.length ? <div className="px-6 py-16 text-center"><ClipboardCheck size={38} className="mx-auto text-stone-400" aria-hidden /><h3 className="mt-5 text-lg font-semibold">{blocked.length ? 'No accessible review work' : 'No open review work'}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">{blocked.length ? 'Your assignments are listed above. An administrator must grant the Reviewer document bundle before you can act on them.' : 'Start a workflow from a document’s Review workflow section. It will appear here until it reaches a final state.'}</p><Link to="/app" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#365d4d] hover:underline">Browse documents<ArrowRight size={15} aria-hidden /></Link></div>
        : !visible.length ? <div className="px-6 py-12 text-center"><CircleAlert size={32} className="mx-auto text-stone-400" aria-hidden /><h3 className="mt-4 font-semibold">No records in {filter}</h3><button onClick={() => setFilter('All open')} className="mt-3 text-sm font-semibold text-[#365d4d] underline">Show all open reviews</button></div>
        : <ul className="divide-y divide-stone-100">{visible.map(item => <li key={item.id} className="p-6 hover:bg-stone-50/70"><div className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${stateStyle(item.state.label)}`}>{item.state.label}</span><span className="text-xs text-stone-500">{item.state.completion}% complete</span>{item.assignment && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.assignment.priority === 'urgent' ? 'bg-red-100 text-red-800' : item.assignment.priority === 'high' ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-600'}`}>{item.assignment.priority} priority</span>}</div><Link to={`/app/documents/${item.id}`} className="mt-3 block break-words text-lg font-semibold text-stone-900 hover:text-[#365d4d] hover:underline">{item.label}</Link><p className="mt-1 text-sm text-stone-500">{item.document_type?.label || 'Unspecified type'} · Created {formatDate(item.datetime_created)}</p><p className="mt-3 flex items-center gap-2 text-xs text-stone-600"><UserRoundCheck aria-hidden size={14} />{item.assignment ? <>Assigned to <strong>{item.assignment.assignee_username}</strong>{item.assignment.due_at ? ` · Due ${formatDate(item.assignment.due_at)}` : ''}</> : 'Unassigned'}</p>{item.last_action && <p className="mt-2 text-xs text-stone-500">Latest: <span className="font-medium text-stone-700">{item.last_action.label}</span> by {item.last_action.actor} · {formatDate(item.last_action.datetime, true)}</p>}</div><div className="w-full sm:w-48"><div className="mb-3 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-[#b28a42]" style={{ width: `${item.state.completion}%` }} /></div><Link to={`/app/documents/${item.id}`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#233b33] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#304e43]">Open review<ArrowRight size={15} aria-hidden /></Link>{canAssign && <button onClick={() => editAssignment(item)} className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-2 text-xs font-semibold hover:bg-stone-100">{item.assignment ? 'Edit assignment' : 'Assign reviewer'}</button>}</div></div></li>)}</ul>}
    </section>
    {editing && <section role="dialog" aria-modal="true" aria-labelledby="assignment-title" className="mt-6 rounded-2xl border-2 border-[#365d4d] bg-white p-6 shadow-lg"><h2 id="assignment-title" className="text-lg font-semibold">Assign review</h2><p className="mt-1 text-sm text-stone-500">{editing.label}</p><p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900">Saving the assignment also ensures Reviewer access for the person’s role. Other members of that role can access the record, but only the selected person receives the assignment and notification.</p><div className="mt-5 grid gap-4 md:grid-cols-3"><label className="text-sm font-medium">Reviewer<select value={assignee} onChange={event => setAssignee(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3"><option value="">Choose reviewer</option>{assignees.map(user => <option key={user.id} value={user.username}>{user.label}{user.label !== user.username ? ` (${user.username})` : ''} — {user.role_label}</option>)}</select>{selectedAssignee && <span className="mt-2 block text-xs text-stone-500">Access audience: {selectedAssignee.role_label}</span>}{!assignees.length && <span className="mt-2 block text-xs text-red-700">No eligible reviewers were returned. Assign an active user to Department Administrator, Research Professor, or Research Assistant.</span>}</label><label className="text-sm font-medium">Priority<select value={priority} onChange={event => setPriority(event.target.value as ReviewAssignment['priority'])} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label className="text-sm font-medium">Due date<input type="date" min={new Date().toISOString().slice(0, 10)} value={dueDate} onChange={event => setDueDate(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-3" /></label></div><div className="mt-5 flex flex-wrap gap-3"><button disabled={!assignee || saving} onClick={saveAssignment} className="rounded-xl bg-[#233b33] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save assignment and access'}</button>{editing.assignment && <button disabled={saving} onClick={unassign} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">Remove assignment</button>}<button disabled={saving} onClick={() => setEditing(null)} className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold">Cancel</button></div></section>}
  </div>
}
