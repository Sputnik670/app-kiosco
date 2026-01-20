/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🌐 USE ONLINE STATUS HOOK
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Hook para detectar el estado de conexión a internet en tiempo real.
 * Útil para:
 * - Mostrar indicador de conexión en el header
 * - Habilitar/deshabilitar funcionalidades que requieren internet
 * - Preparar el sistema para modo offline
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use client'

import { useState, useEffect, useCallback } from 'react'

export interface OnlineStatus {
  isOnline: boolean
  wasOffline: boolean // true si estuvo offline en algún momento de la sesión
  lastOnlineAt: Date | null
  lastOfflineAt: Date | null
  connectionType: string | null
  effectiveType: string | null // 4g, 3g, 2g, slow-2g
  downlink: number | null // Mbps
}

export interface UseOnlineStatusOptions {
  /**
   * Si es true, hace ping al servidor para verificar conectividad real
   * (no solo estado del navegador)
   */
  pingServer?: boolean
  /**
   * URL para hacer ping (por defecto usa /api/health o favicon.ico)
   */
  pingUrl?: string
  /**
   * Intervalo de ping en ms (por defecto 30000 = 30s)
   */
  pingInterval?: number
  /**
   * Callback cuando cambia el estado de conexión
   */
  onStatusChange?: (status: OnlineStatus) => void
}

/**
 * Hook para monitorear el estado de conexión a internet
 *
 * @example
 * ```tsx
 * const { isOnline, connectionType } = useOnlineStatus()
 *
 * return (
 *   <div>
 *     {!isOnline && <OfflineBanner />}
 *   </div>
 * )
 * ```
 */
export function useOnlineStatus(options: UseOnlineStatusOptions = {}): OnlineStatus {
  const {
    pingServer = false,
    pingUrl = '/icon.svg',
    pingInterval = 30000,
    onStatusChange,
  } = options

  const [status, setStatus] = useState<OnlineStatus>(() => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    lastOnlineAt: null,
    lastOfflineAt: null,
    connectionType: null,
    effectiveType: null,
    downlink: null,
  }))

  // Obtener información de la conexión (Network Information API)
  const getConnectionInfo = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection
      return {
        connectionType: connection?.type || null,
        effectiveType: connection?.effectiveType || null,
        downlink: connection?.downlink || null,
      }
    }
    return {
      connectionType: null,
      effectiveType: null,
      downlink: null,
    }
  }, [])

  // Actualizar estado de conexión
  const updateStatus = useCallback((isOnline: boolean) => {
    setStatus(prev => {
      const connectionInfo = getConnectionInfo()
      const newStatus: OnlineStatus = {
        ...prev,
        ...connectionInfo,
        isOnline,
        wasOffline: prev.wasOffline || !isOnline,
        lastOnlineAt: isOnline ? new Date() : prev.lastOnlineAt,
        lastOfflineAt: !isOnline ? new Date() : prev.lastOfflineAt,
      }

      // Llamar callback si cambió el estado
      if (prev.isOnline !== isOnline && onStatusChange) {
        onStatusChange(newStatus)
      }

      return newStatus
    })
  }, [getConnectionInfo, onStatusChange])

  // Ping al servidor para verificar conectividad real
  const pingServerCheck = useCallback(async () => {
    if (!pingServer) return

    try {
      const response = await fetch(pingUrl, {
        method: 'HEAD',
        cache: 'no-store',
        mode: 'no-cors',
      })
      // Si llegamos aquí, hay conexión
      updateStatus(true)
    } catch {
      // Si falla el fetch, posiblemente estemos offline
      // Pero solo marcamos offline si navigator.onLine también dice que no hay conexión
      if (!navigator.onLine) {
        updateStatus(false)
      }
    }
  }, [pingServer, pingUrl, updateStatus])

  useEffect(() => {
    // Handlers para eventos online/offline
    const handleOnline = () => updateStatus(true)
    const handleOffline = () => updateStatus(false)

    // Agregar listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Listener para cambios en la conexión (Network Information API)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      connection?.addEventListener('change', () => {
        updateStatus(navigator.onLine)
      })
    }

    // Estado inicial
    updateStatus(navigator.onLine)

    // Ping periódico si está habilitado
    let pingIntervalId: NodeJS.Timeout | null = null
    if (pingServer) {
      pingServerCheck()
      pingIntervalId = setInterval(pingServerCheck, pingInterval)
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (pingIntervalId) {
        clearInterval(pingIntervalId)
      }
    }
  }, [updateStatus, pingServer, pingInterval, pingServerCheck])

  return status
}

/**
 * Hook simplificado que solo retorna isOnline
 */
export function useIsOnline(): boolean {
  const { isOnline } = useOnlineStatus()
  return isOnline
}

export default useOnlineStatus
