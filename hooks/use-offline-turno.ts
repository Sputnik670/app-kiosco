/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 💼 USE OFFLINE TURNO - Hook para turno con soporte offline
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Hook que permite acceder al estado del turno (caja diaria) tanto online como offline.
 * Cuando está offline:
 * - Muestra el turno desde cache local (IndexedDB)
 * - Permite al empleado vender si hay un turno abierto
 * - Sincroniza automáticamente al reconectar
 *
 * USO:
 * ```tsx
 * const {
 *   turno,
 *   isFromCache,
 *   refreshTurno,
 *   canOperateOffline,
 *   hasTurnoAbierto,
 * } = useOfflineTurno({ sucursalId })
 * ```
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useOnlineStatus } from './use-online-status'
import { turnoCache } from '@/lib/offline/turno-cache-service'
import type { TurnoCacheado } from '@/lib/offline/indexed-db'
import { getActiveShiftAction } from '@/lib/actions/shift.actions'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

export interface UseOfflineTurnoOptions {
  sucursalId: string
  /**
   * Si es true, sincroniza turno al montar el hook
   */
  syncOnMount?: boolean
  /**
   * Callback cuando cambia el estado del turno
   */
  onTurnoChange?: (turno: TurnoCacheado | null) => void
}

export interface UseOfflineTurnoReturn {
  // Estado del turno
  turno: TurnoCacheado | null
  isLoading: boolean
  isFromCache: boolean

  // Acciones
  refreshTurno: () => Promise<void>

  // Estado de operación
  canOperateOffline: boolean
  hasTurnoAbierto: boolean
  lastSyncAt: Date | null

  // Indicador de conexión
  isOnline: boolean
}

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

const SYNC_DEBOUNCE_MS = 2000 // Esperar 2s después de reconectar antes de sincronizar

// ───────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────

export function useOfflineTurno(options: UseOfflineTurnoOptions): UseOfflineTurnoReturn {
  const {
    sucursalId,
    syncOnMount = true,
    onTurnoChange,
  } = options

  // Estado de conexión — pingServer: true para detección confiable
  const { isOnline } = useOnlineStatus({
    pingServer: true,
    pingInterval: 30000,
    onStatusChange: (status) => {
      // Cuando vuelve online, programar sincronización
      if (status.isOnline && !wasOnlineRef.current) {
        scheduleSyncAfterReconnect()
      }
      wasOnlineRef.current = status.isOnline
    },
  })

  // Referencias
  const wasOnlineRef = useRef(isOnline)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Estados locales
  const [turno, setTurno] = useState<TurnoCacheado | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFromCache, setIsFromCache] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)

  // ─────────────────────────────────────────────────────────────────────────────
  // EFECTOS
  // ─────────────────────────────────────────────────────────────────────────────

  // Cargar turno al montar
  useEffect(() => {
    loadTurno()
  }, [sucursalId])

  // Sincronizar turno al montar (si está online)
  useEffect(() => {
    if (syncOnMount && isOnline && sucursalId) {
      refreshTurno()
    }
  }, [sucursalId, isOnline, syncOnMount])

  // Notificar cambios de turno
  useEffect(() => {
    onTurnoChange?.(turno)
  }, [turno, onTurnoChange])

  // ─────────────────────────────────────────────────────────────────────────────
  // FUNCIONES AUXILIARES
  // ─────────────────────────────────────────────────────────────────────────────

  const loadTurno = async () => {
    try {
      setIsLoading(true)

      // Intentar desde servidor primero si estamos online
      if (isOnline) {
        const result = await getActiveShiftAction()
        if (result.success && result.shift) {
          // Mapear a formato cache
          const turnoCache: TurnoCacheado = {
            id: result.shift.id,
            branch_id: result.shift.branch_id,
            organization_id: result.shift.organization_id,
            opened_by: result.shift.opened_by,
            opened_at: result.shift.opened_at,
            initial_cash: Number(result.shift.opening_amount),
            status: 'open',
            cached_at: Date.now(),
          }
          setTurno(turnoCache)
          setIsFromCache(false)
          return
        }
      }

      // Fallback a cache
      const cached = await turnoCache.getTurnoActivo(sucursalId)
      if (cached) {
        setTurno(cached)
        setIsFromCache(true)
      } else {
        setTurno(null)
        setIsFromCache(false)
      }
    } catch (error) {
      console.error('Error cargando turno:', error)
      // Fallback silencioso a cache
      try {
        const cached = await turnoCache.getTurnoActivo(sucursalId)
        if (cached) {
          setTurno(cached)
          setIsFromCache(true)
        }
      } catch {
        // No hay cache disponible
        setTurno(null)
        setIsFromCache(false)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const scheduleSyncAfterReconnect = () => {
    // Cancelar timeout anterior si existe
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    // Programar sincronización
    syncTimeoutRef.current = setTimeout(() => {
      refreshTurno()
    }, SYNC_DEBOUNCE_MS)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ACCIONES PÚBLICAS
  // ─────────────────────────────────────────────────────────────────────────────

  const refreshTurno = useCallback(async () => {
    if (!isOnline) {
      console.log('No se puede sincronizar turno: sin conexión')
      return
    }

    try {
      setIsLoading(true)

      const result = await turnoCache.syncFromServer(
        sucursalId,
        async () => {
          // Fetch turno desde el servidor
          const response = await getActiveShiftAction()
          if (response.success && response.shift) {
            return {
              id: response.shift.id,
              branch_id: response.shift.branch_id,
              organization_id: response.shift.organization_id,
              opened_by: response.shift.opened_by,
              opening_amount: response.shift.opening_amount,
              opened_at: response.shift.opened_at,
              is_open: true,
            }
          }
          return null
        },
        true // force
      )

      if (result.success) {
        setTurno(result.turno || null)
        setIsFromCache(false)
        setLastSyncAt(new Date())
      }
    } catch (error) {
      console.error('Error refrescando turno:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isOnline, sucursalId])

  // ─────────────────────────────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPUTADAS
  // ─────────────────────────────────────────────────────────────────────────────

  const hasTurnoAbierto = turno !== null && turno.status === 'open'
  const canOperateOffline = hasTurnoAbierto && isFromCache

  // ─────────────────────────────────────────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────────────────────────────────────────

  return {
    // Estado del turno
    turno,
    isLoading,
    isFromCache,

    // Acciones
    refreshTurno,

    // Estado de operación
    canOperateOffline,
    hasTurnoAbierto,
    lastSyncAt,

    // Indicador de conexión
    isOnline,
  }
}

export default useOfflineTurno
