import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router-dom'

const LandingPage = lazy(() => import('../pages/LandingPage').then(module => ({ default: module.LandingPage })))
const SignInPage = lazy(() => import('../pages/SignInPage').then(module => ({ default: module.SignInPage })))
const ApplicationPage = lazy(() => import('../pages/ApplicationPage').then(module => ({ default: module.ApplicationPage })))

function PageLoading() {
  return <div role="status" aria-live="polite" className="mx-auto max-w-5xl px-6 py-16"><div className="h-4 w-32 animate-pulse rounded bg-stone-200" /><div className="mt-6 h-10 w-2/3 animate-pulse rounded bg-stone-200" /><div className="mt-8 grid gap-4 sm:grid-cols-3">{[1, 2, 3].map(value => <div key={value} className="h-32 animate-pulse rounded-2xl bg-stone-100" />)}</div><span className="sr-only">Loading ArcheoVault…</span></div>
}

function NotFoundPage() {
  return <main className="grid min-h-screen place-items-center bg-[#f6f7f4] px-6"><section className="max-w-lg rounded-3xl border border-stone-200 bg-white p-10 text-center shadow-sm"><p className="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">404 · Page not found</p><h1 className="mt-4 text-3xl font-semibold">This page is unavailable</h1><p className="mt-4 leading-7 text-stone-600">The address may be incorrect, or the page may have moved.</p><Link to="/app/dashboard" className="mt-7 inline-flex rounded-xl bg-[#233b33] px-5 py-3 text-sm font-semibold text-white">Return to My work</Link></section></main>
}

export function App() {
  return (
    <Suspense fallback={<PageLoading />}><Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/app" element={<ApplicationPage />} />
      <Route path="/app/dashboard" element={<ApplicationPage />} />
      <Route path="/app/users" element={<ApplicationPage />} />
      <Route path="/app/access" element={<ApplicationPage />} />
      <Route path="/app/tags" element={<ApplicationPage />} />
      <Route path="/app/reviews" element={<ApplicationPage />} />
      <Route path="/app/smart-search" element={<ApplicationPage />} />
      <Route path="/app/upload" element={<ApplicationPage />} />
      <Route path="/app/documents/:documentId" element={<ApplicationPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes></Suspense>
  )
}
