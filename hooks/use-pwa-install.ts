'use client'

import { useEffect, useState, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface UsePWAInstallReturn {
  canInstall: boolean
  isInstalled: boolean
  isIOS: boolean
  isDismissed: boolean
  installApp: () => Promise<boolean>
  dismissPrompt: () => void
}

/**
 * Hook que gestiona el prompt de instalación PWA
 *
 * - Captura el evento beforeinstallprompt
 * - Permite instalar la app
 * - Detecta iOS y modo standalone
 * - Persiste preferencia de "dismiss"
 */
export function usePWAInstall(): UsePWAInstallReturn {
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  const DISMISS_KEY = 'kiosco-pwa-install-dismissed'

  // Detectar iOS
  useEffect(() => {
    const checkIOS = () => {
      const ua = navigator.userAgent
      const isAppleDevice = /iPad|iPhone|iPod/.test(ua)
      const isWebKit = /WebKit/.test(ua) && !/Chrome/.test(ua)
      setIsIOS(isAppleDevice && isWebKit)
    }

    checkIOS()
  }, [])

  // Detectar si ya está instalado
  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')

      setIsInstalled(isStandalone)

      // Si ya está instalado, limpiar dismiss
      if (isStandalone) {
        localStorage.removeItem(DISMISS_KEY)
      }
    }

    checkInstalled()

    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    mediaQuery.addEventListener('change', checkInstalled)

    return () => mediaQuery.removeEventListener('change', checkInstalled)
  }, [])

  // Cargar estado de dismiss desde localStorage
  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY) === 'true'
    setIsDismissed(dismissed)
  }, [])

  // Capturar evento beforeinstallprompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setCanInstall(true)
      console.log('[PWA] beforeinstallprompt capturado')
    }

    const handleAppInstalled = () => {
      setCanInstall(false)
      setIsInstalled(true)
      setDeferredPrompt(null)
      localStorage.removeItem(DISMISS_KEY)
      console.log('[PWA] App instalada')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const installApp = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.log('[PWA] No hay prompt disponible')
      return false
    }

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        console.log('[PWA] Usuario aceptó instalar')
        setCanInstall(false)
        setDeferredPrompt(null)
        localStorage.removeItem(DISMISS_KEY)
        return true
      } else {
        console.log('[PWA] Usuario rechazó instalar')
        // Si rechaza, no marcar como dismiss automáticamente
        return false
      }
    } catch (error) {
      console.error('[PWA] Error al instalar:', error)
      return false
    }
  }, [deferredPrompt])

  const dismissPrompt = useCallback(() => {
    setIsDismissed(true)
    localStorage.setItem(DISMISS_KEY, 'true')
    console.log('[PWA] Prompt dismissed')
  }, [])

  return {
    canInstall,
    isInstalled,
    isIOS,
    isDismissed,
    installApp,
    dismissPrompt,
  }
}
