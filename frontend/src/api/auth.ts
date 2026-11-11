import { ApiError } from './client'

export interface Session {
  username: string
  csrf_token: string
}

async function authRequest(path: string, options: RequestInit = {}) {
  let response: Response
  try {
    response = await fetch(`/api/v1/auth/${path}`, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...options.headers },
    })
  } catch {
    throw new Error('Unable to connect. Check your connection and try again.')
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: 'Your session has ended. Please sign in again.',
      403: 'This request could not be verified. Refresh the page and try again.',
      422: 'Check your username and password and try again.',
      429: 'Too many attempts. Wait one minute and try again.',
    }
    throw new ApiError(
      path === 'login' && response.status === 401
        ? 'Username or password is incorrect.'
        : messages[response.status] || 'Sign-in is temporarily unavailable. Please try again.',
      response.status,
    )
  }
  if (response.status === 204) return undefined
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The application service is unavailable. Please try again.')
  }
  const data = await response.json()
  if (typeof data.username !== 'string' || typeof data.csrf_token !== 'string') {
    throw new Error('The application returned an unexpected response. Please try again.')
  }
  return data as Session
}

export async function signIn(username: string, password: string): Promise<Session> {
  return (await authRequest('login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }))!
}

export async function getSession(): Promise<Session> {
  return (await authRequest('session'))!
}

export async function signOut(csrf: string): Promise<void> {
  await authRequest('logout', { method: 'POST', headers: { 'X-CSRF-Token': csrf } })
}
