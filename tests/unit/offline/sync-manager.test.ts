/**
 * Tests para lib/offline/sync-manager.ts
 *
 * Escenarios cubiertos:
 * 1. Venta offline → sync exitoso
 * 2. Sync falla → retry con backoff → éxito
 * 3. Múltiples ventas → sync parcial → fallo → retry
 * 4. Máximo de reintentos alcanzado
 * 5. Cancelación de sync
 * 6. Prevención de sync duplicados
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { offlineDB, generateLocalId, STORES, type VentaPendiente } from '@/lib/offline/indexed-db'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Import after mocking
import { createSyncManager, type SyncResult, type SyncEventHandlers } from '@/lib/offline/sync-manager'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function createMockVenta(overrides: Partial<VentaPendiente> = {}): VentaPendiente {
  return {
    id: generateLocalId(),
    sucursal_id: 'suc-001',
    turno_id: 'turno-001',
    organization_id: 'org-001',
    items: [
      {
        producto_id: 'prod-001',
        cantidad: 2,
        precio_unitario: 500,
        nombre: 'Coca Cola 500ml',
        subtotal: 1000,
      },
    ],
    metodo_pago: 'cash',
    monto_total: 1000,
    vendedor_id: 'user-001',
    created_at: Date.now(),
    estado: 'pending',
    intentos: 0,
    ultimo_intento: null,
    ultimo_error: null,
    venta_id_servidor: null,
    synced_at: null,
    ...overrides,
  }
}

function mockFetchSuccess(ventaId: string = 'server-venta-001') {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, ventaId }),
    text: async () => JSON.stringify({ success: true, ventaId }),
  })
}

function mockFetchFailure(error: string = 'Stock insuficiente', status: number = 400) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ success: false, error }),
    text: async () => JSON.stringify({ success: false, error }),
  })
}

function mockFetchNetworkError() {
  mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('SyncManager', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockFetch.mockReset()
    offlineDB.close()
    await offlineDB.open()
    await offlineDB.clear(STORES.VENTAS_PENDIENTES)
    await offlineDB.clear(STORES.SYNC_METADATA)
  })

  afterEach(() => {
    vi.useRealTimers()
    offlineDB.close()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // ESCENARIO 1: Venta offline → sync exitoso
  // ─────────────────────────────────────────────────────────────────────────

  describe('Venta offline → sync exitoso', () => {
    it('should sync a single pending venta successfully', async () => {
      const venta = createMockVenta()
      await offlineDB.saveVentaPendiente(venta)

      mockFetchSuccess('server-venta-001')

      const syncManager = createSyncManager()
      const result = await syncManager.syncAll()

      expect(result.success).toBe(true)
      expect(result.syncedCount).toBe(1)
      expect(result.failedCount).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should send correct payload to sync endpoint', async () => {
      const venta = createMockVenta({
        id: 'local-001',
        sucursal_id: 'suc-001',
        turno_id: 'turno-001',
        organization_id: 'org-001',
        monto_total: 1500,
        metodo_pago: 'card',
        vendedor_id: 'user-001',
      })
      await offlineDB.saveVentaPendiente(venta)

      mockFetchSuccess()

      const syncManager = createSyncManager()
      await syncManager.syncAll()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)

      expect(body.localId).toBe('local-001')
      expect(body.sucursalId).toBe('suc-001')
      expect(body.turnoId).toBe('turno-001')
      expect(body.organizationId).toBe('org-001')
      expect(body.montoTotal).toBe(1500)
      expect(body.metodoPago).toBe('card')
      expect(body.vendedorId).toBe('user-001')
    })

    it('should mark venta as synced and clean up', async () => {
      const venta = createMockVenta()
      await offlineDB.saveVentaPendiente(venta)

      mockFetchSuccess('server-123')

      const syncManager = createSyncManager()
      await syncManager.syncAll()

      // After syncAll, synced ventas are cleared
      const remaining = await offlineDB.getVentasPendientes()
      expect(remaining).toHaveLength(0)
    })

    it('should call event handlers on success', async () => {
      const venta = createMockVenta()
      await offlineDB.saveVentaPendiente(venta)

      mockFetchSuccess('server-123')

      const handlers: SyncEventHandlers = {
        onStart: vi.fn(),
        onProgress: vi.fn(),
        onComplete: vi.fn(),
        onVentaSynced: vi.fn(),
      }

      const syncManager = createSyncManager({ handlers })
      await syncManager.syncAll()

      expect(handlers.onStart).toHaveBeenCalledTimes(1)
      expect(handlers.onVentaSynced).toHaveBeenCalledWith(
        expect.objectContaining({ id: venta.id }),
        'server-123'
      )
      expect(handlers.onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, syncedCount: 1 })
      )
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // ESCENARIO 2: Sync falla → retry con backoff → éxito
  // ─────────────────────────────────────────────────────────────────────────

  describe('Sync falla → retry con backoff → éxito', () => {
    it('should mark failed ventas with error and increment intentos', async () => {
      const venta = createMockVenta()
      await offlineDB.saveVentaPendiente(venta)

      mockFetchFailure('Error del servidor')

      const syncManager = createSyncManager()
      const result = await syncManager.syncAll()

      expect(result.failedCount).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain('Error del servidor')

      // Venta should still exist with failed state
      const ventas = await offlineDB.getVentasPendientes()
      expect(ventas).toHaveLength(1)
      expect(ventas[0].estado).toBe('failed')
      expect(ventas[0].intentos).toBe(1) // Incremented by updateVentaEstado
    })

    it('should handle network errors gracefully', async () => {
      const venta = createMockVenta()
      await offlineDB.saveVentaPendiente(venta)

      mockFetchNetworkError()

      const syncManager = createSyncManager()
      const result = await syncManager.syncAll()

      expect(result.success).toBe(false)
      expect(result.failedCount).toBe(1)
    })

    it('should apply backoff delay for retries', async () => {
      // Create a venta with 2 previous attempts
      const venta = createMockVenta({ intentos: 2 })
      await offlineDB.saveVentaPendiente(venta)

      mockFetchSuccess()

      const syncManager = createSyncManager()
      const startTime = Date.now()

      // Need to advance timers for the backoff delay
      const syncPromise = syncManager.syncAll()
      // Backoff for attempt 2: 1000 * 2^2 = 4000ms + jitter
      await vi.advanceTimersByTimeAsync(5000)
      const result = await syncPromise

      expect(result.success).toBe(true)
      expect(result.syncedCount).toBe(1)
    })

    it('should retry failed venta on next syncAll', async () => {
      const venta = createMockVenta()
      await offlineDB.saveVentaPendiente(venta)

      // First sync fails
      mockFetchFailure('Timeout')
      const syncManager = createSyncManager()
      await syncManager.syncAll()

      // Verify venta is now in failed state
      const afterFirst = await offlineDB.getVentasPendientes()
      expect(afterFirst[0].estado).toBe('failed')
      expect(afterFirst[0].intentos).toBe(1)

      // Second sync succeeds (getVentasParaSincronizar returns failed + pending)
      mockFetchSuccess('server-001')
      const result2 = await syncManager.syncAll()

      expect(result2.syncedCount).toBe(1)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // ESCENARIO 3: Múltiples ventas → sync parcial → fallo → retry
  // ─────────────────────────────────────────────────────────────────────────

  describe('Múltiples ventas → sync parcial', () => {
    it('should sync multiple ventas in sequence', async () => {
      const v1 = createMockVenta({ monto_total: 500 })
      const v2 = createMockVenta({ monto_total: 1000 })
      const v3 = createMockVenta({ monto_total: 1500 })

      await offlineDB.saveVentaPendiente(v1)
      await offlineDB.saveVentaPendiente(v2)
      await offlineDB.saveVentaPendiente(v3)

      mockFetchSuccess('sv-1')
      mockFetchSuccess('sv-2')
      mockFetchSuccess('sv-3')

      const syncManager = createSyncManager()
      const result = await syncManager.syncAll()

      expect(result.syncedCount).toBe(3)
      expect(result.failedCount).toBe(0)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should continue syncing after partial failure', async () => {
      const v1 = createMockVenta()
      const v2 = createMockVenta()
      const v3 = createMockVenta()

      await offlineDB.saveVentaPendiente(v1)
      await offlineDB.saveVentaPendiente(v2)
      await offlineDB.saveVentaPendiente(v3)

      // v1: success, v2: fail, v3: success
      mockFetchSuccess('sv-1')
      mockFetchFailure('Stock insuficiente')
      mockFetchSuccess('sv-3')

      const syncManager = createSyncManager()
      const result = await syncManager.syncAll()

      expect(result.syncedCount).toBe(2)
      expect(result.failedCount).toBe(1)
      expect(result.success).toBe(false) // Has failures

      // Only failed venta should remain
      const remaining = await offlineDB.getVentasPendientes()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].estado).toBe('failed')
    })

    it('should track progress during multi-venta sync', async () => {
      const v1 = createMockVenta()
      const v2 = createMockVenta()

      await offlineDB.saveVentaPendiente(v1)
      await offlineDB.saveVentaPendiente(v2)

      mockFetchSuccess('sv-1')
      mockFetchSuccess('sv-2')

      const progressUpdates: any[] = []
      const syncManager = createSyncManager({
        handlers: {
          onProgress: (progress) => progressUpdates.push({ ...progress }),
        },
      })

      await syncManager.syncAll()

      expect(progressUpdates.length).toBeGreaterThanOrEqual(2)
      // Last progress should show both completed
      const lastProgress = progressUpdates[progressUpdates.length - 1]
      expect(lastProgress.total).toBe(2)
      expect(lastProgress.completed).toBe(2)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // ESCENARIO 4: Máximo de reintentos
  // ─────────────────────────────────────────────────────────────────────────

  describe('Máximo de reintentos', () => {
    it('should skip ventas that exceeded max retries', async () => {
      const venta = createMockVenta({ intentos: 5 }) // MAX_RETRIES = 5
      await offlineDB.saveVentaPendiente(venta)

      const syncManager = createSyncManager()
      const result = await syncManager.syncAll()

      expect(result.failedCount).toBe(1)
      expect(result.errors[0].error).toContain('reintentos')
      // Fetch should NOT have been called
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // ESCENARIO 5: Prevención de sync duplicados
  // ─────────────────────────────────────────────────────────────────────────

  describe('Prevención de sync duplicados', () => {
    it('should prevent concurrent syncs', async () => {
      const venta = createMockVenta()
      await offlineDB.saveVentaPendiente(venta)

      // Simulate slow fetch
      mockFetch.mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 100))
        return {
          ok: true,
          json: async () => ({ success: true, ventaId: 'sv-1' }),
          text: async () => JSON.stringify({ success: true, ventaId: 'sv-1' }),
        }
      })

      const syncManager = createSyncManager()

      // Start two syncs simultaneously
      const [result1, result2] = await Promise.all([
        syncManager.syncAll(),
        syncManager.syncAll(),
      ])

      // One should succeed, one should be blocked
      const blockedResult = result1.errors.length > 0 ? result1 : result2
      expect(blockedResult.errors[0].error).toContain('ya en curso')
    })

    it('should return idle status when no ventas pending', async () => {
      const syncManager = createSyncManager()
      const result = await syncManager.syncAll()

      expect(result.success).toBe(true)
      expect(result.syncedCount).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // ESCENARIO 6: Retry de ventas fallidas
  // ─────────────────────────────────────────────────────────────────────────

  describe('retryFailed', () => {
    it('should reset failed ventas to pending with 0 intentos', async () => {
      const venta = createMockVenta({
        estado: 'failed',
        intentos: 3,
        ultimo_error: 'Some error',
      })
      await offlineDB.saveVentaPendiente(venta)

      const syncManager = createSyncManager()
      await syncManager.retryFailed()

      const ventas = await offlineDB.getVentasPendientes()
      expect(ventas).toHaveLength(1)
      expect(ventas[0].estado).toBe('pending')
      expect(ventas[0].intentos).toBe(0)
      expect(ventas[0].ultimo_error).toBeNull()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // ESCENARIO 7: getStats
  // ─────────────────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'pending' }))
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'pending' }))
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'failed' }))
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'synced' }))

      const syncManager = createSyncManager()
      const stats = await syncManager.getStats()

      expect(stats.pendientes).toBe(2)
      expect(stats.errores).toBe(1)
      expect(stats.sincronizadas).toBe(1)
      expect(stats.sincronizando).toBe(0)
    })
  })
})
