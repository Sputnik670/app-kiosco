/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🌐 CONNECTION STATUS INDICATOR
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Componente que muestra el estado de conexión a internet.
 * Se muestra como un banner discreto cuando hay problemas de conexión.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use client'

import { useOnlineStatus } from '@/hooks/use-online-status'
import { Wifi, WifiOff, AlertTriangle, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ConnectionStatusProps {
  /**
   * Si es true, siempre muestra el estado (incluso cuando está online)
   */
  alwaysShow?: boolean
  /**
   * Posición del indicador
   */
  position?: 'top' | 'bottom'
  /**
   * Variante del indicador
   */
  variant?: 'banner' | 'badge' | 'minimal'
}

export function ConnectionStatus({
  alwaysShow = false,
  position = 'top',
  variant = 'banner',
}: ConnectionStatusProps) {
  const { isOnline, wasOffline, effectiveType, lastOfflineAt } = useOnlineStatus({
    onStatusChange: (status) => {
      // Log para debugging
      console.log('[Connection]', status.isOnline ? 'Online' : 'Offline')
    },
  })

  const [showReconnected, setShowReconnected] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  // Mostrar mensaje de reconexión temporal
  useEffect(() => {
    if (isOnline && wasOffline && lastOfflineAt) {
      setShowReconnected(true)
      const timeout = setTimeout(() => {
        setShowReconnected(false)
      }, 3000)
      return () => clearTimeout(timeout)
    }
  }, [isOnline, wasOffline, lastOfflineAt])

  // Controlar visibilidad con animación
  useEffect(() => {
    if (!isOnline || showReconnected || alwaysShow) {
      setIsVisible(true)
    } else {
      const timeout = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timeout)
    }
  }, [isOnline, showReconnected, alwaysShow])

  // No mostrar si está online y no hay mensaje de reconexión
  if (!isVisible && !alwaysShow) {
    return null
  }

  // Determinar color según conexión
  const getConnectionQuality = () => {
    if (!isOnline) return 'offline'
    if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'slow'
    if (effectiveType === '3g') return 'moderate'
    return 'good'
  }

  const quality = getConnectionQuality()

  // Variante Minimal (solo un punto)
  if (variant === 'minimal') {
    return (
      <div
        className={`
          w-2 h-2 rounded-full transition-all duration-300
          ${quality === 'offline' ? 'bg-red-500 animate-pulse' : ''}
          ${quality === 'slow' ? 'bg-yellow-500' : ''}
          ${quality === 'moderate' ? 'bg-yellow-400' : ''}
          ${quality === 'good' ? 'bg-green-500' : ''}
        `}
        title={isOnline ? 'Conectado' : 'Sin conexión'}
      />
    )
  }

  // Variante Badge (pequeño badge)
  if (variant === 'badge') {
    return (
      <div
        className={`
          inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
          transition-all duration-300
          ${!isOnline ? 'bg-red-500/20 text-red-400' : ''}
          ${showReconnected ? 'bg-green-500/20 text-green-400' : ''}
          ${isOnline && !showReconnected ? 'bg-green-500/20 text-green-400' : ''}
        `}
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-3 h-3" />
            <span>Offline</span>
          </>
        ) : showReconnected ? (
          <>
            <Wifi className="w-3 h-3" />
            <span>Reconectado</span>
          </>
        ) : (
          <>
            <Wifi className="w-3 h-3" />
            <span>Online</span>
          </>
        )}
      </div>
    )
  }

  // Variante Banner (completo)
  return (
    <div
      className={`
        fixed left-0 right-0 z-50 transition-all duration-300 ease-out
        ${position === 'top' ? 'top-0' : 'bottom-0'}
        ${!isOnline || showReconnected ? 'translate-y-0 opacity-100' :
          position === 'top' ? '-translate-y-full opacity-0' : 'translate-y-full opacity-0'}
      `}
    >
      <div
        className={`
          flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium
          ${!isOnline ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}
        `}
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4" />
            <span>Sin conexión a internet</span>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded text-xs hover:bg-white/30 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Reintentar
            </button>
          </>
        ) : showReconnected ? (
          <>
            <Wifi className="w-4 h-4" />
            <span>Conexión restaurada</span>
          </>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Componente de punto de conexión para usar en headers
 */
export function ConnectionDot() {
  const { isOnline } = useOnlineStatus()

  return (
    <div
      className={`
        w-2 h-2 rounded-full transition-colors duration-300
        ${isOnline ? 'bg-green-500' : 'bg-red-500 animate-pulse'}
      `}
      title={isOnline ? 'Conectado' : 'Sin conexión'}
    />
  )
}

export default ConnectionStatus
