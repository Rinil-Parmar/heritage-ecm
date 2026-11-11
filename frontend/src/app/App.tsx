import { Route, Routes } from 'react-router-dom'
import { LandingPage } from '../pages/LandingPage'
import { SignInPage } from '../pages/SignInPage'
import { ApplicationPage } from '../pages/ApplicationPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/app" element={<ApplicationPage />} />
      <Route path="/app/documents/:documentId" element={<ApplicationPage />} />
    </Routes>
  )
}
