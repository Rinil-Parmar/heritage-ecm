import { captureRequest } from './uploads'
import type { DocumentSummary } from './documents'

export interface SmartSearchStatus {
  ai_enabled: boolean
  mode: 'ai' | 'standard'
  capabilities: string[]
  examples: string[]
}

export interface SearchPlan {
  keywords: string
  created_from: string | null
  created_to: string | null
  document_type_id: number | null
  tag_id: number | null
  cabinet_id: number | null
  metadata: { field: string; value: string }[]
  explanation: string
}

export interface SmartSearchResult {
  mode: 'ai' | 'standard'
  warning: string
  plan: SearchPlan
  interpretation: string[]
  count: number
  page: number
  next_page: number | null
  previous_page: number | null
  results: DocumentSummary[]
}

export interface SmartSearchPage {
  count: number
  page: number
  next_page: number | null
  previous_page: number | null
  results: DocumentSummary[]
}

export function getSmartSearchStatus(signal?: AbortSignal) {
  return captureRequest<SmartSearchStatus>('smart-search/status', { signal })
}

export function runSmartSearch(query: string, csrf: string, signal?: AbortSignal) {
  return captureRequest<SmartSearchResult>('smart-search', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ query }),
  })
}

export function getSmartSearchPage(plan: SearchPlan, page: number, csrf: string, signal?: AbortSignal) {
  return captureRequest<SmartSearchPage>('smart-search/page', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ plan, page }),
  })
}
