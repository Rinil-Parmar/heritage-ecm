import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock3, LockKeyhole, RefreshCw, Search, ShieldCheck, Trash2, UserRound, UsersRound, X } from 'lucide-react'
import { getACLs, getAccessAudit, getAccessDirectory, getAccessOptions, getCabinetDocuments, saveACL, saveBulkDocumentACL, type ACLRow, type AccessAuditRow, type AccessBundle, type AccessRole, type AccessScope, type AccessVerification, type DirectoryPage } from '../api/accessControl'
import { listDocuments, type DocumentPage } from '../api/documents'
import { captureRequest, type OrganizationOption } from '../api/uploads'

interface ObjectOption { id: number; label: string }

export function AccessControlManager({ csrf }: { csrf: string }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [scope, setScope] = useState<AccessScope>(() => searchParams.get('scope') === 'cabinet' ? 'cabinet' : 'document')
  const [objects, setObjects] = useState<ObjectOption[]>([])
  const [documentPage, setDocumentPage] = useState<DocumentPage | null>(null)
  const [documentPageNumber, setDocumentPageNumber] = useState(1)
  const [documentQuery, setDocumentQuery] = useState('')
  const [documentSearch, setDocumentSearch] = useState('')
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>(() => searchParams.get('object') ? [Number(searchParams.get('object'))] : [])
  const [objectId, setObjectId] = useState(() => searchParams.get('object') || '')
  const [roles, setRoles] = useState<AccessRole[]>([])
  const [bundles, setBundles] = useState<AccessBundle[]>([])
  const [roleId, setRoleId] = useState(() => searchParams.get('audience') || '')
  const [bundle, setBundle] = useState('')
  const [acls, setAcls] = useState<ACLRow[]>([])
  const [audit, setAudit] = useState<AccessAuditRow[]>([])
  const [audienceQuery, setAudienceQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [optionsError, setOptionsError] = useState('')
  const [objectError, setObjectError] = useState('')
  const [notice, setNotice] = useState('')
  const [verification, setVerification] = useState<AccessVerification | null>(null)
  const [cabinetDocuments, setCabinetDocuments] = useState<ObjectOption[]>([])
  const [includeCabinetDocuments, setIncludeCabinetDocuments] = useState(false)
  const [containedBundle, setContainedBundle] = useState('read_only')
  const [overviewFilter, setOverviewFilter] = useState('')
  const [directory, setDirectory] = useState<DirectoryPage | null>(null)
  const [directoryUser, setDirectoryUser] = useState('')
  const [directoryRole, setDirectoryRole] = useState('')
  const [directoryDocument, setDirectoryDocument] = useState('')
  const [directoryLoading, setDirectoryLoading] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setOptionsError('')
    setLoading(true); setError(''); setObjectError(''); setNotice(''); setBundle(''); setAcls([]); setAudit([]); setObjects([]); setRoles([]); setBundles([])
    const optionsRequest = getAccessOptions(scope, controller.signal)
    const objectsRequest = scope === 'document'
      ? Promise.resolve([] as ObjectOption[])
      : captureRequest<{ results: OrganizationOption[] }>('upload/cabinets', { signal: controller.signal }).then(data => data.results.map(row => ({ id: row.id, label: row.full_path || row.label })))
    Promise.allSettled([optionsRequest, objectsRequest]).then(([optionsResult, objectsResult]) => {
      if (controller.signal.aborted) return
      if (optionsResult.status === 'fulfilled') {
        if (!optionsResult.value.roles.length) setOptionsError('No managed roles were returned. Verify the role setup in Mayan and reload this page.')
        else { setRoles(optionsResult.value.roles); setBundles(optionsResult.value.bundles) }
      }
      else setOptionsError(optionsResult.reason instanceof Error ? `Roles and ACL permissions: ${optionsResult.reason.message}` : 'Roles and ACL permissions could not be loaded.')
      if (objectsResult.status === 'fulfilled') {
        if (scope === 'cabinet') setObjects(objectsResult.value)
      } else setObjectError(objectsResult.reason instanceof Error ? `${scope === 'document' ? 'Documents' : 'Cabinets'}: ${objectsResult.reason.message}` : `${scope === 'document' ? 'Documents' : 'Cabinets'} could not be loaded.`)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [scope, reload])

  useEffect(() => {
    if (scope !== 'document') return
    const controller = new AbortController()
    setLoading(true); setObjectError('')
    listDocuments(documentPageNumber, { query: documentSearch || undefined }, controller.signal)
      .then(page => {
        if (controller.signal.aborted) return
        setDocumentPage(page)
        setObjects(page.results.map(row => ({ id: row.id, label: row.label || `Document ${row.id}` })))
      })
      .catch(cause => { if (!controller.signal.aborted) setObjectError(cause instanceof Error ? cause.message : 'Documents could not be loaded.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [scope, documentPageNumber, documentSearch, reload])

  useEffect(() => {
    if (scope !== 'cabinet' || !Number(objectId)) { setCabinetDocuments([]); return }
    const controller = new AbortController()
    getCabinetDocuments(Number(objectId), controller.signal)
      .then(result => { if (!controller.signal.aborted) setCabinetDocuments(result.results) })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Cabinet documents could not be inspected.') })
    return () => controller.abort()
  }, [scope, objectId, reload])

  useEffect(() => {
    if (!Number(objectId)) { setAcls([]); return }
    const controller = new AbortController()
    setLoading(true); setError(''); setNotice('')
    Promise.all([
      getACLs(scope, Number(objectId), controller.signal),
      getAccessAudit(scope, Number(objectId), controller.signal),
    ]).then(([access, history]) => { if (!controller.signal.aborted) { setAcls(access.results); setAudit(history.results) } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'ACLs could not be loaded.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [scope, objectId])

  const selectedACL = useMemo(() => acls.find(row => row.role.id === Number(roleId)), [acls, roleId])
  const selectedRole = roles.find(row => row.id === Number(roleId))
  const selectedObject = objects.find(row => row.id === Number(objectId))
  const selectedBundle = bundles.find(row => row.key === bundle)
  const audienceReady = Boolean(selectedRole?.mapping_ready && selectedRole.members.length)
  const audienceMatches = useMemo(() => {
    const query = audienceQuery.trim().toLowerCase()
    if (!query) return []
    return roles.map(role => ({
      role,
      matchedMembers: role.members.filter(member => member.toLowerCase().includes(query)),
      roleMatches: [role.label, role.expected_group].some(value => value.toLowerCase().includes(query)),
    })).filter(result => result.roleMatches || result.matchedMembers.length)
  }, [roles, audienceQuery])

  function chooseAudience(id: number) {
    setRoleId(String(id))
    setBundle('')
    setAudienceQuery('')
    const next = new URLSearchParams(searchParams)
    next.set('scope', scope)
    if (objectId) next.set('object', objectId)
    next.set('audience', String(id))
    setSearchParams(next, { replace: true })
  }

  function chooseScope(value: AccessScope) {
    setScope(value)
    setObjectId('')
    setSelectedDocuments([])
    setRoleId('')
    setBundle('')
    setSearchParams({ scope: value }, { replace: true })
  }

  function chooseObject(value: string) {
    setObjectId(value)
    if (scope === 'document') setSelectedDocuments(value ? [Number(value)] : [])
    const next = new URLSearchParams(searchParams)
    next.set('scope', scope)
    if (value) next.set('object', value); else next.delete('object')
    if (roleId) next.set('audience', roleId)
    setSearchParams(next, { replace: true })
  }

  function toggleDocument(id: number) {
    const next = selectedDocuments.includes(id)
      ? selectedDocuments.filter(value => value !== id)
      : [...selectedDocuments, id].slice(0, 50)
    setSelectedDocuments(next)
    chooseObject(next.length === 1 ? String(next[0]) : '')
    if (next.length !== 1) setSelectedDocuments(next)
  }

  function chooseRole(value: string) {
    setRoleId(value)
    setBundle('')
    const next = new URLSearchParams(searchParams)
    next.set('scope', scope)
    if (objectId) next.set('object', objectId)
    if (value) next.set('audience', value); else next.delete('audience')
    setSearchParams(next, { replace: true })
  }

  function accessSummary(row: ACLRow) {
    const current = new Set(row.permissions.map(permission => permission.pk))
    const matches = bundles
      .filter(option => option.key !== 'none' && option.permission_pks.length && option.permission_pks.every(permission => current.has(permission)))
      .sort((left, right) => right.permission_pks.length - left.permission_pks.length)
    return matches[0]?.label || (row.permissions.length ? 'Custom access' : 'No access')
  }

  const filteredAcls = useMemo(() => {
    const query = overviewFilter.trim().toLowerCase()
    if (!query) return acls
    return acls.filter(row => {
      const audience = roles.find(role => role.id === row.role.id)
      const permissionPks = new Set(row.permissions.map(permission => permission.pk))
      const summary = bundles.filter(option => option.key !== 'none' && option.permission_pks.length && option.permission_pks.every(pk => permissionPks.has(pk))).sort((a, b) => b.permission_pks.length - a.permission_pks.length)[0]?.label || 'Custom access'
      return [row.role.label, summary, ...(audience?.members || []), ...row.permissions.map(permission => permission.label)]
        .some(value => value.toLowerCase().includes(query))
    })
  }, [acls, overviewFilter, roles, bundles])
  const directorySummary = useMemo(() => {
    if (!directory) return []
    const groups = new Map<string, { user: string; role: string; access: string; documents: Set<number> }>()
    for (const row of directory.results) for (const user of row.members) {
      const key = `${user}\u0000${row.role_label}\u0000${row.access.label}`
      const entry = groups.get(key) || { user, role: row.role_label, access: row.access.label, documents: new Set<number>() }
      entry.documents.add(row.document_id); groups.set(key, entry)
    }
    return [...groups.values()].sort((a, b) => a.user.localeCompare(b.user))
  }, [directory])

  async function apply() {
    const targetIds = scope === 'document' ? selectedDocuments : [Number(objectId)]
    if (!targetIds.length || !Number(roleId) || !bundle || saving) return
    setSaving(true); setError(''); setNotice('')
    try {
      if (scope === 'document' && targetIds.length > 1) {
        const result = await saveBulkDocumentACL(targetIds, Number(roleId), bundle, csrf)
        setNotice(`${result.applied} of ${result.requested} documents were updated and verified.${result.failed ? ` ${result.failed} need attention.` : ''}`)
        const checked = result.results[0]?.acl.verification
        if (checked) setVerification({ ...checked, verified_at: result.verified_at })
      } else {
        const updated = await saveACL(scope, targetIds[0], Number(roleId), bundle, selectedACL?.permissions.map(row => row.pk) || [], csrf)
        setAcls(current => [...current.filter(row => row.role.id !== updated.role.id), updated].sort((a, b) => a.role.label.localeCompare(b.role.label)))
        setVerification(updated.verification || null)
        const history = await getAccessAudit(scope, targetIds[0]); setAudit(history.results)
        setNotice(`${selectedBundle?.label || 'Access'} was applied to ${updated.role.label} and verified against Mayan.`)
      }
      if (scope === 'cabinet' && includeCabinetDocuments && cabinetDocuments.length) {
        const result = await saveBulkDocumentACL(cabinetDocuments.map(row => row.id), Number(roleId), containedBundle, csrf)
        setNotice(`Folder access and ${result.applied} of ${result.requested} current documents were updated and verified.${result.failed ? ` ${result.failed} need attention.` : ''}`)
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Access could not be updated.') }
    finally { setSaving(false) }
  }

  async function removeAccess(row: ACLRow) {
    if (!Number(objectId) || saving) return
    setSaving(true); setError(''); setNotice(''); setVerification(null)
    try {
      const updated = await saveACL(scope, Number(objectId), row.role.id, 'none', row.permissions.map(item => item.pk), csrf)
      setAcls(current => current.filter(item => item.role.id !== row.role.id))
      setVerification(updated.verification || null)
      setNotice(`Managed access was removed from ${row.role.label} and verified against Mayan.`)
      const history = await getAccessAudit(scope, Number(objectId)); setAudit(history.results)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Access could not be removed.') }
    finally { setSaving(false) }
  }

  async function loadDirectory(page = 1) {
    setDirectoryLoading(true); setError('')
    try {
      setDirectory(await getAccessDirectory(page, {
        username: directoryUser.trim() || undefined,
        query: directoryDocument.trim() || undefined,
        roleId: Number(directoryRole) || undefined,
      }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Access directory could not be loaded.') }
    finally { setDirectoryLoading(false) }
  }

  return <div className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="mb-2 text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">Administration</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Share records</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">Choose what to share, who should receive it, and what they are allowed to do.</p></div><button onClick={() => setReload(value => value + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-stone-100 disabled:opacity-50"><RefreshCw aria-hidden size={16} className={loading ? 'animate-spin' : ''} />Reload</button></div>

    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold">How sharing works</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
        <div className="rounded-xl bg-stone-50 p-4"><span className="text-xs font-semibold text-stone-500">1. PERSON</span><p className="mt-1 text-sm font-medium">Assign a role</p><p className="mt-1 text-xs text-stone-500">Manage the person from the Users page.</p></div>
        <ArrowRight aria-hidden className="hidden text-stone-400 md:block" size={18} />
        <div className="rounded-xl bg-stone-50 p-4"><span className="text-xs font-semibold text-stone-500">2. AUDIENCE</span><p className="mt-1 text-sm font-medium">Choose that role</p><p className="mt-1 text-xs text-stone-500">Everyone with the role receives the same access.</p></div>
        <ArrowRight aria-hidden className="hidden text-stone-400 md:block" size={18} />
        <div className="rounded-xl bg-stone-50 p-4"><span className="text-xs font-semibold text-stone-500">3. ACCESS</span><p className="mt-1 text-sm font-medium">Choose what they can do</p><p className="mt-1 text-xs text-stone-500">View, edit, review, or remove access.</p></div>
      </div>
      <p className="mt-4 text-sm text-stone-600">Need to onboard someone? <a href="/app/users" className="font-medium text-[#365d4d] underline underline-offset-4">Manage users and group membership</a>.</p>
    </section>
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><strong>Cabinets and documents are protected separately.</strong> Sharing a cabinet only makes that folder visible; it does not unlock the documents inside. To open a record, share that document with the same role. This prevents one folder choice from accidentally exposing every document.</div>
    {optionsError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{optionsError}</p>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {objectError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{objectError}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="grid gap-5 lg:grid-cols-4">
        <label className="text-sm font-medium">What are you sharing?<select value={scope} onChange={event => chooseScope(event.target.value as AccessScope)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3"><option value="document">One or more documents</option><option value="cabinet">Cabinet / folder</option></select></label>
        {scope === 'document' ? <div className="lg:col-span-1"><form onSubmit={event => { event.preventDefault(); setDocumentPageNumber(1); setDocumentSearch(documentQuery.trim()) }}><label className="text-sm font-medium">Search all documents<div className="relative mt-2"><Search size={16} className="absolute top-3.5 left-3 text-stone-400" /><input value={documentQuery} onChange={event => setDocumentQuery(event.target.value)} placeholder="Title, metadata, or OCR text…" className="w-full rounded-xl border border-stone-300 py-3 pr-10 pl-9 text-sm" />{documentQuery && <button type="button" onClick={() => { setDocumentQuery(''); setDocumentSearch(''); setDocumentPageNumber(1) }} className="absolute top-2 right-2 rounded-lg p-2 text-stone-400" aria-label="Clear document search"><X size={15} /></button>}</div></label></form><div className="mt-2 max-h-52 overflow-auto rounded-xl border border-stone-200">{objects.map(row => <label key={row.id} className="flex cursor-pointer items-center gap-2 border-b border-stone-100 px-3 py-2.5 text-sm last:border-0 hover:bg-stone-50"><input type="checkbox" checked={selectedDocuments.includes(row.id)} onChange={() => toggleDocument(row.id)} /><span className="min-w-0 flex-1 truncate">{row.label} (#{row.id})</span></label>)}{!objects.length && <p className="p-3 text-xs text-stone-500">No matching documents.</p>}</div><div className="mt-2 flex items-center justify-between"><span className="text-xs text-stone-500">{selectedDocuments.length} selected</span><div className="flex items-center gap-1"><button type="button" disabled={!documentPage?.previous_page} onClick={() => setDocumentPageNumber(documentPage?.previous_page || 1)} className="rounded border p-1.5 disabled:opacity-40"><ChevronLeft size={14} /></button><span className="px-2 text-xs">Page {documentPageNumber}</span><button type="button" disabled={!documentPage?.next_page} onClick={() => setDocumentPageNumber(documentPage?.next_page || documentPageNumber)} className="rounded border p-1.5 disabled:opacity-40"><ChevronRight size={14} /></button></div></div></div> : <label className="text-sm font-medium">Cabinet<select value={objectId} onChange={event => chooseObject(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3"><option value="">Choose cabinet</option>{objects.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select><span className="mt-1 block text-xs font-normal text-stone-500">{objects.length} accessible cabinets loaded.</span></label>}
        <div>
          <label className="text-sm font-medium" htmlFor="audience-search">Find a user or role</label>
          <div className="relative mt-2"><Search aria-hidden size={16} className="absolute left-3 top-3.5 text-stone-400" /><input id="audience-search" value={audienceQuery} onChange={event => setAudienceQuery(event.target.value)} placeholder="Type a username or role…" autoComplete="off" className="w-full rounded-xl border border-stone-300 bg-white py-3 pr-10 pl-9 text-sm" />{audienceQuery && <button type="button" onClick={() => setAudienceQuery('')} aria-label="Clear user search" className="absolute top-2 right-2 rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"><X aria-hidden size={15} /></button>}</div>
          <p className="mt-1 text-xs text-stone-500">Search a username to find the role that will receive access.</p>
          {audienceQuery.trim() && <div className="mt-2 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm" aria-live="polite">
            {audienceMatches.length ? audienceMatches.map(({ role, matchedMembers }) => <button type="button" key={role.id} onClick={() => chooseAudience(role.id)} className={`flex w-full items-start justify-between gap-3 border-b border-stone-100 px-3 py-3 text-left last:border-0 hover:bg-stone-50 ${role.id === Number(roleId) ? 'bg-emerald-50' : ''}`}>
              <span className="min-w-0"><span className="block text-sm font-semibold">{role.label}</span><span className="mt-1 block truncate text-xs text-stone-500">{matchedMembers.length ? `User: ${matchedMembers.join(', ')}` : `Group: ${role.expected_group}`} · {role.members.length} member{role.members.length === 1 ? '' : 's'}</span></span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#365d4d]">{role.id === Number(roleId) ? <><Check aria-hidden size={14} />Selected</> : 'Select'}</span>
            </button>) : <div className="px-3 py-4"><p className="text-sm font-medium">No user or role found</p><p className="mt-1 text-xs leading-5 text-stone-500">Check the username, or assign the user to a research group from <a href="/app/users" className="font-semibold text-[#365d4d] underline">Manage users</a>.</p></div>}
          </div>}
          <label className="mt-3 block text-sm font-medium">Or choose a role<select value={roleId} onChange={event => chooseRole(event.target.value)} disabled={!roles.length} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 disabled:opacity-50"><option value="">Choose role</option>{roles.map(row => <option key={row.id} value={row.id}>{row.label} · {row.members.length} member{row.members.length === 1 ? '' : 's'}</option>)}</select></label>
          <span className="mt-1 block text-xs font-normal text-stone-500">Access is assigned to the role and shared by its active members.</span>
        </div>
        <label className="text-sm font-medium">What can they do?<select value={bundle} onChange={event => setBundle(event.target.value)} disabled={!roleId || !audienceReady} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 disabled:opacity-50"><option value="">Choose permission</option>{bundles.filter(row => row.key !== 'none').map(row => <option key={row.key} value={row.key}>{row.label}</option>)}</select><span className="mt-1 block text-xs font-normal text-stone-500">{selectedBundle?.description || (selectedRole?.mapping_ready && !selectedRole.members.length ? 'Assign at least one user to this role before sharing.' : 'Choose the permitted actions.')}</span></label>
      </div>
      {scope === 'cabinet' && objectId && <section className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-4"><h3 className="text-sm font-semibold">Should document access be included?</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="flex cursor-pointer gap-3 rounded-xl border bg-white p-4"><input type="radio" checked={!includeCabinetDocuments} onChange={() => setIncludeCabinetDocuments(false)} /><span><strong className="block text-sm">Share folder only</strong><span className="mt-1 block text-xs text-stone-500">The cabinet is visible; documents remain protected.</span></span></label><label className="flex cursor-pointer gap-3 rounded-xl border bg-white p-4"><input type="radio" checked={includeCabinetDocuments} onChange={() => setIncludeCabinetDocuments(true)} /><span><strong className="block text-sm">Share folder and current documents</strong><span className="mt-1 block text-xs text-stone-500">Also updates {cabinetDocuments.length} documents currently inside.</span></span></label></div>{includeCabinetDocuments && <div className="mt-4"><label className="text-sm font-medium">Document permission<select value={containedBundle} onChange={event => setContainedBundle(event.target.value)} className="ml-3 rounded-lg border border-stone-300 bg-white px-3 py-2"><option value="read_only">Viewer</option><option value="contributor">Contributor</option><option value="reviewer">Reviewer</option><option value="edit_and_review">Manager</option></select></label><details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-[#365d4d]">Preview affected documents</summary><ul className="mt-2 max-h-44 overflow-auto rounded-lg border bg-white p-3">{cabinetDocuments.map(row => <li key={row.id} className="py-1 text-xs text-stone-600">{row.label} (#{row.id})</li>)}</ul></details></div>}</section>}
      {selectedRole && <div className={`mt-5 rounded-xl border p-4 ${!selectedRole.mapping_ready ? 'border-red-200 bg-red-50' : selectedRole.members.length ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-start gap-3"><UsersRound aria-hidden size={18} className="mt-0.5 shrink-0" /><div><h3 className="text-sm font-semibold">Who will receive this access</h3>
          {selectedRole.mapping_error ? <p className="mt-1 text-sm text-red-800">{selectedRole.mapping_error}</p> : selectedRole.mapping_ready ? <><p className="mt-1 text-sm">Role <strong>{selectedRole.label}</strong> is linked to <strong>{selectedRole.expected_group}</strong>.</p>{selectedRole.members.length ? <p className="mt-2 flex items-center gap-2 text-xs text-stone-600"><UserRound aria-hidden size={14} />{`${selectedRole.members.length} active member${selectedRole.members.length === 1 ? '' : 's'}: ${selectedRole.members.join(', ')}`}</p> : <p className="mt-2 text-sm text-amber-950"><strong>No users will receive this access.</strong> Open <a href="/app/users" className="font-semibold underline underline-offset-4">Manage users</a>, edit the intended account, and add it to <strong>{selectedRole.expected_group}</strong>.</p>}</> : <p className="mt-1 text-sm text-red-800">This role is not linked to its expected group, <strong>{selectedRole.expected_group}</strong>. Fix the role–group association in Mayan before granting access.</p>}
        </div></div>
      </div>}
      {selectedBundle?.missing_labels.length ? <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-900">Unavailable permissions will be skipped: {selectedBundle.missing_labels.join(', ')}.</p> : null}
      {selectedBundle && <section className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-4" aria-label="Permission preview"><h3 className="text-sm font-semibold">Permission preview</h3><p className="mt-1 text-xs leading-5 text-stone-600">Saving <strong>{selectedBundle.label}</strong> will manage these actions for {selectedRole?.label || 'the selected audience'}:</p>{selectedBundle.permission_labels.length ? <ul className="mt-3 flex flex-wrap gap-2">{selectedBundle.permission_labels.map(label => <li key={label} className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700">{label}</li>)}</ul> : <p className="mt-3 text-xs font-medium text-red-700">All ArcheoVault-managed access will be removed. Unrelated custom permissions remain unchanged.</p>}</section>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-stone-100 pt-5"><p className="text-xs text-stone-500">Custom permissions outside these choices are preserved.</p><button onClick={apply} disabled={!(scope === 'document' ? selectedDocuments.length : objectId) || !roleId || !bundle || !audienceReady || saving} className="inline-flex items-center gap-2 rounded-xl bg-[#233b33] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><ShieldCheck aria-hidden size={16} />{saving ? 'Saving and verifying…' : 'Save and verify access'}</button></div>
    </section>

    {verification && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><h2 className="flex items-center gap-2 font-semibold text-emerald-950"><Check size={18} />Access verified</h2><div className="mt-4 grid gap-4 text-sm sm:grid-cols-3"><div><span className="text-xs text-emerald-800">USERS</span><p className="mt-1 font-medium">{verification.users.join(', ') || 'No active group members'}</p></div><div><span className="text-xs text-emerald-800">PERMISSIONS</span><p className="mt-1 font-medium">{verification.permissions_applied.length} confirmed</p></div><div><span className="text-xs text-emerald-800">VERIFIED</span><p className="mt-1 font-medium">{new Date(verification.verified_at).toLocaleString()}</p></div></div>{verification.missing_permissions.length > 0 && <p className="mt-4 text-sm text-amber-900">Unavailable Mayan permissions: {verification.missing_permissions.join(', ')}</p>}</section>}

    {directorySummary.length > 0 && <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5"><h2 className="text-sm font-semibold">Access summary {directory?.complete ? '— complete user report' : '— current document page'}</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{directorySummary.map(row => <div key={`${row.user}-${row.role}-${row.access}`} className="rounded-xl border border-stone-200 bg-white p-4"><p className="text-sm font-semibold">{row.user} → {row.role}</p><p className="mt-1 text-xs text-stone-600">{row.documents.size} document{row.documents.size === 1 ? '' : 's'} → {row.access}</p></div>)}</div></section>}

    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">User access directory</h2><p className="mt-1 text-xs text-stone-500">User → role → document → access, verified from live Mayan ACLs.</p></div><button onClick={() => loadDirectory(1)} disabled={directoryLoading} className="rounded-xl bg-[#233b33] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{directoryLoading ? 'Checking…' : 'Run report'}</button></div><div className="mt-5 grid gap-3 md:grid-cols-3"><input value={directoryUser} onChange={event => setDirectoryUser(event.target.value)} placeholder="Username" className="rounded-xl border border-stone-300 px-3 py-3 text-sm" /><input value={directoryDocument} onChange={event => setDirectoryDocument(event.target.value)} placeholder="Document search" className="rounded-xl border border-stone-300 px-3 py-3 text-sm" /><select value={directoryRole} onChange={event => setDirectoryRole(event.target.value)} className="rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm"><option value="">All roles</option>{roles.map(role => <option key={role.id} value={role.id}>{role.label}</option>)}</select></div>{directory && <div className="mt-5"><p className="mb-3 text-xs text-stone-500">Page {directory.page} · {directory.count} documents total</p>{directory.results.length ? <div className="overflow-x-auto rounded-xl border"><table className="min-w-full text-left text-sm"><thead className="bg-stone-50 text-xs text-stone-500"><tr><th className="px-4 py-3">User(s)</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Document</th><th className="px-4 py-3">Access</th></tr></thead><tbody className="divide-y">{directory.results.map((row, index) => <tr key={`${row.document_id}-${row.role_id}-${index}`}><td className="px-4 py-3">{row.members.join(', ') || 'No members'}</td><td className="px-4 py-3">{row.role_label}</td><td className="px-4 py-3"><a href={`/app/documents/${row.document_id}`} className="font-medium text-[#365d4d] underline">{row.document_label}</a></td><td className="px-4 py-3">{row.access.label}</td></tr>)}</tbody></table></div> : <p className="rounded-xl bg-stone-50 p-5 text-sm text-stone-500">No matching entries on this page.</p>}<div className="mt-3 flex justify-end gap-2"><button disabled={!directory.previous_page || directoryLoading} onClick={() => loadDirectory(directory.previous_page || 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronLeft size={16} /></button><button disabled={!directory.next_page || directoryLoading} onClick={() => loadDirectory(directory.next_page || directory.page)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>}</section>

    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="border-b border-stone-200 px-6 py-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><LockKeyhole aria-hidden size={18} className="text-[#365d4d]" />Who currently has access?</h2><p className="mt-1 text-xs text-stone-500">Live Mayan access for the selected {scope}</p></div>{objectId && <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700">{selectedObject?.label || `${scope} #${objectId}`}</span>}</div><div className="relative mt-4 max-w-lg"><Search size={15} className="absolute top-3 left-3 text-stone-400" /><input value={overviewFilter} onChange={event => setOverviewFilter(event.target.value)} placeholder="Filter by user, role, access, or permission…" className="w-full rounded-xl border border-stone-300 py-2.5 pr-9 pl-9 text-sm" />{overviewFilter && <button onClick={() => setOverviewFilter('')} className="absolute top-1.5 right-2 p-2 text-stone-400"><X size={14} /></button>}</div></div>{!objectId ? <p className="p-8 text-sm text-stone-500">Select one document or cabinet to inspect its current access.</p> : loading ? <p className="p-8 text-sm text-stone-500">Loading current access…</p> : !filteredAcls.length ? <p className="p-8 text-sm text-stone-500">No matching direct role access.</p> : <div className="divide-y divide-stone-100">{filteredAcls.map(row => { const audience = roles.find(role => role.id === row.role.id); return <article key={row.id} className="px-6 py-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{row.role.label}</h3><p className="mt-1 text-xs text-stone-500">Group: {audience?.expected_group || 'Linked Mayan group'}</p>{audience?.members.length ? <div className="mt-3 flex flex-wrap gap-2">{audience.members.map(member => <span key={member} className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-700"><UserRound aria-hidden size={12} />{member}</span>)}</div> : <p className="mt-2 text-xs font-medium text-amber-800">No active users currently belong to this role.</p>}</div><div className="flex items-center gap-2"><span className="rounded-full bg-[#eaf1ed] px-3 py-1.5 text-xs font-semibold text-[#294b3e]">{accessSummary(row)}</span><button onClick={() => removeAccess(row)} disabled={saving} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={13} />Remove access</button></div></div>{row.permissions.length ? <details className="mt-4"><summary className="cursor-pointer text-xs font-medium text-stone-500 hover:text-stone-800">View technical permission details</summary><div className="mt-3 flex flex-wrap gap-2">{row.permissions.map(permission => <span key={permission.pk} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs text-stone-700">{permission.label}</span>)}</div></details> : <p className="mt-2 text-xs text-stone-500">No permissions</p>}</article> })}</div>}</section>
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 px-6 py-5"><div><h2 className="flex items-center gap-2 font-semibold"><Clock3 aria-hidden size={18} className="text-[#365d4d]" />Access history</h2><p className="mt-1 text-xs text-stone-500">Persistent audit history for changes made through ArcheoVault</p></div>{objectId && <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700">{selectedObject?.label || `${scope} #${objectId}`}</span>}</div>{!objectId ? <p className="p-8 text-sm text-stone-500">Choose a {scope} to view its access history.</p> : !audit.length ? <p className="p-8 text-sm text-stone-500">No ArcheoVault access changes have been recorded for this {scope}.</p> : <ol className="divide-y divide-stone-100">{audit.map(row => <li key={row.id} className="px-6 py-4"><p className="text-sm"><strong>{row.actor}</strong> applied <strong>{bundles.find(item => item.key === row.bundle)?.label || row.bundle}</strong> to {row.role_label}.</p><p className="mt-1 text-xs text-stone-500">{new Date(row.created_at).toLocaleString()} · {row.permission_count} effective permission{row.permission_count === 1 ? '' : 's'}</p></li>)}</ol>}</section>
  </div>
}
