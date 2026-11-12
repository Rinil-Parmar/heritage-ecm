import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArrowUpRight, Files, LogOut, Users } from 'lucide-react'
import { getSession, signOut, type Session } from '../api/auth'
import { ApiError } from '../api/client'
import { DocumentsPanel } from '../components/DocumentsPanel'
import { DocumentDetailPanel } from '../components/DocumentDetailPanel'
import { UploadPanel } from '../components/UploadPanel'
import { CabinetNavigation } from '../components/CabinetNavigation'
import { TagLibrary } from '../components/TagLibrary'
import { UserAdministration } from '../components/UserAdministration'
import { captureRequest } from '../api/uploads'

export function ApplicationPage() {
  const navigate = useNavigate()
  const { documentId } = useParams()
  const location = useLocation()
  const usersPage = location.pathname === '/app/users'
  const tagsPage = location.pathname === '/app/tags'
  const tagsActive = tagsPage || new URLSearchParams(location.search).has('tag')
  const documentsActive = !usersPage && !tagsActive && !new URLSearchParams(location.search).has('cabinet')
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [adminAllowed, setAdminAllowed] = useState(false)
  useEffect(() => {
    if (!session) { setAdminAllowed(false); return }
    const controller = new AbortController()
    captureRequest<{ allowed: boolean }>('admin/access', { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setAdminAllowed(result.allowed) }).catch(() => { if (!controller.signal.aborted) setAdminAllowed(false) })
    return () => controller.abort()
  }, [session, location.pathname])
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try { const width = Number(localStorage.getItem('ecm-sidebar-width')); return width >= 220 && width <= 480 ? width : 280 } catch { return 280 }
  })
  function resizeSidebar(width: number) {
    const value = Math.max(220, Math.min(480, width))
    setSidebarWidth(value)
    try { localStorage.setItem('ecm-sidebar-width', String(value)) } catch { /* Storage is optional. */ }
  }

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
    <div style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties} className="min-h-screen bg-[#f6f7f4] lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      <aside className="relative flex min-w-0 flex-col bg-[#233b33] px-6 py-6 text-white lg:sticky lg:top-0 lg:h-dvh lg:py-6">
        <div role="separator" aria-label="Resize sidebar" aria-orientation="vertical" aria-valuemin={220} aria-valuemax={480} aria-valuenow={sidebarWidth} tabIndex={0}
          onDoubleClick={() => resizeSidebar(280)}
          onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); resizeSidebar(sidebarWidth + (event.key === 'ArrowRight' ? 20 : -20)) } }}
          onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault() }}
          onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resizeSidebar(event.clientX - event.currentTarget.parentElement!.getBoundingClientRect().left) }}
          onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
          title="Drag to resize. Arrow keys adjust width; double-click resets."
          className="absolute inset-y-0 -right-1 z-20 hidden w-2 touch-none cursor-col-resize hover:bg-amber-200/60 focus:bg-amber-200/60 focus:outline-none lg:block" />
        <Link to="/" className="flex items-center gap-3 text-xl font-semibold"><Archive aria-hidden size={24} />ArcheoECM</Link>
        <p className="mt-2 pl-9 text-xs text-stone-300">Research &amp; heritage</p>
        <div className="sidebar-scroll mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 pb-3">
        <nav aria-label="Application navigation">
          <p className="mb-3 px-3 text-[0.65rem] font-semibold tracking-[0.2em] text-stone-400 uppercase">Library</p>
          <Link to="/app" aria-current={documentsActive ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${documentsActive ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5'}`}><Files aria-hidden size={18} />Documents</Link>
        </nav>
        <Link to="/app/tags" aria-current={tagsActive ? 'page' : undefined} className={`mt-2 block rounded-xl px-4 py-3 text-sm font-medium ${tagsActive ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5'}`}>Tags</Link>
        {adminAllowed && <nav aria-label="Administration" className="mt-5"><p className="mb-2 px-3 text-[0.65rem] font-semibold tracking-[0.2em] text-stone-400 uppercase">Administration</p><Link to="/app/users" aria-current={usersPage ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${usersPage ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5'}`}><Users aria-hidden size={18} />Manage users</Link></nav>}
        {session && <CabinetNavigation />}
        <div className="mt-6 border-t border-white/10 pt-5"><p className="font-serif text-xl text-amber-100 italic">Keep the context.</p><p className="mt-2 text-xs leading-6 text-stone-300">Preserve the connections that make your research meaningful.</p><Link to="/" className="mt-5 inline-flex items-center gap-2 text-xs text-stone-300 hover:text-white">About ArcheoECM<ArrowUpRight aria-hidden size={14} /></Link></div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 bg-white px-6 py-4 sm:px-10">
          <p className="text-sm text-stone-500">{usersPage ? 'Administration' : 'Library'} <span aria-hidden className="mx-2 text-stone-300">/</span><span className="font-medium text-stone-800">{usersPage ? 'Manage users' : tagsPage ? 'Tags' : location.pathname === '/app/upload' ? 'Upload document' : 'Documents'}</span></p>
          {session && <div className="flex items-center gap-4"><span className="max-w-40 truncate text-sm text-stone-600" title={session.username}>{session.username}</span><button onClick={logout} disabled={busy} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium hover:bg-stone-50 focus-visible:outline-2 disabled:opacity-60"><LogOut aria-hidden size={15} />{busy ? 'Signing out…' : 'Sign out'}</button></div>}
        </header>
      <main className="mx-auto max-w-7xl px-6 py-9 sm:px-10 sm:py-12">
        {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}{!session && <button onClick={() => setAttempt(attempt + 1)} className="ml-4 underline">Try again</button>}</div>}
        {!session && !error && <p role="status">Checking your session…</p>}
        {session && (tagsPage ? <TagLibrary /> : location.pathname === '/app/users' ? (adminAllowed ? <UserAdministration csrf={session.csrf_token} /> : <p>Account administration is unavailable for this account.</p>) : location.pathname === '/app/upload' ? <UploadPanel csrf={session.csrf_token} /> : documentId ? <DocumentDetailPanel key={documentId} id={Number(documentId)} csrf={session.csrf_token} /> : <DocumentsPanel />)}
      </main>
      </div>
    </div>
  )
}
