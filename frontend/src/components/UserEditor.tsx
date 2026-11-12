import { useEffect, useState, type FormEvent } from 'react'
import { captureRequest } from '../api/uploads'
interface UserDetails { id: number; username: string; first_name: string; last_name: string; email: string; groups: { id: number; name: string }[] }
export function UserEditor({ id, csrf, groups, onClose }: { id: number; csrf: string; groups: { id: number; name: string }[]; onClose: () => void }) {
  const [user, setUser] = useState<UserDetails | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setUser(null); setError('')
    captureRequest<UserDetails>(`admin/users/${id}`, { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) { setUser(value); setSelected(value.groups.filter(group => groups.some(option => option.id === group.id)).map(group => group.id)) }
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load account.') })
    return () => controller.abort()
  }, [id, reload, groups])
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!user || busy) return
    setBusy(true); setError('')
    try {
      const result = await captureRequest<{ saved: boolean; errors: string[] }>(`admin/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ first_name: user.first_name, last_name: user.last_name, email: user.email, group_ids: selected, original_group_ids: user.groups.map(group => group.id) }) })
      if (result.saved) onClose()
      else setError(result.errors.join(' '))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Update could not be confirmed. Reload before retrying.') }
    finally { setBusy(false) }
  }
  return <section className="my-6 rounded-2xl border border-emerald-200 bg-white p-6"><h2 className="text-xl font-semibold">Edit account {user?.username}</h2>{error && <p role="alert" className="my-4 text-sm text-red-800">{error}</p>}{!user ? <p role="status">Loading account…</p> : <form onSubmit={save}><fieldset disabled={busy} className="mt-5 space-y-4"><div className="grid gap-4 sm:grid-cols-2">{(['first_name', 'last_name', 'email'] as const).map(field => <label key={field} className="text-sm">{field === 'first_name' ? 'First name' : field === 'last_name' ? 'Last name' : 'Email'}<input type={field === 'email' ? 'email' : 'text'} maxLength={field === 'email' ? 254 : 150} value={user[field]} onChange={event => setUser({ ...user, [field]: event.target.value })} className="mt-2 block w-full rounded-lg border p-3" /></label>)}</div><fieldset><legend className="mb-3 text-sm font-semibold">Access groups</legend><p className="mb-3 text-xs text-stone-500">Permissions from selected groups combine. Administrator groups grant elevated access.</p>{groups.map(group => <label key={group.id} className="flex items-center gap-3 py-2 text-sm"><input type="checkbox" checked={selected.includes(group.id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, group.id] : previous.filter(value => value !== group.id))} />{group.name}</label>)}</fieldset><button className="rounded-lg bg-[#233b33] px-4 py-3 text-sm text-white">{busy ? 'Saving…' : 'Save account'}</button></fieldset></form>}<div className="mt-4 flex gap-4"><button disabled={busy} onClick={() => setReload(value => value + 1)} className="text-sm underline">Reload account</button><button disabled={busy} onClick={onClose} className="text-sm underline">Close</button></div></section>
}
