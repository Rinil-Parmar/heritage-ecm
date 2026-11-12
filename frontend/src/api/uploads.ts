import { ApiError } from './client'

export interface MetadataField { id: number; label: string; required: boolean; constrained: boolean }
export interface UploadResult { document_id: number; metadata_saved: boolean; organization_saved: boolean; errors: string[] }
export interface OrganizationOption { id: number; label: string; full_path?: string; color?: string; parent_id?: number | null; depth?: number }

export async function captureRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, { ...options, credentials: 'same-origin', cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(typeof body?.detail === 'string' ? body.detail : 'Unable to complete this request. Please try again.', response.status)
  }
  if (!body) throw new Error('The service returned an unexpected response.')
  return body as T
}

export function uploadDocument(file: File, details: object, csrf: string, key: string, onProgress: (value: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/v1/upload')
    xhr.timeout = 300000
    xhr.setRequestHeader('X-CSRF-Token', csrf)
    xhr.setRequestHeader('Idempotency-Key', key)
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)) }
    xhr.onerror = xhr.ontimeout = () => reject(new Error('Connection interrupted. Check the document list before uploading again; the file may have been received.'))
    xhr.onload = () => {
      let data
      try { data = JSON.parse(xhr.responseText) } catch { reject(new Error('Upload outcome is uncertain. Check the document list before trying again.')); return }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError(typeof data.detail === 'string' ? data.detail : 'Upload failed. Check the document list before trying again.', xhr.status))
      } else if (!Number.isInteger(data.document_id)) {
        reject(new Error('Upload outcome is uncertain. Check the document list.'))
      } else resolve(data)
    }
    const form = new FormData()
    form.append('details', JSON.stringify(details))
    form.append('file', file)
    xhr.send(form)
  })
}
