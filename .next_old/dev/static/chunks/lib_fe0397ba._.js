(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/supabase.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createBrowserClient$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/createBrowserClient.js [app-client] (ecmascript)");
;
;
let browserClient = null;
let serverClient = null;
function getSupabaseClient() {
    // En el browser, usar createBrowserClient para manejo de cookies
    if ("TURBOPACK compile-time truthy", 1) {
        if (!browserClient) {
            browserClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createBrowserClient$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createBrowserClient"])(("TURBOPACK compile-time value", "https://cwefwathdodmaqnjjagt.supabase.co"), ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3ZWZ3YXRoZG9kbWFxbmpqYWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0OTUyNjIsImV4cCI6MjA4NTA3MTI2Mn0.kKnwAWVpj6WRbCfbVs6K0oXzmsza2MYzdEl3p11mJaY"));
        }
        return browserClient;
    }
    //TURBOPACK unreachable
    ;
}
const supabase = new Proxy({}, {
    get (_, prop) {
        const client = getSupabaseClient();
        const value = client[prop];
        // Si es una función, bindearla al cliente
        if (typeof value === 'function') {
            return value.bind(client);
        }
        return value;
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/utils.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cn",
    ()=>cn
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/clsx/dist/clsx.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-client] (ecmascript)");
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/generar-ticket.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "generarTicketPDF",
    ()=>generarTicketPDF,
    "generarTicketVenta",
    ()=>generarTicketVenta
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jspdf$2f$dist$2f$jspdf$2e$es$2e$min$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jspdf/dist/jspdf.es.min.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jspdf$2d$autotable$2f$dist$2f$jspdf$2e$plugin$2e$autotable$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs [app-client] (ecmascript)");
;
;
// Auxiliar para formatear moneda en el PDF
const formatPDFMoney = (val)=>new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
    }).format(val);
const generarTicketPDF = (datos)=>{
    const doc = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jspdf$2f$dist$2f$jspdf$2e$es$2e$min$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]();
    // Encabezado
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Kiosco 24hs", 105, 20, {
        align: "center"
    });
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Reporte de Auditoría de Caja", 105, 30, {
        align: "center"
    });
    doc.line(20, 35, 190, 35);
    // Info General
    doc.setFontSize(10);
    doc.text(`AUDITOR: ${datos.empleado.toUpperCase()}`, 20, 45);
    doc.text(`APERTURA: ${datos.fechaApertura}`, 20, 50);
    doc.text(`CIERRE: ${datos.fechaCierre || 'TURNO EN CURSO'}`, 20, 55);
    // Tabla de Resumen Financiero (Matemática de Caja)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jspdf$2d$autotable$2f$dist$2f$jspdf$2e$plugin$2e$autotable$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(doc, {
        startY: 65,
        head: [
            [
                'CONCEPTO',
                'VALOR'
            ]
        ],
        body: [
            [
                '(+) CAJA INICIAL',
                formatPDFMoney(datos.montoInicial)
            ],
            [
                '(+) VENTAS EFECTIVO',
                formatPDFMoney(datos.totalVentasEfectivo)
            ],
            [
                '(+) INGRESOS MANUALES',
                formatPDFMoney(datos.totalIngresos)
            ],
            [
                '(-) GASTOS / RETIROS',
                `-${formatPDFMoney(datos.totalGastos)}`
            ],
            [
                '(=) TOTAL ESPERADO EN CAJA',
                formatPDFMoney(datos.cajaEsperada)
            ],
            [
                '(X) CAJA DECLARADA (REAL)',
                datos.cajaReal ? formatPDFMoney(datos.cajaReal) : '---'
            ],
            [
                '(Δ) DIFERENCIA',
                datos.diferencia !== null ? formatPDFMoney(datos.diferencia) : '---'
            ]
        ],
        theme: 'grid',
        styles: {
            fontStyle: 'bold'
        },
        headStyles: {
            fillColor: [
                15,
                23,
                42
            ]
        },
        columnStyles: {
            1: {
                halign: 'right'
            }
        },
        didParseCell: function(data) {
            if (data.row.index === 4) {
                data.cell.styles.fillColor = [
                    241,
                    245,
                    249
                ];
            }
            if (data.row.index === 6 && datos.diferencia !== null) {
                if (datos.diferencia < 0) data.cell.styles.textColor = [
                    220,
                    38,
                    38
                ];
                if (datos.diferencia > 0) data.cell.styles.textColor = [
                    22,
                    163,
                    74
                ];
            }
        }
    });
    // Detalle de Movimientos Manuales (Audit Trail)
    if (datos.gastos.length > 0) {
        // @ts-expect-error jspdf-autotable adds lastAutoTable property
        const finalY = doc.lastAutoTable.finalY + 15;
        doc.setFont("helvetica", "bold");
        doc.text("DETALLE DE MOVIMIENTOS MANUALES:", 20, finalY);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jspdf$2d$autotable$2f$dist$2f$jspdf$2e$plugin$2e$autotable$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(doc, {
            startY: finalY + 5,
            head: [
                [
                    'HORA/CAT',
                    'DESCRIPCIÓN',
                    'MONTO'
                ]
            ],
            body: datos.gastos.map((g)=>[
                    g.categoria?.toUpperCase() || 'AJUSTE',
                    g.descripcion,
                    formatPDFMoney(g.monto)
                ]),
            theme: 'striped',
            headStyles: {
                fillColor: [
                    71,
                    85,
                    105
                ]
            },
            columnStyles: {
                2: {
                    halign: 'right'
                }
            }
        });
    }
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("Documento oficial de auditoría - Kiosco 24hs Cloud System", 105, pageHeight - 10, {
        align: "center"
    });
    const nombreArchivo = `Cierre_${datos.empleado}_${datos.fechaApertura.replace(/[\/\s:]/g, '-')}.pdf`;
    doc.save(nombreArchivo);
};
const generarTicketVenta = (datos)=>{
    const alturaBase = 100;
    // Agregar espacio extra si hay banner offline
    const alturaOffline = datos.offlinePending ? 25 : 0;
    const alturaTicket = alturaBase + datos.items.length * 7 + alturaOffline;
    const doc = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jspdf$2f$dist$2f$jspdf$2e$es$2e$min$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]({
        orientation: 'portrait',
        unit: 'mm',
        format: [
            80,
            alturaTicket
        ]
    });
    doc.setFont("Courier", "normal");
    let y = 10;
    // Banner de modo offline si está pendiente de sincronización
    if (datos.offlinePending) {
        doc.setFillColor(255, 237, 213); // Naranja claro
        doc.rect(0, y - 5, 80, 12, 'F');
        doc.setFontSize(8);
        doc.setFont("Courier", "bold");
        doc.setTextColor(194, 65, 12); // Naranja oscuro
        doc.text("*** PENDIENTE SYNC ***", 40, y, {
            align: "center"
        });
        y += 4;
        doc.setFontSize(6);
        doc.text(`ID: ${datos.localId || 'N/A'}`, 40, y, {
            align: "center"
        });
        doc.setTextColor(0, 0, 0); // Reset a negro
        y += 8;
    }
    doc.setFontSize(14);
    doc.setFont("Courier", "bold");
    doc.text(datos.organizacion.toUpperCase(), 40, y, {
        align: "center"
    });
    y += 5;
    doc.setFontSize(8);
    doc.setFont("Courier", "normal");
    doc.text("--------------------------------", 40, y, {
        align: "center"
    });
    y += 5;
    doc.text(`FECHA: ${datos.fecha}`, 5, y);
    y += 4;
    if (datos.vendedor) {
        doc.text(`VEND: ${datos.vendedor.toUpperCase()}`, 5, y);
        y += 4;
    }
    y += 2;
    doc.text("--------------------------------", 40, y, {
        align: "center"
    });
    y += 5;
    doc.setFont("Courier", "bold");
    doc.text("CANT", 5, y);
    doc.text("PRODUCTO", 20, y);
    doc.text("TOTAL", 75, y, {
        align: "right"
    });
    y += 4;
    doc.setFont("Courier", "normal");
    datos.items.forEach((item)=>{
        const nombre = item.producto.length > 18 ? item.producto.substring(0, 18) + ".." : item.producto;
        doc.text(item.cantidad.toString(), 5, y);
        doc.text(nombre, 20, y);
        doc.text(formatPDFMoney(item.subtotal), 75, y, {
            align: "right"
        });
        y += 5;
    });
    y += 2;
    doc.text("--------------------------------", 40, y, {
        align: "center"
    });
    y += 5;
    doc.setFontSize(14);
    doc.setFont("Courier", "bold");
    doc.text(`TOTAL: ${formatPDFMoney(datos.total)}`, 75, y, {
        align: "right"
    });
    y += 6;
    doc.setFontSize(9);
    doc.setFont("Courier", "normal");
    doc.text(`PAGO: ${datos.metodoPago.toUpperCase()}`, 75, y, {
        align: "right"
    });
    y += 10;
    doc.setFontSize(8);
    doc.text("¡GRACIAS POR SU COMPRA!", 40, y, {
        align: "center"
    });
    y += 4;
    doc.text("Kiosco 24hs", 40, y, {
        align: "center"
    });
    // Nota al pie si está offline
    if (datos.offlinePending) {
        y += 6;
        doc.setFontSize(6);
        doc.setFont("Courier", "italic");
        doc.text("Venta registrada offline.", 40, y, {
            align: "center"
        });
        y += 3;
        doc.text("Se sincronizará automáticamente.", 40, y, {
            align: "center"
        });
    }
    const prefix = datos.offlinePending ? 'Offline_' : '';
    const nombreArchivo = `${prefix}Ticket_${datos.fecha.replace(/[\/\s:]/g, '-')}.pdf`;
    doc.save(nombreArchivo);
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/offline/indexed-db.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

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
 */ // ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────
__turbopack_context__.s([
    "STORES",
    ()=>STORES,
    "generateLocalId",
    ()=>generateLocalId,
    "offlineDB",
    ()=>offlineDB
]);
const DB_NAME = 'kiosco-offline';
const DB_VERSION = 2;
const STORES = {
    PRODUCTOS_CACHE: 'productos-cache',
    VENTAS_PENDIENTES: 'ventas-pendientes',
    SYNC_METADATA: 'sync-metadata'
};
// ───────────────────────────────────────────────────────────────────────────────
// CLASE PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────
class OfflineDB {
    db = null;
    dbPromise = null;
    /**
   * Verifica si IndexedDB está disponible
   */ isAvailable() {
        return ("TURBOPACK compile-time value", "object") !== 'undefined' && 'indexedDB' in window;
    }
    /**
   * Abre o crea la base de datos
   */ async open() {
        // Si ya está abierta, retornar
        if (this.db) {
            return this.db;
        }
        // Si hay una promesa en curso, esperar
        if (this.dbPromise) {
            return this.dbPromise;
        }
        // Verificar disponibilidad
        if (!this.isAvailable()) {
            throw new Error('IndexedDB no está disponible en este navegador');
        }
        // Crear promesa de apertura
        this.dbPromise = new Promise((resolve, reject)=>{
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = ()=>{
                this.dbPromise = null;
                reject(new Error(`Error abriendo IndexedDB: ${request.error?.message}`));
            };
            request.onsuccess = ()=>{
                this.db = request.result;
                this.dbPromise = null;
                // Manejar cierre inesperado
                this.db.onclose = ()=>{
                    this.db = null;
                };
                resolve(this.db);
            };
            request.onupgradeneeded = (event)=>{
                const db = event.target.result;
                // ─────────────────────────────────────────────────────────────────────
                // CREAR OBJECT STORES
                // ─────────────────────────────────────────────────────────────────────
                // Store: productos-cache
                if (!db.objectStoreNames.contains(STORES.PRODUCTOS_CACHE)) {
                    const productosStore = db.createObjectStore(STORES.PRODUCTOS_CACHE, {
                        keyPath: [
                            'id',
                            'sucursal_id'
                        ]
                    });
                    // Índices para búsqueda
                    productosStore.createIndex('sucursal_id', 'sucursal_id', {
                        unique: false
                    });
                    productosStore.createIndex('nombre', 'nombre', {
                        unique: false
                    });
                    productosStore.createIndex('codigo_barras', 'codigo_barras', {
                        unique: false
                    });
                    productosStore.createIndex('cached_at', 'cached_at', {
                        unique: false
                    });
                }
                // Store: ventas-pendientes
                if (!db.objectStoreNames.contains(STORES.VENTAS_PENDIENTES)) {
                    const ventasStore = db.createObjectStore(STORES.VENTAS_PENDIENTES, {
                        keyPath: 'id'
                    });
                    // Índices para consulta
                    ventasStore.createIndex('estado', 'estado', {
                        unique: false
                    });
                    ventasStore.createIndex('sucursal_id', 'sucursal_id', {
                        unique: false
                    });
                    ventasStore.createIndex('created_at', 'created_at', {
                        unique: false
                    });
                }
                // Store: sync-metadata
                if (!db.objectStoreNames.contains(STORES.SYNC_METADATA)) {
                    db.createObjectStore(STORES.SYNC_METADATA, {
                        keyPath: 'key'
                    });
                }
            };
        });
        return this.dbPromise;
    }
    /**
   * Cierra la conexión a la base de datos
   */ close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // OPERACIONES GENÉRICAS
    // ─────────────────────────────────────────────────────────────────────────────
    /**
   * Ejecuta una transacción con un store
   */ async transaction(storeName, mode, operation) {
        const db = await this.open();
        return new Promise((resolve, reject)=>{
            const transaction = db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            const request = operation(store);
            request.onsuccess = ()=>resolve(request.result);
            request.onerror = ()=>reject(request.error);
        });
    }
    /**
   * Obtiene todos los registros de un store
   */ async getAll(storeName) {
        return this.transaction(storeName, 'readonly', (store)=>store.getAll());
    }
    /**
   * Obtiene un registro por clave
   */ async get(storeName, key) {
        return this.transaction(storeName, 'readonly', (store)=>store.get(key));
    }
    /**
   * Guarda un registro (insert o update)
   */ async put(storeName, value) {
        return this.transaction(storeName, 'readwrite', (store)=>store.put(value));
    }
    /**
   * Elimina un registro por clave
   */ async delete(storeName, key) {
        return this.transaction(storeName, 'readwrite', (store)=>store.delete(key));
    }
    /**
   * Elimina todos los registros de un store
   */ async clear(storeName) {
        return this.transaction(storeName, 'readwrite', (store)=>store.clear());
    }
    /**
   * Cuenta registros en un store
   */ async count(storeName) {
        return this.transaction(storeName, 'readonly', (store)=>store.count());
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // OPERACIONES DE PRODUCTOS CACHE
    // ─────────────────────────────────────────────────────────────────────────────
    /**
   * Guarda productos en cache para una sucursal
   */ async cacheProductos(productos) {
        const db = await this.open();
        return new Promise((resolve, reject)=>{
            const transaction = db.transaction(STORES.PRODUCTOS_CACHE, 'readwrite');
            const store = transaction.objectStore(STORES.PRODUCTOS_CACHE);
            transaction.oncomplete = ()=>resolve();
            transaction.onerror = ()=>reject(transaction.error);
            // Guardar cada producto
            for (const producto of productos){
                store.put(producto);
            }
        });
    }
    /**
   * Obtiene productos cacheados de una sucursal
   */ async getProductosBySucursal(sucursalId) {
        const db = await this.open();
        return new Promise((resolve, reject)=>{
            const transaction = db.transaction(STORES.PRODUCTOS_CACHE, 'readonly');
            const store = transaction.objectStore(STORES.PRODUCTOS_CACHE);
            const index = store.index('sucursal_id');
            const request = index.getAll(sucursalId);
            request.onsuccess = ()=>resolve(request.result);
            request.onerror = ()=>reject(request.error);
        });
    }
    /**
   * Busca productos en cache (offline search)
   */ async searchProductosOffline(sucursalId, query) {
        const productos = await this.getProductosBySucursal(sucursalId);
        const queryLower = query.toLowerCase();
        return productos.filter((p)=>{
            // Excluir servicios virtuales
            if (p.nombre === 'Carga SUBE' || p.nombre === 'Carga Virtual') {
                return false;
            }
            // Buscar por nombre o código de barras
            const matchNombre = p.nombre.toLowerCase().includes(queryLower);
            const matchCodigo = p.codigo_barras === query;
            return matchNombre || matchCodigo;
        }).slice(0, 5) // Límite de 5 como en la búsqueda online
        ;
    }
    /**
   * Elimina productos cacheados de una sucursal
   */ async clearProductosBySucursal(sucursalId) {
        const productos = await this.getProductosBySucursal(sucursalId);
        const db = await this.open();
        return new Promise((resolve, reject)=>{
            const transaction = db.transaction(STORES.PRODUCTOS_CACHE, 'readwrite');
            const store = transaction.objectStore(STORES.PRODUCTOS_CACHE);
            transaction.oncomplete = ()=>resolve();
            transaction.onerror = ()=>reject(transaction.error);
            // Eliminar cada producto de esta sucursal
            for (const producto of productos){
                store.delete([
                    producto.id,
                    producto.sucursal_id
                ]);
            }
        });
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // OPERACIONES DE VENTAS PENDIENTES
    // ─────────────────────────────────────────────────────────────────────────────
    /**
   * Guarda una venta pendiente
   */ async saveVentaPendiente(venta) {
        await this.put(STORES.VENTAS_PENDIENTES, venta);
    }
    /**
   * Obtiene todas las ventas pendientes
   */ async getVentasPendientes() {
        return this.getAll(STORES.VENTAS_PENDIENTES);
    }
    /**
   * Obtiene ventas pendientes por estado
   */ async getVentasByEstado(estado) {
        const db = await this.open();
        return new Promise((resolve, reject)=>{
            const transaction = db.transaction(STORES.VENTAS_PENDIENTES, 'readonly');
            const store = transaction.objectStore(STORES.VENTAS_PENDIENTES);
            const index = store.index('estado');
            const request = index.getAll(estado);
            request.onsuccess = ()=>resolve(request.result);
            request.onerror = ()=>reject(request.error);
        });
    }
    /**
   * Obtiene ventas que necesitan sincronización (pending o failed)
   */ async getVentasParaSincronizar() {
        const todas = await this.getVentasPendientes();
        return todas.filter((v)=>v.estado === 'pending' || v.estado === 'failed');
    }
    /**
   * Obtiene todas las ventas pendientes (alias para compatibilidad)
   */ async getAllVentasPendientes() {
        return this.getVentasPendientes();
    }
    /**
   * Cuenta ventas pendientes de sync
   */ async countVentasPendientesSync() {
        const ventas = await this.getVentasParaSincronizar();
        return ventas.length;
    }
    /**
   * Actualiza el estado de una venta pendiente
   */ async updateVentaEstado(id, estado, extra) {
        const venta = await this.get(STORES.VENTAS_PENDIENTES, id);
        if (!venta) {
            throw new Error(`Venta ${id} no encontrada`);
        }
        const updated = {
            ...venta,
            estado,
            intentos: estado === 'syncing' ? venta.intentos + 1 : venta.intentos,
            ultimo_intento: estado === 'syncing' ? Date.now() : venta.ultimo_intento,
            ...extra
        };
        await this.put(STORES.VENTAS_PENDIENTES, updated);
    }
    /**
   * Elimina una venta pendiente
   */ async deleteVentaPendiente(id) {
        await this.delete(STORES.VENTAS_PENDIENTES, id);
    }
    /**
   * Elimina ventas sincronizadas exitosamente (limpieza)
   */ async clearVentasSincronizadas() {
        const sincronizadas = await this.getVentasByEstado('synced');
        for (const venta of sincronizadas){
            await this.deleteVentaPendiente(venta.id);
        }
        return sincronizadas.length;
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // OPERACIONES DE METADATA
    // ─────────────────────────────────────────────────────────────────────────────
    /**
   * Guarda metadata de sincronización
   */ async setMetadata(key, value) {
        const metadata = {
            key,
            value,
            updated_at: Date.now()
        };
        await this.put(STORES.SYNC_METADATA, metadata);
    }
    /**
   * Obtiene metadata de sincronización
   */ async getMetadata(key) {
        return this.get(STORES.SYNC_METADATA, key);
    }
    /**
   * Obtiene el timestamp de última sincronización de productos
   */ async getLastProductosSyncTime(sucursalId) {
        const metadata = await this.getMetadata(`productos-sync-${sucursalId}`);
        return metadata ? metadata.value : null;
    }
    /**
   * Guarda el timestamp de sincronización de productos
   */ async setLastProductosSyncTime(sucursalId) {
        await this.setMetadata(`productos-sync-${sucursalId}`, Date.now());
    }
}
const offlineDB = new OfflineDB();
function generateLocalId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback para navegadores antiguos
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c)=>{
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : r & 0x3 | 0x8;
        return v.toString(16);
    });
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/offline/product-cache.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

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
 */ __turbopack_context__.s([
    "productCache",
    ()=>productCache
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/offline/indexed-db.ts [app-client] (ecmascript)");
;
// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────
/**
 * Tiempo de vida del cache en milisegundos (15 minutos)
 */ const CACHE_TTL_MS = 15 * 60 * 1000;
/**
 * Intervalo mínimo entre sincronizaciones (5 minutos)
 */ const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;
// ───────────────────────────────────────────────────────────────────────────────
// CLASE PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────
class ProductCacheService {
    syncingFor = new Set();
    syncPromises = new Map();
    /**
   * Verifica si el cache está disponible (cliente con IndexedDB)
   */ isAvailable() {
        return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].isAvailable();
    }
    /**
   * Verifica si el cache de una sucursal está obsoleto
   */ async isCacheStale(sucursalId) {
        const lastSync = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].getLastProductosSyncTime(sucursalId);
        if (!lastSync) return true;
        const age = Date.now() - lastSync;
        return age > CACHE_TTL_MS;
    }
    /**
   * Verifica si podemos sincronizar (respeta el intervalo mínimo)
   */ async canSync(sucursalId) {
        if (this.syncingFor.has(sucursalId)) {
            return false;
        }
        const lastSync = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].getLastProductosSyncTime(sucursalId);
        if (!lastSync) return true;
        const timeSinceLastSync = Date.now() - lastSync;
        return timeSinceLastSync >= MIN_SYNC_INTERVAL_MS;
    }
    /**
   * Sincroniza productos desde el servidor al cache local
   *
   * @param sucursalId - ID de la sucursal
   * @param fetchFn - Función para obtener productos del servidor
   * @param force - Forzar sincronización ignorando intervalo mínimo
   */ async syncFromServer(sucursalId, fetchFn, force = false) {
        // Verificar si ya estamos sincronizando
        if (this.syncingFor.has(sucursalId)) {
            // Esperar la sincronización en curso
            const existingPromise = this.syncPromises.get(sucursalId);
            if (existingPromise) {
                await existingPromise;
            }
            const count = (await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].getProductosBySucursal(sucursalId)).length;
            return {
                success: true,
                count
            };
        }
        // Verificar intervalo mínimo
        if (!force && !await this.canSync(sucursalId)) {
            const count = (await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].getProductosBySucursal(sucursalId)).length;
            return {
                success: true,
                count
            };
        }
        // Marcar como sincronizando
        this.syncingFor.add(sucursalId);
        const syncPromise = (async ()=>{
            try {
                // Obtener productos del servidor
                const productos = await fetchFn();
                // Convertir a formato cache
                const productosCache = productos.map((p)=>({
                        ...p,
                        cached_at: Date.now()
                    }));
                // Limpiar cache anterior de esta sucursal
                await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].clearProductosBySucursal(sucursalId);
                // Guardar nuevos productos
                if (productosCache.length > 0) {
                    await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].cacheProductos(productosCache);
                }
                // Actualizar timestamp de sync
                await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].setLastProductosSyncTime(sucursalId);
                return {
                    success: true,
                    count: productosCache.length
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
                return {
                    success: false,
                    count: 0,
                    error: errorMessage
                };
            } finally{
                this.syncingFor.delete(sucursalId);
                this.syncPromises.delete(sucursalId);
            }
        })();
        this.syncPromises.set(sucursalId, syncPromise.then(()=>{}));
        return syncPromise;
    }
    /**
   * Busca productos en el cache local
   */ async searchOffline(sucursalId, query) {
        if (!query || query.trim().length === 0) {
            return [];
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].searchProductosOffline(sucursalId, query.trim());
    }
    /**
   * Obtiene todos los productos cacheados de una sucursal
   */ async getAll(sucursalId) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].getProductosBySucursal(sucursalId);
    }
    /**
   * Obtiene el estado del cache para una sucursal
   */ async getStatus(sucursalId) {
        const productos = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].getProductosBySucursal(sucursalId);
        const lastSyncAt = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].getLastProductosSyncTime(sucursalId);
        const isStale = await this.isCacheStale(sucursalId);
        const isSyncing = this.syncingFor.has(sucursalId);
        return {
            sucursalId,
            productCount: productos.length,
            lastSyncAt,
            isStale,
            isSyncing
        };
    }
    /**
   * Invalida el cache de una sucursal (fuerza re-sync en próxima búsqueda)
   */ async invalidate(sucursalId) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].clearProductosBySucursal(sucursalId);
        // También limpiamos el timestamp para forzar re-sync
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].setMetadata(`productos-sync-${sucursalId}`, 0);
    }
    /**
   * Limpia todo el cache de productos
   */ async clearAll() {
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].clear('productos-cache');
    }
    /**
   * Actualiza el stock de un producto en cache
   * (útil después de una venta offline para mantener consistencia visual)
   */ async updateStock(productoId, sucursalId, nuevoStock) {
        const productos = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].getProductosBySucursal(sucursalId);
        const producto = productos.find((p)=>p.id === productoId);
        if (producto) {
            const updated = {
                ...producto,
                stock_disponible: Math.max(0, nuevoStock)
            };
            await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].put('productos-cache', updated);
        }
    }
    /**
   * Reduce el stock de un producto en cache
   * (útil después de agregar al carrito offline)
   */ async reduceStock(productoId, sucursalId, cantidad) {
        const productos = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["offlineDB"].getProductosBySucursal(sucursalId);
        const producto = productos.find((p)=>p.id === productoId);
        if (producto) {
            await this.updateStock(productoId, sucursalId, producto.stock_disponible - cantidad);
        }
    }
}
const productCache = new ProductCacheService();
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=lib_fe0397ba._.js.map