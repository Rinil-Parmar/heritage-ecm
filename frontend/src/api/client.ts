const API_BASE_PATH = '/api/v4'
const DEFAULT_TIMEOUT_MS = 15_000

export class ApiError extends Error {
  readonly status: number

  constructor(
    message: string,
    status: number,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'The request could not be completed. Check the information and try again.',
  401: 'Your session has ended. Please sign in again.',
  403: 'Your account does not have permission to perform this action.',
  404: 'This record or page is no longer available.',
  409: 'This information changed since it was loaded. Refresh and try again.',
  413: 'The selected file is too large.',
  415: 'This file format is not supported for this action.',
  422: 'Check the required information and try again.',
  429: 'The service is busy. Please wait briefly and try again.',
  500: 'ArcheoVault encountered an unexpected error.',
  502: 'The document service returned an unexpected response.',
  503: 'The document service is temporarily unavailable.',
  504: 'The request timed out while waiting for the document service.',
}

interface RequestOptions {
  timeoutMs?: number
  retry?: boolean
}

let unauthorizedNotified = false

export function markAuthenticated() {
  unauthorizedNotified = false
}

function requestSignal(callerSignal: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort('timeout'), timeoutMs)
  const abort = () => controller.abort(callerSignal?.reason || 'cancelled')
  if (callerSignal?.aborted) abort()
  else callerSignal?.addEventListener('abort', abort, { once: true })
  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timeout)
      callerSignal?.removeEventListener('abort', abort)
    },
  }
}

async function fetchWithPolicy(input: RequestInfo | URL, init: RequestInit,
  options: RequestOptions = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase()
  // A retry must be explicitly requested. Most UI reads are user-visible and
  // should fail once with a useful message instead of silently doubling load.
  const attempts = options.retry === true && method === 'GET' ? 2 : 1
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const managed = requestSignal(init.signal, options.timeoutMs || DEFAULT_TIMEOUT_MS)
    try {
      const response = await fetch(input, {
        ...init, signal: managed.signal, credentials: 'same-origin', cache: 'no-store',
        headers: { Accept: 'application/json', ...init.headers },
      })
      if (attempt + 1 < attempts && [502, 503, 504].includes(response.status)) continue
      return response
    } catch (cause) {
      lastError = cause
      if (init.signal?.aborted) throw cause
      if (attempt + 1 >= attempts) {
        if (managed.signal.aborted) throw new ApiError('The request timed out. Check your connection and try again.', 504)
        throw new ApiError('ArcheoVault could not reach the service. Check your connection and try again.', 503)
      }
    } finally { managed.cleanup() }
  }
  throw lastError
}

export async function requestJson<T>(path: string, init: RequestInit = {},
  options: RequestOptions = {}): Promise<T> {
  const response = await fetchWithPolicy(path, init, options)
  if (response.status === 204 && response.ok) return undefined as T
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = typeof body?.detail === 'string' ? body.detail : STATUS_MESSAGES[response.status]
    if (response.status === 401 && !path.startsWith('/api/v1/auth/') && !unauthorizedNotified) {
      unauthorizedNotified = true
      window.dispatchEvent(new CustomEvent('archeovault:unauthorized'))
    }
    throw new ApiError(detail || 'Unable to complete this request. Please try again.', response.status)
  }
  if (body === null || body === undefined) throw new ApiError('The service returned an unexpected response.', 502)
  return body as T
}

export async function requestBlob(path: string, init: RequestInit = {},
  options: RequestOptions = {}): Promise<Blob> {
  const response = await fetchWithPolicy(path, { ...init, headers: init.headers }, options)
  if (!response.ok) throw new ApiError(STATUS_MESSAGES[response.status] || 'Unable to retrieve this file.', response.status)
  return response.blob()
}

export async function checkDocumentApi(signal?: AbortSignal): Promise<void> {
  const response = await fetchWithPolicy(`${API_BASE_PATH}/`, {
    headers: { Accept: 'application/json' },
    signal,
  }, { retry: true })

  if (!response.ok) {
    throw new ApiError('The document service is unavailable.', response.status)
  }
}
