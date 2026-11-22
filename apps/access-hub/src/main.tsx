import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installFeatureFlagsFetchHook } from '@strixun/api-framework/client'
import './index.css'
import App from './App.tsx'

installFeatureFlagsFetchHook()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
