import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AuthGate from './AuthGate.tsx'
import { RevealProvider } from './components/RevealProvider.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { installSwipeToClose } from './swipeToClose.ts'

installSwipeToClose()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <RevealProvider>
        <AuthGate />
      </RevealProvider>
    </ToastProvider>
  </StrictMode>,
)
