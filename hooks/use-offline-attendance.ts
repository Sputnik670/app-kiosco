/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📱 USE OFFLINE ATTENDANCE - Hook para fichaje con soporte offline
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Hook que permite registrar entrada/salida (fichaje) tanto online como offline.
 * Cuando está offline:
 * - Guarda fichajes pendientes localmente en IndexedDB
 * - Sincroniza automáticamente al reconectar
 *
 * USO:
 * ```tsx
 * const {
 *   saveAttendanceOffline,
 *   pendingCount,
 *   isOffline,
 *   syncNow
 * } = useOfflineAttendance({ sucursalId, organizationId })
 * ```
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useOnlineStatus } from './use-online-status'
import { offlineDB, generateLocalId, STORES, type AsistenciaPendiente } from '@/lib/offline/indexed-db'
import type { SyncStatus } from '@/types/app.types'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

export interface UseOfflineAttendanceOptions {
  sucursalId: string
  organizationId: string
  userId?: string
  /**
   * Callback cuando cambia el conteo de pendientes
   */
  onPendingCountChange?: (count: number) => void
  /**
   * Callback cuando cambia el estado de sincronización
   */
  onSyncStatusChange?: (status: SyncStatus) => void
}

export interface UseOfflineAttendanceReturn {
  // Guardar fichaje
  saveAttendanceOffline: (
    tipo: 'entrada' | 'salida',
    attendanceId?: string
  ) => Promise<{ success: boolean; error?: string }>

  // Estado de conexión
  isOffline: boolean

  // Fichajes pendientes
  pendingCount: number
  pendingAttendances: AsistenciaPendiente[]

  // Sincronización
  syncStatus: SyncStatus
  lastSyncAt: Date | null
  syncNow: () => Promise<void>
}

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

const SYNC_DEBOUNCE_MS = 2000 // Esperar 2s después de reconectar antes de sincronizar

// ───────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────

export function useOfflineAttendance(
  options: UseOfflineAttendanceOptions
): UseOfflineAttendanceReturn {
  const { sucursalId, organizationId, userId, onPendingCountChange, onSyncStatusChange } =
    options

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
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingAttendances, setPendingAttendances] = useState<AsistenciaPendiente[]>([])
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
  const [currentAttendanceId, setCurrentAttendanceId] = useState<string | null>(null)

  // ─────────────────────────────────────────────────────────────────────────────
  // EFECTOS
  // ─────────────────────────────────────────────────────────────────────────────

  // Cargar fichajes pendientes al montar
  useEffect(() => {
    loadPendingAttendances()
  }, [])

  // Notificar cambios de pendingCount
  useEffect(() => {
    onPendingCountChange?.(pendingCount)
  }, [pendingCount, onPendingCountChange])

  // Notificar cambios de syncStatus
  useEffect(() => {
    onSyncStatusChange?.(syncStatus)
  }, [syncStatus, onSyncStatusChange])

  // Escuchar mensajes del Service Worker (sync completado en background)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const handleSWMessage = (event: MessageEvent) => {
      const { type } = event.data || {}
      if (type === 'ATTENDANCE_SYNC_COMPLETE') {
        // El SW sincronizó fichajes — recargar estado
        loadPendingAttendances()
      }
    }

    navigator.serviceWorker.addEventListener('message', handleSWMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // FUNCIONES AUXILIARES
  // ─────────────────────────────────────────────────────────────────────────────

  const loadPendingAttendances = async () => {
    try {
      // Recover stuck 'syncing' attendances (app was closed mid-sync)
      const allAttendances = await offlineDB.getAsistenciasPendientes()
      for (const a of allAttendances) {
        if (a.estado === 'syncing') {
          await offlineDB.put(STORES.ASISTENCIA_PENDIENTE, {
            ...a,
            estado: 'pending' as const,
            intentos: Math.max(0, a.intentos - 1),
          })
        }
      }

      const attendances = await offlineDB.getAsistenciasParaSincronizar()
      setPendingAttendances(attendances)
      setPendingCount(attendances.length)
    } catch (error) {
      console.error('Error cargando fichajes pendientes:', error)
    }
  }

  const scheduleSyncAfterReconnect = () => {
    // Cancelar timeout anterior si existe
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    // Programar sincronización
    syncTimeoutRef.current = setTimeout(() => {
      syncPendingAttendances()
    }, SYNC_DEBOUNCE_MS)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GUARDAR FICHAJE OFFLINE
  // ─────────────────────────────────────────────────────────────────────────────

  const saveAttendanceOffline = useCallback(
    async (
      tipo: 'entrada' | 'salida',
      attendanceId?: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const localId = generateLocalId()

        const asistenciaPendiente: AsistenciaPendiente = {
          id: localId,
          organization_id: organizationId,
          branch_id: sucursalId,
          user_id: userId || '',
          tipo,
          timestamp: Date.now(), // Usar timestamp local actual
          // Para salidas: guardar el ID del registro activo
          attendance_id: attendanceId || null,
          // Estado de sync
          estado: 'pending',
          intentos: 0,
          ultimo_intento: null,
          ultimo_error: null,
          // Resultado de sync
          synced_at: null,
          created_at: Date.now(),
        }

        await offlineDB.saveAsistenciaPendiente(asistenciaPendiente)

        // Si es entrada, guardar el ID para la salida
        if (tipo === 'entrada') {
          setCurrentAttendanceId(localId)
        }

        // Recargar lista de pendientes
        await loadPendingAttendances()

        return { success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
        return {
          success: false,
          error: errorMessage,
        }
      }
    },
    [organizationId, sucursalId, userId]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // SINCRONIZACIÓN
  // ─────────────────────────────────────────────────────────────────────────────

  const syncPendingAttendances = useCallback(async () => {
    if (!isOnline) {
      console.log('No se puede sincronizar asistencia: sin conexión')
      return
    }

    setSyncStatus('syncing')

    try {
      // Mandar mensaje al SW para sincronizar
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        const channel = new MessageChannel()

        const syncPromise = new Promise<void>((resolve) => {
          channel.port1.onmessage = (event) => {
            if (event.data?.success || event.data?.type === 'ATTENDANCE_SYNC_COMPLETE') {
              resolve()
            }
          }
        })

        registration.active?.postMessage(
          { type: 'FORCE_SYNC_ATTENDANCE' },
          [channel.port2]
        )

        // Wait con timeout de 10 segundos
        await Promise.race([
          syncPromise,
          new Promise<void>((resolve) => setTimeout(resolve, 10000)),
        ])
      }

      // Recargar lista
      await loadPendingAttendances()

      // Actualizar estado
      setLastSyncAt(new Date())
      setSyncStatus('success')

      // Volver a idle después de 3 segundos
      setTimeout(() => {
        setSyncStatus('idle')
      }, 3000)

      console.log('[Attendance] Sincronización completada')
    } catch (error) {
      console.error('[Attendance] Error en sincronización:', error)
      setSyncStatus('error')

      // Volver a idle después de 3 segundos
      setTimeout(() => {
        setSyncStatus('idle')
      }, 3000)
    }
  }, [isOnline])

  const syncNow = useCallback(async () => {
    await syncPendingAttendances()
  }, [syncPendingAttendances])

  // ─────────────────────────────────────────────────────────────────────────────
  // BACKGROUND SYNC REGISTRATION & BEFOREUNLOAD
  // ─────────────────────────────────────────────────────────────────────────────

  const registerBackgroundSync = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready
        // Background Sync API — not in all TS lib types yet
        await (registration as ServiceWorkerRegistration & {
          sync: { register: (tag: string) => Promise<void> }
        }).sync.register('sync-asistencia')
      }
    } catch (error) {
      // Background Sync no soportado o falló - no es crítico
      console.warn('Background Sync no disponible:', error)
    }
  }, [])

  // Registrar Background Sync cuando hay fichajes pendientes y estamos offline
  useEffect(() => {
    if (pendingCount > 0 && !isOnline) {
      registerBackgroundSync()
    }
  }, [pendingCount, isOnline, registerBackgroundSync])

  // Proteger datos al cerrar la app: registrar Background Sync
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingCount > 0) {
        registerBackgroundSync()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [pendingCount, registerBackgroundSync])

  // Sincronizar al volver de pestaña inactiva (visibilitychange)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isOnline) {
        loadPendingAttendances()
        if (pendingCount > 0) {
          scheduleSyncAfterReconnect()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isOnline, pendingCount])

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
  // RETURN
  // ─────────────────────────────────────────────────────────────────────────────

  return {
    // Guardar fichaje
    saveAttendanceOffline,

    // Estado de conexión
    isOffline: !isOnline,

    // Fichajes pendientes
    pendingCount,
    pendingAttendances,

    // Sincronización
    syncStatus,
    lastSyncAt,
    syncNow,
  }
}

export default useOfflineAttendance
