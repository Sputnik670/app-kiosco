/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📦 PRODUCT CACHE SERVICE - Cache de productos para modo offline
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Servicio para mantener productos cacheados localmente y permitir:
 * - Búsqueda de productos sin conexión
 * - Sincronización automática cuando hay conexión
 * - Invalidación de cache por tiempo o manualmente
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { offlineDB, type ProductoCache } from './indexed-db'

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Tiempo de vida del cache en milisegundos (15 minutos)
 */
const CACHE_TTL_MS = 15 * 60 * 1000

/**
 * Intervalo mínimo entre sincronizaciones (5 minutos)
 */
const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Producto de la vista view_productos_con_stock
 */
export interface ProductoFromServer {
  id: string
  nombre: string
  categoria: string | null
  codigo_barras: string | null
  costo: number | null
  emoji: string | null
  precio_venta: number
  stock_disponible: number
  stock_minimo: number | null
  sucursal_id: string
  organization_id: string
}

/**
 * Estado del cache de productos
 */
export interface ProductCacheStatus {
  sucursalId: string
  productCount: number
  lastSyncAt: number | null
  isStale: boolean
  isSyncing: boolean
}

// ───────────────────────────────────────────────────────────────────────────────
// CLASE PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────

class ProductCacheService {
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
  async isCacheStale(sucursalId: string): Promise<boolean> {
    const lastSync = await offlineDB.getLastProductosSyncTime(sucursalId)
    if (!lastSync) return true

    const age = Date.now() - lastSync
    return age > CACHE_TTL_MS
  }

  /**
   * Verifica si podemos sincronizar (respeta el intervalo mínimo)
   */
  async canSync(sucursalId: string): Promise<boolean> {
    if (this.syncingFor.has(sucursalId)) {
      return false
    }

    const lastSync = await offlineDB.getLastProductosSyncTime(sucursalId)
    if (!lastSync) return true

    const timeSinceLastSync = Date.now() - lastSync
    return timeSinceLastSync >= MIN_SYNC_INTERVAL_MS
  }

  /**
   * Sincroniza productos desde el servidor al cache local
   *
   * @param sucursalId - ID de la sucursal
   * @param fetchFn - Función para obtener productos del servidor
   * @param force - Forzar sincronización ignorando intervalo mínimo
   */
  async syncFromServer(
    sucursalId: string,
    fetchFn: () => Promise<ProductoFromServer[]>,
    force: boolean = false
  ): Promise<{ success: boolean; count: number; error?: string }> {
    // Verificar si ya estamos sincronizando
    if (this.syncingFor.has(sucursalId)) {
      // Esperar la sincronización en curso
      const existingPromise = this.syncPromises.get(sucursalId)
      if (existingPromise) {
        await existingPromise
      }
      const count = (await offlineDB.getProductosBySucursal(sucursalId)).length
      return { success: true, count }
    }

    // Verificar intervalo mínimo
    if (!force && !(await this.canSync(sucursalId))) {
      const count = (await offlineDB.getProductosBySucursal(sucursalId)).length
      return { success: true, count }
    }

    // Marcar como sincronizando
    this.syncingFor.add(sucursalId)

    const syncPromise = (async () => {
      try {
        // Obtener productos del servidor
        const productos = await fetchFn()

        // Convertir a formato cache
        const productosCache: ProductoCache[] = productos.map((p) => ({
          ...p,
          cached_at: Date.now(),
        }))

        // Limpiar cache anterior de esta sucursal
        await offlineDB.clearProductosBySucursal(sucursalId)

        // Guardar nuevos productos
        if (productosCache.length > 0) {
          await offlineDB.cacheProductos(productosCache)
        }

        // Actualizar timestamp de sync
        await offlineDB.setLastProductosSyncTime(sucursalId)

        return { success: true, count: productosCache.length }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
        return { success: false, count: 0, error: errorMessage }
      } finally {
        this.syncingFor.delete(sucursalId)
        this.syncPromises.delete(sucursalId)
      }
    })()

    this.syncPromises.set(sucursalId, syncPromise.then(() => {}))

    return syncPromise
  }

  /**
   * Busca productos en el cache local
   */
  async searchOffline(sucursalId: string, query: string): Promise<ProductoCache[]> {
    if (!query || query.trim().length === 0) {
      return []
    }

    return offlineDB.searchProductosOffline(sucursalId, query.trim())
  }

  /**
   * Obtiene todos los productos cacheados de una sucursal
   */
  async getAll(sucursalId: string): Promise<ProductoCache[]> {
    return offlineDB.getProductosBySucursal(sucursalId)
  }

  /**
   * Obtiene el estado del cache para una sucursal
   */
  async getStatus(sucursalId: string): Promise<ProductCacheStatus> {
    const productos = await offlineDB.getProductosBySucursal(sucursalId)
    const lastSyncAt = await offlineDB.getLastProductosSyncTime(sucursalId)
    const isStale = await this.isCacheStale(sucursalId)
    const isSyncing = this.syncingFor.has(sucursalId)

    return {
      sucursalId,
      productCount: productos.length,
      lastSyncAt,
      isStale,
      isSyncing,
    }
  }

  /**
   * Invalida el cache de una sucursal (fuerza re-sync en próxima búsqueda)
   */
  async invalidate(sucursalId: string): Promise<void> {
    await offlineDB.clearProductosBySucursal(sucursalId)
    // También limpiamos el timestamp para forzar re-sync
    await offlineDB.setMetadata(`productos-sync-${sucursalId}`, 0)
  }

  /**
   * Limpia todo el cache de productos
   */
  async clearAll(): Promise<void> {
    await offlineDB.clear('productos-cache')
  }

  /**
   * Actualiza el stock de un producto en cache
   * (útil después de una venta offline para mantener consistencia visual)
   */
  async updateStock(
    productoId: string,
    sucursalId: string,
    nuevoStock: number
  ): Promise<void> {
    const productos = await offlineDB.getProductosBySucursal(sucursalId)
    const producto = productos.find((p) => p.id === productoId)

    if (producto) {
      const updated: ProductoCache = {
        ...producto,
        stock_disponible: Math.max(0, nuevoStock),
      }
      await offlineDB.put('productos-cache', updated)
    }
  }

  /**
   * Reduce el stock de un producto en cache
   * (útil después de agregar al carrito offline)
   */
  async reduceStock(
    productoId: string,
    sucursalId: string,
    cantidad: number
  ): Promise<void> {
    const productos = await offlineDB.getProductosBySucursal(sucursalId)
    const producto = productos.find((p) => p.id === productoId)

    if (producto) {
      await this.updateStock(
        productoId,
        sucursalId,
        producto.stock_disponible - cantidad
      )
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Instancia singleton del servicio de cache de productos
 */
export const productCache = new ProductCacheService()
