/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📱 PWA PROVIDER
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Provider que gestiona:
 * - Registro del Service Worker
 * - Estado de instalabilidad PWA
 * - Prompt de instalación
 * - Estado de conexión global
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { ConnectionStatus } from './connection-status'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAContextType {
  isInstalled: boolean
  isInstallable: boolean
  isStandalone: boolean
  isServiceWorkerReady: boolean
  installApp: () => Promise<boolean>
  updateServiceWorker: () => void
}

const PWAContext = createContext<PWAContextType>({
  isInstalled: false,
  isInstallable: false,
  isStandalone: false,
  isServiceWorkerReady: false,
  installApp: async () => false,
  updateServiceWorker: () => {},
})

export function usePWA() {
  return useContext(PWAContext)
}

interface PWAProviderProps {
  children: ReactNode
  /**
   * Si es true, muestra el indicador de conexión
   */
  showConnectionStatus?: boolean
  /**
   * Posición del banner de conexión
   */
  connectionStatusPosition?: 'top' | 'bottom'
}

export function PWAProvider({
  children,
  showConnectionStatus = true,
  connectionStatusPosition = 'top',
}: PWAProviderProps) {
  const [isInstalled, setIsInstalled] = useState(false)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  // Detectar si está en modo standalone (instalado como PWA)
  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')

      setIsStandalone(isStandaloneMode)
      setIsInstalled(isStandaloneMode)
    }

    checkStandalone()

    // Listener para cambios de display-mode
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    mediaQuery.addEventListener('change', checkStandalone)

    return () => mediaQuery.removeEventListener('change', checkStandalone)
  }, [])

  // Registrar Service Worker
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('[PWA] Service Worker no soportado')
      return
    }

    const registerSW = async () => {
      try {
        // El registro lo hace automáticamente @ducanh2912/next-pwa
        // pero verificamos que esté activo
        const reg = await navigator.serviceWorker.ready
        setRegistration(reg)
        setIsServiceWorkerReady(true)
        console.log('[PWA] Service Worker listo:', reg.scope)

        // Escuchar actualizaciones del SW
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] Nueva versión disponible')
                // Aquí podrías mostrar un toast para actualizar
              }
            })
          }
        })
      } catch (error) {
        console.error('[PWA] Error al verificar Service Worker:', error)
      }
    }

    registerSW()

    // Escuchar mensajes del SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[PWA] Service Worker actualizado')
      }
    })
  }, [])

  // Capturar evento de instalación
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setIsInstallable(true)
      console.log('[PWA] App instalable')
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setDeferredPrompt(null)
      console.log('[PWA] App instalada')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // Función para instalar la app
  const installApp = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.log('[PWA] No hay prompt de instalación disponible')
      return false
    }

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        console.log('[PWA] Usuario aceptó instalar')
        setDeferredPrompt(null)
        setIsInstallable(false)
        return true
      } else {
        console.log('[PWA] Usuario rechazó instalar')
        return false
      }
    } catch (error) {
      console.error('[PWA] Error al mostrar prompt:', error)
      return false
    }
  }, [deferredPrompt])

  // Función para actualizar el SW
  const updateServiceWorker = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    }
  }, [registration])

  const value: PWAContextType = {
    isInstalled,
    isInstallable,
    isStandalone,
    isServiceWorkerReady,
    installApp,
    updateServiceWorker,
  }

  return (
    <PWAContext.Provider value={value}>
      {showConnectionStatus && (
        <ConnectionStatus position={connectionStatusPosition} />
      )}
      {children}
    </PWAContext.Provider>
  )
}

export default PWAProvider
