/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔄 SYNC MANAGER - Gestor de sincronización offline/online
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Gestiona la sincronización de ventas pendientes cuando el dispositivo
 * recupera la conexión a internet.
 *
 * CARACTERÍSTICAS:
 * - Sincronización automática al detectar reconexión
 * - Backoff exponencial para reintentos
 * - Eventos para notificar progreso
 * - Prevención de sincronizaciones duplicadas
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { offlineDB, type VentaPendiente, type VentaPendienteEstado } from './indexed-db'
import type { SyncStatus } from '@/types/app.types'

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Configuración de backoff exponencial
 */
const BACKOFF_CONFIG = {
  BASE_DELAY_MS: 1000,      // 1 segundo inicial
  MAX_DELAY_MS: 32000,      // 32 segundos máximo
  MAX_RETRIES: 5,           // Máximo de reintentos por venta
  MULTIPLIER: 2,            // Factor de multiplicación
}

/**
 * Delay después de reconectar antes de iniciar sync
 */
const RECONNECT_DELAY_MS = 2000

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

export interface SyncProgress {
  total: number
  completed: number
  failed: number
  current: string | null // ID de la venta actual
}

export interface SyncResult {
  success: boolean
  syncedCount: number
  failedCount: number
  errors: Array<{ ventaId: string; error: string }>
}

export interface SyncEventHandlers {
  onStart?: () => void
  onProgress?: (progress: SyncProgress) => void
  onComplete?: (result: SyncResult) => void
  onError?: (error: Error) => void
  onVentaSynced?: (venta: VentaPendiente, ventaIdServidor: string) => void
  onVentaFailed?: (venta: VentaPendiente, error: string) => void
}

export interface SyncManagerConfig {
  /**
   * URL del endpoint de sincronización
   */
  syncEndpoint: string
  /**
   * Handlers de eventos
   */
  handlers?: SyncEventHandlers
  /**
   * Si es true, sincroniza automáticamente al detectar online
   */
  autoSync?: boolean
}

// ───────────────────────────────────────────────────────────────────────────────
// CLASE PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────

class SyncManager {
  private config: SyncManagerConfig
  private isSyncing: boolean = false
  private status: SyncStatus = 'idle'
  private abortController: AbortController | null = null

  constructor(config: Partial<SyncManagerConfig> = {}) {
    this.config = {
      syncEndpoint: config.syncEndpoint || '/api/ventas/sync',
      autoSync: config.autoSync ?? true,
      handlers: config.handlers,
    }
  }

  /**
   * Obtiene el estado actual de sincronización
   */
  getStatus(): SyncStatus {
    return this.status
  }

  /**
   * Verifica si hay sincronización en curso
   */
  isSyncInProgress(): boolean {
    return this.isSyncing
  }

  /**
   * Calcula el delay con backoff exponencial
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay = Math.min(
      BACKOFF_CONFIG.BASE_DELAY_MS * Math.pow(BACKOFF_CONFIG.MULTIPLIER, attempt),
      BACKOFF_CONFIG.MAX_DELAY_MS
    )
    // Añadir jitter para evitar thundering herd
    const jitter = Math.random() * 0.3 * delay
    return Math.floor(delay + jitter)
  }

  /**
   * Espera un tiempo determinado
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Sincroniza una venta individual al servidor
   */
  private async syncVenta(venta: VentaPendiente): Promise<{ success: boolean; ventaId?: string; error?: string }> {
    try {
      const response = await fetch(this.config.syncEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          localId: venta.id,
          sucursalId: venta.sucursal_id,
          turnoId: venta.turno_id,
          organizationId: venta.organization_id,
          items: venta.items,
          metodoPago: venta.metodo_pago,
          montoTotal: venta.monto_total,
          vendedorId: venta.vendedor_id,
          createdAt: venta.created_at,
        }),
        signal: this.abortController?.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        }
      }

      const result = await response.json()
      return result
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: 'Sincronización cancelada' }
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error de red',
      }
    }
  }

  /**
   * Sincroniza todas las ventas pendientes
   */
  async syncAll(): Promise<SyncResult> {
    // Prevenir sincronizaciones duplicadas
    if (this.isSyncing) {
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errors: [{ ventaId: '', error: 'Sincronización ya en curso' }],
      }
    }

    this.isSyncing = true
    this.status = 'syncing'
    this.abortController = new AbortController()

    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: [],
    }

    try {
      // Obtener ventas pendientes
      const ventasPendientes = await offlineDB.getVentasParaSincronizar()

      if (ventasPendientes.length === 0) {
        this.status = 'success'
        return result
      }

      // Notificar inicio
      this.config.handlers?.onStart?.()

      const progress: SyncProgress = {
        total: ventasPendientes.length,
        completed: 0,
        failed: 0,
        current: null,
      }

      // Procesar cada venta secuencialmente
      for (const venta of ventasPendientes) {
        // Verificar si se canceló
        if (this.abortController.signal.aborted) {
          break
        }

        // Verificar límite de reintentos
        if (venta.intentos >= BACKOFF_CONFIG.MAX_RETRIES) {
          progress.failed++
          result.failedCount++
          result.errors.push({
            ventaId: venta.id,
            error: `Máximo de reintentos (${BACKOFF_CONFIG.MAX_RETRIES}) alcanzado`,
          })
          continue
        }

        progress.current = venta.id
        this.config.handlers?.onProgress?.(progress)

        // Marcar como sincronizando
        await offlineDB.updateVentaEstado(venta.id, 'syncing')

        // Calcular delay si es reintento
        if (venta.intentos > 0) {
          const backoffDelay = this.calculateBackoffDelay(venta.intentos)
          await this.delay(backoffDelay)
        }

        // Intentar sincronizar
        const syncResult = await this.syncVenta(venta)

        if (syncResult.success && syncResult.ventaId) {
          // Éxito
          await offlineDB.updateVentaEstado(venta.id, 'synced', {
            venta_id_servidor: syncResult.ventaId,
            synced_at: Date.now(),
          })

          progress.completed++
          result.syncedCount++

          this.config.handlers?.onVentaSynced?.(venta, syncResult.ventaId)
        } else {
          // Error
          const errorMessage = syncResult.error || 'Error desconocido'

          await offlineDB.updateVentaEstado(venta.id, 'failed', {
            ultimo_error: errorMessage,
          })

          progress.failed++
          result.failedCount++
          result.errors.push({
            ventaId: venta.id,
            error: errorMessage,
          })

          this.config.handlers?.onVentaFailed?.(venta, errorMessage)
        }

        this.config.handlers?.onProgress?.(progress)
      }

      // Limpiar ventas sincronizadas
      await offlineDB.clearVentasSincronizadas()

      // Determinar estado final
      result.success = result.failedCount === 0
      this.status = result.success ? 'success' : 'error'

      // Notificar completado
      this.config.handlers?.onComplete?.(result)

      return result
    } catch (error) {
      this.status = 'error'
      const errorInstance = error instanceof Error ? error : new Error('Error desconocido')
      this.config.handlers?.onError?.(errorInstance)

      return {
        success: false,
        syncedCount: result.syncedCount,
        failedCount: result.failedCount,
        errors: [...result.errors, { ventaId: '', error: errorInstance.message }],
      }
    } finally {
      this.isSyncing = false
      this.abortController = null
    }
  }

  /**
   * Cancela la sincronización en curso
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
  }

  /**
   * Reintenta las ventas fallidas (resetea el contador de intentos)
   */
  async retryFailed(): Promise<void> {
    const ventasConError = await offlineDB.getVentasByEstado('failed')

    for (const venta of ventasConError) {
      // Resetear a pendiente para nuevo intento
      await offlineDB.put('ventas-pendientes', {
        ...venta,
        estado: 'pending' as VentaPendienteEstado,
        intentos: 0,
        ultimo_error: null,
      })
    }
  }

  /**
   * Obtiene estadísticas de ventas pendientes
   */
  async getStats(): Promise<{
    pendientes: number
    sincronizando: number
    errores: number
    sincronizadas: number
  }> {
    const todas = await offlineDB.getVentasPendientes()

    return {
      pendientes: todas.filter((v) => v.estado === 'pending').length,
      sincronizando: todas.filter((v) => v.estado === 'syncing').length,
      errores: todas.filter((v) => v.estado === 'failed').length,
      sincronizadas: todas.filter((v) => v.estado === 'synced').length,
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTION
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Crea una instancia del SyncManager
 */
export function createSyncManager(config?: Partial<SyncManagerConfig>): SyncManager {
  return new SyncManager({
    syncEndpoint: '/api/ventas/sync',
    autoSync: true,
    ...config,
  })
}

/**
 * Instancia singleton por defecto
 */
let defaultSyncManager: SyncManager | null = null

/**
 * Obtiene la instancia singleton del SyncManager
 */
export function getSyncManager(): SyncManager {
  if (!defaultSyncManager) {
    defaultSyncManager = createSyncManager()
  }
  return defaultSyncManager
}

export { SyncManager }
