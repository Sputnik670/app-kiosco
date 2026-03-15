'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔄 UPDATE PROMPT
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Componente que notifica cuando hay una nueva versión del Service Worker
 * disponible. Permite actualizar la app sin recargar manualmente.
 *
 * Escucha:
 * - updatefound: Nueva versión siendo descargada
 * - controllerchange: Controlador cambió (actualización completada)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

interface UpdatePromptProps {
  /**
   * Auto-dismiss después de N ms (default: 10000 = 10s)
   */
  autoDismissDelay?: number
  /**
   * Callback cuando se actualiza
   */
  onUpdate?: () => void
}

export function UpdatePrompt({ autoDismissDelay = 10000, onUpdate }: UpdatePromptProps) {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    const handleServiceWorkerUpdate = async () => {
      try {
        const reg = await navigator.serviceWorker.ready

        // Escuchar cuando se instala una nueva versión
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              // Estado 'installed' significa que se descargó pero no está activo aún
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[UpdatePrompt] Nueva versión disponible')
                setRegistration(reg)
                setUpdateAvailable(true)

                // Auto-dismiss después del delay
                const timer = setTimeout(() => {
                  setUpdateAvailable(false)
                }, autoDismissDelay)

                return () => clearTimeout(timer)
              }
            })
          }
        })

        // Escuchar cambios de controlador (actualización completada)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[UpdatePrompt] Service Worker actualizado')
          setUpdateAvailable(false)
          onUpdate?.()
        })
      } catch (error) {
        console.error('[UpdatePrompt] Error configurando escuchadores:', error)
      }
    }

    handleServiceWorkerUpdate()
  }, [autoDismissDelay, onUpdate])

  const handleUpdate = async () => {
    if (!registration?.waiting) {
      console.log('[UpdatePrompt] No hay Worker esperando')
      return
    }

    setIsUpdating(true)

    try {
      // Decirle al SW que salte la espera (activate inmediatamente)
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })

      // Recargar la página cuando el nuevo SW esté activo
      const onControllerChange = () => {
        window.location.reload()
      }

      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, {
        once: true,
      })

      // Si pasan 3s y no se recargar, hacerlo manualmente
      setTimeout(() => {
        window.location.reload()
      }, 3000)
    } catch (error) {
      console.error('[UpdatePrompt] Error actualizando:', error)
      toast.error('Error al actualizar')
      setIsUpdating(false)
    }
  }

  if (!updateAvailable) {
    return null
  }

  // Mostrar como toast con acción
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm" key="update-prompt">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg shadow-lg p-4 flex items-center gap-3">
        <RefreshCw className="w-5 h-5 flex-shrink-0 animate-spin" />

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Nueva versión disponible</p>
          <p className="text-xs text-emerald-100 mt-0.5">
            {isUpdating ? 'Actualizando...' : 'Toca actualizar para obtener mejoras'}
          </p>
        </div>

        <button
          onClick={handleUpdate}
          disabled={isUpdating}
          className="flex-shrink-0 bg-white text-emerald-600 px-3 py-1 rounded font-semibold text-sm hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUpdating ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
    </div>
  )
}
