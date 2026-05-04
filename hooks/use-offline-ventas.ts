/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🛒 USE OFFLINE VENTAS - Hook para ventas con soporte offline
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Hook principal que permite realizar ventas tanto online como offline.
 * Cuando está offline:
 * - Busca productos en cache local (IndexedDB)
 * - Guarda ventas pendientes localmente
 * - Sincroniza automáticamente al reconectar
 *
 * USO:
 * ```tsx
 * const {
 *   searchProducts,
 *   processVenta,
 *   isOffline,
 *   pendingCount,
 *   syncStatus,
 *   forceSyncNow
 * } = useOfflineVentas({ sucursalId, organizationId })
 * ```
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useOnlineStatus } from './use-online-status'
import { offlineDB, generateLocalId, STORES, type VentaPendiente } from '@/lib/offline/indexed-db'
import { productCache, type ProductoFromServer } from '@/lib/offline/product-cache'
import { searchProductsAction, confirmSaleAction, type ConfirmSaleParams, type SaleItemInput, type ProductoVenta } from '@/lib/actions/ventas.actions'
import { getSyncManager } from '@/lib/offline/sync-manager'
import type { SyncStatus } from '@/types/app.types'

/**
 * Métodos de pago soportados en modo offline
 * Nota: Solo métodos que no requieren validación online
 * 'mercadopago' está aquí pero requiere validación online (QR dinámico)
 */
type OfflinePaymentMethod = 'cash' | 'card' | 'wallet' | 'mercadopago' | 'posnet_mp' | 'qr_static_mp' | 'transfer_alias'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

export interface UseOfflineVentasOptions {
  sucursalId: string
  organizationId: string
  turnoId?: string // caja_diaria_id
  vendedorId?: string
  /**
   * Si es true, sincroniza productos al montar el hook
   */
  syncProductsOnMount?: boolean
  /**
   * Callback cuando se completa una venta (online u offline)
   */
  onVentaCompleted?: (result: VentaResult) => void
  /**
   * Callback cuando cambia el estado de sincronización
   */
  onSyncStatusChange?: (status: SyncStatus) => void
}

export interface VentaResult {
  success: boolean
  ventaId?: string // ID del servidor (si online) o ID local (si offline)
  isOffline: boolean
  error?: string
  // Campos ARCA (T15a) — solo poblados en venta online cuando ARCA está activo.
  // En offline quedan undefined; la facturación se hace al sincronizar (T15c).
  invoiceSkipped?: boolean
  invoiceAlreadyInvoiced?: boolean
  invoiceCAE?: string
  invoiceCbteNumero?: number
  invoiceError?: string
  /** ID de arca_invoices (T13) — habilita descarga del PDF post-venta. */
  invoiceId?: string
}

export interface UseOfflineVentasReturn {
  // Búsqueda
  searchProducts: (query: string) => Promise<ProductoVenta[]>
  isSearchingOffline: boolean

  // Venta
  processVenta: (params: ProcessVentaParams) => Promise<VentaResult>
  isProcessing: boolean

  // Estado de conexión
  isOffline: boolean
  connectionQuality: string | null // '4g', '3g', '2g', 'slow-2g'

  // Ventas pendientes
  pendingCount: number
  pendingVentas: VentaPendiente[]

  // Sincronización
  syncStatus: SyncStatus
  lastSyncAt: Date | null
  forceSyncNow: () => Promise<void>
  retryFailed: () => Promise<void>

  // Cache de productos
  productCacheStatus: {
    count: number
    lastSyncAt: number | null
    isStale: boolean
  }
  refreshProductCache: () => Promise<void>
}

export interface ProcessVentaParams {
  items: Array<{
    producto_id: string
    cantidad: number
    precio_unitario: number
    nombre: string
  }>
  metodoPago: OfflinePaymentMethod
  montoTotal: number
}

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

const SYNC_DEBOUNCE_MS = 2000 // Esperar 2s después de reconectar antes de sincronizar

// ───────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────

export function useOfflineVentas(options: UseOfflineVentasOptions): UseOfflineVentasReturn {
  const {
    sucursalId,
    organizationId,
    turnoId,
    vendedorId,
    syncProductsOnMount = true,
    onVentaCompleted,
    onSyncStatusChange,
  } = options

  // Estado de conexión — pingServer: true para detección confiable
  // (navigator.onLine es unreliable según SKILL.md)
  const { isOnline, effectiveType } = useOnlineStatus({
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
  const [isSearchingOffline, setIsSearchingOffline] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingVentas, setPendingVentas] = useState<VentaPendiente[]>([])
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
  const [productCacheStatus, setProductCacheStatus] = useState({
    count: 0,
    lastSyncAt: null as number | null,
    isStale: true,
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // EFECTOS
  // ─────────────────────────────────────────────────────────────────────────────

  // Cargar ventas pendientes al montar
  useEffect(() => {
    loadPendingVentas()
  }, [])

  // Sincronizar productos al montar (si está online)
  useEffect(() => {
    if (syncProductsOnMount && isOnline && sucursalId) {
      refreshProductCache()
    }
  }, [sucursalId, isOnline, syncProductsOnMount])

  // Actualizar estado del cache
  useEffect(() => {
    updateProductCacheStatus()
  }, [sucursalId])

  // Notificar cambios de syncStatus
  useEffect(() => {
    onSyncStatusChange?.(syncStatus)
  }, [syncStatus, onSyncStatusChange])

  // Escuchar mensajes del Service Worker (sync completado en background)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const handleSWMessage = (event: MessageEvent) => {
      const { type } = event.data || {}
      if (type === 'SYNC_COMPLETE' || type === 'SYNC_STATUS') {
        // El SW sincronizó ventas — recargar estado
        loadPendingVentas()
      }
    }

    navigator.serviceWorker.addEventListener('message', handleSWMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // FUNCIONES AUXILIARES
  // ─────────────────────────────────────────────────────────────────────────────

  const loadPendingVentas = async () => {
    try {
      // Recover stuck 'syncing' ventas (app was closed mid-sync)
      // Undo intentos increment — the interrupted sync shouldn't count as a retry
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

      const ventas = await offlineDB.getVentasParaSincronizar()
      setPendingVentas(ventas)
      setPendingCount(ventas.length)
    } catch (error) {
      console.error('Error cargando ventas pendientes:', error)
    }
  }

  const updateProductCacheStatus = async () => {
    try {
      const status = await productCache.getStatus(sucursalId)
      setProductCacheStatus({
        count: status.productCount,
        lastSyncAt: status.lastSyncAt,
        isStale: status.isStale,
      })
    } catch (error) {
      console.error('Error obteniendo estado del cache:', error)
    }
  }

  const scheduleSyncAfterReconnect = () => {
    // Cancelar timeout anterior si existe
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    // Programar sincronización
    syncTimeoutRef.current = setTimeout(() => {
      syncPendingVentas()
    }, SYNC_DEBOUNCE_MS)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BÚSQUEDA DE PRODUCTOS
  // ─────────────────────────────────────────────────────────────────────────────

  const searchProducts = useCallback(async (query: string): Promise<ProductoVenta[]> => {
    if (!query || query.trim().length === 0) {
      return []
    }

    // Si está online, usar búsqueda del servidor
    if (isOnline) {
      setIsSearchingOffline(false)
      const result = await searchProductsAction(query, sucursalId)
      if (result.success) {
        return result.products
      }
      // Si falla la búsqueda online, intentar offline como fallback
      console.warn('Búsqueda online falló, usando cache:', result.error)
    }

    // Búsqueda offline
    setIsSearchingOffline(true)
    try {
      const cached = await productCache.searchOffline(sucursalId, query)
      return cached.map((p) => ({
        id: p.id,
        name: p.nombre,
        price: p.precio_venta,
        stock: p.stock_disponible,
        barcode: p.codigo_barras || undefined,
      }))
    } finally {
      setIsSearchingOffline(false)
    }
  }, [isOnline, sucursalId])

  // ─────────────────────────────────────────────────────────────────────────────
  // PROCESAR VENTA
  // ─────────────────────────────────────────────────────────────────────────────

  const processVenta = useCallback(async (params: ProcessVentaParams): Promise<VentaResult> => {
    setIsProcessing(true)

    try {
      // Si está online y hay turno, procesar directamente
      if (isOnline && turnoId) {
        const confirmParams: ConfirmSaleParams = {
          branchId: sucursalId,
          cashRegisterId: turnoId,
          items: params.items.map((item): SaleItemInput => ({
            product_id: item.producto_id,
            quantity: item.cantidad,
            unit_price: item.precio_unitario,
            subtotal: item.cantidad * item.precio_unitario,
          })),
          paymentMethod: params.metodoPago,
          total: params.montoTotal,
        }

        const result = await confirmSaleAction(confirmParams)

        if (result.success) {
          const ventaResult: VentaResult = {
            success: true,
            ventaId: result.saleId,
            isOffline: false,
            invoiceSkipped: result.invoiceSkipped,
            invoiceAlreadyInvoiced: result.invoiceAlreadyInvoiced,
            invoiceCAE: result.invoiceCAE,
            invoiceCbteNumero: result.invoiceCbteNumero,
            invoiceError: result.invoiceError,
            invoiceId: result.invoiceId,
          }
          onVentaCompleted?.(ventaResult)
          return ventaResult
        }

        // Si falla el online, guardar offline como fallback
        console.warn('Venta online falló, guardando offline:', result.error)
      }

      // Guardar venta offline
      if (!turnoId) {
        console.warn('Venta offline guardada sin turnoId — el sync asignará la caja activa')
      }
      const localId = generateLocalId()
      const ventaPendiente: VentaPendiente = {
        id: localId,
        sucursal_id: sucursalId,
        turno_id: turnoId || 'offline-no-turno',
        organization_id: organizationId,
        items: params.items.map((item) => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          nombre: item.nombre,
          subtotal: item.cantidad * item.precio_unitario,
        })),
        metodo_pago: params.metodoPago,
        monto_total: params.montoTotal,
        vendedor_id: vendedorId || null,
        created_at: Date.now(),
        estado: 'pending',
        intentos: 0,
        ultimo_intento: null,
        ultimo_error: null,
        venta_id_servidor: null,
        synced_at: null,
      }

      await offlineDB.saveVentaPendiente(ventaPendiente)

      // Actualizar stock local para consistencia visual
      for (const item of params.items) {
        await productCache.reduceStock(item.producto_id, sucursalId, item.cantidad)
      }

      // Recargar lista de pendientes
      await loadPendingVentas()

      const ventaResult: VentaResult = {
        success: true,
        ventaId: localId,
        isOffline: true,
      }
      onVentaCompleted?.(ventaResult)
      return ventaResult

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      return {
        success: false,
        isOffline: !isOnline,
        error: errorMessage,
      }
    } finally {
      setIsProcessing(false)
    }
  }, [isOnline, sucursalId, turnoId, organizationId, vendedorId, onVentaCompleted])

  // ─────────────────────────────────────────────────────────────────────────────
  // SINCRONIZACIÓN
  // ─────────────────────────────────────────────────────────────────────────────

  const syncPendingVentas = useCallback(async () => {
    if (!isOnline) {
      console.log('No se puede sincronizar: sin conexión')
      return
    }

    const syncManager = getSyncManager()

    // Prevent duplicate syncs
    if (syncManager.isSyncInProgress()) {
      return
    }

    setSyncStatus('syncing')

    // SyncManager handles: backoff exponencial, AbortController,
    // complete payload (organizationId + vendedorId), retry limits
    const result = await syncManager.syncAll()

    // Recargar lista
    await loadPendingVentas()

    // Actualizar estado
    setLastSyncAt(new Date())
    setSyncStatus(result.failedCount > 0 ? 'error' : 'success')

    // Volver a idle después de 3 segundos
    setTimeout(() => {
      setSyncStatus('idle')
    }, 3000)

    console.log(`Sincronización completada: ${result.syncedCount} exitosas, ${result.failedCount} errores`)
  }, [isOnline])

  const forceSyncNow = useCallback(async () => {
    await syncPendingVentas()
  }, [syncPendingVentas])

  const retryFailed = useCallback(async () => {
    // Resetear intentos de ventas con error
    const ventasConError = await offlineDB.getVentasByEstado('failed')
    for (const venta of ventasConError) {
      await offlineDB.updateVentaEstado(venta.id, 'pending')
    }
    await loadPendingVentas()
    // Intentar sincronizar
    await syncPendingVentas()
  }, [syncPendingVentas])

  // ─────────────────────────────────────────────────────────────────────────────
  // CACHE DE PRODUCTOS
  // ─────────────────────────────────────────────────────────────────────────────

  const refreshProductCache = useCallback(async () => {
    if (!isOnline) {
      console.log('No se puede refrescar cache: sin conexión')
      return
    }

    try {
      const result = await productCache.syncFromServer(
        sucursalId,
        async () => {
          // Fetch productos desde el servidor
          const response = await fetch(`/api/productos?sucursalId=${sucursalId}`)
          if (!response.ok) {
            throw new Error('Error obteniendo productos')
          }
          const data = await response.json()
          return data.productos as ProductoFromServer[]
        },
        true // force
      )

      if (result.success) {
        await updateProductCacheStatus()
        console.log(`Cache de productos actualizado: ${result.count} productos`)
      }
    } catch (error) {
      console.error('Error refrescando cache de productos:', error)
    }
  }, [isOnline, sucursalId])

  // ─────────────────────────────────────────────────────────────────────────────
  // BACKGROUND SYNC REGISTRATION & BEFOREUNLOAD
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Registra Background Sync para que el SW sincronice ventas pendientes
   * cuando vuelva la conexión (incluso si la app está cerrada).
   */
  const registerBackgroundSync = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready
        // Background Sync API — not in all TS lib types yet
        await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-ventas')
      }
    } catch (error) {
      // Background Sync no soportado o falló - no es crítico
      console.warn('Background Sync no disponible:', error)
    }
  }, [])

  // Registrar Background Sync cuando hay ventas pendientes y estamos offline
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
        loadPendingVentas()
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
    // Búsqueda
    searchProducts,
    isSearchingOffline,

    // Venta
    processVenta,
    isProcessing,

    // Estado de conexión
    isOffline: !isOnline,
    connectionQuality: effectiveType,

    // Ventas pendientes
    pendingCount,
    pendingVentas,

    // Sincronización
    syncStatus,
    lastSyncAt,
    forceSyncNow,
    retryFailed,

    // Cache de productos
    productCacheStatus,
    refreshProductCache,
  }
}

export default useOfflineVentas
