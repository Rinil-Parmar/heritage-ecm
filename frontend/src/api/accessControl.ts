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
export interface AccessBundle { key: string; label: string; description: string; permission_pks: string[]; missing_labels: string[] }
export interface ACLPermission { pk: string; label: string; namespace: string }
export interface ACLRow { id: number; role: AccessRole; permissions: ACLPermission[] }

export function getAccessManagerStatus(signal?: AbortSignal) {
  return captureRequest<{ allowed: boolean }>('access-control/access', { signal })
}

export function getAccessOptions(scope: AccessScope, signal?: AbortSignal) {
  return captureRequest<{ roles: AccessRole[]; bundles: AccessBundle[] }>(`access-control/options?scope=${scope}`, { signal })
}

export function getACLs(scope: AccessScope, objectId: number, signal?: AbortSignal) {
  return captureRequest<{ results: ACLRow[] }>(`access-control/acls?scope=${scope}&object_id=${objectId}`, { signal })
}

export function saveACL(scope: AccessScope, objectId: number, roleId: number, bundle: string,
  originalPermissionPks: string[], csrf: string) {
  return captureRequest<ACLRow>('access-control/acls', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ scope, object_id: objectId, role_id: roleId, bundle, original_permission_pks: originalPermissionPks }),
  })
}
