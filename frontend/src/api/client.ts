const API_BASE_PATH = '/api/v4'

export class ApiError extends Error {
  readonly status: number

  constructor(
    message: string,
    status: number,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function checkDocumentApi(signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${API_BASE_PATH}/`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new ApiError('The document service is unavailable.', response.status)
  }
}
