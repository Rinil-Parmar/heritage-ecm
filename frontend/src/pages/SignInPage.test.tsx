// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SignInPage } from './SignInPage'
import { getSession, signIn } from '../api/auth'
import { ApiError } from '../api/client'

vi.mock('../api/auth', () => ({ signIn: vi.fn(), getSession: vi.fn() }))
beforeEach(() => { vi.mocked(getSession).mockRejectedValue(new ApiError('Please sign in.', 401)) })
afterEach(() => { cleanup(); vi.clearAllMocks() })

function setup() {
  render(<MemoryRouter initialEntries={['/sign-in']}><Routes>
    <Route path="/sign-in" element={<SignInPage />} />
    <Route path="/app" element={<p>Account connected</p>} />
  </Routes></MemoryRouter>)
  return userEvent.setup()
}

describe('Sign in', () => {
  it('submits credentials and enters the application', async () => {
    vi.mocked(signIn).mockResolvedValue({ username: 'researcher', csrf_token: 'csrf' })
    const user = setup()
    await user.type(await screen.findByLabelText('Username'), 'researcher')
    await user.type(screen.getByLabelText('Password'), 'example-password')
    await user.click(screen.getByRole('button', { name: /^Sign in$/ }))
    expect(await screen.findByText('Account connected')).toBeTruthy()
    expect(signIn).toHaveBeenCalledWith('researcher', 'example-password')
  })

  it('shows a failure and clears the password for retry', async () => {
    vi.mocked(signIn).mockRejectedValue(new Error('Username or password is incorrect.'))
    const user = setup()
    await user.type(await screen.findByLabelText('Username'), 'researcher')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /^Sign in$/ }))
    expect((await screen.findByRole('alert')).textContent).toContain('incorrect')
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('researcher')
  })
})
