/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📦 INDEXED DB SERVICE - Sistema de almacenamiento offline
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Servicio base para IndexedDB que maneja:
 * - Cache de productos por sucursal
 * - Cola de ventas pendientes de sincronización
 * - Metadata de sincronización
 *
 * IMPORTANTE: Este servicio solo corre en el cliente (browser)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'kiosco-offline'
const DB_VERSION = 3

// Store names
export const STORES = {
  PRODUCTOS_CACHE: 'productos-cache',
  VENTAS_PENDIENTES: 'ventas-pendientes',
  ASISTENCIA_PENDIENTE: 'asistencia-pendiente',
  SYNC_METADATA: 'sync-metadata',
} as const

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Producto cacheado localmente para búsqueda offline
 */
export interface ProductoCache {
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
  // Metadata de cache
  cached_at: number // timestamp
}

/**
 * Item de venta pendiente
 */
export interface VentaPendienteItem {
  producto_id: string
  cantidad: number
  precio_unitario: number
  nombre: string // Para mostrar en UI sin conexión
  subtotal: number
}

/**
 * Estado de una venta pendiente
 * Nota: Usamos valores en inglés para compatibilidad con Service Worker
 */
export type VentaPendienteEstado =
  | 'pending'      // Esperando sincronización
  | 'syncing'      // En proceso de sync
  | 'failed'       // Falló, requiere retry
  | 'synced'       // Completada exitosamente

/**
 * Venta pendiente de sincronización
 */
export interface VentaPendiente {
  id: string // UUID generado localmente
  sucursal_id: string
  turno_id: string // caja_diaria_id
  organization_id: string
  items: VentaPendienteItem[]
  metodo_pago: 'cash' | 'card' | 'wallet'
  monto_total: number
  vendedor_id: string | null
  // Timestamps
  created_at: number // timestamp local
  // Estado de sync
  estado: VentaPendienteEstado
  intentos: number
  ultimo_intento: number | null
  ultimo_error: string | null
  // Resultado de sync (cuando se completa)
  venta_id_servidor: string | null
  synced_at: number | null
}

/**
 * Estado de un fichaje pendiente
 */
export type AsistenciaPendienteEstado =
  | 'pending'      // Esperando sincronización
  | 'syncing'      // En proceso de sync
  | 'failed'       // Falló, requiere retry
  | 'synced'       // Completada exitosamente

/**
 * Fichaje pendiente de sincronización
 */
export interface AsistenciaPendiente {
  id: string // UUID generado localmente
  organization_id: string
  branch_id: string
  user_id: string
  tipo: 'entrada' | 'salida'
  timestamp: number // momento real del fichaje (timestamp local)
  // Para salidas: ID del registro de attendance activo
  attendance_id: string | null
  // Estado de sync
  estado: AsistenciaPendienteEstado
  intentos: number
  ultimo_intento: number | null
  ultimo_error: string | null
  // Resultado de sync
  synced_at: number | null
  created_at: number
}

/**
 * Metadata de sincronización
 */
export interface SyncMetadata {
  key: string // 'productos-{sucursalId}' | 'last-sync' | etc
  value: string | number | boolean
  updated_at: number
}

// ───────────────────────────────────────────────────────────────────────────────
// CLASE PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────

class OfflineDB {
  private db: IDBDatabase | null = null
  private dbPromise: Promise<IDBDatabase> | null = null

  /**
   * Verifica si IndexedDB está disponible
   */
  isAvailable(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window
  }

  /**
   * Abre o crea la base de datos
   */
  async open(): Promise<IDBDatabase> {
    // Si ya está abierta, retornar
    if (this.db) {
      return this.db
    }

    // Si hay una promesa en curso, esperar
    if (this.dbPromise) {
      return this.dbPromise
    }

    // Verificar disponibilidad
    if (!this.isAvailable()) {
      throw new Error('IndexedDB no está disponible en este navegador')
    }

    // Crear promesa de apertura
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        this.dbPromise = null
        reject(new Error(`Error abriendo IndexedDB: ${request.error?.message}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        this.dbPromise = null

        // Manejar cierre inesperado
        this.db.onclose = () => {
          this.db = null
        }

        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // ─────────────────────────────────────────────────────────────────────
        // CREAR OBJECT STORES
        // ─────────────────────────────────────────────────────────────────────

        // Store: productos-cache
        if (!db.objectStoreNames.contains(STORES.PRODUCTOS_CACHE)) {
          const productosStore = db.createObjectStore(STORES.PRODUCTOS_CACHE, {
            keyPath: ['id', 'sucursal_id'], // Clave compuesta
          })
          // Índices para búsqueda
          productosStore.createIndex('sucursal_id', 'sucursal_id', { unique: false })
          productosStore.createIndex('nombre', 'nombre', { unique: false })
          productosStore.createIndex('codigo_barras', 'codigo_barras', { unique: false })
          productosStore.createIndex('cached_at', 'cached_at', { unique: false })
        }

        // Store: ventas-pendientes
        if (!db.objectStoreNames.contains(STORES.VENTAS_PENDIENTES)) {
          const ventasStore = db.createObjectStore(STORES.VENTAS_PENDIENTES, {
            keyPath: 'id',
          })
          // Índices para consulta
          ventasStore.createIndex('estado', 'estado', { unique: false })
          ventasStore.createIndex('sucursal_id', 'sucursal_id', { unique: false })
          ventasStore.createIndex('created_at', 'created_at', { unique: false })
        }

        // Store: asistencia-pendiente (v3)
        if (!db.objectStoreNames.contains(STORES.ASISTENCIA_PENDIENTE)) {
          const asistenciaStore = db.createObjectStore(STORES.ASISTENCIA_PENDIENTE, {
            keyPath: 'id',
          })
          asistenciaStore.createIndex('estado', 'estado', { unique: false })
          asistenciaStore.createIndex('branch_id', 'branch_id', { unique: false })
          asistenciaStore.createIndex('created_at', 'created_at', { unique: false })
        }

        // Store: sync-metadata
        if (!db.objectStoreNames.contains(STORES.SYNC_METADATA)) {
          db.createObjectStore(STORES.SYNC_METADATA, {
            keyPath: 'key',
          })
        }
      }
    })

    return this.dbPromise
  }

  /**
   * Cierra la conexión a la base de datos
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // OPERACIONES GENÉRICAS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Ejecuta una transacción con un store
   */
  private async transaction<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await this.open()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode)
      const store = transaction.objectStore(storeName)
      const request = operation(store)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Obtiene todos los registros de un store
   */
  async getAll<T>(storeName: string): Promise<T[]> {
    return this.transaction(storeName, 'readonly', (store) => store.getAll())
  }

  /**
   * Obtiene un registro por clave
   */
  async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    return this.transaction(storeName, 'readonly', (store) => store.get(key))
  }

  /**
   * Guarda un registro (insert o update)
   */
  async put<T>(storeName: string, value: T): Promise<IDBValidKey> {
    return this.transaction(storeName, 'readwrite', (store) => store.put(value))
  }

  /**
   * Elimina un registro por clave
   */
  async delete(storeName: string, key: IDBValidKey): Promise<void> {
    return this.transaction(storeName, 'readwrite', (store) => store.delete(key))
  }

  /**
   * Elimina todos los registros de un store
   */
  async clear(storeName: string): Promise<void> {
    return this.transaction(storeName, 'readwrite', (store) => store.clear())
  }

  /**
   * Cuenta registros en un store
   */
  async count(storeName: string): Promise<number> {
    return this.transaction(storeName, 'readonly', (store) => store.count())
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // OPERACIONES DE PRODUCTOS CACHE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Guarda productos en cache para una sucursal
   */
  async cacheProductos(productos: ProductoCache[]): Promise<void> {
    const db = await this.open()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PRODUCTOS_CACHE, 'readwrite')
      const store = transaction.objectStore(STORES.PRODUCTOS_CACHE)

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)

      // Guardar cada producto
      for (const producto of productos) {
        store.put(producto)
      }
    })
  }

  /**
   * Obtiene productos cacheados de una sucursal
   */
  async getProductosBySucursal(sucursalId: string): Promise<ProductoCache[]> {
    const db = await this.open()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PRODUCTOS_CACHE, 'readonly')
      const store = transaction.objectStore(STORES.PRODUCTOS_CACHE)
      const index = store.index('sucursal_id')
      const request = index.getAll(sucursalId)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Busca productos en cache (offline search)
   */
  async searchProductosOffline(
    sucursalId: string,
    query: string
  ): Promise<ProductoCache[]> {
    const productos = await this.getProductosBySucursal(sucursalId)
    const queryLower = query.toLowerCase()

    return productos
      .filter((p) => {
        // Excluir servicios virtuales
        if (p.nombre === 'Carga SUBE' || p.nombre === 'Carga Virtual') {
          return false
        }
        // Buscar por nombre o código de barras
        const matchNombre = p.nombre.toLowerCase().includes(queryLower)
        const matchCodigo = p.codigo_barras === query
        return matchNombre || matchCodigo
      })
      .slice(0, 5) // Límite de 5 como en la búsqueda online
  }

  /**
   * Elimina productos cacheados de una sucursal
   */
  async clearProductosBySucursal(sucursalId: string): Promise<void> {
    const productos = await this.getProductosBySucursal(sucursalId)
    const db = await this.open()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PRODUCTOS_CACHE, 'readwrite')
      const store = transaction.objectStore(STORES.PRODUCTOS_CACHE)

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)

      // Eliminar cada producto de esta sucursal
      for (const producto of productos) {
        store.delete([producto.id, producto.sucursal_id])
      }
    })
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // OPERACIONES DE VENTAS PENDIENTES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Guarda una venta pendiente
   */
  async saveVentaPendiente(venta: VentaPendiente): Promise<void> {
    await this.put(STORES.VENTAS_PENDIENTES, venta)
  }

  /**
   * Obtiene todas las ventas pendientes
   */
  async getVentasPendientes(): Promise<VentaPendiente[]> {
    return this.getAll<VentaPendiente>(STORES.VENTAS_PENDIENTES)
  }

  /**
   * Obtiene ventas pendientes por estado
   */
  async getVentasByEstado(estado: VentaPendienteEstado): Promise<VentaPendiente[]> {
    const db = await this.open()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.VENTAS_PENDIENTES, 'readonly')
      const store = transaction.objectStore(STORES.VENTAS_PENDIENTES)
      const index = store.index('estado')
      const request = index.getAll(estado)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Obtiene ventas que necesitan sincronización (pending o failed)
   */
  async getVentasParaSincronizar(): Promise<VentaPendiente[]> {
    const todas = await this.getVentasPendientes()
    return todas.filter((v) => v.estado === 'pending' || v.estado === 'failed')
  }

  /**
   * Obtiene todas las ventas pendientes (alias para compatibilidad)
   */
  async getAllVentasPendientes(): Promise<VentaPendiente[]> {
    return this.getVentasPendientes()
  }

  /**
   * Cuenta ventas pendientes de sync
   */
  async countVentasPendientesSync(): Promise<number> {
    const ventas = await this.getVentasParaSincronizar()
    return ventas.length
  }

  /**
   * Actualiza el estado de una venta pendiente
   */
  async updateVentaEstado(
    id: string,
    estado: VentaPendienteEstado,
    extra?: Partial<Pick<VentaPendiente, 'ultimo_error' | 'venta_id_servidor' | 'synced_at'>>
  ): Promise<void> {
    const venta = await this.get<VentaPendiente>(STORES.VENTAS_PENDIENTES, id)
    if (!venta) {
      throw new Error(`Venta ${id} no encontrada`)
    }

    const updated: VentaPendiente = {
      ...venta,
      estado,
      intentos: estado === 'syncing' ? venta.intentos + 1 : venta.intentos,
      ultimo_intento: estado === 'syncing' ? Date.now() : venta.ultimo_intento,
      ...extra,
    }

    await this.put(STORES.VENTAS_PENDIENTES, updated)
  }

  /**
   * Elimina una venta pendiente
   */
  async deleteVentaPendiente(id: string): Promise<void> {
    await this.delete(STORES.VENTAS_PENDIENTES, id)
  }

  /**
   * Elimina ventas sincronizadas exitosamente (limpieza)
   */
  async clearVentasSincronizadas(): Promise<number> {
    const sincronizadas = await this.getVentasByEstado('synced')

    for (const venta of sincronizadas) {
      await this.deleteVentaPendiente(venta.id)
    }

    return sincronizadas.length
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // OPERACIONES DE ASISTENCIA PENDIENTE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Guarda un fichaje pendiente (entrada o salida offline)
   */
  async saveAsistenciaPendiente(asistencia: AsistenciaPendiente): Promise<void> {
    await this.put(STORES.ASISTENCIA_PENDIENTE, asistencia)
  }

  /**
   * Obtiene todos los fichajes pendientes
   */
  async getAsistenciasPendientes(): Promise<AsistenciaPendiente[]> {
    return this.getAll<AsistenciaPendiente>(STORES.ASISTENCIA_PENDIENTE)
  }

  /**
   * Obtiene fichajes que necesitan sincronización
   */
  async getAsistenciasParaSincronizar(): Promise<AsistenciaPendiente[]> {
    const todas = await this.getAsistenciasPendientes()
    return todas.filter((a) => a.estado === 'pending' || a.estado === 'failed')
  }

  /**
   * Actualiza el estado de un fichaje pendiente
   */
  async updateAsistenciaEstado(
    id: string,
    estado: AsistenciaPendienteEstado,
    extra?: Partial<Pick<AsistenciaPendiente, 'ultimo_error' | 'synced_at'>>
  ): Promise<void> {
    const asistencia = await this.get<AsistenciaPendiente>(STORES.ASISTENCIA_PENDIENTE, id)
    if (!asistencia) {
      throw new Error(`Asistencia ${id} no encontrada`)
    }

    const updated: AsistenciaPendiente = {
      ...asistencia,
      estado,
      intentos: estado === 'syncing' ? asistencia.intentos + 1 : asistencia.intentos,
      ultimo_intento: estado === 'syncing' ? Date.now() : asistencia.ultimo_intento,
      ...extra,
    }

    await this.put(STORES.ASISTENCIA_PENDIENTE, updated)
  }

  /**
   * Elimina un fichaje pendiente
   */
  async deleteAsistenciaPendiente(id: string): Promise<void> {
    await this.delete(STORES.ASISTENCIA_PENDIENTE, id)
  }

  /**
   * Elimina fichajes ya sincronizados (limpieza)
   */
  async clearAsistenciasSincronizadas(): Promise<number> {
    const todas = await this.getAsistenciasPendientes()
    const sincronizadas = todas.filter((a) => a.estado === 'synced')

    for (const asistencia of sincronizadas) {
      await this.deleteAsistenciaPendiente(asistencia.id)
    }

    return sincronizadas.length
  }

  /**
   * Cuenta fichajes pendientes de sync
   */
  async countAsistenciasPendientesSync(): Promise<number> {
    const asistencias = await this.getAsistenciasParaSincronizar()
    return asistencias.length
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // OPERACIONES DE METADATA
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Guarda metadata de sincronización
   */
  async setMetadata(key: string, value: string | number | boolean): Promise<void> {
    const metadata: SyncMetadata = {
      key,
      value,
      updated_at: Date.now(),
    }
    await this.put(STORES.SYNC_METADATA, metadata)
  }

  /**
   * Obtiene metadata de sincronización
   */
  async getMetadata(key: string): Promise<SyncMetadata | undefined> {
    return this.get<SyncMetadata>(STORES.SYNC_METADATA, key)
  }

  /**
   * Obtiene el timestamp de última sincronización de productos
   */
  async getLastProductosSyncTime(sucursalId: string): Promise<number | null> {
    const metadata = await this.getMetadata(`productos-sync-${sucursalId}`)
    return metadata ? (metadata.value as number) : null
  }

  /**
   * Guarda el timestamp de sincronización de productos
   */
  async setLastProductosSyncTime(sucursalId: string): Promise<void> {
    await this.setMetadata(`productos-sync-${sucursalId}`, Date.now())
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Instancia singleton del servicio de IndexedDB
 */
export const offlineDB = new OfflineDB()

/**
 * Genera un UUID v4 para IDs locales
 */
export function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback para navegadores antiguos
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
