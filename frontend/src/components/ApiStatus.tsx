import { useQuery } from '@tanstack/react-query'
import { checkDocumentApi } from '../api/client'

export function ApiStatus() {
  const apiQuery = useQuery({
    queryKey: ['mayan-api-status'],
    queryFn: ({ signal }) => checkDocumentApi(signal),
    refetchInterval: 60_000,
  })

  const state = apiQuery.isPending
    ? { label: 'Checking service', color: 'bg-amber-400', pulse: true }
    : apiQuery.isError
      ? { label: 'System unavailable', color: 'bg-red-400', pulse: false }
      : { label: 'System available', color: 'bg-emerald-400', pulse: false }

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 shadow-sm" aria-live="polite">
      <span className="relative flex size-2.5" aria-hidden="true">
        {state.pulse && <span className={`absolute inline-flex size-full animate-ping rounded-full ${state.color} opacity-70`} />}
        <span className={`relative inline-flex size-2.5 rounded-full ${state.color}`} />
      </span>
      {state.label}
    </div>
  )
}
