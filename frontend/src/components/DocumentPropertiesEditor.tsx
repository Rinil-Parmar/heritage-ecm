import { useState, type FormEvent } from 'react'
import { captureRequest } from '../api/uploads'
import type { DocumentDetail } from '../api/documents'

export function DocumentPropertiesEditor({ document, csrf, onSaved }: { document: DocumentDetail; csrf: string; onSaved: (value: DocumentDetail) => void }) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(document.label)
  const [description, setDescription] = useState(document.description)
  const [language, setLanguage] = useState(document.language)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const languages = [{ code: 'eng', label: 'English' }, { code: 'fra', label: 'French' }, { code: 'spa', label: 'Spanish' }, { code: 'deu', label: 'German' }, { code: 'ita', label: 'Italian' }, { code: 'por', label: 'Portuguese' }, { code: 'ara', label: 'Arabic' }, { code: 'hin', label: 'Hindi' }]
  const inputClass = 'mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-sm focus:outline-2 focus:outline-emerald-700'
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await captureRequest<DocumentDetail>(`records/${document.id}/properties`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ values: { label: label.trim(), description, language }, original: { label: document.label, description: document.description, language: document.language } }),
      })
      onSaved(result); setEditing(false); setSaved(true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Saving could not be confirmed. Reload the record before retrying.') }
    finally { setBusy(false) }
  }
  return <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-6">
    <div className="flex items-center justify-between gap-4"><h2 className="font-semibold">Document details</h2>{!editing && <button className="rounded-lg border border-stone-300 px-3 py-2 text-sm" onClick={() => { setLabel(document.label); setDescription(document.description); setLanguage(document.language); setError(''); setSaved(false); setEditing(true) }}>Edit details</button>}</div>
    {saved && <p role="status" className="mt-3 text-sm text-emerald-800">Document details saved.</p>}
    {editing && <form onSubmit={submit} className="mt-5"><fieldset disabled={busy} className="space-y-4"><legend className="sr-only">Edit document details</legend>
      <label className="block text-sm font-medium">Title<input required maxLength={255} value={label} onChange={event => setLabel(event.target.value)} className={inputClass} /></label>
      <label className="block text-sm font-medium">Description<textarea maxLength={10000} rows={4} value={description} onChange={event => setDescription(event.target.value)} className={inputClass} /></label>
      <label className="block text-sm font-medium">Document language<select required value={language} onChange={event => setLanguage(event.target.value)} className={inputClass}>{!languages.some(item => item.code === language) && <option value={language}>{language || 'Select a language'}</option>}{languages.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
      <div className="flex gap-3"><button disabled={!label.trim()} className="rounded-lg bg-[#233b33] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save details'}</button><button type="button" onClick={() => setEditing(false)} className="px-4 py-3 text-sm">Cancel</button></div>
    </fieldset>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}</form>}
  </section>
}
