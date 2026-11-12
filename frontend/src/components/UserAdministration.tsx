import { useEffect, useState, type FormEvent } from 'react'
import { captureRequest } from '../api/uploads'
import { UserEditor } from './UserEditor'

export function UserAdministration({ csrf }: { csrf: string }) {
  const [users, setUsers] = useState<{ id: number; username: string; is_active: boolean }[]>([])
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [group, setGroup] = useState('')
  const [reload, setReload] = useState(0)
  const [uncertain, setUncertain] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [editId, setEditId] = useState<number | null>(null)
  const visibleUsers = users.filter(user => user.username.toLowerCase().includes(search.trim().toLowerCase()) && (status === 'all' || user.is_active === (status === 'active')))
  useEffect(() => {
    const controller = new AbortController()
    setReady(false); setError('')
    Promise.all([captureRequest<{ results: typeof users }>('admin/users', { signal: controller.signal }), captureRequest<{ results: typeof groups }>('admin/groups', { signal: controller.signal })])
      .then(([u, g]) => { if (!controller.signal.aborted) { setUsers(u.results); setGroups(g.results); setReady(true) } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Administration unavailable.') })
    return () => controller.abort()
  }, [reload])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || uncertain) return
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await captureRequest<{ created: boolean; group_assigned: boolean; user_id: number }>('admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ username, password, group_id: Number(group) }) })
      setMessage(result.group_assigned ? 'Account created and access group assigned.' : `Account #${result.user_id} was created, but its group could not be assigned. Use Edit account to complete membership.`)
      setUsername(''); setReload(value => value + 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Creation could not be confirmed.'); setUncertain(true) }
    finally { setPassword(''); setBusy(false) }
  }
  return <section><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">Administration</p><h1 className="text-3xl font-semibold tracking-tight">Manage users</h1><p className="mt-3 text-sm text-stone-600">Find team members, check account status, and create research accounts.</p>
    {error && <p role="alert" className="mt-5 text-red-800">{error}</p>}{message && <p role="status" className="mt-5 rounded-lg bg-emerald-50 p-4">{message}</p>}
    <button disabled={busy} className="my-5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-50" onClick={() => setReload(value => value + 1)}>Refresh users</button>
    {!ready && !error && <p role="status" className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-500">Loading accounts and available groups…</p>}
    {ready && <div className="mb-5"><label className="text-sm font-medium">Edit an existing account<select value={editId || ''} onChange={event => setEditId(Number(event.target.value) || null)} className="mt-2 block w-full max-w-xl rounded-lg border border-stone-300 bg-white p-3"><option value="">Select account to edit</option>{users.map(user => <option key={user.id} value={user.id}>{user.username}</option>)}</select></label>{editId && <UserEditor key={editId} id={editId} csrf={csrf} groups={groups} onClose={() => { setEditId(null); setReload(value => value + 1) }} />}</div>}
    {ready && <><div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="flex flex-wrap items-end gap-4 border-b border-stone-200 p-5"><label className="min-w-48 flex-1 text-sm font-medium">Find a user<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search username…" className="mt-2 block w-full rounded-lg border border-stone-300 p-3 font-normal focus:outline-emerald-700" /></label><label className="text-sm font-medium">Account status<select value={status} onChange={event => setStatus(event.target.value)} className="mt-2 block rounded-lg border border-stone-300 bg-white p-3 font-normal"><option value="all">All accounts</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div><p role="status" className="px-5 pt-4 text-xs text-stone-500">{visibleUsers.length} of {users.length} accounts</p><ul className="divide-y divide-stone-100 px-5">{visibleUsers.map(user => <li key={user.id} className="flex items-center justify-between gap-4 py-4 text-sm"><div className="min-w-0"><p className="break-words font-medium">{user.username}</p><p className="mt-1 text-xs text-stone-500">Account #{user.id}</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${user.is_active ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>{user.is_active ? 'Active' : 'Inactive'}</span></li>)}</ul>{!visibleUsers.length && <p className="p-8 text-center text-sm text-stone-500">No accounts match these filters.</p>}</div>
    <form onSubmit={submit} className="mt-6 max-w-xl rounded-xl border border-stone-200 bg-white p-6"><h2 className="font-semibold">Create research account</h2><fieldset disabled={busy || uncertain} className="mt-4 space-y-4"><label className="block text-sm">Username<input required maxLength={150} value={username} onChange={event => setUsername(event.target.value)} className="mt-2 block w-full rounded-lg border p-3" /></label><label className="block text-sm">Initial password<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} className="mt-2 block w-full rounded-lg border p-3" /></label><label className="block text-sm">Research group<select required value={group} onChange={event => setGroup(event.target.value)} className="mt-2 block w-full rounded-lg border p-3"><option value="">Select group</option>{groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="rounded-lg bg-[#233b33] px-4 py-3 text-sm text-white">{busy ? 'Creating…' : 'Create account'}</button></fieldset>{uncertain && <p className="mt-4 text-sm">Check the refreshed user list before retrying. <button type="button" onClick={() => setUncertain(false)} className="underline">I checked; enable form</button></p>}</form></>}
  </section>
}
