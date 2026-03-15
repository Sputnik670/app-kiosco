'use client'

import { useEffect, useState } from 'react'
import { usePWAInstall } from '@/hooks/use-pwa-install'
import { Button } from '@/components/ui/button'
import { Download, X, Share2 } from 'lucide-react'
import { toast } from 'sonner'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📱 INSTALL PROMPT
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Componente que muestra un banner inteligente para instalar la PWA:
 * - Android: Muestra prompt nativo
 * - iOS: Muestra instrucciones manuales
 * - No aparece si ya está instalada o si el usuario lo descartó
 * - Aparece después de 30 segundos de uso
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

interface InstallPromptProps {
  /**
   * Posición del banner (bottom = sticky footer, inline = dentro del flujo)
   */
  position?: 'bottom' | 'inline'
  /**
   * Delay en ms antes de mostrar el prompt (default: 30000 = 30s)
   */
  showDelay?: number
  /**
   * Callback cuando el usuario instala
   */
  onInstallSuccess?: () => void
}

export function InstallPrompt({
  position = 'bottom',
  showDelay = 30000,
  onInstallSuccess,
}: InstallPromptProps) {
  const { canInstall, isInstalled, isIOS, isDismissed, installApp, dismissPrompt } =
    usePWAInstall()

  const [showPrompt, setShowPrompt] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Mostrar prompt después del delay (solo si es posible instalar y no fue dismissed)
  useEffect(() => {
    if (isInstalled || isDismissed || !canInstall) {
      return
    }

    const timer = setTimeout(() => {
      setShowPrompt(true)
      console.log('[InstallPrompt] Mostrando prompt')
    }, showDelay)

    return () => clearTimeout(timer)
  }, [canInstall, isDismissed, isInstalled, showDelay])

  // Si ya está instalado o fue dismissed, no renderizar nada
  if (isInstalled || isDismissed || !canInstall || !showPrompt) {
    return null
  }

  const handleInstall = async () => {
    setIsLoading(true)
    try {
      const success = await installApp()
      if (success) {
        toast.success('Kiosco App instalada correctamente')
        setShowPrompt(false)
        onInstallSuccess?.()
      } else {
        toast.error('No se pudo instalar la app')
      }
    } catch (error) {
      console.error('Error instalando:', error)
      toast.error('Error al instalar la app')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDismiss = () => {
    dismissPrompt()
    setShowPrompt(false)
  }

  // ANDROID: Prompt nativo
  if (!isIOS) {
    return (
      <div
        className={`fixed left-0 right-0 z-40 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-4 shadow-lg transition-transform duration-300 ${
          position === 'bottom' ? 'bottom-0' : 'top-0'
        } safe-bottom`}
      >
        <div className="max-w-md mx-auto flex items-center gap-4">
          {/* Icono */}
          <div className="flex-shrink-0">
            <Download className="w-6 h-6" />
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Instalar Kiosco App</h3>
            <p className="text-xs text-indigo-100 line-clamp-1">
              Acceso rápido desde tu pantalla de inicio
            </p>
          </div>

          {/* Botones */}
          <div className="flex-shrink-0 flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="text-white hover:bg-indigo-700 h-9 px-3"
              disabled={isLoading}
            >
              <X className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleInstall}
              disabled={isLoading}
              className="bg-white text-indigo-600 hover:bg-indigo-50 h-9 px-4 font-semibold"
            >
              {isLoading ? 'Instalando...' : 'Instalar'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // iOS: Instrucciones manuales
  return (
    <div
      className={`fixed left-0 right-0 z-40 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-4 shadow-lg ${
        position === 'bottom' ? 'bottom-0' : 'top-0'
      } safe-bottom`}
    >
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Instalar Kiosco App</h3>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-indigo-700 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instrucciones iOS */}
        <div className="space-y-2 text-xs text-indigo-100">
          <p className="font-semibold text-white">Pasos:</p>
          <ol className="space-y-1 ml-4 list-decimal">
            <li>Tocá el botón Compartir</li>
            <li>Selecciona "Agregar a pantalla de inicio"</li>
            <li>Confirma con "Agregar"</li>
          </ol>

          {/* Botón para mostrar share sheet */}
          <button
            onClick={() => {
              if (navigator.share) {
                navigator
                  .share({
                    title: 'Kiosco App',
                    text: 'Sistema de gestión para kioscos',
                    url: window.location.href,
                  })
                  .catch((err) => {
                    if (err.name !== 'AbortError') {
                      toast.error('Error al compartir')
                    }
                  })
              }
            }}
            className="mt-2 w-full bg-white text-indigo-600 py-2 rounded font-semibold text-sm hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Mostrar opciones
          </button>
        </div>
      </div>
    </div>
  )
}
