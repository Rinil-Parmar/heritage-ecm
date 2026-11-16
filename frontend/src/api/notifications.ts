import { captureRequest } from './uploads'

export interface NotificationItem {
  id: number
  kind: string
  title: string
  body: string
  document_id: number | null
  created_at: string
  read_at: string | null
}

export function getNotifications(signal?: AbortSignal) {
  return captureRequest<{ unread: number; results: NotificationItem[] }>('notifications', { signal })
}

export function readNotification(id: number, csrf: string) {
  return captureRequest<{ updated: boolean }>(`notifications/${id}/read`, {
    method: 'POST', headers: { 'X-CSRF-Token': csrf },
  })
}

export function readAllNotifications(csrf: string) {
  return captureRequest<{ updated: number }>('notifications/read-all', {
    method: 'POST', headers: { 'X-CSRF-Token': csrf },
  })
}
