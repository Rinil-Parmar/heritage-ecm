import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArrowUpRight, Files, LogOut } from 'lucide-react'
import { getSession, signOut, type Session } from '../api/auth'
import { ApiError } from '../api/client'
import { DocumentsPanel } from '../components/DocumentsPanel'
import { DocumentDetailPanel } from '../components/DocumentDetailPanel'

export function ApplicationPage() {
  const navigate = useNavigate()
  const { documentId } = useParams()
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setError('')
    getSession().then(value => { if (active) setSession(value) }).catch(cause => {
      if (!active) return
      if (cause instanceof ApiError && cause.status === 401) navigate('/sign-in', { replace: true })
      else setError(cause instanceof Error ? cause.message : 'Unable to load your session.')
    })
    return () => { active = false }
  }, [navigate, attempt])

  async function logout() {
    if (!session || busy) return
    setBusy(true)
    setError('')
    try {
      await signOut(session.csrf_token)
      setSession(null)
      navigate('/sign-in', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign out. Try again.')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f4] lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex flex-col bg-[#233b33] px-6 py-6 text-white lg:sticky lg:top-0 lg:h-screen lg:py-9">
        <Link to="/" className="flex items-center gap-3 text-xl font-semibold"><Archive aria-hidden size={24} />ArcheoECM</Link>
        <p className="mt-2 pl-9 text-xs text-stone-300">Research &amp; heritage</p>
        <nav aria-label="Application navigation" className="mt-8 lg:mt-12">
          <p className="mb-3 px-3 text-[0.65rem] font-semibold tracking-[0.2em] text-stone-400 uppercase">Library</p>
          <Link to="/app" aria-current="page" className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium"><Files aria-hidden size={18} />Documents</Link>
        </nav>
        <div className="mt-auto hidden border-t border-white/10 pt-6 lg:block"><p className="font-serif text-xl text-amber-100 italic">Keep the context.</p><p className="mt-2 text-xs leading-6 text-stone-300">Preserve the connections that make your research meaningful.</p><Link to="/" className="mt-5 inline-flex items-center gap-2 text-xs text-stone-300 hover:text-white">About ArcheoECM<ArrowUpRight aria-hidden size={14} /></Link></div>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 bg-white px-6 py-4 sm:px-10">
          <p className="text-sm text-stone-500">Library <span aria-hidden className="mx-2 text-stone-300">/</span><span className="font-medium text-stone-800">Documents</span></p>
          {session && <div className="flex items-center gap-4"><span className="max-w-40 truncate text-sm text-stone-600" title={session.username}>{session.username}</span><button onClick={logout} disabled={busy} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium hover:bg-stone-50 focus-visible:outline-2 disabled:opacity-60"><LogOut aria-hidden size={15} />{busy ? 'Signing out…' : 'Sign out'}</button></div>}
        </header>
      <main className="mx-auto max-w-7xl px-6 py-9 sm:px-10 sm:py-12">
        {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}{!session && <button onClick={() => setAttempt(attempt + 1)} className="ml-4 underline">Try again</button>}</div>}
        {!session && !error && <p role="status">Checking your session…</p>}
        {session && (documentId ? <DocumentDetailPanel key={documentId} id={Number(documentId)} /> : <DocumentsPanel />)}
      </main>
      </div>
    </div>
  )
}
