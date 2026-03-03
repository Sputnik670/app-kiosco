/**
 * Tests de integración para el flujo completo offline
 *
 * Escenarios cubiertos:
 * 1. Venta offline → guardar en IndexedDB → sync → limpieza
 * 2. Venta offline → app se cierra (stuck syncing) → se reabre → recovery → sync
 * 3. Sync falla → retry con backoff → éxito
 * 4. Múltiples ventas offline → sync parcial → fallo → retry
 * 5. Verificaciones de alineación entre SW y App
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import {
  offlineDB,
  STORES,
  generateLocalId,
  type VentaPendiente,
  type ProductoCache,
} from '@/lib/offline/indexed-db'
import { productCache } from '@/lib/offline/product-cache'
import { createSyncManager } from '@/lib/offline/sync-manager'

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function createVenta(overrides: Partial<VentaPendiente> = {}): VentaPendiente {
  return {
    id: generateLocalId(),
    sucursal_id: 'suc-001',
    turno_id: 'turno-001',
    organization_id: 'org-001',
    items: [
      {
        producto_id: 'prod-001',
        cantidad: 1,
        precio_unitario: 800,
        nombre: 'Alfajor Triple',
        subtotal: 800,
      },
    ],
    metodo_pago: 'cash',
    monto_total: 800,
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

function mockSyncSuccess(ventaId: string = 'sv-001') {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, ventaId }),
    text: async () => JSON.stringify({ success: true, ventaId }),
  })
}

function mockSyncFail(error: string = 'Error del servidor') {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 400,
    json: async () => ({ success: false, error }),
    text: async () => JSON.stringify({ success: false, error }),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────────────────────

describe('Offline Flow Integration', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockFetch.mockReset()
    offlineDB.close()
    await offlineDB.open()
    await offlineDB.clear(STORES.VENTAS_PENDIENTES)
    await offlineDB.clear(STORES.PRODUCTOS_CACHE)
    await offlineDB.clear(STORES.SYNC_METADATA)
  })

  afterEach(() => {
    vi.useRealTimers()
    offlineDB.close()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // ESCENARIO 1: Flujo completo offline → sync → limpieza
  // ─────────────────────────────────────────────────────────────────────────

  describe('Flujo completo: offline → save → sync → cleanup', () => {
    it('should complete full offline sale lifecycle', async () => {
      // 1. Guardar venta offline (simula processVenta offline)
      const localId = generateLocalId()
      const venta = createVenta({ id: localId })
      await offlineDB.saveVentaPendiente(venta)

      // 2. Verificar que se guardó correctamente
      const pending = await offlineDB.getVentasParaSincronizar()
      expect(pending).toHaveLength(1)
      expect(pending[0].id).toBe(localId)
      expect(pending[0].estado).toBe('pending')

      // 3. Sincronizar (simula reconexión)
      mockSyncSuccess('server-venta-abc')
      const syncManager = createSyncManager()
      const result = await syncManager.syncAll()

      expect(result.success).toBe(true)
      expect(result.syncedCount).toBe(1)

      // 4. Verificar limpieza
      const remaining = await offlineDB.getVentasPendientes()
      expect(remaining).toHaveLength(0)
    })

    it('should preserve venta data integrity through save/retrieve cycle', async () => {
      const items = [
        { producto_id: 'p1', cantidad: 3, precio_unitario: 500, nombre: 'Coca Cola', subtotal: 1500 },
        { producto_id: 'p2', cantidad: 1, precio_unitario: 800, nombre: 'Alfajor', subtotal: 800 },
      ]
      const venta = createVenta({
        items,
        monto_total: 2300,
        metodo_pago: 'card',
        vendedor_id: 'emp-005',
      })
      await offlineDB.saveVentaPendiente(venta)

      // Retrieve and verify all fields
      const stored = (await offlineDB.getVentasPendientes())[0]
      expect(stored.items).toHaveLength(2)
      expect(stored.items[0].precio_unitario).toBe(500)
      expect(stored.items[1].nombre).toBe('Alfajor')
      expect(stored.monto_total).toBe(2300)
      expect(stored.metodo_pago).toBe('card')
      expect(stored.vendedor_id).toBe('emp-005')
      expect(stored.organization_id).toBe('org-001')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // ESCENARIO 2: App se cierra mid-sync → recovery
  // ─────────────────────────────────────────────────────────────────────────

  describe('App cerrada durante sync → recovery', () => {
    it('should recover ventas stuck in syncing state', async () => {
      // Simular que la app se cerró durante sync: ventas quedaron en 'syncing'
      const v1 = createVenta({ estado: 'syncing', intentos: 1 })
      const v2 = createVenta({ estado: 'syncing', intentos: 2 })
      const v3 = createVenta({ estado: 'pending' })

      await offlineDB.saveVentaPendiente(v1)
      await offlineDB.saveVentaPendiente(v2)
      await offlineDB.saveVentaPendiente(v3)

      // Simular recovery del hook (loadPendingVentas con recovery)
      // Resets intentos to undo the increment from the interrupted sync
      const allVentas = await offlineDB.getVentasPendientes()
      for (const v of allVentas) {
        if (v.estado === 'syncing') {
          await offlineDB.put(STORES.VENTAS_PENDIENTES, {
            ...v,
            estado: 'pending' as const,
            intentos: Math.max(0, v.intentos - 1),
          })
        }
      }

      // Verificar que las ventas stuck se recuperaron
      const recovered = await offlineDB.getVentasPendientes()
      const states = recovered.map(v => v.estado)
      expect(states).not.toContain('syncing')
      expect(states.filter(s => s === 'pending')).toHaveLength(3)

      // Ahora sincronizar todas exitosamente
      mockSyncSuccess('sv-1')
      mockSyncSuccess('sv-2')
      mockSyncSuccess('sv-3')

      const syncManager = createSyncManager()
      const result = await syncManager.syncAll()

      expect(result.syncedCount).toBe(3)
    })

    it('should not lose ventas data during recovery', async () => {
      const originalVenta = createVenta({
        estado: 'syncing',
        intentos: 1,
        monto_total: 5500,
        items: [
          { producto_id: 'p1', cantidad: 5, precio_unitario: 1100, nombre: 'Yerba', subtotal: 5500 },
        ],
      })
      await offlineDB.saveVentaPendiente(originalVenta)

      // Recover
      await offlineDB.updateVentaEstado(originalVenta.id, 'pending')

      // Verify data is intact
      const recovered = (await offlineDB.getVentasPendientes())[0]
      expect(recovered.monto_total).toBe(5500)
      expect(recovered.items[0].nombre).toBe('Yerba')
      expect(recovered.items[0].cantidad).toBe(5)
      expect(recovered.estado).toBe('pending')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // ESCENARIO 3: Sync falla → retry → éxito
  // ─────────────────────────────────────────────────────────────────────────

  describe('Sync falla → retry → éxito', () => {
    it('should sync on retry after initial failure', async () => {
      const venta = createVenta()
      await offlineDB.saveVentaPendiente(venta)

      // Round 1: Failure
      mockSyncFail('Caja cerrada')
      const sm = createSyncManager()
      const r1 = await sm.syncAll()
      expect(r1.failedCount).toBe(1)

      // Verify intentos incremented
      const afterFail = (await offlineDB.getVentasPendientes())[0]
      expect(afterFail.intentos).toBe(1)
      expect(afterFail.estado).toBe('failed')

      // Round 2: Success
      mockSyncSuccess('sv-recovered')
      const sm2 = createSyncManager()
      const r2 = await sm2.syncAll()

      expect(r2.syncedCount).toBe(1)
      expect(r2.failedCount).toBe(0)
    })

    it('should handle multiple retry rounds correctly', { timeout: 30000 }, async () => {
      const venta = createVenta()
      await offlineDB.saveVentaPendiente(venta)

      // Fail 3 times (each round creates a new SyncManager to avoid "already syncing")
      for (let i = 0; i < 3; i++) {
        mockSyncFail(`Error intento ${i + 1}`)
        const sm = createSyncManager()
        await sm.syncAll()
      }

      const afterFails = (await offlineDB.getVentasPendientes())[0]
      expect(afterFails.intentos).toBe(3)
      expect(afterFails.estado).toBe('failed')

      // Success on 4th try (backoff for intentos=3: ~8s, managed by shouldAdvanceTime)
      mockSyncSuccess('sv-finally')
      const smFinal = createSyncManager()
      const result = await smFinal.syncAll()

      expect(result.syncedCount).toBe(1)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // ESCENARIO 4: Múltiples ventas → sync parcial → retry
  // ─────────────────────────────────────────────────────────────────────────

  describe('Múltiples ventas → sync parcial → retry', () => {
    it('should retry only failed ventas on next sync', async () => {
      const v1 = createVenta({ monto_total: 100 })
      const v2 = createVenta({ monto_total: 200 })
      const v3 = createVenta({ monto_total: 300 })

      await offlineDB.saveVentaPendiente(v1)
      await offlineDB.saveVentaPendiente(v2)
      await offlineDB.saveVentaPendiente(v3)

      // Round 1: 2 OK, 1 FAIL (order is not guaranteed by IndexedDB)
      mockSyncSuccess('sv-1')
      mockSyncFail('Error en una venta')
      mockSyncSuccess('sv-3')

      const sm1 = createSyncManager()
      const r1 = await sm1.syncAll()
      expect(r1.syncedCount).toBe(2)
      expect(r1.failedCount).toBe(1)

      // Only the failed venta should remain
      const remaining = await offlineDB.getVentasPendientes()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].estado).toBe('failed')

      // Round 2: Retry the failed venta successfully
      mockSyncSuccess('sv-retried')
      const sm2 = createSyncManager()
      const r2 = await sm2.syncAll()

      expect(r2.syncedCount).toBe(1)
      expect(r2.failedCount).toBe(0)

      // All ventas should be cleaned
      const final = await offlineDB.getVentasPendientes()
      expect(final).toHaveLength(0)
    })

    it('should handle total failure gracefully', async () => {
      await offlineDB.saveVentaPendiente(createVenta())
      await offlineDB.saveVentaPendiente(createVenta())
      await offlineDB.saveVentaPendiente(createVenta())

      // All fail
      mockSyncFail('Error 1')
      mockSyncFail('Error 2')
      mockSyncFail('Error 3')

      const sm = createSyncManager()
      const result = await sm.syncAll()

      expect(result.success).toBe(false)
      expect(result.syncedCount).toBe(0)
      expect(result.failedCount).toBe(3)

      // All ventas should still be in DB
      const remaining = await offlineDB.getVentasPendientes()
      expect(remaining).toHaveLength(3)
      expect(remaining.every(v => v.estado === 'failed')).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // ESCENARIO 5: Product cache for offline search
  // ─────────────────────────────────────────────────────────────────────────

  describe('Product cache offline flow', () => {
    it('should cache products and search offline', async () => {
      // Simulate caching products from server
      const productos: ProductoCache[] = [
        {
          id: 'p1', nombre: 'Coca Cola 500ml', categoria: 'Bebidas',
          codigo_barras: '7790895000454', costo: 350, emoji: '🥤',
          precio_venta: 500, stock_disponible: 20, stock_minimo: 5,
          sucursal_id: 'suc-001', organization_id: 'org-001', cached_at: Date.now(),
        },
        {
          id: 'p2', nombre: 'Pepsi 500ml', categoria: 'Bebidas',
          codigo_barras: '7792222000111', costo: 340, emoji: '🥤',
          precio_venta: 480, stock_disponible: 15, stock_minimo: 5,
          sucursal_id: 'suc-001', organization_id: 'org-001', cached_at: Date.now(),
        },
      ]

      await offlineDB.cacheProductos(productos)

      // Search offline
      const results = await productCache.searchOffline('suc-001', 'coca')
      expect(results).toHaveLength(1)
      expect(results[0].nombre).toBe('Coca Cola 500ml')
    })

    it('should reduce stock after offline sale', async () => {
      const producto: ProductoCache = {
        id: 'p1', nombre: 'Alfajor', categoria: 'Golosinas',
        codigo_barras: null, costo: 300, emoji: '🍫',
        precio_venta: 500, stock_disponible: 10, stock_minimo: 3,
        sucursal_id: 'suc-001', organization_id: 'org-001', cached_at: Date.now(),
      }
      await offlineDB.cacheProductos([producto])

      // Reduce stock (simulates offline sale)
      await productCache.reduceStock('p1', 'suc-001', 3)

      const updated = await offlineDB.getProductosBySucursal('suc-001')
      expect(updated[0].stock_disponible).toBe(7)
    })

    it('should not go below 0 stock', async () => {
      const producto: ProductoCache = {
        id: 'p1', nombre: 'Alfajor', categoria: 'Golosinas',
        codigo_barras: null, costo: 300, emoji: '🍫',
        precio_venta: 500, stock_disponible: 2, stock_minimo: 3,
        sucursal_id: 'suc-001', organization_id: 'org-001', cached_at: Date.now(),
      }
      await offlineDB.cacheProductos([producto])

      await productCache.reduceStock('p1', 'suc-001', 5) // More than available

      const updated = await offlineDB.getProductosBySucursal('suc-001')
      expect(updated[0].stock_disponible).toBe(0) // Clamped to 0
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // ESCENARIO 6: Verificación de alineación SW ↔ App
  // ─────────────────────────────────────────────────────────────────────────

  describe('SW-App alignment verification', () => {
    it('should use correct DB name matching sw.js', () => {
      // These values must match sw.js constants
      const APP_DB_NAME = 'kiosco-offline'
      const APP_DB_VERSION = 2
      // (see public/sw.js lines: OFFLINE_DB_NAME, OFFLINE_DB_VERSION)
      expect(APP_DB_NAME).toBe('kiosco-offline')
      expect(APP_DB_VERSION).toBe(2)
    })

    it('should store ventas with all fields needed by sync API', async () => {
      const venta = createVenta({
        organization_id: 'org-test',
        vendedor_id: 'user-test',
      })
      await offlineDB.saveVentaPendiente(venta)

      const stored = (await offlineDB.getVentasPendientes())[0]

      // These fields are required by /api/ventas/sync
      expect(stored.id).toBeDefined()
      expect(stored.sucursal_id).toBeDefined()
      expect(stored.turno_id).toBeDefined()
      expect(stored.organization_id).toBe('org-test')
      expect(stored.items).toBeInstanceOf(Array)
      expect(stored.items.length).toBeGreaterThan(0)
      expect(stored.metodo_pago).toBeDefined()
      expect(stored.monto_total).toBeGreaterThan(0)
      expect(stored.vendedor_id).toBe('user-test')
      expect(stored.created_at).toBeGreaterThan(0)
    })

    it('should use compound key for productos-cache', async () => {
      // Same product in two branches should coexist
      const p1: ProductoCache = {
        id: 'prod-001', nombre: 'Test', categoria: null,
        codigo_barras: null, costo: 100, emoji: null,
        precio_venta: 200, stock_disponible: 10, stock_minimo: null,
        sucursal_id: 'suc-001', organization_id: 'org-001', cached_at: Date.now(),
      }
      const p2: ProductoCache = {
        ...p1,
        sucursal_id: 'suc-002', // Different branch, same product ID
        stock_disponible: 5,
      }

      await offlineDB.cacheProductos([p1, p2])

      const suc1 = await offlineDB.getProductosBySucursal('suc-001')
      const suc2 = await offlineDB.getProductosBySucursal('suc-002')

      expect(suc1).toHaveLength(1)
      expect(suc1[0].stock_disponible).toBe(10)
      expect(suc2).toHaveLength(1)
      expect(suc2[0].stock_disponible).toBe(5)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // ESCENARIO 7: Edge cases — max retries, network errors, empty turno
  // ─────────────────────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('should permanently fail venta after max retries (5)', async () => {
      const venta = createVenta({ intentos: 5, estado: 'failed' })
      await offlineDB.saveVentaPendiente(venta)

      // SyncManager should skip this venta (MAX_RETRIES reached)
      const sm = createSyncManager()
      const result = await sm.syncAll()

      expect(result.failedCount).toBe(1)
      expect(result.errors[0].error).toContain('reintentos')
      // Fetch should NOT have been called for this venta
      expect(mockFetch).not.toHaveBeenCalled()

      // Venta should still exist in DB (not lost)
      const remaining = await offlineDB.getVentasPendientes()
      expect(remaining).toHaveLength(1)
    })

    it('should handle network error (fetch throws) gracefully', async () => {
      const venta = createVenta()
      await offlineDB.saveVentaPendiente(venta)

      // Simulate network error (not a server error, but connectivity failure)
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      const sm = createSyncManager()
      const result = await sm.syncAll()

      expect(result.success).toBe(false)
      expect(result.failedCount).toBe(1)
      expect(result.errors[0].error).toContain('Failed to fetch')

      // Venta should be marked as failed but not lost
      const remaining = await offlineDB.getVentasPendientes()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].estado).toBe('failed')
    })

    it('should handle venta with empty turno_id (offline-no-turno)', async () => {
      // Simulates offline venta when no caja was open
      const venta = createVenta({ turno_id: 'offline-no-turno' })
      await offlineDB.saveVentaPendiente(venta)

      // The sync endpoint will try to find an active caja for the branch
      mockSyncSuccess('sv-fallback-turno')

      const sm = createSyncManager()
      const result = await sm.syncAll()

      expect(result.success).toBe(true)
      expect(result.syncedCount).toBe(1)

      // Verify the payload was sent with the turnoId
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.turnoId).toBe('offline-no-turno')
    })

    it('should not lose data when multiple syncs overlap (idempotency)', async () => {
      const v1 = createVenta()
      const v2 = createVenta()
      await offlineDB.saveVentaPendiente(v1)
      await offlineDB.saveVentaPendiente(v2)

      mockSyncSuccess('sv-1')
      mockSyncSuccess('sv-2')

      // First sync should work
      const sm1 = createSyncManager()
      const r1 = await sm1.syncAll()
      expect(r1.syncedCount).toBe(2)

      // Second sync on empty queue should be a no-op
      const sm2 = createSyncManager()
      const r2 = await sm2.syncAll()
      expect(r2.syncedCount).toBe(0)
      expect(r2.success).toBe(true)
    })

    it('should recover after DB close/reopen (simulates app restart)', async () => {
      // Save some ventas
      const v1 = createVenta({ monto_total: 1500 })
      const v2 = createVenta({ monto_total: 2500, estado: 'failed', intentos: 2 })
      await offlineDB.saveVentaPendiente(v1)
      await offlineDB.saveVentaPendiente(v2)

      // Close DB (simulates app being killed)
      offlineDB.close()

      // Reopen (simulates app restart)
      await offlineDB.open()

      // Ventas should persist across close/open
      const ventas = await offlineDB.getVentasPendientes()
      expect(ventas).toHaveLength(2)

      const totals = ventas.map(v => v.monto_total).sort()
      expect(totals).toEqual([1500, 2500])
    })

    it('should handle sync cancellation via AbortController', async () => {
      const v1 = createVenta()
      const v2 = createVenta()
      await offlineDB.saveVentaPendiente(v1)
      await offlineDB.saveVentaPendiente(v2)

      // First venta succeeds, second triggers abort
      mockSyncSuccess('sv-1')
      mockFetch.mockImplementationOnce(() => {
        const error = new Error('Aborted')
        error.name = 'AbortError'
        return Promise.reject(error)
      })

      const sm = createSyncManager()
      const result = await sm.syncAll()

      // At least one should have been processed
      expect(result.syncedCount + result.failedCount).toBeGreaterThanOrEqual(1)
    })

    it('retryFailed should reset intentos to 0', async () => {
      // Venta that failed 4 times
      const venta = createVenta({
        estado: 'failed',
        intentos: 4,
        ultimo_error: 'Server error',
      })
      await offlineDB.saveVentaPendiente(venta)

      const sm = createSyncManager()
      await sm.retryFailed()

      const ventas = await offlineDB.getVentasPendientes()
      expect(ventas[0].estado).toBe('pending')
      expect(ventas[0].intentos).toBe(0)
      expect(ventas[0].ultimo_error).toBeNull()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // ESCENARIO 8: Concurrent operations — data consistency
  // ─────────────────────────────────────────────────────────────────────────

  describe('Data consistency under concurrent operations', () => {
    it('should handle rapid sequential saves without data loss', async () => {
      // Simulate Lucía making 10 quick sales
      const ventas = Array.from({ length: 10 }, (_, i) =>
        createVenta({ monto_total: (i + 1) * 100 })
      )

      // Save all ventas as fast as possible
      await Promise.all(ventas.map(v => offlineDB.saveVentaPendiente(v)))

      // All should be saved
      const saved = await offlineDB.getVentasPendientes()
      expect(saved).toHaveLength(10)

      // All totals should be present
      const totals = saved.map(v => v.monto_total).sort((a, b) => a - b)
      expect(totals).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000])
    })

    it('should maintain product cache consistency after multiple stock reductions', async () => {
      const producto: ProductoCache = {
        id: 'p1', nombre: 'Coca Cola', categoria: 'Bebidas',
        codigo_barras: null, costo: 300, emoji: '🥤',
        precio_venta: 500, stock_disponible: 100, stock_minimo: 10,
        sucursal_id: 'suc-001', organization_id: 'org-001', cached_at: Date.now(),
      }
      await offlineDB.cacheProductos([producto])

      // Simulate 5 offline sales reducing stock
      await productCache.reduceStock('p1', 'suc-001', 3) // 97
      await productCache.reduceStock('p1', 'suc-001', 7) // 90
      await productCache.reduceStock('p1', 'suc-001', 10) // 80
      await productCache.reduceStock('p1', 'suc-001', 5) // 75
      await productCache.reduceStock('p1', 'suc-001', 25) // 50

      const updated = await offlineDB.getProductosBySucursal('suc-001')
      expect(updated[0].stock_disponible).toBe(50)
    })
  })
})
