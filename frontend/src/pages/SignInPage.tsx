import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Archive, ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { getSession, signIn } from '../api/auth'
import { ApiError } from '../api/client'

export function SignInPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let active = true
    getSession().then(() => {
      if (active) navigate('/app', { replace: true })
    }).catch(cause => {
      if (!active) return
      // An absent/expired session is expected; service errors should remain visible.
      if (!(cause instanceof ApiError && cause.status === 401)) {
        setError('Unable to check your existing session. You can try signing in again.')
      }
      setCheckingSession(false)
    })
    return () => { active = false }
  }, [navigate])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || checkingSession) return
    setBusy(true)
    setError('')
    try {
      await signIn(username.trim(), password)
      setPassword('')
      navigate('/app', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.')
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-stone-50 lg:grid-cols-2">
      <section className="hero-grid relative flex flex-col justify-between overflow-hidden bg-[#233b33] px-8 py-10 text-white sm:px-14 lg:p-16">
        <Link to="/" className="flex w-fit items-center gap-3 text-xl font-semibold"><Archive aria-hidden size={25} />ArcheoECM</Link>
        <div className="relative z-10 max-w-lg py-12 lg:py-24">
          <p className="mb-6 text-xs font-semibold tracking-[0.2em] text-amber-200/80 uppercase">Evidence. Context. Continuity.</p>
          <h1 className="text-4xl leading-tight tracking-tight sm:text-5xl">Return to the records.<br /><span className="font-serif text-amber-100 italic">Continue the discovery.</span></h1>
          <p className="mt-6 max-w-sm leading-7 text-stone-300">A connected home for your organization’s research and the stories it preserves.</p>
        </div>
        <Link to="/" className="flex w-fit items-center gap-2 text-sm text-stone-300 hover:text-white"><ArrowLeft size={16} aria-hidden />Back to home</Link>
      </section>
      <section className="flex items-center justify-center px-6 py-16 sm:px-12">
        <div className="w-full max-w-sm">
          {checkingSession ? (
            <p role="status" className="flex items-center gap-3 text-stone-600">
              <LoaderCircle className="animate-spin" aria-hidden size={20} />Checking your session…
            </p>
          ) : <>
          <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">Welcome back</p>
          <h2 className="text-3xl font-semibold tracking-tight">Sign in to ArcheoECM</h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">Continue with your organization account.</p>
          <form onSubmit={submit} className="mt-9 space-y-6" aria-busy={busy}>
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium">Username</label>
              <input id="username" autoComplete="username" required maxLength={150} value={username} onChange={e => setUsername(e.target.value)} disabled={busy} className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-[#365d4d] focus:ring-2 focus:ring-[#365d4d]/20 disabled:opacity-60" />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label>
              <div className="relative">
                <input id="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} className="w-full rounded-xl border border-stone-300 bg-white py-3 pr-14 pl-4 outline-none focus:border-[#365d4d] focus:ring-2 focus:ring-[#365d4d]/20 disabled:opacity-60" />
                <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} className="absolute inset-y-0 right-0 rounded-r-xl px-4 text-stone-500 focus-visible:outline-2 focus-visible:outline-[#365d4d]">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{error}</p>}
            <button disabled={busy} className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#233b33] px-5 py-3.5 font-semibold text-white transition hover:bg-[#304e43] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#365d4d] disabled:cursor-wait disabled:opacity-70">
              {busy ? <><LoaderCircle className="animate-spin" aria-hidden size={18} />Signing in…</> : <>Sign in<ArrowRight aria-hidden size={18} /></>}
            </button>
          </form>
          <p className="mt-7 text-sm leading-6 text-stone-500">Having trouble accessing your account? Contact your organization administrator.</p>
          </>}
        </div>
      </section>
    </main>
  )
}
