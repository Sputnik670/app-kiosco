/**
 * Tests para lib/offline/indexed-db.ts
 *
 * Usa fake-indexeddb para simular IndexedDB en jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { offlineDB, STORES, generateLocalId, type VentaPendiente, type ProductoCache } from '@/lib/offline/indexed-db'

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
    vendedor_id: null,
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

function createMockProducto(overrides: Partial<ProductoCache> = {}): ProductoCache {
  return {
    id: 'prod-001',
    nombre: 'Coca Cola 500ml',
    categoria: 'Bebidas',
    codigo_barras: '7790895000454',
    costo: 350,
    emoji: '🥤',
    precio_venta: 500,
    stock_disponible: 25,
    stock_minimo: 5,
    sucursal_id: 'suc-001',
    organization_id: 'org-001',
    cached_at: Date.now(),
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('OfflineDB', () => {
  beforeEach(async () => {
    // Reset the singleton's internal state
    offlineDB.close()
    // Clear all stores
    try {
      await offlineDB.open()
      await offlineDB.clear(STORES.VENTAS_PENDIENTES)
      await offlineDB.clear(STORES.PRODUCTOS_CACHE)
      await offlineDB.clear(STORES.SYNC_METADATA)
    } catch {
      // First open might fail if DB doesn't exist yet
    }
  })

  afterEach(() => {
    offlineDB.close()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // BASIC OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  describe('open()', () => {
    it('should open the database successfully', async () => {
      const db = await offlineDB.open()
      expect(db).toBeDefined()
      expect(db.name).toBe('kiosco-offline')
      expect(db.version).toBe(2)
    })

    it('should create all required object stores', async () => {
      const db = await offlineDB.open()
      expect(db.objectStoreNames.contains('productos-cache')).toBe(true)
      expect(db.objectStoreNames.contains('ventas-pendientes')).toBe(true)
      expect(db.objectStoreNames.contains('sync-metadata')).toBe(true)
    })

    it('should return the same DB on repeated opens', async () => {
      const db1 = await offlineDB.open()
      const db2 = await offlineDB.open()
      expect(db1).toBe(db2)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // VENTAS PENDIENTES
  // ─────────────────────────────────────────────────────────────────────────

  describe('Ventas Pendientes', () => {
    it('should save and retrieve a pending venta', async () => {
      const venta = createMockVenta()
      await offlineDB.saveVentaPendiente(venta)

      const ventas = await offlineDB.getVentasPendientes()
      expect(ventas).toHaveLength(1)
      expect(ventas[0].id).toBe(venta.id)
      expect(ventas[0].monto_total).toBe(1000)
    })

    it('should save multiple ventas', async () => {
      const venta1 = createMockVenta({ monto_total: 500 })
      const venta2 = createMockVenta({ monto_total: 1500 })
      const venta3 = createMockVenta({ monto_total: 2000 })

      await offlineDB.saveVentaPendiente(venta1)
      await offlineDB.saveVentaPendiente(venta2)
      await offlineDB.saveVentaPendiente(venta3)

      const ventas = await offlineDB.getVentasPendientes()
      expect(ventas).toHaveLength(3)
    })

    it('should filter ventas by estado', async () => {
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'pending' }))
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'pending' }))
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'failed' }))
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'synced' }))

      const pending = await offlineDB.getVentasByEstado('pending')
      expect(pending).toHaveLength(2)

      const failed = await offlineDB.getVentasByEstado('failed')
      expect(failed).toHaveLength(1)

      const synced = await offlineDB.getVentasByEstado('synced')
      expect(synced).toHaveLength(1)
    })

    it('should get ventas para sincronizar (pending + failed)', async () => {
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'pending' }))
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'failed' }))
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'synced' }))
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'syncing' }))

      const paraSincronizar = await offlineDB.getVentasParaSincronizar()
      expect(paraSincronizar).toHaveLength(2)
      expect(paraSincronizar.every(v => v.estado === 'pending' || v.estado === 'failed')).toBe(true)
    })

    it('should update venta estado correctly', async () => {
      const venta = createMockVenta()
      await offlineDB.saveVentaPendiente(venta)

      // Update to syncing (should increment intentos)
      await offlineDB.updateVentaEstado(venta.id, 'syncing')
      const updated = await offlineDB.getVentasPendientes()
      expect(updated[0].estado).toBe('syncing')
      expect(updated[0].intentos).toBe(1)
      expect(updated[0].ultimo_intento).not.toBeNull()

      // Update to synced with server ID
      await offlineDB.updateVentaEstado(venta.id, 'synced', {
        venta_id_servidor: 'server-venta-123',
        synced_at: Date.now(),
      })
      const synced = await offlineDB.getVentasPendientes()
      expect(synced[0].estado).toBe('synced')
      expect(synced[0].venta_id_servidor).toBe('server-venta-123')
    })

    it('should update venta estado to failed with error message', async () => {
      const venta = createMockVenta()
      await offlineDB.saveVentaPendiente(venta)

      await offlineDB.updateVentaEstado(venta.id, 'failed', {
        ultimo_error: 'Stock insuficiente',
      })

      const ventas = await offlineDB.getVentasPendientes()
      expect(ventas[0].estado).toBe('failed')
      expect(ventas[0].ultimo_error).toBe('Stock insuficiente')
    })

    it('should throw when updating non-existent venta', async () => {
      await expect(
        offlineDB.updateVentaEstado('non-existent', 'synced')
      ).rejects.toThrow('no encontrada')
    })

    it('should delete a venta', async () => {
      const venta = createMockVenta()
      await offlineDB.saveVentaPendiente(venta)

      await offlineDB.deleteVentaPendiente(venta.id)
      const ventas = await offlineDB.getVentasPendientes()
      expect(ventas).toHaveLength(0)
    })

    it('should clear synced ventas', async () => {
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'synced' }))
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'synced' }))
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'pending' }))

      const cleared = await offlineDB.clearVentasSincronizadas()
      expect(cleared).toBe(2)

      const remaining = await offlineDB.getVentasPendientes()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].estado).toBe('pending')
    })

    it('should count ventas pendientes de sync', async () => {
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'pending' }))
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'failed' }))
      await offlineDB.saveVentaPendiente(createMockVenta({ estado: 'synced' }))

      const count = await offlineDB.countVentasPendientesSync()
      expect(count).toBe(2)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUCTOS CACHE
  // ─────────────────────────────────────────────────────────────────────────

  describe('Productos Cache', () => {
    it('should cache and retrieve products', async () => {
      const products = [
        createMockProducto({ id: 'p1', nombre: 'Coca Cola' }),
        createMockProducto({ id: 'p2', nombre: 'Pepsi' }),
        createMockProducto({ id: 'p3', nombre: 'Fanta' }),
      ]

      await offlineDB.cacheProductos(products)
      const cached = await offlineDB.getProductosBySucursal('suc-001')
      expect(cached).toHaveLength(3)
    })

    it('should retrieve products by sucursal', async () => {
      await offlineDB.cacheProductos([
        createMockProducto({ id: 'p1', sucursal_id: 'suc-001' }),
        createMockProducto({ id: 'p2', sucursal_id: 'suc-001' }),
        createMockProducto({ id: 'p3', sucursal_id: 'suc-002' }),
      ])

      const suc1 = await offlineDB.getProductosBySucursal('suc-001')
      expect(suc1).toHaveLength(2)

      const suc2 = await offlineDB.getProductosBySucursal('suc-002')
      expect(suc2).toHaveLength(1)
    })

    it('should search products offline by name', async () => {
      await offlineDB.cacheProductos([
        createMockProducto({ id: 'p1', nombre: 'Coca Cola 500ml' }),
        createMockProducto({ id: 'p2', nombre: 'Coca Cola 2L' }),
        createMockProducto({ id: 'p3', nombre: 'Pepsi 500ml' }),
      ])

      const results = await offlineDB.searchProductosOffline('suc-001', 'coca')
      expect(results).toHaveLength(2)
      expect(results.every(p => p.nombre.toLowerCase().includes('coca'))).toBe(true)
    })

    it('should search products offline by barcode', async () => {
      await offlineDB.cacheProductos([
        createMockProducto({ id: 'p1', codigo_barras: '7790895000454' }),
        createMockProducto({ id: 'p2', codigo_barras: '7790895999999' }),
      ])

      const results = await offlineDB.searchProductosOffline('suc-001', '7790895000454')
      expect(results).toHaveLength(1)
      expect(results[0].codigo_barras).toBe('7790895000454')
    })

    it('should exclude virtual services from search', async () => {
      await offlineDB.cacheProductos([
        createMockProducto({ id: 'p1', nombre: 'Carga SUBE' }),
        createMockProducto({ id: 'p2', nombre: 'Carga Virtual' }),
        createMockProducto({ id: 'p3', nombre: 'Coca Cola' }),
      ])

      const results = await offlineDB.searchProductosOffline('suc-001', 'carga')
      expect(results).toHaveLength(0)
    })

    it('should limit search results to 5', async () => {
      const products = Array.from({ length: 10 }, (_, i) =>
        createMockProducto({ id: `p${i}`, nombre: `Producto ${i}` })
      )
      await offlineDB.cacheProductos(products)

      const results = await offlineDB.searchProductosOffline('suc-001', 'producto')
      expect(results).toHaveLength(5)
    })

    it('should clear products by sucursal', async () => {
      await offlineDB.cacheProductos([
        createMockProducto({ id: 'p1', sucursal_id: 'suc-001' }),
        createMockProducto({ id: 'p2', sucursal_id: 'suc-001' }),
        createMockProducto({ id: 'p3', sucursal_id: 'suc-002' }),
      ])

      await offlineDB.clearProductosBySucursal('suc-001')

      const suc1 = await offlineDB.getProductosBySucursal('suc-001')
      expect(suc1).toHaveLength(0)

      const suc2 = await offlineDB.getProductosBySucursal('suc-002')
      expect(suc2).toHaveLength(1)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────────────────────────────────────

  describe('Sync Metadata', () => {
    it('should save and retrieve metadata', async () => {
      await offlineDB.setMetadata('test-key', 'test-value')
      const metadata = await offlineDB.getMetadata('test-key')
      expect(metadata?.value).toBe('test-value')
    })

    it('should track product sync timestamps', async () => {
      await offlineDB.setLastProductosSyncTime('suc-001')

      const lastSync = await offlineDB.getLastProductosSyncTime('suc-001')
      expect(lastSync).not.toBeNull()
      expect(lastSync).toBeGreaterThan(0)
    })

    it('should return null for never-synced sucursal', async () => {
      const lastSync = await offlineDB.getLastProductosSyncTime('never-synced')
      expect(lastSync).toBeNull()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE LOCAL ID
// ─────────────────────────────────────────────────────────────────────────────

describe('generateLocalId', () => {
  it('should generate valid UUID format', () => {
    const id = generateLocalId()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(id).toMatch(uuidRegex)
  })

  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateLocalId()))
    expect(ids.size).toBe(100)
  })
})
