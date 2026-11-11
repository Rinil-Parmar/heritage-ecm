import { ApiError } from './client'
import { captureRequest } from './uploads'

export interface DocumentVersion {
  id: number
  active: boolean
  comment: string
  timestamp: string
}

export function listDocumentVersions(documentId: number, signal?: AbortSignal) {
  return captureRequest<{ results: DocumentVersion[] }>(`documents/${documentId}/versions`, { signal })
}

export function uploadDocumentVersion(documentId: number, file: File, comment: string, csrf: string, key: string, onProgress: (value: number) => void): Promise<{ accepted: boolean; message: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/v1/documents/${documentId}/versions`)
    xhr.timeout = 300000
    xhr.setRequestHeader('X-CSRF-Token', csrf)
    xhr.setRequestHeader('Idempotency-Key', key)
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)) }
    xhr.onerror = xhr.ontimeout = () => reject(new Error('The upload outcome is uncertain. Refresh version history before trying again.'))
    xhr.onload = () => {
      let body: { accepted?: boolean; message?: string; detail?: string }
      try { body = JSON.parse(xhr.responseText) } catch { reject(new Error('The upload outcome is uncertain. Refresh version history.')); return }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError(body.detail || 'Unable to upload this version.', xhr.status))
      } else if (!body.accepted || !body.message) {
        reject(new Error('The version service returned an unexpected response.'))
      } else resolve({ accepted: true, message: body.message })
    }
    const form = new FormData()
    form.append('file', file)
    form.append('comment', comment)
    xhr.send(form)
  })
}
