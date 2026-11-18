import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Link2, LoaderCircle, Network, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { type DocumentSummary, listDocuments } from '../api/documents'
import {
  createRelationship, deleteRelationship, getRelationships,
  type RecordRelationship, type RelationshipType,
} from '../api/relationships'
import { runSmartSearch } from '../api/smartSearch'

const relationshipOptions: { value: RelationshipType; label: string; help: string }[] = [
  { value: 'same_site', label: 'Same site', help: 'Records belong to the same research site.' },
  { value: 'depicts', label: 'Depicts', help: 'This record visually depicts the related record.' },
  { value: 'supports', label: 'Supports', help: 'This record supplies evidence for the related record.' },
  { value: 'cites', label: 'Cites', help: 'This record cites or references the related record.' },
  { value: 'supersedes', label: 'Supersedes', help: 'This record replaces the related record.' },
  { value: 'related', label: 'Related', help: 'A general research connection.' },
]

const labels: Record<RelationshipType, [string, string]> = {
  same_site: ['Same site', 'Same site'],
  depicts: ['Depicts', 'Depicted by'],
  supports: ['Supports', 'Supported by'],
  cites: ['Cites', 'Cited by'],
  supersedes: ['Supersedes', 'Superseded by'],
  related: ['Related to', 'Related to'],
}

function relationshipLabel(item: RecordRelationship) {
  return labels[item.relationship_type][item.direction === 'outgoing' ? 0 : 1]
}

export function RecordRelationships({ id, csrf }: { id: number; csrf: string }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [relationships, setRelationships] = useState<RecordRelationship[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DocumentSummary[]>([])
  const [resultMode, setResultMode] = useState<'recent' | 'search'>('recent')
  const [hasSearched, setHasSearched] = useState(false)
  const [target, setTarget] = useState<DocumentSummary | null>(null)
  const [kind, setKind] = useState<RelationshipType>('same_site')
  const [note, setNote] = useState('')
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setRelationships(null)
    setError('')
    getRelationships(id, controller.signal).then(data => {
      if (!controller.signal.aborted) setRelationships(data.results)
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load record connections.')
    })
    return () => controller.abort()
  }, [id, attempt])

  useEffect(() => {
    if (!editing) return
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => searchRef.current?.focus(), 250)
  }, [editing])

  function available(items: DocumentSummary[]) {
    return items.filter(item => item.id !== id && !relationships?.some(link => link.document.id === item.id))
  }

  async function browseRecords() {
    setSearching(true)
    setError('')
    setHasSearched(false)
    setResultMode('recent')
    try {
      const page = await listDocuments(1)
      setResults(available(page.results))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to browse accessible records.')
    } finally {
      setSearching(false)
    }
  }

  function openEditor() {
    setEditing(true)
    setTarget(null)
    setQuery('')
    setResults([])
    setError('')
    setHasSearched(false)
    void browseRecords()
  }

  async function search() {
    const term = query.trim()
    if (term.length < 2 || searching) return
    setSearching(true)
    setError('')
    try {
      const page = await runSmartSearch(term, csrf)
      setResults(available(page.results))
      setResultMode('search')
      setHasSearched(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to search records.')
    } finally {
      setSearching(false)
    }
  }

  async function save() {
    if (!target || busy) return
    setBusy(true)
    setError('')
    try {
      const created = await createRelationship(id, target.id, kind, note, csrf)
      setRelationships(current => [created, ...(current || []).filter(item => item.id !== created.id)])
      setTarget(null)
      setQuery('')
      setResults([])
      setNote('')
      setKind('same_site')
      setEditing(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to link these records.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(relationshipId: number) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await deleteRelationship(id, relationshipId, csrf)
      setRelationships(current => current?.filter(item => item.id !== relationshipId) || [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove this connection.')
    } finally {
      setBusy(false)
    }
  }

  function closeEditor() {
    setEditing(false)
    setTarget(null)
    setQuery('')
    setResults([])
    setError('')
  }

  const selectedOption = relationshipOptions.find(option => option.value === kind)!
  return (
    <section id="record-connections" aria-labelledby="record-connections-title" className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="record-connections-title" className="flex items-center gap-2 font-semibold"><Network aria-hidden size={19} />Context graph</h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">Connect this record to the sites, evidence, images and publications that give it meaning.</p>
        </div>
        {!editing && <button type="button" aria-expanded={false} aria-controls="relationship-editor" onClick={openEditor} className="inline-flex items-center gap-2 rounded-lg bg-[#233b33] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#304e43]"><Plus aria-hidden size={16} />Link a record</button>}
      </div>

      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error} {relationships === null && <button type="button" onClick={() => setAttempt(value => value + 1)} className="font-semibold underline">Retry</button>}</p>}

      {editing && (
        <div ref={editorRef} id="relationship-editor" className="mt-6 scroll-mt-6 rounded-xl border-2 border-[#365d4d] bg-[#f6f8f6] p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Create a research connection</h3>
              <p className="mt-1 text-sm text-stone-500">Choose an available record or search by title, site, country, year, tag, or document type.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/app" className="hidden rounded-lg px-3 py-2 text-xs font-semibold text-[#365d4d] hover:bg-white sm:inline-flex">Browse library</Link>
              <Link to="/app/upload" className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold hover:border-[#365d4d]"><Upload aria-hidden size={15} />Upload new record</Link>
              <button type="button" aria-label="Close link editor" onClick={closeEditor} className="rounded-lg p-2 hover:bg-white"><X aria-hidden size={18} /></button>
            </div>
          </div>

          {!target ? (
            <>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Find a record</span>
                  <Search aria-hidden size={17} className="absolute left-3 top-3 text-stone-400" />
                  <input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void search()
                    }
                  }} placeholder="Example: excavation reports from Canada in 2025" className="w-full rounded-lg border border-stone-300 bg-white py-2.5 pl-10 pr-3 text-sm" />
                </label>
                <button type="button" onClick={search} disabled={query.trim().length < 2 || searching} className="rounded-lg bg-[#233b33] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{searching ? 'Searching…' : 'Search records'}</button>
              </div>

              {searching && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-stone-500"><LoaderCircle aria-hidden size={16} className="animate-spin" />Loading accessible records…</p>}

              {!searching && results.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{resultMode === 'recent' ? 'Available records' : `Results for “${query.trim()}”`}</p>
                    {resultMode === 'search' && <button type="button" onClick={browseRecords} className="text-xs font-semibold text-[#365d4d] hover:underline">Browse records</button>}
                  </div>
                  <ul className="max-h-72 divide-y divide-stone-200 overflow-y-auto rounded-lg border border-stone-200 bg-white">
                    {results.map(item => (
                      <li key={item.id}>
                        <button type="button" onClick={() => setTarget(item)} className="flex w-full items-center justify-between gap-4 p-3 text-left hover:bg-stone-50">
                          <span className="min-w-0"><strong className="block truncate text-sm">{item.label || `Record ${item.id}`}</strong><span className="mt-1 block text-xs text-stone-500">{item.document_type?.label || 'Unspecified type'} · Record #{item.id}</span></span>
                          <ArrowRight aria-hidden size={16} className="shrink-0" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!searching && hasSearched && results.length === 0 && (
                <div className="mt-4 rounded-lg border border-dashed border-stone-300 p-5 text-center">
                  <p className="text-sm font-semibold">No accessible records matched</p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">Try a shorter phrase, browse available records, or upload the record first.</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-3"><button type="button" onClick={browseRecords} className="text-xs font-semibold text-[#365d4d] underline">Browse records</button><Link to="/app/upload" className="text-xs font-semibold text-[#365d4d] underline">Upload a record</Link></div>
                </div>
              )}

              {!searching && !hasSearched && results.length === 0 && <p className="mt-4 rounded-lg bg-white p-4 text-sm text-stone-500">No other records are available on this page. Search the archive or upload a new record.</p>}
            </>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-[#cad8d1] bg-[#edf3ef] p-4"><span className="text-xs font-semibold tracking-wide text-[#365d4d] uppercase">Related record</span><p className="mt-1 font-semibold">{target.label || `Record ${target.id}`}</p><p className="mt-1 text-xs text-stone-600">{target.document_type?.label || 'Unspecified type'} · Record #{target.id}</p></div>
              <label className="block text-sm font-medium">Relationship<select value={kind} onChange={event => setKind(event.target.value as RelationshipType)} className="mt-2 w-full rounded-lg border border-stone-300 bg-white p-2.5">{relationshipOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="mt-1 block text-xs font-normal text-stone-500">{selectedOption.help}</span></label>
              <label className="block text-sm font-medium">Context note <span className="font-normal text-stone-400">(optional)</span><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={3} placeholder="Explain why these records belong together…" className="mt-2 w-full resize-y rounded-lg border border-stone-300 bg-white p-3 text-sm" /></label>
              <div className="flex flex-wrap gap-3"><button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#233b33] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle aria-hidden size={16} className="animate-spin" /> : <Link2 aria-hidden size={16} />}{busy ? 'Linking…' : 'Create connection'}</button><button type="button" onClick={() => setTarget(null)} disabled={busy} className="px-3 py-2.5 text-sm font-semibold">Choose another</button></div>
            </div>
          )}
        </div>
      )}

      {relationships === null && !error ? (
        <p role="status" className="mt-6 text-sm text-stone-500">Loading record connections…</p>
      ) : relationships?.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-stone-300 px-5 py-8 text-center"><Link2 aria-hidden size={28} className="mx-auto text-stone-400" /><p className="mt-3 text-sm font-semibold">No connected records yet</p><p className="mt-1 text-sm text-stone-500">Link the evidence that shares a site, subject or research conclusion.</p>{!editing && <button type="button" onClick={openEditor} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold hover:border-[#365d4d]"><Plus aria-hidden size={16} />Link the first record</button>}</div>
      ) : (
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {relationships?.map(item => (
            <li key={item.id} className="group rounded-xl border border-stone-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{relationshipLabel(item)}</span><Link to={`/app/documents/${item.document.id}`} className="mt-3 block break-words font-semibold text-[#233b33] hover:underline">{item.document.label || `Record ${item.document.id}`}</Link><p className="mt-1 text-xs text-stone-500">{item.document.document_type?.label || 'Unspecified type'} · Record #{item.document.id}</p></div>
                <button type="button" onClick={() => remove(item.id)} disabled={busy} aria-label={`Remove connection to ${item.document.label}`} className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"><Trash2 aria-hidden size={16} /></button>
              </div>
              {item.note && <p className="mt-3 border-t border-stone-100 pt-3 text-sm leading-6 text-stone-600">{item.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
