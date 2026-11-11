import { ApiError } from './client'

export interface DocumentSummary {
  id: number
  label: string
  description: string
  datetime_created: string
  document_type: { id: number; label: string } | null
  language: string
}

export interface DocumentPage {
  count: number
  page: number
  next_page: number | null
  previous_page: number | null
  results: DocumentSummary[]
}

export interface DocumentFilters {
  query?: string
  documentTypeId?: number
  createdFrom?: string
  createdTo?: string
}

export interface DocumentDetail extends DocumentSummary {
  uuid: string
  file_latest: { id: number; filename: string; mimetype: string; size: number | null; timestamp: string | null } | null
}

async function recordResponse(url: string, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal })
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: 'Your session has ended. Please sign in again.',
      403: 'You do not have permission to access this record or download its file.',
      404: 'This record or file is no longer available.',
      413: 'This file is too large for preview. Download the original instead.',
      415: 'Preview is unavailable for this format. Download the original instead.',
      429: 'The document service is busy. Please try again shortly.',
    }
    throw new ApiError(messages[response.status] || 'The document service is unavailable. Please try again.', response.status)
  }
  return response
}

export async function getDocument(id: number, signal?: AbortSignal): Promise<DocumentDetail> {
  const response = await recordResponse(`/api/v1/documents/${id}`, signal)
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Unexpected document response.')
  const data = await response.json()
  if (data.id !== id || typeof data.label !== 'string') throw new Error('Unexpected document response.')
  return data as DocumentDetail
}

export async function getDocumentFile(id: number, preview: boolean, signal?: AbortSignal): Promise<Blob> {
  const response = await recordResponse(`/api/v1/documents/${id}/file?preview=${preview}`, signal)
  return response.blob()
}

export async function listDocuments(page: number, filters: DocumentFilters = {}, signal?: AbortSignal): Promise<DocumentPage> {
  const params = new URLSearchParams({ page: String(page) })
  if (filters.query) params.set('query', filters.query)
  if (filters.documentTypeId) params.set('document_type_id', String(filters.documentTypeId))
  if (filters.createdFrom) params.set('created_from', filters.createdFrom)
  if (filters.createdTo) params.set('created_to', filters.createdTo)
  const response = await fetch(`/api/v1/documents?${params}`, {
    credentials: 'same-origin', cache: 'no-store', signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: 'Your session has ended. Please sign in again.',
      403: 'Your account does not have access to the document list.',
      404: 'This page is no longer available. Return to the first page or try refreshing.',
      422: 'The selected search filters are invalid. Check the dates and try again.',
      429: 'The document service is busy. Please try again shortly.',
    }
    throw new ApiError(messages[response.status] || 'Unable to load documents. Please try again.', response.status)
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The document service returned an unexpected response.')
  }
  const data = await response.json()
  if (!Array.isArray(data.results) || typeof data.count !== 'number' || data.page !== page) {
    throw new Error('The document service returned an unexpected response.')
  }
  return data as DocumentPage
}
