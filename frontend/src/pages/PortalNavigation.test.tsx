// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { LandingPage } from './LandingPage'
import { SignInPage } from './SignInPage'
import { getSession, signIn } from '../api/auth'
import { ApiError } from '../api/client'

vi.mock('../api/auth', () => ({ getSession: vi.fn(), signIn: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState({}, '', '/') })
function AppDestination() {
  return <p>Application route: {useLocation().pathname}</p>
}

it('keeps both landing links, back navigation and successful sign-in under /portal/', async () => {
  vi.mocked(getSession).mockRejectedValue(new ApiError('Please sign in.', 401))
  vi.mocked(signIn).mockResolvedValue({ username: 'researcher', csrf_token: 'test-csrf' })
  window.history.replaceState({}, '', '/portal/')
  render(<BrowserRouter basename="/portal/"><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/sign-in" element={<SignInPage />} />
    <Route path="/app" element={<AppDestination />} />
  </Routes></BrowserRouter>)
  const user = userEvent.setup()
  expect(screen.getByRole('link', { name: /^Sign in$/ }).getAttribute('href')).toBe('/portal/sign-in')
  expect(screen.getByRole('link', { name: 'Organization sign in' }).getAttribute('href')).toBe('/portal/sign-in')
  await user.click(screen.getByRole('link', { name: /^Sign in$/ }))
  await screen.findByLabelText('Username')
  expect(window.location.pathname).toBe('/portal/sign-in')
  await user.click(screen.getByRole('link', { name: 'Back to home' }))
  expect(window.location.pathname).toBe('/portal/')
  await user.click(screen.getByRole('link', { name: 'Organization sign in' }))
  await user.type(await screen.findByLabelText('Username'), 'researcher')
  await user.type(screen.getByLabelText('Password'), 'test-password')
  await user.click(screen.getByRole('button', { name: /^Sign in$/ }))
  await screen.findByText('Application route: /app')
  expect(window.location.pathname).toBe('/portal/app')
  expect(signIn).toHaveBeenCalledWith('researcher', 'test-password')
})
