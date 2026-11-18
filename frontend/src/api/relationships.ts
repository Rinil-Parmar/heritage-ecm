import { captureRequest } from './uploads'

export type RelationshipType = 'same_site' | 'depicts' | 'supports' | 'cites' | 'supersedes' | 'related'

export interface RelatedRecord {
  id: number
  label: string
  document_type: { id: number; label: string } | null
  datetime_created: string
}

export interface RecordRelationship {
  id: number
  relationship_type: RelationshipType
  direction: 'incoming' | 'outgoing'
  note: string
  created_by: string
  created_at: string
  document: RelatedRecord
}

export function getRelationships(documentId: number, signal?: AbortSignal) {
  return captureRequest<{ results: RecordRelationship[] }>(`records/${documentId}/relationships`, { signal })
}

export function createRelationship(documentId: number, targetId: number, relationshipType: RelationshipType, note: string, csrf: string) {
  return captureRequest<RecordRelationship>(`records/${documentId}/relationships`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ target_document_id: targetId, relationship_type: relationshipType, note }),
  })
}

export function deleteRelationship(documentId: number, relationshipId: number, csrf: string) {
  return captureRequest<{ deleted: boolean }>(`records/${documentId}/relationships/${relationshipId}`, {
    method: 'DELETE', headers: { 'X-CSRF-Token': csrf },
  })
}
