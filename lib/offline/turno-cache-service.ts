/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 💼 TURNO CACHE SERVICE - Cache de turnos para modo offline
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Servicio para mantener turnos (cash registers) cacheados localmente y permitir:
 * - Lectura del estado del turno (abierto/cerrado) sin internet
 * - Sincronización automática cuando hay conexión
 * - Validación de si el empleado puede operar sin conexión
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { offlineDB, type TurnoCacheado } from './indexed-db'

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Tiempo de vida del cache en milisegundos (30 minutos)
 */
const CACHE_TTL_MS = 30 * 60 * 1000

/**
 * Intervalo mínimo entre sincronizaciones (5 minutos)
 */
const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Turno del servidor (schema V2: cash_registers)
 */
export interface TurnoFromServer {
  id: string
  branch_id: string
  organization_id: string
  opened_by: string
  opening_amount: number
  opened_at: string
  is_open: boolean
  closed_at?: string | null
}

/**
 * Estado del cache de turnos
 */
export interface TurnoCacheStatus {
  branchId: string
  turnoActivo: TurnoCacheado | null
  lastSyncAt: number | null
  isStale: boolean
  isSyncing: boolean
}

/**
 * Resultado de sincronización de turno
 */
export interface SyncTurnoResult {
  success: boolean
  turno?: TurnoCacheado
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// CLASE PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────

class TurnoCacheService {
  private syncingFor: Set<string> = new Set()
  private syncPromises: Map<string, Promise<void>> = new Map()

  /**
   * Verifica si el cache está disponible (cliente con IndexedDB)
   */
  isAvailable(): boolean {
    return offlineDB.isAvailable()
  }

  /**
   * Verifica si el cache de una sucursal está obsoleto
   */
  async isCacheStale(branchId: string): Promise<boolean> {
    const lastSync = await offlineDB.getMetadata(`turno-sync-${branchId}`)
    if (!lastSync) return true

    const age = Date.now() - (lastSync.value as number)
    return age > CACHE_TTL_MS
  }

  /**
   * Verifica si podemos sincronizar (respeta el intervalo mínimo)
   */
  async canSync(branchId: string): Promise<boolean> {
    if (this.syncingFor.has(branchId)) {
      return false
    }

    const lastSync = await offlineDB.getMetadata(`turno-sync-${branchId}`)
    if (!lastSync) return true

    const timeSinceLastSync = Date.now() - (lastSync.value as number)
    return timeSinceLastSync >= MIN_SYNC_INTERVAL_MS
  }

  /**
   * Sincroniza el turno activo desde el servidor al cache local
   *
   * @param branchId - ID de la sucursal
   * @param fetchFn - Función para obtener turno del servidor
   * @param force - Forzar sincronización ignorando intervalo mínimo
   */
  async syncFromServer(
    branchId: string,
    fetchFn: () => Promise<TurnoFromServer | null>,
    force: boolean = false
  ): Promise<SyncTurnoResult> {
    // Verificar si ya estamos sincronizando
    if (this.syncingFor.has(branchId)) {
      // Esperar la sincronización en curso
      const existingPromise = this.syncPromises.get(branchId)
      if (existingPromise) {
        await existingPromise
      }
      const cached = await offlineDB.getTurnoActivo(branchId)
      return { success: true, turno: cached }
    }

    // Verificar intervalo mínimo
    if (!force && !(await this.canSync(branchId))) {
      const cached = await offlineDB.getTurnoActivo(branchId)
      return { success: true, turno: cached }
    }

    // Marcar como sincronizando
    this.syncingFor.add(branchId)

    const syncPromise = (async () => {
      try {
        // Obtener turno del servidor
        const turno = await fetchFn()

        if (turno) {
          // Convertir a formato cache
          const turnoCache: TurnoCacheado = {
            id: turno.id,
            branch_id: turno.branch_id,
            organization_id: turno.organization_id,
            opened_by: turno.opened_by,
            opened_at: turno.opened_at,
            initial_cash: Number(turno.opening_amount),
            status: turno.is_open ? 'open' : 'closed',
            cached_at: Date.now(),
          }

          // Guardar o actualizar turno
          await offlineDB.saveTurnoCache(turnoCache)
        } else {
          // No hay turno activo — limpiar cache
          await offlineDB.clearTurnosBySucursal(branchId)
        }

        // Actualizar timestamp de sync
        await offlineDB.setMetadata(`turno-sync-${branchId}`, Date.now())

        return { success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
        return { success: false, error: errorMessage }
      } finally {
        this.syncingFor.delete(branchId)
        this.syncPromises.delete(branchId)
      }
    })()

    this.syncPromises.set(branchId, syncPromise.then(() => {}))

    const result = await syncPromise
    if (result.success) {
      const cached = await offlineDB.getTurnoActivo(branchId)
      return { success: true, turno: cached }
    }

    return result
  }

  /**
   * Obtiene el turno activo de una sucursal desde cache
   * Retorna null si no hay turno abierto
   */
  async getTurnoActivo(branchId: string): Promise<TurnoCacheado | null> {
    const turno = await offlineDB.getTurnoActivo(branchId)
    return turno || null
  }

  /**
   * Verifica si hay un turno abierto en el cache
   */
  async hasTurnoAbierto(branchId: string): Promise<boolean> {
    const turno = await this.getTurnoActivo(branchId)
    return turno !== null && turno.status === 'open'
  }

  /**
   * Obtiene el estado del cache para una sucursal
   */
  async getStatus(branchId: string): Promise<TurnoCacheStatus> {
    const turnoActivo = await this.getTurnoActivo(branchId)
    const lastSyncMeta = await offlineDB.getMetadata(`turno-sync-${branchId}`)
    const lastSyncAt = lastSyncMeta ? (lastSyncMeta.value as number) : null
    const isStale = await this.isCacheStale(branchId)
    const isSyncing = this.syncingFor.has(branchId)

    return {
      branchId,
      turnoActivo,
      lastSyncAt,
      isStale,
      isSyncing,
    }
  }

  /**
   * Invalida el cache de una sucursal (fuerza re-sync en próxima búsqueda)
   */
  async invalidate(branchId: string): Promise<void> {
    await offlineDB.clearTurnosBySucursal(branchId)
    // También limpiamos el timestamp para forzar re-sync
    await offlineDB.setMetadata(`turno-sync-${branchId}`, 0)
  }

  /**
   * Limpia todo el cache de turnos
   */
  async clearAll(): Promise<void> {
    await offlineDB.clearAllTurnoCache()
  }

  /**
   * Actualiza el estado de un turno en cache (cuando se cierra desde otro dispositivo)
   */
  async updateTurnoStatus(
    turnoId: string,
    status: 'open' | 'closed'
  ): Promise<void> {
    await offlineDB.updateTurnoCache(turnoId, { status })
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Instancia singleton del servicio de cache de turnos
 */
export const turnoCache = new TurnoCacheService()
