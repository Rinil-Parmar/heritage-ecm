import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { AppProviders } from './app/providers'
import './styles/app.css'

// Retire the former dark preference for existing browsers.
delete document.documentElement.dataset.theme
document.documentElement.style.colorScheme = 'light'
try { localStorage.removeItem('archeovault-theme') } catch { /* Storage is optional. */ }

createRoot(document.getElementById('root')!).render(
  <AppProviders>
    <App />
  </AppProviders>,
)
