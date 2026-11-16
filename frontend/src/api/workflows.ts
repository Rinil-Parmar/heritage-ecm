import { captureRequest } from './uploads'

export interface WorkflowState {
  id: number
  label: string
  completion: number
  final: boolean
}

export interface WorkflowTransition {
  id: number
  label: string
  origin_state: WorkflowState | null
  destination_state: WorkflowState | null
}

export interface WorkflowInstance {
  id: number
  label: string
  internal_name: string
  current_state: WorkflowState | null
  last_log_entry: {
    datetime: string | null
    comment: string
    actor: string
    transition: WorkflowTransition | null
  } | null
  transitions: WorkflowTransition[]
}

export interface ReviewQueueItem {
  id: number
  label: string
  datetime_created: string | null
  document_type: { id: number; label: string } | null
  state: WorkflowState
  workflow_instance_id: number
  assignment: ReviewAssignment | null
  last_action: { label: string; datetime: string | null; actor: string } | null
}

export interface ReviewAssignment {
  workflow_instance_id: number
  document_id: number
  assignee_username: string
  assigned_by: string
  priority: 'normal' | 'high' | 'urgent'
  due_at: string | null
  created_at: string
  updated_at: string
}

export interface ReviewAssignee { id: number; username: string; label: string }
export interface BlockedReview {
  document_id: number
  label: string
  reason: string
  assignment: ReviewAssignment
}

export function getWorkflows(documentId: number, signal?: AbortSignal) {
  return captureRequest<{ configured: boolean; results: WorkflowInstance[] }>(`records/${documentId}/workflows`, { signal })
}

export function performTransition(
  documentId: number,
  instanceId: number,
  transitionId: number,
  comment: string,
  csrf: string,
) {
  return captureRequest<WorkflowInstance>(
    `records/${documentId}/workflows/${instanceId}/transitions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ transition_id: transitionId, comment }),
    },
  )
}

export function launchWorkflow(documentId: number, csrf: string) {
  return captureRequest<{ started: boolean; workflow: WorkflowInstance | null }>(
    `records/${documentId}/workflows/launch`,
    { method: 'POST', headers: { 'X-CSRF-Token': csrf } },
  )
}

export function getReviewQueue(signal?: AbortSignal) {
  return captureRequest<{
    workflow: { id: number; label: string } | null
    results: ReviewQueueItem[]
    blocked: BlockedReview[]
  }>('reviews/queue', { signal })
}

export function getAssignmentAccess(signal?: AbortSignal) {
  return captureRequest<{ allowed: boolean }>('reviews/assignment-access', { signal })
}

export function getReviewAssignees(signal?: AbortSignal) {
  return captureRequest<{ results: ReviewAssignee[] }>('reviews/assignees', { signal })
}

export function saveReviewAssignment(workflowId: number, documentId: number, assignee: string,
  priority: ReviewAssignment['priority'], dueDate: string, csrf: string) {
  return captureRequest<ReviewAssignment>(`reviews/assignments/${workflowId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ document_id: documentId, assignee_username: assignee, priority, due_date: dueDate || null }),
  })
}

export function removeReviewAssignment(workflowId: number, csrf: string) {
  return captureRequest<{ removed: boolean }>(`reviews/assignments/${workflowId}`, {
    method: 'DELETE', headers: { 'X-CSRF-Token': csrf },
  })
}
