import { ApiError, markAuthenticated, requestJson } from './client'

export interface Session {
  username: string
  csrf_token: string
}

let cachedSession: { value: Session; expiresAt: number } | null = null
let sessionRequest: Promise<Session> | null = null
let unauthenticatedUntil = 0
const SESSION_CACHE_MS = 10_000
const UNAUTHENTICATED_CACHE_MS = 5_000

async function authRequest(path: string, options: RequestInit = {}) {
  try {
    const data = await requestJson<Session | undefined>(`/api/v1/auth/${path}`, options, {
      retry: false,
    })
    if (data === undefined) return undefined
    if (typeof data.username !== 'string' || typeof data.csrf_token !== 'string') {
      throw new ApiError('The application returned an unexpected response. Please try again.', 502)
    }
    return data
  } catch (cause) {
    if (!(cause instanceof ApiError)) throw cause
    if (path === 'login' && cause.status === 401) {
      throw new ApiError('Username or password is incorrect.', 401)
    }
    const messages: Record<number, string> = {
      401: 'Your session has ended. Please sign in again.',
      403: 'This request could not be verified. Refresh the page and try again.',
      422: 'Check your username and password and try again.',
      429: 'Too many attempts. Wait one minute and try again.',
    }
    throw new ApiError(
      messages[cause.status] || cause.message || 'Sign-in is temporarily unavailable. Please try again.',
      cause.status,
    )
  }
}

export async function signIn(username: string, password: string): Promise<Session> {
  const session = (await authRequest('login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }))!
  cachedSession = { value: session, expiresAt: Date.now() + SESSION_CACHE_MS }
  unauthenticatedUntil = 0
  markAuthenticated()
  return session
}

export async function getSession(): Promise<Session> {
  const now = Date.now()
  if (cachedSession && cachedSession.expiresAt > now) return cachedSession.value
  if (unauthenticatedUntil > now) throw new ApiError('Your session has ended. Please sign in again.', 401)
  if (sessionRequest) return sessionRequest
  sessionRequest = authRequest('session').then(value => {
    const session = value!
    cachedSession = { value: session, expiresAt: Date.now() + SESSION_CACHE_MS }
    unauthenticatedUntil = 0
    markAuthenticated()
    return session
  }).catch(cause => {
    cachedSession = null
    if (cause instanceof ApiError && cause.status === 401) {
      unauthenticatedUntil = Date.now() + UNAUTHENTICATED_CACHE_MS
    }
    throw cause
  }).finally(() => { sessionRequest = null })
  return sessionRequest
}

export async function signOut(csrf: string): Promise<void> {
  await authRequest('logout', { method: 'POST', headers: { 'X-CSRF-Token': csrf } })
  cachedSession = null
  unauthenticatedUntil = Date.now() + UNAUTHENTICATED_CACHE_MS
}
