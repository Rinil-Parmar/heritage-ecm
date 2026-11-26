import { captureRequest } from './uploads'

export type AccessScope = 'document' | 'cabinet'
export interface AccessGroup { id: number; name: string }
export interface AccessRole {
  id: number
  label: string
  expected_group: string
  linked_groups: AccessGroup[]
  members: string[]
  mapping_ready: boolean
  mapping_error: string
}
export interface AccessBundle { key: string; label: string; description: string; permission_pks: string[]; permission_labels: string[]; missing_labels: string[] }
export interface ACLPermission { pk: string; label: string; namespace: string }
export interface AccessVerification { users: string[]; permissions_applied: string[]; missing_permissions: string[]; verified_at: string }
export interface ACLRow { id: number; role: AccessRole; permissions: ACLPermission[]; verification?: AccessVerification }
export interface DirectoryRow { document_id: number; document_label: string; role_id: number; role_label: string; members: string[]; access: { key: string; label: string }; permissions: ACLPermission[] }
export interface DirectoryPage { count: number; page: number; complete: boolean; next_page: number | null; previous_page: number | null; results: DirectoryRow[] }
export interface AccessAuditRow {
  id: number
  actor: string
  scope: AccessScope
  object_id: number
  role_id: number
  role_label: string
  bundle: string
  permission_count: number
  created_at: string
}

export function getAccessManagerStatus(signal?: AbortSignal) {
  return captureRequest<{ allowed: boolean }>('access-control/access', { signal })
}

export function getAccessOptions(scope: AccessScope, signal?: AbortSignal) {
  return captureRequest<{ roles: AccessRole[]; bundles: AccessBundle[] }>(`access-control/options?scope=${scope}`, { signal })
}

export function getACLs(scope: AccessScope, objectId: number, signal?: AbortSignal) {
  return captureRequest<{ results: ACLRow[] }>(`access-control/acls?scope=${scope}&object_id=${objectId}`, { signal })
}

export function getAccessAudit(scope: AccessScope, objectId: number, signal?: AbortSignal) {
  return captureRequest<{ results: AccessAuditRow[] }>(`access-control/audit?scope=${scope}&object_id=${objectId}`, { signal })
}

export function getCabinetDocuments(cabinetId: number, signal?: AbortSignal) {
  return captureRequest<{ count: number; results: { id: number; label: string }[] }>(`access-control/cabinet-documents?cabinet_id=${cabinetId}`, { signal })
}

export function getAccessDirectory(page: number, filters: { query?: string; username?: string; roleId?: number } = {}, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(page) })
  if (filters.query) params.set('query', filters.query)
  if (filters.username) params.set('username', filters.username)
  if (filters.roleId) params.set('role_id', String(filters.roleId))
  return captureRequest<DirectoryPage>(`access-control/directory?${params}`, { signal })
}

export function saveACL(scope: AccessScope, objectId: number, roleId: number, bundle: string,
  originalPermissionPks: string[], csrf: string) {
  return captureRequest<ACLRow>('access-control/acls', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ scope, object_id: objectId, role_id: roleId, bundle, original_permission_pks: originalPermissionPks }),
  })
}


export function saveBulkDocumentACL(objectIds: number[], roleId: number, bundle: string, csrf: string) {
  return captureRequest<{ requested: number; applied: number; failed: number; results: { object_id: number; acl: ACLRow }[]; failures: { object_id: number; status: number; message: string }[]; verified_at: string }>('access-control/bulk', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ object_ids: objectIds, role_id: roleId, bundle }),
  })
}
