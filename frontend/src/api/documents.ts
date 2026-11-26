import { requestBlob, requestJson } from './client'

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
  tagId?: number
  cabinetId?: number
  query?: string
  documentTypeId?: number
  createdFrom?: string
  createdTo?: string
}

export interface PreviewPage { id: number; page_number: number; image_hash: string }
export interface PreviewPageList { version_id: number; count: number; results: PreviewPage[] }

export interface DocumentDetail extends DocumentSummary {
  uuid: string
  file_latest: { id: number; filename: string; mimetype: string; size: number | null; timestamp: string | null } | null
}

export async function getDocument(id: number, signal?: AbortSignal): Promise<DocumentDetail> {
  const data = await requestJson<DocumentDetail>(`/api/v1/documents/${id}`, { signal })
  if (data.id !== id || typeof data.label !== 'string') throw new Error('Unexpected document response.')
  return data
}

export async function getDocumentFile(id: number, preview: boolean, signal?: AbortSignal): Promise<Blob> {
  return requestBlob(`/api/v1/documents/${id}/file?preview=${preview}`, { signal }, { timeoutMs: 30_000 })
}

export function getPreviewPages(id: number, signal?: AbortSignal) {
  return requestJson<PreviewPageList>(`/api/v1/documents/${id}/preview-pages`, { signal })
}

export function getPreviewPageImage(id: number, versionId: number, pageId: number, width: number, imageHash: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ width: String(width) })
  if (imageHash) params.set('_hash', imageHash)
  return requestBlob(`/api/v1/documents/${id}/preview-pages/${versionId}/${pageId}?${params}`, { signal }, { timeoutMs: 45_000 })
}

export async function listDocuments(page: number, filters: DocumentFilters = {}, signal?: AbortSignal): Promise<DocumentPage> {
  const params = new URLSearchParams({ page: String(page) })
  if (filters.tagId) params.set('tag_id', String(filters.tagId))
  if (filters.cabinetId) params.set('cabinet_id', String(filters.cabinetId))
  if (filters.query) params.set('query', filters.query)
  if (filters.documentTypeId) params.set('document_type_id', String(filters.documentTypeId))
  if (filters.createdFrom) params.set('created_from', filters.createdFrom)
  if (filters.createdTo) params.set('created_to', filters.createdTo)
  const data = await requestJson<DocumentPage>(`/api/v1/documents?${params}`, { signal })
  if (!Array.isArray(data.results) || typeof data.count !== 'number' || data.page !== page) {
    throw new Error('The document service returned an unexpected response.')
  }
  return data as DocumentPage
}
