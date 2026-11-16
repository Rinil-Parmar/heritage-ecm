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
  last_action: { label: string; datetime: string | null; actor: string } | null
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
  }>('reviews/queue', { signal })
}
