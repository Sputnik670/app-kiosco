(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/hooks/use-offline-ventas.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

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
 */ __turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__,
    "useOfflineVentas",
    ()=>useOfflineVentas
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$use$2d$online$2d$status$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/hooks/use-online-status.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/offline/indexed-db.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$product$2d$cache$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/offline/product-cache.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$data$3a$0d0502__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/lib/actions/data:0d0502 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$data$3a$964839__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/lib/actions/data:964839 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$sync$2d$manager$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/offline/sync-manager.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────
const SYNC_DEBOUNCE_MS = 2000 // Esperar 2s después de reconectar antes de sincronizar
;
function useOfflineVentas(options) {
    _s();
    const { sucursalId, organizationId, turnoId, vendedorId, syncProductsOnMount = true, onVentaCompleted, onSyncStatusChange } = options;
    // Estado de conexión — pingServer: true para detección confiable
    // (navigator.onLine es unreliable según SKILL.md)
    const { isOnline, effectiveType } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$use$2d$online$2d$status$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useOnlineStatus"])({
        pingServer: true,
        pingInterval: 30000,
        onStatusChange: {
            "useOfflineVentas.useOnlineStatus": (status)=>{
                // Cuando vuelve online, programar sincronización
                if (status.isOnline && !wasOnlineRef.current) {
                    scheduleSyncAfterReconnect();
                }
                wasOnlineRef.current = status.isOnline;
            }
        }["useOfflineVentas.useOnlineStatus"]
    });
    // Referencias
    const wasOnlineRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(isOnline);
    const syncTimeoutRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Estados locales
    const [isSearchingOffline, setIsSearchingOffline] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isProcessing, setIsProcessing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [pendingCount, setPendingCount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [pendingVentas, setPendingVentas] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [syncStatus, setSyncStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('idle');
    const [lastSyncAt, setLastSyncAt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [productCacheStatus, setProductCacheStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        count: 0,
        lastSyncAt: null,
        isStale: true
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // EFECTOS
    // ─────────────────────────────────────────────────────────────────────────────
    // Cargar ventas pendientes al montar
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useOfflineVentas.useEffect": ()=>{
            loadPendingVentas();
        }
    }["useOfflineVentas.useEffect"], []);
    // Sincronizar productos al montar (si está online)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useOfflineVentas.useEffect": ()=>{
            if (syncProductsOnMount && isOnline && sucursalId) {
                refreshProductCache();
            }
        }
    }["useOfflineVentas.useEffect"], [
        sucursalId,
        isOnline,
        syncProductsOnMount
    ]);
    // Actualizar estado del cache
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useOfflineVentas.useEffect": ()=>{
            updateProductCacheStatus();
        }
    }["useOfflineVentas.useEffect"], [
        sucursalId
    ]);
    // Notificar cambios de syncStatus
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useOfflineVentas.useEffect": ()=>{
            onSyncStatusChange?.(syncStatus);
        }
    }["useOfflineVentas.useEffect"], [
        syncStatus,
        onSyncStatusChange
    ]);
    // Escuchar mensajes del Service Worker (sync completado en background)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useOfflineVentas.useEffect": ()=>{
            if (!('serviceWorker' in navigator)) return;
            const handleSWMessage = {
                "useOfflineVentas.useEffect.handleSWMessage": (event)=>{
                    const { type } = event.data || {};
                    if (type === 'SYNC_COMPLETE' || type === 'SYNC_STATUS') {
                        // El SW sincronizó ventas — recargar estado
                        loadPendingVentas();
                    }
                }
            }["useOfflineVentas.useEffect.handleSWMessage"];
            navigator.serviceWorker.addEventListener('message', handleSWMessage);
            return ({
                "useOfflineVentas.useEffect": ()=>navigator.serviceWorker.removeEventListener('message', handleSWMessage)
            })["useOfflineVentas.useEffect"];
        }
    }["useOfflineVentas.useEffect"], []);
    // ─────────────────────────────────────────────────────────────────────────────
    // FUNCIONES AUXILIARES
    // ─────────────────────────────────────────────────────────────────────────────
    const loadPendingVentas = async ()=>{
        try {
            // Recover stuck 'syncing' ventas (app was closed mid-sync)
            // Undo intentos increment — the interrupted sync shouldn't count as a retry
            const allVentas = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].getVentasPendientes();
            for (const v of allVentas){
                if (v.estado === 'syncing') {
                    await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].put(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORES"].VENTAS_PENDIENTES, {
                        ...v,
                        estado: 'pending',
                        intentos: Math.max(0, v.intentos - 1)
                    });
                }
            }
            const ventas = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].getVentasParaSincronizar();
            setPendingVentas(ventas);
            setPendingCount(ventas.length);
        } catch (error) {
            console.error('Error cargando ventas pendientes:', error);
        }
    };
    const updateProductCacheStatus = async ()=>{
        try {
            const status = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$product$2d$cache$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCache"].getStatus(sucursalId);
            setProductCacheStatus({
                count: status.productCount,
                lastSyncAt: status.lastSyncAt,
                isStale: status.isStale
            });
        } catch (error) {
            console.error('Error obteniendo estado del cache:', error);
        }
    };
    const scheduleSyncAfterReconnect = ()=>{
        // Cancelar timeout anterior si existe
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
        }
        // Programar sincronización
        syncTimeoutRef.current = setTimeout(()=>{
            syncPendingVentas();
        }, SYNC_DEBOUNCE_MS);
    };
    // ─────────────────────────────────────────────────────────────────────────────
    // BÚSQUEDA DE PRODUCTOS
    // ─────────────────────────────────────────────────────────────────────────────
    const searchProducts = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOfflineVentas.useCallback[searchProducts]": async (query)=>{
            if (!query || query.trim().length === 0) {
                return [];
            }
            // Si está online, usar búsqueda del servidor
            if (isOnline) {
                setIsSearchingOffline(false);
                const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$data$3a$0d0502__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["searchProductsAction"])(query, sucursalId);
                if (result.success) {
                    return result.products;
                }
                // Si falla la búsqueda online, intentar offline como fallback
                console.warn('Búsqueda online falló, usando cache:', result.error);
            }
            // Búsqueda offline
            setIsSearchingOffline(true);
            try {
                const cached = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$product$2d$cache$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCache"].searchOffline(sucursalId, query);
                return cached.map({
                    "useOfflineVentas.useCallback[searchProducts]": (p)=>({
                            id: p.id,
                            name: p.nombre,
                            price: p.precio_venta,
                            stock: p.stock_disponible,
                            barcode: p.codigo_barras || undefined
                        })
                }["useOfflineVentas.useCallback[searchProducts]"]);
            } finally{
                setIsSearchingOffline(false);
            }
        }
    }["useOfflineVentas.useCallback[searchProducts]"], [
        isOnline,
        sucursalId
    ]);
    // ─────────────────────────────────────────────────────────────────────────────
    // PROCESAR VENTA
    // ─────────────────────────────────────────────────────────────────────────────
    const processVenta = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOfflineVentas.useCallback[processVenta]": async (params)=>{
            setIsProcessing(true);
            try {
                // Si está online y hay turno, procesar directamente
                if (isOnline && turnoId) {
                    const confirmParams = {
                        branchId: sucursalId,
                        cashRegisterId: turnoId,
                        items: params.items.map({
                            "useOfflineVentas.useCallback[processVenta]": (item)=>({
                                    product_id: item.producto_id,
                                    quantity: item.cantidad,
                                    unit_price: item.precio_unitario,
                                    subtotal: item.cantidad * item.precio_unitario
                                })
                        }["useOfflineVentas.useCallback[processVenta]"]),
                        paymentMethod: params.metodoPago,
                        total: params.montoTotal
                    };
                    const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$data$3a$964839__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["confirmSaleAction"])(confirmParams);
                    if (result.success) {
                        const ventaResult = {
                            success: true,
                            ventaId: result.saleId,
                            isOffline: false
                        };
                        onVentaCompleted?.(ventaResult);
                        return ventaResult;
                    }
                    // Si falla el online, guardar offline como fallback
                    console.warn('Venta online falló, guardando offline:', result.error);
                }
                // Guardar venta offline
                if (!turnoId) {
                    console.warn('Venta offline guardada sin turnoId — el sync asignará la caja activa');
                }
                const localId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["generateLocalId"])();
                const ventaPendiente = {
                    id: localId,
                    sucursal_id: sucursalId,
                    turno_id: turnoId || 'offline-no-turno',
                    organization_id: organizationId,
                    items: params.items.map({
                        "useOfflineVentas.useCallback[processVenta]": (item)=>({
                                producto_id: item.producto_id,
                                cantidad: item.cantidad,
                                precio_unitario: item.precio_unitario,
                                nombre: item.nombre,
                                subtotal: item.cantidad * item.precio_unitario
                            })
                    }["useOfflineVentas.useCallback[processVenta]"]),
                    metodo_pago: params.metodoPago,
                    monto_total: params.montoTotal,
                    vendedor_id: vendedorId || null,
                    created_at: Date.now(),
                    estado: 'pending',
                    intentos: 0,
                    ultimo_intento: null,
                    ultimo_error: null,
                    venta_id_servidor: null,
                    synced_at: null
                };
                await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].saveVentaPendiente(ventaPendiente);
                // Actualizar stock local para consistencia visual
                for (const item of params.items){
                    await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$product$2d$cache$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCache"].reduceStock(item.producto_id, sucursalId, item.cantidad);
                }
                // Recargar lista de pendientes
                await loadPendingVentas();
                const ventaResult = {
                    success: true,
                    ventaId: localId,
                    isOffline: true
                };
                onVentaCompleted?.(ventaResult);
                return ventaResult;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
                return {
                    success: false,
                    isOffline: !isOnline,
                    error: errorMessage
                };
            } finally{
                setIsProcessing(false);
            }
        }
    }["useOfflineVentas.useCallback[processVenta]"], [
        isOnline,
        sucursalId,
        turnoId,
        organizationId,
        vendedorId,
        onVentaCompleted
    ]);
    // ─────────────────────────────────────────────────────────────────────────────
    // SINCRONIZACIÓN
    // ─────────────────────────────────────────────────────────────────────────────
    const syncPendingVentas = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOfflineVentas.useCallback[syncPendingVentas]": async ()=>{
            if (!isOnline) {
                console.log('No se puede sincronizar: sin conexión');
                return;
            }
            const syncManager = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$sync$2d$manager$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSyncManager"])();
            // Prevent duplicate syncs
            if (syncManager.isSyncInProgress()) {
                return;
            }
            setSyncStatus('syncing');
            // SyncManager handles: backoff exponencial, AbortController,
            // complete payload (organizationId + vendedorId), retry limits
            const result = await syncManager.syncAll();
            // Recargar lista
            await loadPendingVentas();
            // Actualizar estado
            setLastSyncAt(new Date());
            setSyncStatus(result.failedCount > 0 ? 'error' : 'success');
            // Volver a idle después de 3 segundos
            setTimeout({
                "useOfflineVentas.useCallback[syncPendingVentas]": ()=>{
                    setSyncStatus('idle');
                }
            }["useOfflineVentas.useCallback[syncPendingVentas]"], 3000);
            console.log(`Sincronización completada: ${result.syncedCount} exitosas, ${result.failedCount} errores`);
        }
    }["useOfflineVentas.useCallback[syncPendingVentas]"], [
        isOnline
    ]);
    const forceSyncNow = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOfflineVentas.useCallback[forceSyncNow]": async ()=>{
            await syncPendingVentas();
        }
    }["useOfflineVentas.useCallback[forceSyncNow]"], [
        syncPendingVentas
    ]);
    const retryFailed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOfflineVentas.useCallback[retryFailed]": async ()=>{
            // Resetear intentos de ventas con error
            const ventasConError = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].getVentasByEstado('failed');
            for (const venta of ventasConError){
                await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].updateVentaEstado(venta.id, 'pending');
            }
            await loadPendingVentas();
            // Intentar sincronizar
            await syncPendingVentas();
        }
    }["useOfflineVentas.useCallback[retryFailed]"], [
        syncPendingVentas
    ]);
    // ─────────────────────────────────────────────────────────────────────────────
    // CACHE DE PRODUCTOS
    // ─────────────────────────────────────────────────────────────────────────────
    const refreshProductCache = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOfflineVentas.useCallback[refreshProductCache]": async ()=>{
            if (!isOnline) {
                console.log('No se puede refrescar cache: sin conexión');
                return;
            }
            try {
                const result = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$product$2d$cache$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCache"].syncFromServer(sucursalId, {
                    "useOfflineVentas.useCallback[refreshProductCache]": async ()=>{
                        // Fetch productos desde el servidor
                        const response = await fetch(`/api/productos?sucursalId=${sucursalId}`);
                        if (!response.ok) {
                            throw new Error('Error obteniendo productos');
                        }
                        const data = await response.json();
                        return data.productos;
                    }
                }["useOfflineVentas.useCallback[refreshProductCache]"], true // force
                );
                if (result.success) {
                    await updateProductCacheStatus();
                    console.log(`Cache de productos actualizado: ${result.count} productos`);
                }
            } catch (error) {
                console.error('Error refrescando cache de productos:', error);
            }
        }
    }["useOfflineVentas.useCallback[refreshProductCache]"], [
        isOnline,
        sucursalId
    ]);
    // ─────────────────────────────────────────────────────────────────────────────
    // BACKGROUND SYNC REGISTRATION & BEFOREUNLOAD
    // ─────────────────────────────────────────────────────────────────────────────
    /**
   * Registra Background Sync para que el SW sincronice ventas pendientes
   * cuando vuelva la conexión (incluso si la app está cerrada).
   */ const registerBackgroundSync = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOfflineVentas.useCallback[registerBackgroundSync]": async ()=>{
            try {
                if ('serviceWorker' in navigator && 'SyncManager' in window) {
                    const registration = await navigator.serviceWorker.ready;
                    // Background Sync API — not in all TS lib types yet
                    await registration.sync.register('sync-ventas');
                }
            } catch (error) {
                // Background Sync no soportado o falló - no es crítico
                console.warn('Background Sync no disponible:', error);
            }
        }
    }["useOfflineVentas.useCallback[registerBackgroundSync]"], []);
    // Registrar Background Sync cuando hay ventas pendientes y estamos offline
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useOfflineVentas.useEffect": ()=>{
            if (pendingCount > 0 && !isOnline) {
                registerBackgroundSync();
            }
        }
    }["useOfflineVentas.useEffect"], [
        pendingCount,
        isOnline,
        registerBackgroundSync
    ]);
    // Proteger datos al cerrar la app: registrar Background Sync
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useOfflineVentas.useEffect": ()=>{
            const handleBeforeUnload = {
                "useOfflineVentas.useEffect.handleBeforeUnload": ()=>{
                    if (pendingCount > 0) {
                        registerBackgroundSync();
                    }
                }
            }["useOfflineVentas.useEffect.handleBeforeUnload"];
            window.addEventListener('beforeunload', handleBeforeUnload);
            return ({
                "useOfflineVentas.useEffect": ()=>window.removeEventListener('beforeunload', handleBeforeUnload)
            })["useOfflineVentas.useEffect"];
        }
    }["useOfflineVentas.useEffect"], [
        pendingCount,
        registerBackgroundSync
    ]);
    // Sincronizar al volver de pestaña inactiva (visibilitychange)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useOfflineVentas.useEffect": ()=>{
            const handleVisibilityChange = {
                "useOfflineVentas.useEffect.handleVisibilityChange": ()=>{
                    if (document.visibilityState === 'visible' && isOnline) {
                        loadPendingVentas();
                        if (pendingCount > 0) {
                            scheduleSyncAfterReconnect();
                        }
                    }
                }
            }["useOfflineVentas.useEffect.handleVisibilityChange"];
            document.addEventListener('visibilitychange', handleVisibilityChange);
            return ({
                "useOfflineVentas.useEffect": ()=>document.removeEventListener('visibilitychange', handleVisibilityChange)
            })["useOfflineVentas.useEffect"];
        }
    }["useOfflineVentas.useEffect"], [
        isOnline,
        pendingCount
    ]);
    // ─────────────────────────────────────────────────────────────────────────────
    // CLEANUP
    // ─────────────────────────────────────────────────────────────────────────────
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useOfflineVentas.useEffect": ()=>{
            return ({
                "useOfflineVentas.useEffect": ()=>{
                    if (syncTimeoutRef.current) {
                        clearTimeout(syncTimeoutRef.current);
                    }
                }
            })["useOfflineVentas.useEffect"];
        }
    }["useOfflineVentas.useEffect"], []);
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
        refreshProductCache
    };
}
_s(useOfflineVentas, "bw9K/vDM5wK16hxZmhprUNih13k=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$use$2d$online$2d$status$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useOnlineStatus"]
    ];
});
const __TURBOPACK__default__export__ = useOfflineVentas;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/hooks/use-cart.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useCart",
    ()=>useCart
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
;
function useCart(options = {}) {
    _s();
    const [items, setItems] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const addItem = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useCart.useCallback[addItem]": (product)=>{
            setItems({
                "useCart.useCallback[addItem]": (prev)=>{
                    const existing = prev.find({
                        "useCart.useCallback[addItem].existing": (p)=>p.id === product.id
                    }["useCart.useCallback[addItem].existing"]);
                    if (existing) {
                        return prev.map({
                            "useCart.useCallback[addItem]": (p)=>p.id === product.id ? {
                                    ...p,
                                    cantidad: p.cantidad + 1
                                } : p
                        }["useCart.useCallback[addItem]"]);
                    }
                    const newItem = {
                        ...product,
                        cantidad: 1
                    };
                    options.onItemAdded?.(newItem);
                    return [
                        ...prev,
                        newItem
                    ];
                }
            }["useCart.useCallback[addItem]"]);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success(`+1 ${product.name}`, {
                position: "bottom-center",
                duration: 800
            });
        }
    }["useCart.useCallback[addItem]"], [
        options
    ]);
    const removeItem = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useCart.useCallback[removeItem]": (itemId)=>{
            setItems({
                "useCart.useCallback[removeItem]": (prev)=>prev.filter({
                        "useCart.useCallback[removeItem]": (item)=>item.id !== itemId
                    }["useCart.useCallback[removeItem]"])
            }["useCart.useCallback[removeItem]"]);
            options.onItemRemoved?.(itemId);
        }
    }["useCart.useCallback[removeItem]"], [
        options
    ]);
    const updateQuantity = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useCart.useCallback[updateQuantity]": (itemId, delta)=>{
            setItems({
                "useCart.useCallback[updateQuantity]": (prev)=>prev.map({
                        "useCart.useCallback[updateQuantity]": (p)=>p.id === itemId ? {
                                ...p,
                                cantidad: Math.max(1, p.cantidad + delta)
                            } : p
                    }["useCart.useCallback[updateQuantity]"])
            }["useCart.useCallback[updateQuantity]"]);
        }
    }["useCart.useCallback[updateQuantity]"], []);
    const incrementItem = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useCart.useCallback[incrementItem]": (itemId)=>updateQuantity(itemId, 1)
    }["useCart.useCallback[incrementItem]"], [
        updateQuantity
    ]);
    const decrementItem = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useCart.useCallback[decrementItem]": (itemId)=>updateQuantity(itemId, -1)
    }["useCart.useCallback[decrementItem]"], [
        updateQuantity
    ]);
    const clearCart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useCart.useCallback[clearCart]": ()=>{
            setItems([]);
        }
    }["useCart.useCallback[clearCart]"], []);
    const getTotal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useCart.useCallback[getTotal]": ()=>{
            return items.reduce({
                "useCart.useCallback[getTotal]": (total, item)=>total + item.price * item.cantidad
            }["useCart.useCallback[getTotal]"], 0);
        }
    }["useCart.useCallback[getTotal]"], [
        items
    ]);
    const getItemCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useCart.useCallback[getItemCount]": ()=>{
            return items.reduce({
                "useCart.useCallback[getItemCount]": (count, item)=>count + item.cantidad
            }["useCart.useCallback[getItemCount]"], 0);
        }
    }["useCart.useCallback[getItemCount]"], [
        items
    ]);
    const isEmpty = items.length === 0;
    return {
        items,
        addItem,
        removeItem,
        updateQuantity,
        incrementItem,
        decrementItem,
        clearCart,
        getTotal,
        getItemCount,
        isEmpty
    };
}
_s(useCart, "aj/ZzLgS/r3N1Ck1fN1mSSGckIc=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>HomePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$qr$2d$code$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__QrCode$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/qr-code.js [app-client] (ecmascript) <export default as QrCode>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$dollar$2d$sign$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__DollarSign$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/dollar-sign.js [app-client] (ecmascript) <export default as DollarSign>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/triangle-alert.js [app-client] (ecmascript) <export default as AlertTriangle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shopping$2d$cart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ShoppingCart$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shopping-cart.js [app-client] (ecmascript) <export default as ShoppingCart>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$dashboard$2d$dueno$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/dashboard-dueno.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$vista$2d$empleado$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/vista-empleado.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$auth$2d$form$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/auth-form.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$profile$2d$setup$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/profile-setup.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$seleccionar$2d$sucursal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/seleccionar-sucursal.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$qr$2d$fichaje$2d$scanner$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/qr-fichaje-scanner.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$data$3a$9fd2c0__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/lib/actions/data:9fd2c0 [app-client] (ecmascript) <text/javascript>");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
;
;
function EscanearQRFichaje({ onQRScanned }) {
    _s();
    const [showScanner, setShowScanner] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const handleQRScanned = (data)=>{
        onQRScanned(data);
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success(data.tipo === "entrada" ? "QR de entrada escaneado" : "QR de salida escaneado", {
            description: `Local: ${data.sucursal_nombre || "Sucursal"}`
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen flex items-center justify-center p-6 bg-slate-50",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                className: "w-full max-w-md shadow-2xl border-0 rounded-[2.5rem] overflow-hidden",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "bg-slate-900 p-8 text-white text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "bg-blue-500 p-3 rounded-2xl shadow-lg shadow-blue-500/20 inline-block mb-4",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$qr$2d$code$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__QrCode$3e$__["QrCode"], {
                                    className: "h-8 w-8 text-white"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 42,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/page.tsx",
                                lineNumber: 41,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                className: "text-3xl font-black uppercase tracking-tighter italic mb-2",
                                children: "Kiosco 24hs"
                            }, void 0, false, {
                                fileName: "[project]/app/page.tsx",
                                lineNumber: 44,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-blue-400 text-[10px] font-black uppercase tracking-[0.4em]",
                                children: "Sistema de Fichaje"
                            }, void 0, false, {
                                fileName: "[project]/app/page.tsx",
                                lineNumber: 45,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 40,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-8 space-y-6",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-center space-y-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-xl font-black text-slate-800 uppercase tracking-tight",
                                        children: "Escanea el QR del Local"
                                    }, void 0, false, {
                                        fileName: "[project]/app/page.tsx",
                                        lineNumber: 50,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm font-medium text-slate-400",
                                        children: "Cada local tiene un QR de entrada y otro de salida. Escanea el correspondiente según tu situación."
                                    }, void 0, false, {
                                        fileName: "[project]/app/page.tsx",
                                        lineNumber: 53,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/page.tsx",
                                lineNumber: 49,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 space-y-4",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-start gap-3",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "bg-blue-500 rounded-lg p-2",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$qr$2d$code$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__QrCode$3e$__["QrCode"], {
                                                className: "h-5 w-5 text-white"
                                            }, void 0, false, {
                                                fileName: "[project]/app/page.tsx",
                                                lineNumber: 61,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 60,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex-1",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                    className: "font-black text-blue-900 text-sm uppercase mb-1",
                                                    children: "Instrucciones"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/page.tsx",
                                                    lineNumber: 64,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                                    className: "text-xs text-blue-800 space-y-1 font-bold",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                            children: "• Busca el QR en el local"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 66,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                            children: "• Escanea el QR de ENTRADA al llegar"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 67,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                            children: "• Escanea el QR de SALIDA al terminar"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 68,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                            children: "• No puedes elegir el local manualmente"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 69,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/page.tsx",
                                                    lineNumber: 65,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 63,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 59,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/page.tsx",
                                lineNumber: 58,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                onClick: ()=>setShowScanner(true),
                                className: "w-full h-16 text-lg font-black rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-lg",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$qr$2d$code$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__QrCode$3e$__["QrCode"], {
                                        className: "mr-2 h-5 w-5"
                                    }, void 0, false, {
                                        fileName: "[project]/app/page.tsx",
                                        lineNumber: 79,
                                        columnNumber: 13
                                    }, this),
                                    "Escanear QR del Local"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/page.tsx",
                                lineNumber: 75,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 48,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 39,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$qr$2d$fichaje$2d$scanner$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                isOpen: showScanner,
                onClose: ()=>setShowScanner(false),
                onQRScanned: handleQRScanned
            }, void 0, false, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 85,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/page.tsx",
        lineNumber: 38,
        columnNumber: 5
    }, this);
}
_s(EscanearQRFichaje, "8aS2ZElAj00GeffRDzE4wv0ZwM0=");
_c = EscanearQRFichaje;
function QuickKPISnapshot({ organizationId }) {
    _s1();
    const [snapshot, setSnapshot] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "QuickKPISnapshot.useEffect": ()=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$data$3a$9fd2c0__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["getQuickSnapshotAction"])(organizationId).then(setSnapshot);
        }
    }["QuickKPISnapshot.useEffect"], [
        organizationId
    ]);
    if (!snapshot?.success) return null;
    const formatMoney = (n)=>new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
            maximumFractionDigits: 0
        }).format(n);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "grid grid-cols-3 gap-3 mb-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                className: "p-3 text-center border-green-200 bg-green-50",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$dollar$2d$sign$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__DollarSign$3e$__["DollarSign"], {
                        className: "h-5 w-5 mx-auto text-green-600 mb-1"
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 109,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs font-bold text-green-800 uppercase",
                        children: "Ventas hoy"
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 110,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-lg font-black text-green-700",
                        children: formatMoney(snapshot.ventasHoy)
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 111,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[10px] text-green-600",
                        children: [
                            snapshot.cantVentas,
                            " ventas"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 112,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 108,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                className: "p-3 text-center border-blue-200 bg-blue-50",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shopping$2d$cart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ShoppingCart$3e$__["ShoppingCart"], {
                        className: "h-5 w-5 mx-auto text-blue-600 mb-1"
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 115,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs font-bold text-blue-800 uppercase",
                        children: "Operaciones"
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 116,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-lg font-black text-blue-700",
                        children: snapshot.cantVentas
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 117,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[10px] text-blue-600",
                        children: "transacciones"
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 118,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 114,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                className: `p-3 text-center ${snapshot.productosStockBajo > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__["AlertTriangle"], {
                        className: `h-5 w-5 mx-auto mb-1 ${snapshot.productosStockBajo > 0 ? "text-red-600" : "text-slate-400"}`
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 121,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: `text-xs font-bold uppercase ${snapshot.productosStockBajo > 0 ? "text-red-800" : "text-slate-600"}`,
                        children: "Stock bajo"
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 122,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: `text-lg font-black ${snapshot.productosStockBajo > 0 ? "text-red-700" : "text-slate-500"}`,
                        children: snapshot.productosStockBajo
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 123,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: `text-[10px] ${snapshot.productosStockBajo > 0 ? "text-red-600" : "text-slate-400"}`,
                        children: "productos"
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 124,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 120,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/page.tsx",
        lineNumber: 107,
        columnNumber: 5
    }, this);
}
_s1(QuickKPISnapshot, "nB/jimIGWo0MTT7OBJ2yC37GPAM=");
_c1 = QuickKPISnapshot;
function AppRouter({ userProfile, onLogout, sucursalId }) {
    if (userProfile.rol === "dueño") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$dashboard$2d$dueno$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
            onBack: onLogout,
            sucursalId: sucursalId
        }, void 0, false, {
            fileName: "[project]/app/page.tsx",
            lineNumber: 132,
            columnNumber: 16
        }, this);
    }
    if (userProfile.rol === "empleado") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$vista$2d$empleado$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
            onBack: onLogout,
            sucursalId: sucursalId
        }, void 0, false, {
            fileName: "[project]/app/page.tsx",
            lineNumber: 135,
            columnNumber: 16
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen flex items-center justify-center p-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
            className: "p-6 text-center",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-xl font-bold text-destructive",
                    children: "Error de Rol"
                }, void 0, false, {
                    fileName: "[project]/app/page.tsx",
                    lineNumber: 140,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                    onClick: onLogout,
                    className: "mt-4",
                    variant: "destructive",
                    children: "Cerrar Sesión"
                }, void 0, false, {
                    fileName: "[project]/app/page.tsx",
                    lineNumber: 141,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/page.tsx",
            lineNumber: 139,
            columnNumber: 13
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/page.tsx",
        lineNumber: 138,
        columnNumber: 9
    }, this);
}
_c2 = AppRouter;
function HomePage() {
    _s2();
    const [session, setSession] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [userProfile, setUserProfile] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [hasProfile, setHasProfile] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [sucursalId, setSucursalId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const fetchProfile = async (userId, shouldValidate = false)=>{
        setLoading(true);
        try {
            console.log('[fetchProfile] Iniciando para userId:', userId);
            // Schema V2: Obtener datos desde memberships (única fuente de verdad)
            const { data: membership, error: membershipError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].from('memberships').select('user_id, organization_id, branch_id, role, display_name, email').eq('user_id', userId).eq('is_active', true).maybeSingle();
            console.log('[fetchProfile] Membership:', membership, 'Error:', membershipError);
            if (membershipError) {
                console.error('[fetchProfile] Error de BD:', membershipError);
                throw membershipError;
            }
            // Si no hay membership, el usuario necesita completar setup
            if (!membership) {
                console.log('[fetchProfile] No tiene membership, mostrando setup');
                setHasProfile(false);
                setUserProfile(null);
                if (shouldValidate) {
                    throw new Error('Profile not ready yet');
                }
                return;
            }
            // Mapear role de BD a rol de UI (owner → dueño, employee → empleado)
            const rolUI = membership.role === 'owner' ? 'dueño' : 'empleado';
            console.log('[fetchProfile] Rol mapeado:', rolUI);
            setUserProfile({
                id: membership.user_id,
                nombre: membership.display_name,
                rol: rolUI,
                organization_id: membership.organization_id
            });
            setHasProfile(true);
            console.log('[fetchProfile] Perfil cargado exitosamente');
        } catch (error) {
            console.error("[fetchProfile] Error:", error);
            if (!shouldValidate) {
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error('Error cargando perfil');
            }
            setHasProfile(false);
            throw error;
        } finally{
            setLoading(false);
        }
    };
    // 1. Manejo de Sesión
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "HomePage.useEffect": ()=>{
            __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.getSession().then({
                "HomePage.useEffect": ({ data: { session } })=>{
                    setSession(session);
                    if (session?.user) fetchProfile(session.user.id);
                    else setLoading(false);
                }
            }["HomePage.useEffect"]);
            const { data: { subscription } } = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.onAuthStateChange({
                "HomePage.useEffect": (_event, session)=>{
                    setSession(session);
                    if (session?.user) fetchProfile(session.user.id);
                    else {
                        setLoading(false);
                        setUserProfile(null);
                        setHasProfile(false);
                        setSucursalId(null);
                    }
                }
            }["HomePage.useEffect"]);
            return ({
                "HomePage.useEffect": ()=>subscription.unsubscribe()
            })["HomePage.useEffect"];
        }
    }["HomePage.useEffect"], []);
    // 2. Lógica de Sincronización de Sucursal (URL y Asistencia Activa)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "HomePage.useEffect": ()=>{
            const sincronizarSucursal = {
                "HomePage.useEffect.sincronizarSucursal": async ()=>{
                    if (!session || !userProfile) return;
                    // Prioridad 1: URL (viene de redirección de fichaje)
                    const urlParams = new URLSearchParams(window.location.search);
                    const idFromUrl = urlParams.get('sucursal_id');
                    if (idFromUrl) {
                        setSucursalId(idFromUrl);
                        window.history.replaceState({}, '', '/'); // Limpiar URL limpia
                        return;
                    }
                    // Prioridad 2: Asistencia activa en DB (si es empleado y no hay ID seleccionado)
                    if (userProfile.rol === "empleado" && !sucursalId) {
                        const { data: asistencia } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].from('asistencia').select('sucursal_id').eq('empleado_id', session.user.id).is('salida', null).maybeSingle();
                        if (asistencia?.sucursal_id) {
                            setSucursalId(asistencia.sucursal_id);
                        }
                    }
                }
            }["HomePage.useEffect.sincronizarSucursal"];
            sincronizarSucursal();
        }
    }["HomePage.useEffect"], [
        session,
        userProfile
    ]);
    const handleLogout = async ()=>{
        setLoading(true);
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.signOut();
        setSucursalId(null);
        setLoading(false);
    };
    if (loading) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen flex items-center justify-center",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
            className: "h-10 w-10 animate-spin text-primary"
        }, void 0, false, {
            fileName: "[project]/app/page.tsx",
            lineNumber: 275,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/page.tsx",
        lineNumber: 274,
        columnNumber: 5
    }, this);
    if (!session) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$auth$2d$form$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
        fileName: "[project]/app/page.tsx",
        lineNumber: 279,
        columnNumber: 24
    }, this);
    if (session && !hasProfile) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$profile$2d$setup$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
            user: session.user,
            onProfileCreated: async (result)=>{
                try {
                    // Schema V2: RPC retorna { organization_id, branch_id, role, success }
                    // Siempre hacemos fetchProfile para obtener el membership completo
                    // Esto es más confiable que intentar reconstruir el estado desde el RPC
                    console.log('[ProfileSetup] Perfil creado, cargando membership...');
                    await fetchProfile(session.user.id);
                } catch (error) {
                    console.error('[ProfileSetup] Error processing profile:', error);
                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error("Error al cargar perfil", {
                        description: "Por favor recarga la página"
                    });
                }
            }
        }, void 0, false, {
            fileName: "[project]/app/page.tsx",
            lineNumber: 283,
            columnNumber: 9
        }, this);
    }
    if (session && userProfile) {
        if (!sucursalId) {
            if (userProfile.rol === "empleado") {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(EscanearQRFichaje, {
                    onQRScanned: (data)=>setSucursalId(data.sucursal_id)
                }, void 0, false, {
                    fileName: "[project]/app/page.tsx",
                    lineNumber: 306,
                    columnNumber: 20
                }, this);
            }
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "min-h-screen bg-slate-50",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "max-w-md mx-auto pt-6 px-4",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(QuickKPISnapshot, {
                            organizationId: userProfile.organization_id
                        }, void 0, false, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 311,
                            columnNumber: 17
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 310,
                        columnNumber: 15
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$seleccionar$2d$sucursal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        organizationId: userProfile.organization_id,
                        userId: userProfile.id,
                        userRol: userProfile.rol,
                        onSelect: (id)=>setSucursalId(id)
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 313,
                        columnNumber: 15
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 309,
                columnNumber: 13
            }, this);
        }
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AppRouter, {
            userProfile: userProfile,
            onLogout: handleLogout,
            sucursalId: sucursalId
        }, void 0, false, {
            fileName: "[project]/app/page.tsx",
            lineNumber: 323,
            columnNumber: 12
        }, this);
    }
    return null;
}
_s2(HomePage, "9gZ6Nnns07rbYyWlP/BQeOJv2Pw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c3 = HomePage;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "EscanearQRFichaje");
__turbopack_context__.k.register(_c1, "QuickKPISnapshot");
__turbopack_context__.k.register(_c2, "AppRouter");
__turbopack_context__.k.register(_c3, "HomePage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_e7b8adb7._.js.map