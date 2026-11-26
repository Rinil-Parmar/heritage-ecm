// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
})

describe('request efficiency', () => {
  it('shares concurrent session checks instead of calling the server twice', async () => {
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      username: 'researcher', csrf_token: 'csrf',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const { getSession } = await import('./auth')

    const [first, second] = await Promise.all([getSession(), getSession()])

    expect(first.username).toBe('researcher')
    expect(second.username).toBe('researcher')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('briefly caches an absent session instead of repeating 401 calls', async () => {
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      detail: 'Please sign in.',
    }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
    const { getSession } = await import('./auth')

    await expect(getSession()).rejects.toMatchObject({ status: 401 })
    await expect(getSession()).rejects.toMatchObject({ status: 401 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry ordinary failed reads unless explicitly requested', async () => {
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      detail: 'Temporarily unavailable.',
    }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
    const { requestJson } = await import('./client')

    await expect(requestJson('/api/v1/example')).rejects.toMatchObject({ status: 503 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
