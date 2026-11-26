import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Archive, FileCheck2, Files, KeyRound, LayoutDashboard, LogOut, Sparkles, Users } from 'lucide-react'
import { getSession, signOut, type Session } from '../api/auth'
import { ApiError } from '../api/client'
import { DocumentsPanel } from '../components/DocumentsPanel'
import { CabinetNavigation } from '../components/CabinetNavigation'
import { captureRequest } from '../api/uploads'
import { OperationsDashboard } from '../components/OperationsDashboard'
import { NotificationMenu } from '../components/NotificationMenu'
import { getAccessManagerStatus } from '../api/accessControl'

const DocumentDetailPanel = lazy(() => import('../components/DocumentDetailPanel').then(module => ({ default: module.DocumentDetailPanel })))
const UploadPanel = lazy(() => import('../components/UploadPanel').then(module => ({ default: module.UploadPanel })))
const TagLibrary = lazy(() => import('../components/TagLibrary').then(module => ({ default: module.TagLibrary })))
const UserAdministration = lazy(() => import('../components/UserAdministration').then(module => ({ default: module.UserAdministration })))
const ReviewQueue = lazy(() => import('../components/ReviewQueue').then(module => ({ default: module.ReviewQueue })))
const SmartSearch = lazy(() => import('../components/SmartSearch').then(module => ({ default: module.SmartSearch })))
const AccessControlManager = lazy(() => import('../components/AccessControlManager').then(module => ({ default: module.AccessControlManager })))

function WorkspaceLoading() {
  return <div role="status" className="space-y-5"><div className="h-5 w-28 animate-pulse rounded bg-stone-200" /><div className="h-11 w-2/3 animate-pulse rounded bg-stone-200" /><div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map(value => <div key={value} className="h-36 animate-pulse rounded-2xl bg-white" />)}</div><span className="sr-only">Loading workspace…</span></div>
}

export function ApplicationPage() {
  const navigate = useNavigate()
  const { documentId } = useParams()
  const location = useLocation()
  const usersPage = location.pathname === '/app/users'
  const accessPage = location.pathname === '/app/access'
  const tagsPage = location.pathname === '/app/tags'
  const reviewsPage = location.pathname === '/app/reviews'
  const smartSearchPage = location.pathname === '/app/smart-search'
  const dashboardPage = location.pathname === '/app/dashboard'
  const tagsActive = tagsPage || new URLSearchParams(location.search).has('tag')
  const documentsActive = !dashboardPage && !usersPage && !accessPage && !reviewsPage && !smartSearchPage && !tagsActive && !new URLSearchParams(location.search).has('cabinet')
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [adminAllowed, setAdminAllowed] = useState(false)
  const [accessAllowed, setAccessAllowed] = useState(false)
  const [accessChecked, setAccessChecked] = useState(false)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname])
  useEffect(() => {
    if (!session) { setAdminAllowed(false); return }
    const controller = new AbortController()
    captureRequest<{ allowed: boolean }>('admin/access', { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setAdminAllowed(result.allowed) }).catch(() => { if (!controller.signal.aborted) setAdminAllowed(false) })
    return () => controller.abort()
  }, [session, location.pathname])
  useEffect(() => {
    if (!session) { setAccessAllowed(false); setAccessChecked(false); return }
    const controller = new AbortController()
    getAccessManagerStatus(controller.signal).then(result => { if (!controller.signal.aborted) setAccessAllowed(result.allowed) }).catch(() => { if (!controller.signal.aborted) setAccessAllowed(false) }).finally(() => { if (!controller.signal.aborted) setAccessChecked(true) })
    return () => controller.abort()
  }, [session])
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

  useEffect(() => {
    const expired = () => navigate('/sign-in', { replace: true })
    window.addEventListener('archeovault:unauthorized', expired)
    return () => window.removeEventListener('archeovault:unauthorized', expired)
  }, [navigate])

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
    <div style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties} className="theme-surface min-h-screen bg-[#f6f7f4] lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      <aside className="relative flex min-w-0 flex-col bg-[#233b33] px-6 py-6 text-white lg:sticky lg:top-0 lg:h-dvh lg:py-6">
        <div role="separator" aria-label="Resize sidebar" aria-orientation="vertical" aria-valuemin={220} aria-valuemax={480} aria-valuenow={sidebarWidth} tabIndex={0}
          onDoubleClick={() => resizeSidebar(280)}
          onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); resizeSidebar(sidebarWidth + (event.key === 'ArrowRight' ? 20 : -20)) } }}
          onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault() }}
          onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resizeSidebar(event.clientX - event.currentTarget.parentElement!.getBoundingClientRect().left) }}
          onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
          title="Drag to resize. Arrow keys adjust width; double-click resets."
          className="absolute inset-y-0 -right-1 z-20 hidden w-2 touch-none cursor-col-resize hover:bg-amber-200/60 focus:bg-amber-200/60 focus:outline-none lg:block" />
        <Link to="/app/dashboard" aria-label="ArcheoVault workspace home" className="flex items-center gap-3 text-xl font-semibold"><Archive aria-hidden size={24} />ArcheoVault</Link>
        <p className="mt-2 pl-9 text-xs text-stone-300">Research &amp; heritage</p>
        <div className="sidebar-scroll mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 pb-3">
        <nav aria-label="Application navigation">
          <Link to="/app/dashboard" aria-current={dashboardPage ? 'page' : undefined} className={`mb-5 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${dashboardPage ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5'}`}><LayoutDashboard aria-hidden size={18} />My work</Link>
          <p className="mb-3 px-3 text-[0.65rem] font-semibold tracking-[0.2em] text-stone-400 uppercase">Library</p>
          <Link to="/app" aria-current={documentsActive ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${documentsActive ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5'}`}><Files aria-hidden size={18} />Documents</Link>
          <Link to="/app/reviews" aria-current={reviewsPage ? 'page' : undefined} className={`mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${reviewsPage ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5'}`}><FileCheck2 aria-hidden size={18} />Review queue</Link>
          <Link to="/app/smart-search" aria-current={smartSearchPage ? 'page' : undefined} className={`mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${smartSearchPage ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5'}`}><Sparkles aria-hidden size={18} />Smart search</Link>
        </nav>
        <Link to="/app/tags" aria-current={tagsActive ? 'page' : undefined} className={`mt-2 block rounded-xl px-4 py-3 text-sm font-medium ${tagsActive ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5'}`}>Tags</Link>
        {(adminAllowed || accessAllowed) && <nav aria-label="Administration" className="mt-5"><p className="mb-2 px-3 text-[0.65rem] font-semibold tracking-[0.2em] text-stone-400 uppercase">Administration</p>{adminAllowed && <Link to="/app/users" aria-current={usersPage ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${usersPage ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5'}`}><Users aria-hidden size={18} />Manage users</Link>}{accessAllowed && <Link to="/app/access" aria-current={accessPage ? 'page' : undefined} className={`mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${accessPage ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5'}`}><KeyRound aria-hidden size={18} />Share records</Link>}</nav>}
        {session && <CabinetNavigation />}
        {/* <div className="mt-6 border-t border-white/10 pt-5"><p className="font-serif text-xl text-amber-100 italic">Keep the context.</p><p className="mt-2 text-xs leading-6 text-stone-300">Preserve the connections that make your research meaningful.</p><Link to="/" className="mt-5 inline-flex items-center gap-2 text-xs text-stone-300 hover:text-white">About ArcheoVault<ArrowUpRight aria-hidden size={14} /></Link></div> */}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 bg-white px-6 py-4 sm:px-10">
          <p className="text-sm text-stone-500">{usersPage || accessPage ? 'Administration' : dashboardPage ? 'Workspace' : 'Library'} <span aria-hidden className="mx-2 text-stone-300">/</span><span className="font-medium text-stone-800">{usersPage ? 'Manage users' : accessPage ? 'Share records' : dashboardPage ? 'My work' : smartSearchPage ? 'Smart search' : reviewsPage ? 'Review queue' : tagsPage ? 'Tags' : location.pathname === '/app/upload' ? 'Upload document' : 'Documents'}</span></p>
          {session && <div className="flex items-center gap-3"><NotificationMenu csrf={session.csrf_token} /><span className="max-w-40 truncate text-sm text-stone-600" title={session.username}>{session.username}</span><button onClick={logout} disabled={busy} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium hover:bg-stone-50 focus-visible:outline-2 disabled:opacity-60"><LogOut aria-hidden size={15} />{busy ? 'Signing out…' : 'Sign out'}</button></div>}
        </header>
      <main className="mx-auto max-w-7xl px-6 py-9 sm:px-10 sm:py-12">
        {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}{!session && <button onClick={() => setAttempt(attempt + 1)} className="ml-4 underline">Try again</button>}</div>}
        {!session && !error && <WorkspaceLoading />}
        {session && <Suspense fallback={<WorkspaceLoading />}>{dashboardPage ? <OperationsDashboard username={session.username} adminAllowed={adminAllowed} /> : accessPage ? (!accessChecked ? <WorkspaceLoading /> : accessAllowed ? <AccessControlManager csrf={session.csrf_token} /> : <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-semibold">Access management unavailable</h1><p className="mt-2 text-sm text-amber-900">Your account is signed in but does not have permission to manage organizational access.</p></section>) : smartSearchPage ? <SmartSearch csrf={session.csrf_token} /> : reviewsPage ? <ReviewQueue username={session.username} csrf={session.csrf_token} /> : tagsPage ? <TagLibrary /> : location.pathname === '/app/users' ? (adminAllowed ? <UserAdministration csrf={session.csrf_token} /> : <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-semibold">User administration unavailable</h1><p className="mt-2 text-sm text-amber-900">Only a system administrator can create or edit accounts.</p></section>) : location.pathname === '/app/upload' ? <UploadPanel csrf={session.csrf_token} /> : documentId ? <DocumentDetailPanel key={documentId} id={Number(documentId)} csrf={session.csrf_token} /> : <DocumentsPanel />}</Suspense>}
      </main>
      </div>
    </div>
  )
}
