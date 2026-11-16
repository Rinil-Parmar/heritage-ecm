import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, LockKeyhole, RefreshCw, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { getACLs, getAccessOptions, saveACL, type ACLRow, type AccessBundle, type AccessRole, type AccessScope } from '../api/accessControl'
import { listDocuments } from '../api/documents'
import { captureRequest, type OrganizationOption } from '../api/uploads'

interface ObjectOption { id: number; label: string }

export function AccessControlManager({ csrf }: { csrf: string }) {
  const [scope, setScope] = useState<AccessScope>('document')
  const [objects, setObjects] = useState<ObjectOption[]>([])
  const [objectId, setObjectId] = useState('')
  const [roles, setRoles] = useState<AccessRole[]>([])
  const [bundles, setBundles] = useState<AccessBundle[]>([])
  const [roleId, setRoleId] = useState('')
  const [bundle, setBundle] = useState('')
  const [acls, setAcls] = useState<ACLRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [optionsError, setOptionsError] = useState('')
  const [objectError, setObjectError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setOptionsError('')
    setLoading(true); setError(''); setObjectError(''); setNotice(''); setObjectId(''); setRoleId(''); setBundle(''); setAcls([]); setObjects([]); setRoles([]); setBundles([])
    const optionsRequest = getAccessOptions(scope, controller.signal)
    const objectsRequest = scope === 'document'
      ? listDocuments(1, {}, controller.signal).then(page => page.results.map(row => ({ id: row.id, label: row.label || `Document ${row.id}` })))
      : captureRequest<{ results: OrganizationOption[] }>('upload/cabinets', { signal: controller.signal }).then(data => data.results.map(row => ({ id: row.id, label: row.full_path || row.label })))
    Promise.allSettled([optionsRequest, objectsRequest]).then(([optionsResult, objectsResult]) => {
      if (controller.signal.aborted) return
      if (optionsResult.status === 'fulfilled') {
        if (!optionsResult.value.roles.length) setOptionsError('No managed roles were returned. Verify the role setup in Mayan and reload this page.')
        else { setRoles(optionsResult.value.roles); setBundles(optionsResult.value.bundles) }
      }
      else setOptionsError(optionsResult.reason instanceof Error ? `Roles and ACL permissions: ${optionsResult.reason.message}` : 'Roles and ACL permissions could not be loaded.')
      if (objectsResult.status === 'fulfilled') setObjects(objectsResult.value)
      else setObjectError(objectsResult.reason instanceof Error ? `${scope === 'document' ? 'Documents' : 'Cabinets'}: ${objectsResult.reason.message}` : `${scope === 'document' ? 'Documents' : 'Cabinets'} could not be loaded.`)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [scope, reload])

  useEffect(() => {
    if (!Number(objectId)) { setAcls([]); return }
    const controller = new AbortController()
    setLoading(true); setError(''); setNotice('')
    getACLs(scope, Number(objectId), controller.signal).then(data => { if (!controller.signal.aborted) setAcls(data.results) })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'ACLs could not be loaded.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [scope, objectId])

  const selectedACL = useMemo(() => acls.find(row => row.role.id === Number(roleId)), [acls, roleId])
  const selectedRole = roles.find(row => row.id === Number(roleId))
  const selectedBundle = bundles.find(row => row.key === bundle)

  async function apply() {
    if (!Number(objectId) || !Number(roleId) || !bundle || saving) return
    setSaving(true); setError(''); setNotice('')
    try {
      const updated = await saveACL(scope, Number(objectId), Number(roleId), bundle, selectedACL?.permissions.map(row => row.pk) || [], csrf)
      setAcls(current => [...current.filter(row => row.role.id !== updated.role.id), updated].sort((a, b) => a.role.label.localeCompare(b.role.label)))
      setNotice(`${selectedBundle?.label || 'Access'} was applied to ${updated.role.label} and verified against Mayan.`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Access could not be updated.') }
    finally { setSaving(false) }
  }

  return <div className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="mb-2 text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">Administration</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Access control</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">Apply role-based access bundles to a document or cabinet and verify the resulting Mayan ACL.</p></div><button onClick={() => setReload(value => value + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-stone-100 disabled:opacity-50"><RefreshCw aria-hidden size={16} className={loading ? 'animate-spin' : ''} />Reload</button></div>

    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold">How access reaches a user</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
        <div className="rounded-xl bg-stone-50 p-4"><span className="text-xs font-semibold text-stone-500">1. ACCOUNT</span><p className="mt-1 text-sm font-medium">Create or edit a user</p><p className="mt-1 text-xs text-stone-500">Choose the user’s research group.</p></div>
        <ArrowRight aria-hidden className="hidden text-stone-400 md:block" size={18} />
        <div className="rounded-xl bg-stone-50 p-4"><span className="text-xs font-semibold text-stone-500">2. AUDIENCE</span><p className="mt-1 text-sm font-medium">Group is linked to a role</p><p className="mt-1 text-xs text-stone-500">The role is the access recipient.</p></div>
        <ArrowRight aria-hidden className="hidden text-stone-400 md:block" size={18} />
        <div className="rounded-xl bg-stone-50 p-4"><span className="text-xs font-semibold text-stone-500">3. RECORD</span><p className="mt-1 text-sm font-medium">Grant a document bundle</p><p className="mt-1 text-xs text-stone-500">Every linked group member receives it.</p></div>
      </div>
      <p className="mt-4 text-sm text-stone-600">Need to onboard someone? <a href="/app/users" className="font-medium text-[#365d4d] underline underline-offset-4">Manage users and group membership</a>.</p>
    </section>
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><strong>Important:</strong> Access is not assigned directly to one user. A document grant applies to every user in the groups linked to the selected role. Cabinet access only controls the cabinet; grant document access separately.</div>
    {optionsError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{optionsError}</p>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {objectError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{objectError}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="grid gap-5 lg:grid-cols-4">
        <label className="text-sm font-medium">Scope<select value={scope} onChange={event => setScope(event.target.value as AccessScope)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3"><option value="document">Document</option><option value="cabinet">Cabinet</option></select></label>
        <label className="text-sm font-medium">{scope === 'document' ? 'Document' : 'Cabinet'}<select value={objectId} onChange={event => setObjectId(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3"><option value="">Choose {scope}</option>{objects.map(row => <option key={row.id} value={row.id}>{row.label} (#{row.id})</option>)}</select><span className="mt-1 block text-xs font-normal text-stone-500">{objects.length ? `${objects.length} accessible ${scope === 'document' ? 'documents' : 'cabinets'} loaded.` : loading ? 'Loading objects…' : `No accessible ${scope === 'document' ? 'documents' : 'cabinets'} returned.`}</span></label>
        <label className="text-sm font-medium">Role / audience<select value={roleId} onChange={event => { setRoleId(event.target.value); setBundle('') }} disabled={!objectId || !roles.length} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 disabled:opacity-50"><option value="">Choose audience</option>{roles.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select><span className="mt-1 block text-xs font-normal text-stone-500">Access goes to the role’s linked groups.</span></label>
        <label className="text-sm font-medium">Access bundle<select value={bundle} onChange={event => setBundle(event.target.value)} disabled={!roleId || !selectedRole?.mapping_ready} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 disabled:opacity-50"><option value="">Choose access</option>{bundles.map(row => <option key={row.key} value={row.key}>{row.label}</option>)}</select><span className="mt-1 block text-xs font-normal text-stone-500">{selectedBundle?.description || 'Choose the actions this audience may perform.'}</span></label>
      </div>
      {selectedRole && <div className={`mt-5 rounded-xl border p-4 ${selectedRole.mapping_ready ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
        <div className="flex items-start gap-3"><UsersRound aria-hidden size={18} className="mt-0.5 shrink-0" /><div><h3 className="text-sm font-semibold">Who will receive this access</h3>
          {selectedRole.mapping_error ? <p className="mt-1 text-sm text-red-800">{selectedRole.mapping_error}</p> : selectedRole.mapping_ready ? <><p className="mt-1 text-sm">Role <strong>{selectedRole.label}</strong> is linked to <strong>{selectedRole.expected_group}</strong>.</p><p className="mt-2 flex items-center gap-2 text-xs text-stone-600"><UserRound aria-hidden size={14} />{selectedRole.members.length ? `${selectedRole.members.length} active member${selectedRole.members.length === 1 ? '' : 's'}: ${selectedRole.members.join(', ')}` : 'No users are currently in this group. Add a user before granting access.'}</p></> : <p className="mt-1 text-sm text-red-800">This role is not linked to its expected group, <strong>{selectedRole.expected_group}</strong>. Fix the role–group association in Mayan before granting access.</p>}
        </div></div>
      </div>}
      {selectedBundle?.missing_labels.length ? <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-900">Unavailable permissions will be skipped: {selectedBundle.missing_labels.join(', ')}.</p> : null}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-stone-100 pt-5"><p className="text-xs text-stone-500">Existing custom permissions outside these bundles are preserved.</p><button onClick={apply} disabled={!objectId || !roleId || !bundle || saving} className="inline-flex items-center gap-2 rounded-xl bg-[#233b33] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><ShieldCheck aria-hidden size={16} />{saving ? 'Applying…' : 'Apply and verify'}</button></div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="border-b border-stone-200 px-6 py-5"><h2 className="flex items-center gap-2 font-semibold"><LockKeyhole aria-hidden size={18} className="text-[#365d4d]" />Current ACL</h2><p className="mt-1 text-xs text-stone-500">Permissions directly assigned to this object</p></div>{!objectId ? <p className="p-8 text-sm text-stone-500">Choose an object to inspect its ACL.</p> : loading ? <p className="p-8 text-sm text-stone-500">Loading access…</p> : !acls.length ? <p className="p-8 text-sm text-stone-500">No direct ACL entries are configured for this object.</p> : <div className="divide-y divide-stone-100">{acls.map(row => <article key={row.id} className="px-6 py-5"><h3 className="text-sm font-semibold">{row.role.label}</h3><div className="mt-3 flex flex-wrap gap-2">{row.permissions.length ? row.permissions.map(permission => <span key={permission.pk} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs text-stone-700">{permission.label}</span>) : <span className="text-xs text-stone-500">No permissions</span>}</div></article>)}</div>}</section>
  </div>
}
