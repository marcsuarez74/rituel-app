import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { migrerV2 } from './lib/cycle/etat'

registerSW({ immediate: true })

// 2.0 : remise à zéro des semaines .md (une fois) avant toute lecture.
migrerV2()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
