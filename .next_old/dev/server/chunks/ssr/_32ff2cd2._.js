module.exports = [
"[project]/lib/supabase-server.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createClient",
    ()=>createClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/index.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/createServerClient.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-rsc] (ecmascript)");
;
;
const createClient = async ()=>{
    const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createServerClient"])(("TURBOPACK compile-time value", "https://cwefwathdodmaqnjjagt.supabase.co"), ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3ZWZ3YXRoZG9kbWFxbmpqYWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0OTUyNjIsImV4cCI6MjA4NTA3MTI2Mn0.kKnwAWVpj6WRbCfbVs6K0oXzmsza2MYzdEl3p11mJaY"), {
        cookies: {
            getAll () {
                return cookieStore.getAll();
            },
            setAll (cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options })=>cookieStore.set(name, value, options));
                } catch  {
                // Ignorar errores en Server Components (solo lectura)
                }
            }
        }
    });
};
}),
"[project]/lib/actions/dashboard.actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📊 DASHBOARD SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para el dashboard del dueño.
 * Maneja consultas pesadas y cálculos financieros complejos.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Cálculos matemáticos en servidor (no en useMemo del cliente)
 * - Consultas a vistas optimizadas (v_daily_sales, v_expiring_stock)
 * - Análisis de inventario crítico
 *
 * VISTAS UTILIZADAS:
 * - v_daily_sales: Resumen de ventas por día/branch/método de pago
 * - v_expiring_stock: Productos próximos a vencer
 * - v_products_with_stock: Productos con stock disponible
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ /* __next_internal_action_entry_do_not_use__ [{"40d029fc6c95ed9534fed10662ea7633d49df97d3b":"getInventoryCriticalAction","60c5cea36833a9991afc4b9158361001006a7382bd":"getDailySalesChartAction","70fefa28db228ef2be5fad91633ef642e7e4cad836":"getOwnerStatsAction"},"",""] */ __turbopack_context__.s([
    "getDailySalesChartAction",
    ()=>getDailySalesChartAction,
    "getInventoryCriticalAction",
    ()=>getInventoryCriticalAction,
    "getOwnerStatsAction",
    ()=>getOwnerStatsAction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase-server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────
const DEFAULT_LOW_STOCK_THRESHOLD = 5;
async function getOwnerStatsAction(branchId, dateFrom, dateTo) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // Validaciones
        if (!branchId) {
            return createEmptyStatsResult('Branch no especificado');
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Consultar resumen de ventas desde v_daily_sales
        // ───────────────────────────────────────────────────────────────────────────
        let query = supabase.from('v_daily_sales').select('*').eq('branch_id', branchId);
        if (dateFrom) query = query.gte('date', dateFrom);
        if (dateTo) query = query.lte('date', dateTo);
        const { data: salesData, error: salesError } = await query;
        if (salesError) {
            return createEmptyStatsResult(`Error al obtener ventas: ${salesError.message}`);
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 2: Calcular métricas financieras
        // ───────────────────────────────────────────────────────────────────────────
        let gross = 0;
        let saleCount = 0;
        const paymentBreakdown = {
            cash: 0,
            card: 0,
            transfer: 0,
            wallet: 0
        };
        (salesData || []).forEach((row)=>{
            const amount = Number(row.total_amount) || 0;
            const count = Number(row.sale_count) || 0;
            gross += amount;
            saleCount += count;
            // Desglose por método de pago
            const method = row.payment_method;
            if (method && paymentBreakdown.hasOwnProperty(method)) {
                paymentBreakdown[method] += amount;
            }
        });
        // Traceable = card + transfer + wallet
        const traceable = paymentBreakdown.card + paymentBreakdown.transfer + paymentBreakdown.wallet;
        const cashAmount = paymentBreakdown.cash;
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 3: Consultar movimientos manuales de caja
        // ───────────────────────────────────────────────────────────────────────────
        let movQuery = supabase.from('cash_movements').select('type, amount, category').eq('organization_id', (await supabase.rpc('get_my_org_id')).data || '');
        // Filter by cash_register that belongs to the branch
        const { data: registers } = await supabase.from('cash_registers').select('id').eq('branch_id', branchId);
        if (registers && registers.length > 0) {
            const registerIds = registers.map((r)=>r.id);
            movQuery = movQuery.in('cash_register_id', registerIds);
        }
        const { data: movements } = await movQuery;
        let manualIncome = 0;
        let manualExpense = 0;
        (movements || []).forEach((m)=>{
            // Skip sale-related movements (already counted)
            if (m.category === 'sale' || m.category === 'ventas') return;
            const amount = Number(m.amount) || 0;
            if (m.type === 'income') {
                manualIncome += amount;
            } else if (m.type === 'expense') {
                manualExpense += amount;
            }
        });
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 4: Obtener top productos vendidos
        // ───────────────────────────────────────────────────────────────────────────
        const { data: topData } = await supabase.from('sale_items').select('quantity, products(name, emoji)').eq('organization_id', (await supabase.rpc('get_my_org_id')).data || '');
        const productCounts = {};
        (topData || []).forEach((item)=>{
            const product = item.products;
            if (!product?.name) return;
            if (!productCounts[product.name]) {
                productCounts[product.name] = {
                    count: 0,
                    emoji: product.emoji || undefined
                };
            }
            productCounts[product.name].count += item.quantity;
        });
        const topProducts = Object.entries(productCounts).map(([name, { count, emoji }])=>({
                name,
                count,
                emoji
            })).sort((a, b)=>b.count - a.count).slice(0, 5);
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 5: Calcular métricas finales
        // ───────────────────────────────────────────────────────────────────────────
        // Estimamos costo como 60% del bruto (margen típico de kiosco)
        const estimatedCost = gross * 0.6;
        const productProfit = gross - estimatedCost;
        const net = productProfit + manualIncome - manualExpense;
        const margin = gross > 0 ? productProfit / gross * 100 : 0;
        const ROI = estimatedCost > 0 ? net / estimatedCost * 100 : 0;
        return {
            success: true,
            totalSold: gross,
            netProfit: net,
            ROI,
            paymentBreakdown,
            topProducts,
            saleCount,
            businessMetrics: {
                gross,
                net,
                margin,
                traceable,
                cash: cashAmount,
                ROI
            }
        };
    } catch (error) {
        return createEmptyStatsResult(error instanceof Error ? error.message : 'Error desconocido al obtener estadísticas');
    }
}
async function getInventoryCriticalAction(branchId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // Validaciones
        if (!branchId) {
            return {
                success: false,
                lowStock: [],
                expiringItems: {
                    totalValue: 0,
                    totalUnits: 0,
                    items: []
                },
                error: 'Branch no especificado'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Obtener productos con stock bajo desde v_products_with_stock
        // ───────────────────────────────────────────────────────────────────────────
        const { data: productsData, error: productsError } = await supabase.from('v_products_with_stock').select('*').eq('branch_id', branchId).eq('is_active', true).eq('is_service', false);
        if (productsError) {
            return {
                success: false,
                lowStock: [],
                expiringItems: {
                    totalValue: 0,
                    totalUnits: 0,
                    items: []
                },
                error: `Error al obtener productos: ${productsError.message}`
            };
        }
        // Filtrar productos con stock bajo
        const lowStock = (productsData || []).filter((p)=>{
            const stock = Number(p.stock_available) || 0;
            const minStock = Number(p.min_stock) || DEFAULT_LOW_STOCK_THRESHOLD;
            return stock <= minStock;
        }).map((p)=>({
                id: p.id || '',
                name: p.name || '',
                emoji: p.emoji || null,
                currentStock: Number(p.stock_available) || 0,
                minStock: Number(p.min_stock) || DEFAULT_LOW_STOCK_THRESHOLD,
                category: p.category || null
            }));
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 2: Obtener productos próximos a vencer desde v_expiring_stock
        // ───────────────────────────────────────────────────────────────────────────
        const { data: expiringData, error: expiringError } = await supabase.from('v_expiring_stock').select('*').eq('branch_id', branchId).order('days_until_expiry', {
            ascending: true
        });
        if (expiringError) {
            return {
                success: false,
                lowStock,
                expiringItems: {
                    totalValue: 0,
                    totalUnits: 0,
                    items: []
                },
                error: `Error al obtener vencimientos: ${expiringError.message}`
            };
        }
        let totalValue = 0;
        let totalUnits = 0;
        const items = (expiringData || []).map((e)=>{
            const value = Number(e.value_at_risk) || 0;
            const qty = Number(e.quantity) || 0;
            totalValue += value;
            totalUnits += qty;
            return {
                id: e.organization_id || '',
                productId: e.product_id || '',
                productName: e.product_name || '',
                emoji: e.emoji || null,
                expirationDate: e.expiration_date || '',
                quantity: qty,
                daysUntilExpiry: Number(e.days_until_expiry) || 0,
                valueAtRisk: value
            };
        });
        return {
            success: true,
            lowStock,
            expiringItems: {
                totalValue,
                totalUnits,
                items
            }
        };
    } catch (error) {
        return {
            success: false,
            lowStock: [],
            expiringItems: {
                totalValue: 0,
                totalUnits: 0,
                items: []
            },
            error: error instanceof Error ? error.message : 'Error desconocido al obtener inventario crítico'
        };
    }
}
async function getDailySalesChartAction(branchId, days = 7) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        if (!branchId) {
            return {
                success: false,
                data: [],
                error: 'Branch no especificado'
            };
        }
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - days);
        const { data, error } = await supabase.from('v_daily_sales').select('date, total_amount, sale_count').eq('branch_id', branchId).gte('date', dateFrom.toISOString().split('T')[0]).order('date', {
            ascending: true
        });
        if (error) {
            return {
                success: false,
                data: [],
                error: `Error: ${error.message}`
            };
        }
        // Agrupar por fecha (puede haber múltiples métodos de pago por día)
        const grouped = {};
        (data || []).forEach((row)=>{
            const date = row.date || '';
            if (!grouped[date]) {
                grouped[date] = {
                    total: 0,
                    count: 0
                };
            }
            grouped[date].total += Number(row.total_amount) || 0;
            grouped[date].count += Number(row.sale_count) || 0;
        });
        const chartData = Object.entries(grouped).map(([date, { total, count }])=>({
                date,
                total,
                count
            })).sort((a, b)=>a.date.localeCompare(b.date));
        return {
            success: true,
            data: chartData
        };
    } catch (error) {
        return {
            success: false,
            data: [],
            error: error instanceof Error ? error.message : 'Error desconocido'
        };
    }
}
// ───────────────────────────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────────────────────────
function createEmptyStatsResult(errorMessage) {
    return {
        success: false,
        totalSold: 0,
        netProfit: 0,
        ROI: 0,
        paymentBreakdown: {
            cash: 0,
            card: 0,
            transfer: 0,
            wallet: 0
        },
        topProducts: [],
        saleCount: 0,
        businessMetrics: {
            gross: 0,
            net: 0,
            margin: 0,
            traceable: 0,
            cash: 0,
            ROI: 0
        },
        error: errorMessage
    };
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    getOwnerStatsAction,
    getInventoryCriticalAction,
    getDailySalesChartAction
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getOwnerStatsAction, "70fefa28db228ef2be5fad91633ef642e7e4cad836", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getInventoryCriticalAction, "40d029fc6c95ed9534fed10662ea7633d49df97d3b", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getDailySalesChartAction, "60c5cea36833a9991afc4b9158361001006a7382bd", null);
}),
"[project]/lib/actions/product.actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📦 PRODUCT SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de productos.
 * Maneja verificación de existencia y creación completa (producto + historial + stock).
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Operación unificada: productos + historial_precios + stock
 * - organization_id obtenido/validado en servidor
 * - Sin lógica de negocio en cliente
 *
 * ORIGEN: Refactorización de crear-producto.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ /* __next_internal_action_entry_do_not_use__ [{"401c6028156f42d17b0eff5c6bff909e875ffd2d2a":"applyHappyHourDiscountAction","4037685c5e9267a3d9b9ac5965fe40710ab06d1600":"checkExistingProductAction","40a6b0554342b993720c8318133b6388239460babf":"deleteProductAction","60aa977d9e70f652e2a321bf878fe8639dcbabc980":"createFullProductAction","60f2f52e2b5316743d8df511490b173f59955fedbc":"updateProductAction"},"",""] */ __turbopack_context__.s([
    "applyHappyHourDiscountAction",
    ()=>applyHappyHourDiscountAction,
    "checkExistingProductAction",
    ()=>checkExistingProductAction,
    "createFullProductAction",
    ()=>createFullProductAction,
    "deleteProductAction",
    ()=>deleteProductAction,
    "updateProductAction",
    ()=>updateProductAction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase-server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
async function checkExistingProductAction(barcode) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Obtener usuario y organización
        // ───────────────────────────────────────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                exists: false,
                error: 'No hay sesión activa'
            };
        }
        const { data: orgId } = await supabase.rpc('get_my_org_id_v2');
        if (!orgId) {
            return {
                success: false,
                exists: false,
                error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 2: Buscar producto existente
        // ───────────────────────────────────────────────────────────────────────────
        const { data: existente, error } = await supabase.from('productos').select('nombre').eq('codigo_barras', barcode).eq('organization_id', orgId).maybeSingle();
        if (error) {
            return {
                success: false,
                exists: false,
                error: `Error al verificar producto: ${error.message}`
            };
        }
        if (existente) {
            return {
                success: true,
                exists: true,
                productName: existente.nombre
            };
        }
        return {
            success: true,
            exists: false
        };
    } catch (error) {
        return {
            success: false,
            exists: false,
            error: error instanceof Error ? error.message : 'Error desconocido al verificar producto'
        };
    }
}
async function createFullProductAction(formData, sucursalId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // VALIDACIONES
        // ───────────────────────────────────────────────────────────────────────────
        if (!formData.nombre || !formData.categoria) {
            return {
                success: false,
                error: 'Faltan datos requeridos (nombre, categoría)'
            };
        }
        if (!sucursalId) {
            return {
                success: false,
                error: 'Sucursal no especificada'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Obtener usuario y organización
        // ───────────────────────────────────────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }
        const { data: orgId } = await supabase.rpc('get_my_org_id_v2');
        if (!orgId) {
            return {
                success: false,
                error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 2: Crear producto en el catálogo
        // ───────────────────────────────────────────────────────────────────────────
        const { data: nuevoProducto, error: errorProd } = await supabase.from('productos').insert([
            {
                organization_id: orgId,
                nombre: formData.nombre,
                categoria: formData.categoria,
                precio_venta: formData.precio_venta,
                costo: formData.costo,
                vida_util_dias: 0,
                emoji: formData.emoji,
                codigo_barras: formData.codigo_barras || null
            }
        ]).select().single();
        if (errorProd) {
            return {
                success: false,
                error: `Error al crear producto: ${errorProd.message}`
            };
        }
        if (!nuevoProducto) {
            return {
                success: false,
                error: 'No se pudo crear el producto'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 3: Registrar precio inicial en historial
        // ───────────────────────────────────────────────────────────────────────────
        const { error: errorHistorial } = await supabase.from('historial_precios').insert({
            organization_id: orgId,
            producto_id: nuevoProducto.id,
            precio_venta_anterior: null,
            precio_venta_nuevo: formData.precio_venta,
            costo_anterior: null,
            costo_nuevo: formData.costo,
            empleado_id: user.id,
            fecha_cambio: new Date().toISOString()
        });
        if (errorHistorial) {
            // No bloqueamos la operación por error en historial, pero lo registramos
            console.error('Error al registrar historial de precios:', errorHistorial);
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 4: Crear entrada inicial de stock (si cantidad > 0)
        // ───────────────────────────────────────────────────────────────────────────
        if (formData.cantidad_inicial > 0) {
            const { error: errorStock } = await supabase.from('stock').insert({
                organization_id: orgId,
                sucursal_id: sucursalId,
                producto_id: nuevoProducto.id,
                cantidad: formData.cantidad_inicial,
                tipo_movimiento: 'entrada',
                estado: 'disponible',
                costo_unitario_historico: formData.costo,
                fecha_vencimiento: formData.fecha_vencimiento || null,
                fecha_ingreso: new Date().toISOString()
            });
            if (errorStock) {
                console.error('Error al crear stock inicial:', errorStock);
                // Propagamos el error al usuario para que sepa que el stock no se creó
                return {
                    success: false,
                    error: `Producto creado pero error en stock: ${errorStock.message}`,
                    productoId: nuevoProducto.id
                };
            }
        }
        // ───────────────────────────────────────────────────────────────────────────
        // RETORNO EXITOSO
        // ───────────────────────────────────────────────────────────────────────────
        return {
            success: true,
            productoId: nuevoProducto.id
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al crear producto'
        };
    }
}
async function applyHappyHourDiscountAction(productoId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // VALIDACIONES
        // ───────────────────────────────────────────────────────────────────────────
        if (!productoId) {
            return {
                success: false,
                error: 'productoId es requerido'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Obtener usuario y organización
        // ───────────────────────────────────────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }
        const { data: orgId } = await supabase.rpc('get_my_org_id_v2');
        if (!orgId) {
            return {
                success: false,
                error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 2: Obtener precio actual del producto
        // ───────────────────────────────────────────────────────────────────────────
        const { data: producto, error: fetchError } = await supabase.from('productos').select('precio_venta, nombre, costo').eq('id', productoId).eq('organization_id', orgId).single();
        if (fetchError) {
            return {
                success: false,
                error: `Error al obtener producto: ${fetchError.message}`
            };
        }
        if (!producto) {
            return {
                success: false,
                error: 'Producto no encontrado'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 3: Calcular nuevo precio (30% OFF, redondeo hacia abajo)
        // ───────────────────────────────────────────────────────────────────────────
        const precioAnterior = producto.precio_venta;
        const precioNuevo = Math.floor(precioAnterior * 0.70);
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 4: Actualizar precio del producto
        // ───────────────────────────────────────────────────────────────────────────
        const { error: updateError } = await supabase.from('productos').update({
            precio_venta: precioNuevo
        }).eq('id', productoId).eq('organization_id', orgId);
        if (updateError) {
            return {
                success: false,
                error: `Error al actualizar precio: ${updateError.message}`
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 5: Registrar en historial de precios
        // ───────────────────────────────────────────────────────────────────────────
        const { error: historialError } = await supabase.from('historial_precios').insert({
            organization_id: orgId,
            producto_id: productoId,
            precio_venta_anterior: precioAnterior,
            precio_venta_nuevo: precioNuevo,
            costo_anterior: producto.costo || 0,
            costo_nuevo: producto.costo || 0,
            fecha_cambio: new Date().toISOString(),
            empleado_id: user.id
        });
        if (historialError) {
            // No bloqueamos la operación, pero registramos el error
            console.error('Error al registrar historial de precios:', historialError);
        }
        // ───────────────────────────────────────────────────────────────────────────
        // RETORNO EXITOSO
        // ───────────────────────────────────────────────────────────────────────────
        return {
            success: true,
            precioAnterior,
            precioNuevo,
            nombreProducto: producto.nombre
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al aplicar descuento'
        };
    }
}
async function updateProductAction(productId, data) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // VALIDACIONES
        // ───────────────────────────────────────────────────────────────────────────
        if (!productId) {
            return {
                success: false,
                error: 'ID de producto no especificado'
            };
        }
        if (!data.nombre || !data.categoria) {
            return {
                success: false,
                error: 'Faltan datos requeridos (nombre, categoría)'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Obtener usuario y organización
        // ───────────────────────────────────────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }
        const { data: orgId } = await supabase.rpc('get_my_org_id_v2');
        if (!orgId) {
            return {
                success: false,
                error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 2: Obtener precios anteriores (para historial)
        // ───────────────────────────────────────────────────────────────────────────
        const { data: oldProduct, error: fetchError } = await supabase.from('productos').select('precio_venta, costo').eq('id', productId).eq('organization_id', orgId).single();
        if (fetchError) {
            return {
                success: false,
                error: `Error al obtener producto: ${fetchError.message}`
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 3: Actualizar producto
        // ───────────────────────────────────────────────────────────────────────────
        const { error: updateError } = await supabase.from('productos').update({
            nombre: data.nombre,
            precio_venta: data.precio_venta,
            costo: data.costo,
            categoria: data.categoria,
            emoji: data.emoji ?? undefined,
            codigo_barras: data.codigo_barras ?? undefined
        }).eq('id', productId).eq('organization_id', orgId);
        if (updateError) {
            return {
                success: false,
                error: `Error al actualizar producto: ${updateError.message}`
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 4: Registrar en historial si cambió precio_venta o costo
        // ───────────────────────────────────────────────────────────────────────────
        const precioChanged = oldProduct.precio_venta !== data.precio_venta;
        const costoChanged = oldProduct.costo !== data.costo;
        if (precioChanged || costoChanged) {
            const { error: historialError } = await supabase.from('historial_precios').insert({
                organization_id: orgId,
                producto_id: productId,
                precio_venta_anterior: oldProduct.precio_venta,
                precio_venta_nuevo: data.precio_venta,
                costo_anterior: oldProduct.costo,
                costo_nuevo: data.costo,
                empleado_id: user.id,
                fecha_cambio: new Date().toISOString()
            });
            if (historialError) {
                // No bloqueamos la operación, pero registramos el error
                console.error('Error al registrar historial de precios:', historialError);
            }
        }
        // ───────────────────────────────────────────────────────────────────────────
        // RETORNO EXITOSO
        // ───────────────────────────────────────────────────────────────────────────
        return {
            success: true
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al actualizar producto'
        };
    }
}
async function deleteProductAction(productId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // VALIDACIONES
        // ───────────────────────────────────────────────────────────────────────────
        if (!productId) {
            return {
                success: false,
                error: 'ID de producto no especificado'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Obtener usuario y organización
        // ───────────────────────────────────────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }
        const { data: orgId } = await supabase.rpc('get_my_org_id_v2');
        if (!orgId) {
            return {
                success: false,
                error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 2: Eliminar producto
        // ───────────────────────────────────────────────────────────────────────────
        const { error: deleteError } = await supabase.from('productos').delete().eq('id', productId).eq('organization_id', orgId);
        if (deleteError) {
            return {
                success: false,
                error: `Error al eliminar producto: ${deleteError.message}`
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // RETORNO EXITOSO
        // ───────────────────────────────────────────────────────────────────────────
        return {
            success: true
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al eliminar producto'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    checkExistingProductAction,
    createFullProductAction,
    applyHappyHourDiscountAction,
    updateProductAction,
    deleteProductAction
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(checkExistingProductAction, "4037685c5e9267a3d9b9ac5965fe40710ab06d1600", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createFullProductAction, "60aa977d9e70f652e2a321bf878fe8639dcbabc980", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(applyHappyHourDiscountAction, "401c6028156f42d17b0eff5c6bff909e875ffd2d2a", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateProductAction, "60f2f52e2b5316743d8df511490b173f59955fedbc", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(deleteProductAction, "40a6b0554342b993720c8318133b6388239460babf", null);
}),
"[project]/lib/supabase.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/index.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/esm/wrapper.mjs [app-rsc] (ecmascript)");
;
;
let browserClient = null;
let serverClient = null;
function getSupabaseClient() {
    // En el browser, usar createBrowserClient para manejo de cookies
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    // En el servidor (build/SSR), usar cliente básico
    if (!serverClient) {
        serverClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])(("TURBOPACK compile-time value", "https://cwefwathdodmaqnjjagt.supabase.co"), ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3ZWZ3YXRoZG9kbWFxbmpqYWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0OTUyNjIsImV4cCI6MjA4NTA3MTI2Mn0.kKnwAWVpj6WRbCfbVs6K0oXzmsza2MYzdEl3p11mJaY"));
    }
    return serverClient;
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
}),
"[project]/lib/repositories/organization.repository.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🏢 ORGANIZATION REPOSITORY (actualizado para nuevo schema)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Repositorio para gestión de organizaciones.
 * Usa RPC setup_organization del nuevo schema.
 *
 * MAPEO DE TABLAS:
 * - perfiles → memberships
 * - sucursales → branches
 * - user_organization_roles → memberships (consolidado)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ __turbopack_context__.s([
    "createInitialSetup",
    ()=>createInitialSetup,
    "getOrganizationById",
    ()=>getOrganizationById,
    "updateOrganization",
    ()=>updateOrganization
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase.ts [app-rsc] (ecmascript)");
;
async function createInitialSetup(params) {
    try {
        const { profileName, email, orgName = 'Mi Negocio' } = params;
        // Usar setup_organization del nuevo schema
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].rpc('setup_organization', {
            p_org_name: orgName,
            p_display_name: profileName,
            p_email: email,
            p_branch_name: 'Sucursal Principal'
        });
        if (error) {
            console.error('Error RPC setup_organization:', error);
            return {
                data: null,
                error: new Error(`Error creando organización: ${error.message}`)
            };
        }
        // El RPC devuelve { organization_id, branch_id, membership_id }
        const result = data;
        // Obtener los datos completos
        const [orgResult, branchResult, membershipResult] = await Promise.all([
            __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from('organizations').select('*').eq('id', result.organization_id).single(),
            __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from('branches').select('*').eq('id', result.branch_id).single(),
            __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from('memberships').select('*').eq('id', result.membership_id).single()
        ]);
        if (orgResult.error || branchResult.error || membershipResult.error) {
            return {
                data: null,
                error: new Error('Error obteniendo datos creados')
            };
        }
        return {
            data: {
                organization: orgResult.data,
                branch: branchResult.data,
                membership: membershipResult.data,
                // Alias para compatibilidad
                perfil: membershipResult.data,
                sucursal: branchResult.data
            },
            error: null
        };
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error : new Error('Error desconocido en createInitialSetup')
        };
    }
}
async function getOrganizationById(organizationId) {
    try {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from('organizations').select('*').eq('id', organizationId).single();
        if (error) throw error;
        return {
            data,
            error: null
        };
    } catch (error) {
        return {
            data: null,
            error: error
        };
    }
}
async function updateOrganization(organizationId, updates) {
    try {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from('organizations').update(updates).eq('id', organizationId).select().single();
        if (error) throw error;
        return {
            data,
            error: null
        };
    } catch (error) {
        return {
            data: null,
            error: error
        };
    }
}
}),
"[project]/lib/actions/user.actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 👤 USER SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de usuarios, onboarding y contexto operativo.
 *
 * FUNCIONALIDADES:
 * 1. completeProfile: Maneja el registro inicial (Org + Perfil + Sucursal) vía RPC.
 * 2. getEmployeeDashboardContextAction: Proporciona info consolidada para dashboards.
 *
 * MIGRADO: 2026-01-27 - Schema V2 (tablas en inglés)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ /* __next_internal_action_entry_do_not_use__ [{"40aa9625436d528de53f56574a11eede3faa66ec5b":"getEmployeeDashboardContextAction","60aebd17638619fdb7ba19456567b257135ec719f1":"completeProfile"},"",""] */ __turbopack_context__.s([
    "completeProfile",
    ()=>completeProfile,
    "getEmployeeDashboardContextAction",
    ()=>getEmployeeDashboardContextAction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase-server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$repositories$2f$organization$2e$repository$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/repositories/organization.repository.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
// ───────────────────────────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────────────────────────
/**
 * Mapea role de BD (owner/employee) a rol UI (dueño/empleado)
 */ function mapRoleToLegacy(role) {
    return role === 'owner' ? 'dueño' : 'empleado';
}
async function completeProfile(prevState, formData) {
    const supabaseClient = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
    // 1. Obtener usuario autenticado
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
        return {
            message: 'No se pudo verificar la sesión. Por favor, recarga la página.'
        };
    }
    // 2. Extraer datos del formulario
    const nombre = formData.get('nombre');
    const nombreNegocio = formData.get('nombreNegocio');
    const email = user.email || '';
    // 3. Validaciones básicas
    const errors = {};
    if (!nombre || nombre.length < 3) errors.nombre = [
        'El nombre debe tener al menos 3 caracteres'
    ];
    if (!nombreNegocio || nombreNegocio.length < 3) errors.nombreNegocio = [
        'El nombre del negocio es requerido'
    ];
    if (Object.keys(errors).length > 0) {
        return {
            errors,
            message: 'Faltan datos requeridos.'
        };
    }
    try {
        console.log('Iniciando Setup Atómico para:', email);
        // 4. EJECUTAR RPC BLINDADO
        const { data, error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$repositories$2f$organization$2e$repository$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createInitialSetup"])({
            userId: user.id,
            profileName: nombre,
            orgName: nombreNegocio,
            email: email
        });
        if (error) {
            console.error('Error en createInitialSetup:', error);
            return {
                message: 'Error al crear la organización. Es posible que el nombre ya exista o haya un problema de conexión.'
            };
        }
        console.log('Setup completado exitosamente:', data);
    } catch (err) {
        console.error('Error inesperado:', err);
        return {
            message: 'Ocurrió un error inesperado al procesar tu solicitud.'
        };
    }
    // 5. Redirección final
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/', 'layout');
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])('/dashboard');
}
async function getEmployeeDashboardContextAction(sucursalId) {
    try {
        if (!sucursalId) {
            return {
                success: false,
                error: 'ID de sucursal requerido'
            };
        }
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // PASO 1: Obtener usuario
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }
        // PASO 2: Obtener organization_id del usuario
        const { data: orgId } = await supabase.rpc('get_my_org_id');
        if (!orgId) {
            return {
                success: false,
                error: 'No se encontró tu organización'
            };
        }
        // PASO 3: Consultas paralelas (Schema V2)
        const [membershipResult, branchResult, attendanceResult, cashRegisterResult] = await Promise.all([
            // 1. Membership con display_name, role, xp
            supabase.from('memberships').select('user_id, display_name, role, xp').eq('user_id', user.id).eq('organization_id', orgId).single(),
            // 2. Nombre de la sucursal (branches)
            supabase.from('branches').select('name').eq('id', sucursalId).single(),
            // 3. Estado de asistencia (attendance_logs)
            supabase.from('attendance_logs').select('id').eq('user_id', user.id).eq('branch_id', sucursalId).is('check_out', null).maybeSingle(),
            // 4. Turno de caja activo (cash_registers)
            supabase.from('cash_registers').select('id, opening_amount, opened_at').eq('opened_by', user.id).eq('branch_id', sucursalId).eq('is_open', true).maybeSingle()
        ]);
        // PASO 4: Construir contexto (mapeo a formato legacy)
        const membershipData = membershipResult.data;
        const context = {
            profile: membershipData ? {
                id: membershipData.user_id,
                nombre: membershipData.display_name || 'Operador',
                rol: mapRoleToLegacy(membershipData.role),
                xp: membershipData.xp || 0
            } : null,
            organizationId: orgId,
            branchName: branchResult.data?.name || 'Sucursal',
            isClockedIn: !!attendanceResult.data,
            activeShift: cashRegisterResult.data ? {
                id: cashRegisterResult.data.id,
                monto_inicial: cashRegisterResult.data.opening_amount,
                fecha_apertura: cashRegisterResult.data.opened_at
            } : null
        };
        return {
            success: true,
            context
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al obtener contexto'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    completeProfile,
    getEmployeeDashboardContextAction
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(completeProfile, "60aebd17638619fdb7ba19456567b257135ec719f1", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getEmployeeDashboardContextAction, "40aa9625436d528de53f56574a11eede3faa66ec5b", null);
}),
"[project]/lib/actions/attendance.actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🕐 ATTENDANCE SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de asistencia/fichaje de empleados.
 * Maneja registro de entrada y salida en sucursales.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Validación de sesión y organización
 * - Operaciones atómicas de fichaje
 *
 * ORIGEN: Refactorización de reloj-control.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ /* __next_internal_action_entry_do_not_use__ [{"40296b7b0f274704c36b4c00a045832fc5bf7a8fb9":"toggleAttendanceAction","406749a64aa572cdb6f0333d5b6a1bfcb5215ddfd0":"getAttendanceStatusAction","603f7720f2336da855e42f07daa08187dd08444fbd":"processQRScanAction"},"",""] */ __turbopack_context__.s([
    "getAttendanceStatusAction",
    ()=>getAttendanceStatusAction,
    "processQRScanAction",
    ()=>processQRScanAction,
    "toggleAttendanceAction",
    ()=>toggleAttendanceAction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase-server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
async function getAttendanceStatusAction(sucursalId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // VALIDACIONES
        // ───────────────────────────────────────────────────────────────────────────
        if (!sucursalId) {
            return {
                success: false,
                activeRecord: null,
                error: 'ID de sucursal requerido'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Obtener usuario
        // ───────────────────────────────────────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                activeRecord: null,
                error: 'No hay sesión activa'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 2: Buscar fichaje activo
        // ───────────────────────────────────────────────────────────────────────────
        const { data, error } = await supabase.from('asistencia').select('*').eq('empleado_id', user.id).eq('sucursal_id', sucursalId).is('salida', null).maybeSingle();
        if (error) {
            return {
                success: false,
                activeRecord: null,
                error: `Error al consultar asistencia: ${error.message}`
            };
        }
        return {
            success: true,
            activeRecord: data
        };
    } catch (error) {
        return {
            success: false,
            activeRecord: null,
            error: error instanceof Error ? error.message : 'Error desconocido al consultar asistencia'
        };
    }
}
async function toggleAttendanceAction(sucursalId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // VALIDACIONES
        // ───────────────────────────────────────────────────────────────────────────
        if (!sucursalId) {
            return {
                success: false,
                action: null,
                error: 'ID de sucursal requerido'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Obtener usuario y organización
        // ───────────────────────────────────────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                action: null,
                error: 'No hay sesión activa'
            };
        }
        const { data: orgId } = await supabase.rpc('get_my_org_id_v2');
        if (!orgId) {
            return {
                success: false,
                action: null,
                error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 2: Verificar fichaje activo
        // ───────────────────────────────────────────────────────────────────────────
        const { data: fichajeActivo } = await supabase.from('asistencia').select('*').eq('empleado_id', user.id).eq('sucursal_id', sucursalId).is('salida', null).maybeSingle();
        // ───────────────────────────────────────────────────────────────────────────
        // CASO 1: REGISTRAR ENTRADA
        // ───────────────────────────────────────────────────────────────────────────
        if (!fichajeActivo) {
            const { data, error } = await supabase.from('asistencia').insert({
                organization_id: orgId,
                sucursal_id: sucursalId,
                empleado_id: user.id,
                entrada: new Date().toISOString()
            }).select().single();
            if (error) {
                return {
                    success: false,
                    action: null,
                    error: `Error al registrar entrada: ${error.message}`
                };
            }
            return {
                success: true,
                action: 'entrada',
                record: data,
                message: 'Entrada registrada'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // CASO 2: REGISTRAR SALIDA
        // ───────────────────────────────────────────────────────────────────────────
        const { error: updateError } = await supabase.from('asistencia').update({
            salida: new Date().toISOString()
        }).eq('id', fichajeActivo.id);
        if (updateError) {
            return {
                success: false,
                action: null,
                error: `Error al registrar salida: ${updateError.message}`
            };
        }
        return {
            success: true,
            action: 'salida',
            message: 'Salida registrada'
        };
    } catch (error) {
        return {
            success: false,
            action: null,
            error: error instanceof Error ? error.message : 'Error desconocido al procesar fichaje'
        };
    }
}
async function processQRScanAction(qrData, sucursalId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // VALIDACIONES
        // ───────────────────────────────────────────────────────────────────────────
        if (!qrData.sucursal_id || !sucursalId) {
            return {
                success: false,
                action: null,
                error: 'Datos de sucursal incompletos'
            };
        }
        // Validar que el QR pertenezca a la sucursal correcta
        if (qrData.sucursal_id !== sucursalId) {
            return {
                success: false,
                action: null,
                error: 'El QR escaneado no pertenece a esta sucursal'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Obtener usuario y organización
        // ───────────────────────────────────────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                action: null,
                error: 'No hay sesión activa'
            };
        }
        const { data: orgId } = await supabase.rpc('get_my_org_id_v2');
        if (!orgId) {
            return {
                success: false,
                action: null,
                error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // CASO 1: REGISTRAR ENTRADA
        // ───────────────────────────────────────────────────────────────────────────
        if (qrData.tipo === 'entrada') {
            // Verificar que no exista un fichaje activo
            const { data: fichajeActivo } = await supabase.from('asistencia').select('id').eq('empleado_id', user.id).eq('sucursal_id', qrData.sucursal_id).is('salida', null).maybeSingle();
            if (fichajeActivo) {
                return {
                    success: false,
                    action: null,
                    error: 'Ya tienes un fichaje activo en esta sucursal'
                };
            }
            const { error } = await supabase.from('asistencia').insert({
                organization_id: orgId,
                sucursal_id: qrData.sucursal_id,
                empleado_id: user.id,
                entrada: new Date().toISOString()
            });
            if (error) {
                return {
                    success: false,
                    action: null,
                    error: `Error al registrar entrada: ${error.message}`
                };
            }
            return {
                success: true,
                action: 'entrada',
                message: `Entrada registrada en ${qrData.sucursal_nombre}`
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // CASO 2: REGISTRAR SALIDA
        // ───────────────────────────────────────────────────────────────────────────
        if (qrData.tipo === 'salida') {
            const { data: asistenciaActual } = await supabase.from('asistencia').select('id').eq('empleado_id', user.id).eq('sucursal_id', qrData.sucursal_id).is('salida', null).maybeSingle();
            if (!asistenciaActual) {
                return {
                    success: false,
                    action: null,
                    error: 'No tienes una entrada registrada en este local'
                };
            }
            const { error } = await supabase.from('asistencia').update({
                salida: new Date().toISOString()
            }).eq('id', asistenciaActual.id);
            if (error) {
                return {
                    success: false,
                    action: null,
                    error: `Error al registrar salida: ${error.message}`
                };
            }
            return {
                success: true,
                action: 'salida',
                message: 'Jornada finalizada correctamente'
            };
        }
        return {
            success: false,
            action: null,
            error: 'Tipo de QR no válido'
        };
    } catch (error) {
        return {
            success: false,
            action: null,
            error: error instanceof Error ? error.message : 'Error desconocido al procesar QR'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    getAttendanceStatusAction,
    toggleAttendanceAction,
    processQRScanAction
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getAttendanceStatusAction, "406749a64aa572cdb6f0333d5b6a1bfcb5215ddfd0", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(toggleAttendanceAction, "40296b7b0f274704c36b4c00a045832fc5bf7a8fb9", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(processQRScanAction, "603f7720f2336da855e42f07daa08187dd08444fbd", null);
}),
"[project]/lib/actions/auth.actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔐 AUTH SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de autenticación.
 * Maneja login, registro y magic links de forma segura.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Autenticación con Supabase Auth
 * - Manejo seguro de redirects
 * - Mensajes de error claros
 *
 * RPCs UTILIZADAS:
 * - setup_organization: Onboarding para owners (crea org + membership + branch)
 * - accept_invite: Onboarding para empleados (usa token de invitación)
 * - get_my_org_id: Obtener organization_id del usuario actual
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ /* __next_internal_action_entry_do_not_use__ [{"002096328ab917f262f7ccd5c71459bfeba00a635d":"getCurrentUserAction","00690c8ceee35666264a8ea3a01de94dfe36ef7c3f":"getStaffManagementDataAction","00bcdd73149ed37aef007a8a6daf99f6012341bb48":"isCurrentUserOwnerAction","402390b424b065fac8bf0071018ce7b8fc639a7782":"cancelInviteAction","404cf2032b68db384150751baa4d1f0d8c4a762a45":"completeProfileSetupAction","40a96472ba46c223dae8cd8a9eb2f4b341ad38aefb":"removeEmployeeAction","60241aa8f8d4f05190de64824f914cd6817daac0b0":"signInWithPasswordAction","607937e3d936efc4984d005834de1842e16a51ffe8":"signInWithMagicLinkAction","60bda5c9140bd53f382f3ed48381e699233059b624":"checkInvitationAction","60c7bd07d8cf38cea3f7dee6da14b9074677d23080":"inviteEmployeeAction","60cb25fcc5c5ef2f148937ebd02554bd6dbef5e9fd":"signUpAction"},"",""] */ __turbopack_context__.s([
    "cancelInviteAction",
    ()=>cancelInviteAction,
    "checkInvitationAction",
    ()=>checkInvitationAction,
    "completeProfileSetupAction",
    ()=>completeProfileSetupAction,
    "getCurrentUserAction",
    ()=>getCurrentUserAction,
    "getStaffManagementDataAction",
    ()=>getStaffManagementDataAction,
    "inviteEmployeeAction",
    ()=>inviteEmployeeAction,
    "isCurrentUserOwnerAction",
    ()=>isCurrentUserOwnerAction,
    "removeEmployeeAction",
    ()=>removeEmployeeAction,
    "signInWithMagicLinkAction",
    ()=>signInWithMagicLinkAction,
    "signInWithPasswordAction",
    ()=>signInWithPasswordAction,
    "signUpAction",
    ()=>signUpAction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase-server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
async function signInWithPasswordAction(email, password) {
    try {
        // Validaciones básicas
        if (!email || !password) {
            return {
                success: false,
                error: 'Email y contraseña son requeridos'
            };
        }
        const supabaseServer = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        const { error } = await supabaseServer.auth.signInWithPassword({
            email,
            password
        });
        if (error) {
            return {
                success: false,
                error: error.message || 'Credenciales inválidas'
            };
        }
        return {
            success: true,
            message: '¡Bienvenido! Has iniciado sesión correctamente.'
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al iniciar sesión'
        };
    }
}
async function signUpAction(email, password) {
    try {
        // Validaciones básicas
        if (!email || !password) {
            return {
                success: false,
                error: 'Email y contraseña son requeridos'
            };
        }
        if (password.length < 6) {
            return {
                success: false,
                error: 'La contraseña debe tener al menos 6 caracteres'
            };
        }
        const supabaseServer = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        const { error } = await supabaseServer.auth.signUp({
            email,
            password
        });
        if (error) {
            return {
                success: false,
                error: error.message || 'Error al registrar usuario'
            };
        }
        return {
            success: true,
            message: 'Registro exitoso. Revisa tu correo para confirmar tu cuenta.'
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al registrar'
        };
    }
}
async function signInWithMagicLinkAction(email, redirectTo) {
    try {
        // Validación básica
        if (!email) {
            return {
                success: false,
                error: 'Email es requerido'
            };
        }
        // Determinar URL de redirección
        // Prioridad: 1) Parámetro, 2) Variable de entorno, 3) Localhost (desarrollo)
        const emailRedirectTo = redirectTo || ("TURBOPACK compile-time value", "http://localhost:3000") || process.env.VERCEL_URL || 'http://localhost:3000';
        const supabaseServer = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        const { error } = await supabaseServer.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo,
                shouldCreateUser: false
            }
        });
        if (error) {
            // Mensajes de error personalizados
            if (error.message.includes('not found')) {
                return {
                    success: false,
                    error: 'No existe una cuenta con este email. Contacta a tu administrador.'
                };
            }
            return {
                success: false,
                error: error.message || 'Error al enviar el enlace'
            };
        }
        return {
            success: true,
            message: 'Enlace enviado. Revisa tu correo y haz clic en el enlace para entrar.'
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al enviar magic link'
        };
    }
}
async function getStaffManagementDataAction() {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                branches: [],
                invites: [],
                employees: [],
                error: 'No hay sesión activa'
            };
        }
        // Obtener organization_id desde memberships via RPC
        const { data: orgId } = await supabase.rpc('get_my_org_id');
        if (!orgId) {
            return {
                success: false,
                branches: [],
                invites: [],
                employees: [],
                error: 'No se encontró la organización'
            };
        }
        // Cargar branches
        const { data: branches } = await supabase.from('branches').select('id, name').eq('organization_id', orgId).eq('is_active', true);
        // Cargar invitaciones pendientes con branch info
        const { data: invitesRaw } = await supabase.from('pending_invites').select('id, email, created_at, branch_id, branches(name)').eq('organization_id', orgId).gt('expires_at', new Date().toISOString());
        // Mapear invites al formato esperado
        const invites = (invitesRaw || []).map((inv)=>({
                id: inv.id,
                email: inv.email,
                created_at: inv.created_at,
                branch: inv.branches ? {
                    name: inv.branches.name
                } : null
            }));
        // Cargar empleados desde memberships (excepto el owner actual)
        const { data: membersRaw } = await supabase.from('memberships').select('id, user_id, display_name, email, role, branch_id, branches(name)').eq('organization_id', orgId).eq('is_active', true).neq('user_id', user.id) // Excluir al usuario actual (owner)
        ;
        // Mapear employees al formato esperado
        const employees = (membersRaw || []).map((m)=>({
                id: m.user_id,
                display_name: m.display_name,
                email: m.email,
                role: m.role,
                branch_id: m.branch_id,
                branch: m.branches ? {
                    name: m.branches.name
                } : null
            }));
        return {
            success: true,
            branches: (branches || []).map((b)=>({
                    id: b.id,
                    name: b.name
                })),
            invites,
            employees,
            organizationId: orgId
        };
    } catch (error) {
        return {
            success: false,
            branches: [],
            invites: [],
            employees: [],
            error: error instanceof Error ? error.message : 'Error desconocido al cargar datos'
        };
    }
}
async function inviteEmployeeAction(email, branchId) {
    try {
        if (!email || !email.includes('@')) {
            return {
                success: false,
                error: 'Email inválido'
            };
        }
        if (!branchId) {
            return {
                success: false,
                error: 'Debes asignar una sucursal de trabajo'
            };
        }
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }
        // Obtener organization_id desde memberships
        const { data: orgId } = await supabase.rpc('get_my_org_id');
        if (!orgId) {
            return {
                success: false,
                error: 'Error de sesión'
            };
        }
        const normalizedEmail = email.trim().toLowerCase();
        // Insertar invitación en base de datos
        const { data: invite, error: dbError } = await supabase.from('pending_invites').insert([
            {
                email: normalizedEmail,
                organization_id: orgId,
                branch_id: branchId,
                invited_by: user.id
            }
        ]).select('token').single();
        if (dbError) {
            if (dbError.code === '23505') {
                return {
                    success: false,
                    error: 'Este email ya tiene una invitación pendiente'
                };
            }
            return {
                success: false,
                error: `Error al registrar invitación: ${dbError.message}`
            };
        }
        if (!invite?.token) {
            return {
                success: false,
                error: 'Error al generar token de invitación'
            };
        }
        // Enviar Magic Link
        const baseUrl = ("TURBOPACK compile-time value", "http://localhost:3000") || process.env.VERCEL_URL || 'http://localhost:3000';
        const emailRedirectTo = `${baseUrl}/signup?token=${invite.token}`;
        const { error: magicLinkError } = await supabase.auth.signInWithOtp({
            email: normalizedEmail,
            options: {
                emailRedirectTo,
                shouldCreateUser: true
            }
        });
        if (magicLinkError) {
            return {
                success: false,
                error: `Error al enviar Magic Link: ${magicLinkError.message}`
            };
        }
        return {
            success: true,
            message: 'Invitación enviada. Se vinculará automáticamente al kiosco asignado.'
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al invitar empleado'
        };
    }
}
async function cancelInviteAction(inviteId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        if (!inviteId) {
            return {
                success: false,
                error: 'ID de invitación requerido'
            };
        }
        const { error } = await supabase.from('pending_invites').delete().eq('id', inviteId);
        if (error) {
            return {
                success: false,
                error: `Error al cancelar invitación: ${error.message}`
            };
        }
        return {
            success: true,
            message: 'Invitación cancelada'
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al cancelar invitación'
        };
    }
}
async function removeEmployeeAction(userId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        if (!userId) {
            return {
                success: false,
                error: 'ID de usuario requerido'
            };
        }
        // Obtener organization_id
        const { data: orgId } = await supabase.rpc('get_my_org_id');
        if (!orgId) {
            return {
                success: false,
                error: 'Error de sesión'
            };
        }
        // Soft delete: marcar is_active = false en memberships
        const { error } = await supabase.from('memberships').update({
            is_active: false
        }).eq('user_id', userId).eq('organization_id', orgId);
        if (error) {
            return {
                success: false,
                error: `Error al desvincular empleado: ${error.message}`
            };
        }
        return {
            success: true,
            message: 'Empleado dado de baja'
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al eliminar empleado'
        };
    }
}
async function checkInvitationAction(email, token) {
    try {
        if (!email) {
            return {
                success: false,
                error: 'Email requerido'
            };
        }
        const emailNormalizado = email.toLowerCase().trim();
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // Buscar invitación pendiente válida (no expirada)
        let query = supabase.from('pending_invites').select('organization_id, branch_id, token, expires_at').eq('email', emailNormalizado).gt('expires_at', new Date().toISOString());
        // Si se proporciona token, validar también el token (seguridad adicional)
        if (token) {
            query = query.eq('token', token);
        }
        const { data: invitacion, error } = await query.maybeSingle();
        if (error) {
            console.error('Error buscando invitación:', error);
            return {
                success: false,
                error: `Error al buscar invitación: ${error.message}`
            };
        }
        if (!invitacion) {
            return {
                success: true,
                invitation: null
            };
        }
        // Verificar expiración (doble check)
        const expiresAt = new Date(invitacion.expires_at);
        if (expiresAt < new Date()) {
            return {
                success: false,
                error: 'La invitación ha expirado. Solicita una nueva invitación.'
            };
        }
        return {
            success: true,
            invitation: {
                organization_id: invitacion.organization_id,
                branch_id: invitacion.branch_id,
                token: invitacion.token
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al verificar invitación'
        };
    }
}
async function completeProfileSetupAction(formData) {
    try {
        if (!formData.userId || !formData.email || !formData.name || !formData.role) {
            return {
                success: false,
                error: 'Faltan datos requeridos'
            };
        }
        const { userId, email, name, role, inviteToken } = formData;
        const emailNormalizado = email.toLowerCase().trim();
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // Verificación de idempotencia: verificar si ya existe membership
        const { data: existingMembership } = await supabase.from('memberships').select('id, role').eq('user_id', userId).eq('is_active', true).maybeSingle();
        if (existingMembership) {
            const mappedRole = existingMembership.role === 'owner' ? 'dueño' : 'empleado';
            return {
                success: true,
                role: mappedRole,
                message: 'Usuario ya configurado'
            };
        }
        // CASO DUEÑO - Usar setup_organization RPC
        if (role === 'dueño') {
            const { data: setupData, error: setupError } = await supabase.rpc('setup_organization', {
                p_org_name: `Kiosco de ${name}`,
                p_user_name: name,
                p_email: emailNormalizado
            });
            if (setupError) {
                console.error('Error en setup_organization:', setupError);
                return {
                    success: false,
                    error: `Error al crear organización: ${setupError.message}`
                };
            }
            return {
                success: true,
                role: 'dueño',
                message: '¡Cuenta configurada! Ya tienes acceso y contraseña.',
                data: setupData
            };
        }
        // CASO EMPLEADO - Usar accept_invite RPC
        if (role === 'empleado') {
            // Necesitamos el token de invitación
            let token = inviteToken;
            // Si no viene el token, buscarlo por email
            if (!token) {
                const { data: invite } = await supabase.from('pending_invites').select('token').eq('email', emailNormalizado).gt('expires_at', new Date().toISOString()).maybeSingle();
                if (!invite?.token) {
                    return {
                        success: false,
                        error: `No se encontró invitación válida para ${email}. La invitación puede haber expirado o no existe. Pide al dueño que te invite de nuevo.`
                    };
                }
                token = invite.token;
            }
            const { data: employeeData, error: employeeError } = await supabase.rpc('accept_invite', {
                p_token: token,
                p_user_name: name,
                p_email: emailNormalizado
            });
            if (employeeError) {
                console.error('Error en accept_invite:', employeeError);
                return {
                    success: false,
                    error: `No se encontró invitación válida para ${email}. La invitación puede haber expirado o no existe. Pide al dueño que te invite de nuevo.`
                };
            }
            return {
                success: true,
                role: 'empleado',
                message: '¡Cuenta configurada! Ya tienes acceso y contraseña.',
                data: employeeData
            };
        }
        return {
            success: false,
            error: 'Rol no válido'
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al completar registro'
        };
    }
}
async function getCurrentUserAction() {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }
        // Obtener membership activa
        const { data: membership, error } = await supabase.from('memberships').select('organization_id, branch_id, role, display_name, email').eq('user_id', user.id).eq('is_active', true).maybeSingle();
        if (error) {
            return {
                success: false,
                error: `Error al obtener datos: ${error.message}`
            };
        }
        if (!membership) {
            return {
                success: false,
                error: 'Usuario no tiene perfil configurado'
            };
        }
        return {
            success: true,
            user: {
                id: user.id,
                email: membership.email || user.email || '',
                display_name: membership.display_name,
                role: membership.role,
                organization_id: membership.organization_id,
                branch_id: membership.branch_id
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        };
    }
}
async function isCurrentUserOwnerAction() {
    const result = await getCurrentUserAction();
    return result.success && result.user?.role === 'owner';
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    signInWithPasswordAction,
    signUpAction,
    signInWithMagicLinkAction,
    getStaffManagementDataAction,
    inviteEmployeeAction,
    cancelInviteAction,
    removeEmployeeAction,
    checkInvitationAction,
    completeProfileSetupAction,
    getCurrentUserAction,
    isCurrentUserOwnerAction
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(signInWithPasswordAction, "60241aa8f8d4f05190de64824f914cd6817daac0b0", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(signUpAction, "60cb25fcc5c5ef2f148937ebd02554bd6dbef5e9fd", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(signInWithMagicLinkAction, "607937e3d936efc4984d005834de1842e16a51ffe8", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getStaffManagementDataAction, "00690c8ceee35666264a8ea3a01de94dfe36ef7c3f", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(inviteEmployeeAction, "60c7bd07d8cf38cea3f7dee6da14b9074677d23080", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(cancelInviteAction, "402390b424b065fac8bf0071018ce7b8fc639a7782", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(removeEmployeeAction, "40a96472ba46c223dae8cd8a9eb2f4b341ad38aefb", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(checkInvitationAction, "60bda5c9140bd53f382f3ed48381e699233059b624", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(completeProfileSetupAction, "404cf2032b68db384150751baa4d1f0d8c4a762a45", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getCurrentUserAction, "002096328ab917f262f7ccd5c71459bfeba00a635d", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(isCurrentUserOwnerAction, "00bcdd73149ed37aef007a8a6daf99f6012341bb48", null);
}),
"[project]/lib/actions/branch.actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🏢 BRANCH (SUCURSALES) SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de sucursales.
 * Maneja consultas y actualizaciones de QR de fichaje.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - organization_id obtenido/validado en servidor
 * - Gestión segura de URLs de QR (qr_entrada_url, qr_salida_url)
 *
 * ORIGEN: Refactorización de generar-qr-fichaje.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ /* __next_internal_action_entry_do_not_use__ [{"000820d3776c231a295006b764fe28b646565a4aef":"getBranchesWithQRAction","0096db88f67331cbab7b5298afb5e005d136f36032":"getBranchesAction","40d312eba4347109edc330e79fc7650186ab50cdb6":"createBranchAction","40fa7cf7591b7a9e26de206f1238e88633f4286ea6":"deleteBranchAction","70149795d8dd53edff1c31611cde86efdde422c93a":"updateBranchQRAction"},"",""] */ __turbopack_context__.s([
    "createBranchAction",
    ()=>createBranchAction,
    "deleteBranchAction",
    ()=>deleteBranchAction,
    "getBranchesAction",
    ()=>getBranchesAction,
    "getBranchesWithQRAction",
    ()=>getBranchesWithQRAction,
    "updateBranchQRAction",
    ()=>updateBranchQRAction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase-server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
async function getBranchesWithQRAction() {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Obtener usuario y organización usando V2
        // ───────────────────────────────────────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                branches: [],
                error: 'No hay sesión activa'
            };
        }
        // V2: Usar RPC que lee de user_organization_roles
        const { data: orgIdV2 } = await supabase.rpc('get_my_org_id_v2');
        const orgId = orgIdV2;
        if (!orgId) {
            return {
                success: false,
                branches: [],
                error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 2: Consultar sucursales con QRs
        // ───────────────────────────────────────────────────────────────────────────
        const { data: sucursalesData, error } = await supabase.from('sucursales').select('id, nombre, qr_entrada_url, qr_salida_url').eq('organization_id', orgId).order('nombre');
        if (error) {
            return {
                success: false,
                branches: [],
                error: `Error al cargar sucursales: ${error.message}`
            };
        }
        // Mapear a tipo Branch (asegurar nulls explícitos)
        const branches = (sucursalesData || []).map((s)=>({
                id: s.id,
                nombre: s.nombre,
                qr_entrada_url: s.qr_entrada_url || null,
                qr_salida_url: s.qr_salida_url || null
            }));
        return {
            success: true,
            branches
        };
    } catch (error) {
        return {
            success: false,
            branches: [],
            error: error instanceof Error ? error.message : 'Error desconocido al cargar sucursales'
        };
    }
}
async function updateBranchQRAction(sucursalId, tipo, qrUrl) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // VALIDACIONES
        // ───────────────────────────────────────────────────────────────────────────
        if (!sucursalId || !tipo || !qrUrl) {
            return {
                success: false,
                error: 'Parámetros incompletos'
            };
        }
        if (tipo !== 'entrada' && tipo !== 'salida') {
            return {
                success: false,
                error: 'Tipo de QR inválido (debe ser "entrada" o "salida")'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // ACTUALIZACIÓN
        // ───────────────────────────────────────────────────────────────────────────
        const updateData = {};
        if (tipo === 'entrada') {
            updateData.qr_entrada_url = qrUrl;
        } else {
            updateData.qr_salida_url = qrUrl;
        }
        const { error } = await supabase.from('sucursales').update(updateData).eq('id', sucursalId);
        if (error) {
            return {
                success: false,
                error: `Error al guardar QR: ${error.message}`
            };
        }
        return {
            success: true
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al guardar QR'
        };
    }
}
async function getBranchesAction() {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Obtener usuario y organización usando V2
        // ───────────────────────────────────────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                branches: [],
                error: 'No hay sesión activa'
            };
        }
        // V2: Usar RPC que lee de user_organization_roles
        const { data: orgIdV2 } = await supabase.rpc('get_my_org_id_v2');
        const orgId = orgIdV2;
        if (!orgId) {
            return {
                success: false,
                branches: [],
                error: 'No se encontró la organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 2: Consultar sucursales
        // ───────────────────────────────────────────────────────────────────────────
        const { data, error } = await supabase.from('sucursales').select('*').eq('organization_id', orgId).order('created_at', {
            ascending: true
        });
        if (error) {
            return {
                success: false,
                branches: [],
                error: `Error al cargar sucursales: ${error.message}`
            };
        }
        return {
            success: true,
            branches: data || []
        };
    } catch (error) {
        return {
            success: false,
            branches: [],
            error: error instanceof Error ? error.message : 'Error desconocido al cargar sucursales'
        };
    }
}
async function createBranchAction(data) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // VALIDACIONES
        // ───────────────────────────────────────────────────────────────────────────
        if (!data.nombre.trim()) {
            return {
                success: false,
                error: 'El nombre es obligatorio'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Obtener usuario y organización usando V2
        // ───────────────────────────────────────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }
        // V2: Usar RPC que lee de user_organization_roles
        const { data: orgIdV2 } = await supabase.rpc('get_my_org_id_v2');
        const orgId = orgIdV2;
        if (!orgId) {
            return {
                success: false,
                error: 'No se encontró la organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 2: Crear sucursal
        // ───────────────────────────────────────────────────────────────────────────
        const { data: nuevaSucursal, error } = await supabase.from('sucursales').insert({
            organization_id: orgId,
            nombre: data.nombre,
            direccion: data.direccion
        }).select().single();
        if (error) {
            return {
                success: false,
                error: `Error al crear sucursal: ${error.message}`
            };
        }
        return {
            success: true,
            branchId: nuevaSucursal?.id
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al crear sucursal'
        };
    }
}
async function deleteBranchAction(branchId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // VALIDACIONES
        // ───────────────────────────────────────────────────────────────────────────
        if (!branchId) {
            return {
                success: false,
                error: 'Branch ID es requerido'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // ELIMINACIÓN (CASCADA EN DB)
        // ───────────────────────────────────────────────────────────────────────────
        const { error } = await supabase.from('sucursales').delete().eq('id', branchId);
        if (error) {
            return {
                success: false,
                error: `Error al eliminar sucursal: ${error.message}`
            };
        }
        return {
            success: true
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al eliminar sucursal'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    getBranchesWithQRAction,
    updateBranchQRAction,
    getBranchesAction,
    createBranchAction,
    deleteBranchAction
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getBranchesWithQRAction, "000820d3776c231a295006b764fe28b646565a4aef", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateBranchQRAction, "70149795d8dd53edff1c31611cde86efdde422c93a", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getBranchesAction, "0096db88f67331cbab7b5298afb5e005d136f36032", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createBranchAction, "40d312eba4347109edc330e79fc7650186ab50cdb6", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(deleteBranchAction, "40fa7cf7591b7a9e26de206f1238e88633f4286ea6", null);
}),
"[project]/lib/actions/provider.actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🏢 PROVIDER SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión completa de proveedores.
 * Maneja listado, creación, recarga de saldo e historial de compras.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Cálculos financieros solo en servidor
 * - Transacciones atómicas para integridad de datos
 * - Sin "fallback manual" en cliente
 * - Filtrado inteligente: Globales (sucursal_id IS NULL) + Locales (sucursal_id = X)
 *
 * ORIGEN: Refactorización de control-saldo-proveedor.tsx y gestion-proveedores.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ /* __next_internal_action_entry_do_not_use__ [{"0008842f5ca5eec1eca65916006fe2701e2b7c4109":"getServiceProvidersAction","40b2da98de267b0a1987e5d60b58b6cb163dc9276d":"getProviderPurchaseHistoryAction","6023522941ecea325787a73f1e0e3d9d8828af5f81":"rechargeBalanceAction","60c031a9fb96ff7df41c67e13c5789aa08cd74cce8":"createProviderAction","60f2f6388515ba6be9c5be90f1a147a418444d4ca5":"getProvidersAction"},"",""] */ __turbopack_context__.s([
    "createProviderAction",
    ()=>createProviderAction,
    "getProviderPurchaseHistoryAction",
    ()=>getProviderPurchaseHistoryAction,
    "getProvidersAction",
    ()=>getProvidersAction,
    "getServiceProvidersAction",
    ()=>getServiceProvidersAction,
    "rechargeBalanceAction",
    ()=>rechargeBalanceAction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase-server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
async function getServiceProvidersAction() {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Obtener usuario y organización
        // ───────────────────────────────────────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                providers: [],
                error: 'No hay sesión activa'
            };
        }
        const { data: orgId } = await supabase.rpc('get_my_org_id_v2');
        if (!orgId) {
            return {
                success: false,
                providers: [],
                error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 2: Consultar proveedores de servicios
        // ───────────────────────────────────────────────────────────────────────────
        const { data, error } = await supabase.from('proveedores').select('id, nombre, rubro, saldo_actual').eq('organization_id', orgId).ilike('rubro', '%servicios%') // Case-insensitive match
        .order('nombre', {
            ascending: true
        });
        if (error) {
            return {
                success: false,
                providers: [],
                error: `Error al obtener proveedores: ${error.message}`
            };
        }
        return {
            success: true,
            providers: data || []
        };
    } catch (error) {
        return {
            success: false,
            providers: [],
            error: error instanceof Error ? error.message : 'Error desconocido al obtener proveedores'
        };
    }
}
async function rechargeBalanceAction(providerId, monto) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // VALIDACIONES
        // ───────────────────────────────────────────────────────────────────────────
        if (!providerId) {
            return {
                success: false,
                error: 'ID de proveedor es requerido'
            };
        }
        if (isNaN(monto) || monto <= 0) {
            return {
                success: false,
                error: 'El monto debe ser un número positivo'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // MÉTODO 1: Intentar RPC (preferido - función atómica en DB)
        // ───────────────────────────────────────────────────────────────────────────
        const { data: rpcData, error: rpcError } = await supabase.rpc('incrementar_saldo_proveedor', {
            id_input: providerId,
            monto_input: monto
        });
        if (!rpcError) {
            // RPC exitoso - retornar nuevo saldo
            return {
                success: true,
                nuevoSaldo: rpcData
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // MÉTODO 2: Fallback seguro (si RPC no existe)
        // ───────────────────────────────────────────────────────────────────────────
        // IMPORTANTE: No hacemos SELECT → calcular → UPDATE (race condition)
        // En su lugar, usamos UPDATE con incremento relativo (atómico)
        console.warn('RPC incrementar_saldo_proveedor no disponible, usando UPDATE atómico');
        // Obtener saldo actual primero (solo para validar que existe)
        const { data: proveedorActual, error: fetchError } = await supabase.from('proveedores').select('saldo_actual').eq('id', providerId).single();
        if (fetchError) {
            return {
                success: false,
                error: `Proveedor no encontrado: ${fetchError.message}`
            };
        }
        const saldoActual = proveedorActual?.saldo_actual || 0;
        const nuevoSaldo = saldoActual + monto;
        // UPDATE atómico con el nuevo saldo calculado en servidor
        const { error: updateError } = await supabase.from('proveedores').update({
            saldo_actual: nuevoSaldo
        }).eq('id', providerId);
        if (updateError) {
            return {
                success: false,
                error: `Error al actualizar saldo: ${updateError.message}`
            };
        }
        return {
            success: true,
            nuevoSaldo
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al recargar saldo'
        };
    }
}
async function getProvidersAction(organizationId, sucursalId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // VALIDACIONES
        // ───────────────────────────────────────────────────────────────────────────
        if (!organizationId) {
            return {
                success: false,
                providers: [],
                error: 'Organization ID es requerido'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // CONSULTA CON FILTRADO INTELIGENTE
        // ───────────────────────────────────────────────────────────────────────────
        let query = supabase.from('proveedores').select('*').eq('organization_id', organizationId);
        if (sucursalId) {
            // Caso 1: Mostrar globales + locales de la sucursal seleccionada
            query = query.or(`sucursal_id.is.null,sucursal_id.eq.${sucursalId}`);
        } else {
            // Caso 2: Solo globales (no hay sucursal seleccionada)
            query = query.is('sucursal_id', null);
        }
        const { data, error } = await query.order('nombre', {
            ascending: true
        });
        if (error) {
            return {
                success: false,
                providers: [],
                error: `Error al obtener proveedores: ${error.message}`
            };
        }
        return {
            success: true,
            providers: data || []
        };
    } catch (error) {
        return {
            success: false,
            providers: [],
            error: error instanceof Error ? error.message : 'Error desconocido al obtener proveedores'
        };
    }
}
async function createProviderAction(formData, sucursalId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // VALIDACIONES
        // ───────────────────────────────────────────────────────────────────────────
        if (!formData.nombre) {
            return {
                success: false,
                error: 'El nombre es obligatorio'
            };
        }
        if (!formData.esGlobal && !sucursalId) {
            return {
                success: false,
                error: 'Para crear un proveedor local, debes seleccionar una sucursal'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Obtener usuario y organización
        // ───────────────────────────────────────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }
        const { data: orgId } = await supabase.rpc('get_my_org_id_v2');
        if (!orgId) {
            return {
                success: false,
                error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 2: Insertar proveedor con alcance correcto
        // ───────────────────────────────────────────────────────────────────────────
        const { data, error } = await supabase.from('proveedores').insert([
            {
                organization_id: orgId,
                sucursal_id: formData.esGlobal ? null : sucursalId,
                nombre: formData.nombre,
                rubro: formData.rubro,
                contacto_nombre: formData.contacto_nombre,
                telefono: formData.telefono,
                email: formData.email,
                condicion_pago: formData.condicion_pago
            }
        ]).select().single();
        if (error) {
            return {
                success: false,
                error: `Error al guardar proveedor: ${error.message}`
            };
        }
        return {
            success: true,
            providerId: data?.id
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al crear proveedor'
        };
    }
}
async function getProviderPurchaseHistoryAction(providerId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // VALIDACIONES
        // ───────────────────────────────────────────────────────────────────────────
        if (!providerId) {
            return {
                success: false,
                purchases: [],
                error: 'Provider ID es requerido'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // CONSULTA DE HISTORIAL
        // ───────────────────────────────────────────────────────────────────────────
        const { data, error } = await supabase.from('compras').select('id, monto_total, estado_pago, medio_pago, fecha_compra, comprobante_nro').eq('proveedor_id', providerId).order('fecha_compra', {
            ascending: false
        });
        if (error) {
            return {
                success: false,
                purchases: [],
                error: `Error al obtener historial: ${error.message}`
            };
        }
        return {
            success: true,
            purchases: data || []
        };
    } catch (error) {
        return {
            success: false,
            purchases: [],
            error: error instanceof Error ? error.message : 'Error desconocido al obtener historial'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    getServiceProvidersAction,
    rechargeBalanceAction,
    getProvidersAction,
    createProviderAction,
    getProviderPurchaseHistoryAction
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getServiceProvidersAction, "0008842f5ca5eec1eca65916006fe2701e2b7c4109", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(rechargeBalanceAction, "6023522941ecea325787a73f1e0e3d9d8828af5f81", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getProvidersAction, "60f2f6388515ba6be9c5be90f1a147a418444d4ca5", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createProviderAction, "60c031a9fb96ff7df41c67e13c5789aa08cd74cce8", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getProviderPurchaseHistoryAction, "40b2da98de267b0a1987e5d60b58b6cb163dc9276d", null);
}),
"[project]/lib/repositories/producto.repository.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📦 PRODUCT REPOSITORY (actualizado para nuevo schema)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Repositorio para gestión de productos siguiendo el patrón { data, error }.
 * Usa tabla 'products' del nuevo schema.
 *
 * MAPEO DE TABLAS:
 * - productos → products
 * - nombre → name
 * - precio_venta → sale_price
 * - costo → cost
 * - codigo_barras → barcode
 * - categoria → category
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ __turbopack_context__.s([
    "createProducto",
    ()=>createProducto,
    "deleteProducto",
    ()=>deleteProducto,
    "getProductoById",
    ()=>getProductoById,
    "getProductosByCategoria",
    ()=>getProductosByCategoria,
    "listProductosByOrganization",
    ()=>listProductosByOrganization,
    "searchProductos",
    ()=>searchProductos,
    "updateProducto",
    ()=>updateProducto
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase.ts [app-rsc] (ecmascript)");
;
async function createProducto(params) {
    try {
        const productData = {
            organization_id: params.organizationId,
            name: params.nombre,
            emoji: params.emoji ?? undefined,
            barcode: params.codigoBarras ?? undefined,
            category: params.categoria ?? undefined,
            sale_price: params.precioVenta ?? 0,
            cost: params.costo ?? 0
        };
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from('products').insert(productData).select().single();
        if (error) {
            return {
                data: null,
                error: new Error(`Error creando producto: ${error.message}`)
            };
        }
        if (!data) {
            return {
                data: null,
                error: new Error('No se pudo crear el producto')
            };
        }
        return {
            data,
            error: null
        };
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error : new Error('Error desconocido en createProducto')
        };
    }
}
async function getProductoById(productoId) {
    try {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from('products').select('*').eq('id', productoId).single();
        if (error) {
            return {
                data: null,
                error: new Error(`Error obteniendo producto: ${error.message}`)
            };
        }
        return {
            data,
            error: null
        };
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error : new Error('Error desconocido en getProductoById')
        };
    }
}
async function listProductosByOrganization(organizationId) {
    try {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from('products').select('*').eq('organization_id', organizationId).eq('is_active', true).order('name', {
            ascending: true
        });
        if (error) {
            return {
                data: null,
                error: new Error(`Error listando productos: ${error.message}`)
            };
        }
        return {
            data: data ?? [],
            error: null
        };
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error : new Error('Error desconocido en listProductosByOrganization')
        };
    }
}
async function updateProducto(productoId, updates) {
    try {
        const updateData = {};
        if (updates.nombre !== undefined) updateData.name = updates.nombre;
        if (updates.emoji !== undefined) updateData.emoji = updates.emoji;
        if (updates.codigoBarras !== undefined) updateData.barcode = updates.codigoBarras;
        if (updates.categoria !== undefined) updateData.category = updates.categoria;
        if (updates.precioVenta !== undefined) updateData.sale_price = updates.precioVenta ?? undefined;
        if (updates.costo !== undefined) updateData.cost = updates.costo ?? undefined;
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from('products').update(updateData).eq('id', productoId).select().single();
        if (error) {
            return {
                data: null,
                error: new Error(`Error actualizando producto: ${error.message}`)
            };
        }
        return {
            data,
            error: null
        };
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error : new Error('Error desconocido en updateProducto')
        };
    }
}
async function deleteProducto(productoId) {
    try {
        const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from('products').update({
            is_active: false
        }).eq('id', productoId);
        if (error) {
            return {
                data: false,
                error: new Error(`Error eliminando producto: ${error.message}`)
            };
        }
        return {
            data: true,
            error: null
        };
    } catch (error) {
        return {
            data: false,
            error: error instanceof Error ? error : new Error('Error desconocido en deleteProducto')
        };
    }
}
async function searchProductos(organizationId, searchTerm) {
    try {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from('products').select('*').eq('organization_id', organizationId).eq('is_active', true).or(`name.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`).order('name', {
            ascending: true
        });
        if (error) {
            return {
                data: null,
                error: new Error(`Error buscando productos: ${error.message}`)
            };
        }
        return {
            data: data ?? [],
            error: null
        };
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error : new Error('Error desconocido en searchProductos')
        };
    }
}
async function getProductosByCategoria(organizationId, categoria) {
    try {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from('products').select('*').eq('organization_id', organizationId).eq('category', categoria).eq('is_active', true).order('name', {
            ascending: true
        });
        if (error) {
            return {
                data: null,
                error: new Error(`Error obteniendo productos por categoría: ${error.message}`)
            };
        }
        return {
            data: data ?? [],
            error: null
        };
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error : new Error('Error desconocido en getProductosByCategoria')
        };
    }
}
}),
"[project]/lib/repositories/stock.repository.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📦 STOCK REPOSITORY (actualizado para nuevo schema)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Repositorio para gestión de inventario usando lotes FIFO.
 * Usa tabla 'stock_batches' del nuevo schema.
 *
 * MAPEO DE TABLAS:
 * - stock → stock_batches
 * - sucursal_id → branch_id
 * - producto_id → product_id
 * - cantidad → quantity
 * - fecha_vencimiento → expiration_date
 * - costo_unitario_historico → unit_cost
 * - proveedor_id → supplier_id
 * - estado → status ('disponible' → 'available', 'vendido' → 'sold', etc.)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ __turbopack_context__.s([
    "createStockEntrada",
    ()=>createStockEntrada,
    "createStockSalida",
    ()=>createStockSalida,
    "getProductosProximosAVencer",
    ()=>getProductosProximosAVencer,
    "getStockDisponible",
    ()=>getStockDisponible,
    "listMovimientosByProducto",
    ()=>listMovimientosByProducto,
    "listMovimientosBySucursal",
    ()=>listMovimientosBySucursal,
    "marcarProductosVencidos",
    ()=>marcarProductosVencidos
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase-server.ts [app-rsc] (ecmascript)");
;
async function createStockEntrada(params) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        const batchData = {
            organization_id: params.organizationId,
            branch_id: params.sucursalId,
            product_id: params.productoId,
            quantity: params.cantidad,
            expiration_date: params.fechaVencimiento,
            status: 'available',
            supplier_id: params.proveedorId ?? undefined,
            unit_cost: params.costoUnitarioHistorico ?? undefined
        };
        const { data, error } = await supabase.from('stock_batches').insert(batchData).select().single();
        if (error) {
            return {
                data: null,
                error: new Error(`Error registrando entrada de stock: ${error.message}`)
            };
        }
        if (!data) {
            return {
                data: null,
                error: new Error('No se pudo registrar la entrada de stock')
            };
        }
        return {
            data,
            error: null
        };
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error : new Error('Error desconocido en createStockEntrada')
        };
    }
}
async function createStockSalida(params) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // En el nuevo schema, simplemente actualizamos el lote más antiguo (FIFO)
        // Pero esto es solo para compatibilidad - usar process_sale RPC en su lugar
        const { data: batch, error: fetchError } = await supabase.from('stock_batches').select('*').eq('organization_id', params.organizationId).eq('branch_id', params.sucursalId).eq('product_id', params.productoId).eq('status', 'available').gt('quantity', 0).order('created_at', {
            ascending: true
        }).limit(1).single();
        if (fetchError || !batch) {
            return {
                data: null,
                error: new Error('No hay stock disponible')
            };
        }
        const newQuantity = batch.quantity - params.cantidad;
        const newStatus = newQuantity <= 0 ? 'sold' : 'available';
        const { data, error } = await supabase.from('stock_batches').update({
            quantity: Math.max(0, newQuantity),
            status: newStatus
        }).eq('id', batch.id).select().single();
        if (error) {
            return {
                data: null,
                error: new Error(`Error registrando salida de stock: ${error.message}`)
            };
        }
        return {
            data,
            error: null
        };
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error : new Error('Error desconocido en createStockSalida')
        };
    }
}
async function getStockDisponible(organizationId, sucursalId, productoId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        const { data, error } = await supabase.from('stock_batches').select('quantity').eq('organization_id', organizationId).eq('branch_id', sucursalId).eq('product_id', productoId).eq('status', 'available');
        if (error) {
            return {
                data: 0,
                error: new Error(`Error obteniendo stock: ${error.message}`)
            };
        }
        const totalStock = (data ?? []).reduce((sum, batch)=>sum + (batch.quantity ?? 0), 0);
        return {
            data: totalStock,
            error: null
        };
    } catch (error) {
        return {
            data: 0,
            error: error instanceof Error ? error : new Error('Error desconocido en getStockDisponible')
        };
    }
}
async function listMovimientosBySucursal(organizationId, sucursalId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        const { data, error } = await supabase.from('stock_batches').select('*').eq('organization_id', organizationId).eq('branch_id', sucursalId).order('created_at', {
            ascending: false
        });
        if (error) {
            return {
                data: null,
                error: new Error(`Error listando lotes: ${error.message}`)
            };
        }
        return {
            data: data ?? [],
            error: null
        };
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error : new Error('Error desconocido en listMovimientosBySucursal')
        };
    }
}
async function listMovimientosByProducto(organizationId, productoId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        const { data, error } = await supabase.from('stock_batches').select('*').eq('organization_id', organizationId).eq('product_id', productoId).order('created_at', {
            ascending: false
        });
        if (error) {
            return {
                data: null,
                error: new Error(`Error listando lotes del producto: ${error.message}`)
            };
        }
        return {
            data: data ?? [],
            error: null
        };
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error : new Error('Error desconocido en listMovimientosByProducto')
        };
    }
}
async function getProductosProximosAVencer(organizationId, sucursalId, diasAnticipacion = 30) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() + diasAnticipacion);
        const fechaLimiteStr = fechaLimite.toISOString().split('T')[0];
        const { data, error } = await supabase.from('stock_batches').select('*').eq('organization_id', organizationId).eq('branch_id', sucursalId).eq('status', 'available').not('expiration_date', 'is', null).lte('expiration_date', fechaLimiteStr).order('expiration_date', {
            ascending: true
        });
        if (error) {
            return {
                data: null,
                error: new Error(`Error obteniendo productos próximos a vencer: ${error.message}`)
            };
        }
        return {
            data: data ?? [],
            error: null
        };
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error : new Error('Error desconocido en getProductosProximosAVencer')
        };
    }
}
async function marcarProductosVencidos(organizationId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        const fechaHoy = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase.from('stock_batches').update({
            status: 'expired'
        }).eq('organization_id', organizationId).eq('status', 'available').lt('expiration_date', fechaHoy).select();
        if (error) {
            return {
                data: 0,
                error: new Error(`Error marcando productos vencidos: ${error.message}`)
            };
        }
        return {
            data: data?.length ?? 0,
            error: null
        };
    } catch (error) {
        return {
            data: 0,
            error: error instanceof Error ? error : new Error('Error desconocido en marcarProductosVencidos')
        };
    }
}
}),
"[project]/lib/actions/inventory.actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📦 INVENTORY SERVER ACTIONS (actualizado para nuevo schema)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de inventario y escaneo de productos.
 *
 * MAPEO DE TABLAS:
 * - productos → products
 * - stock → stock_batches
 * - caja_diaria → cash_registers
 * - perfiles → memberships
 * - proveedores → suppliers
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ /* __next_internal_action_entry_do_not_use__ [{"4090243096ddef13f26f20bbe15f93e8098ee9428f":"getCapitalSummaryAction","40e23d79d46b7f28f098b6544b008618dff14d4766":"getCriticalStockAction","40e3f1e884b589c3b237f0cd5da6ea35d97a9a45c4":"getExpiringStockAction","40f3411cd7a56651189d8f4f54523c537a747e4984":"processComplexStockEntry","7014b224ae1687da57875543e1d800d6adadde7693":"getStockSummary","70566edb59723eff9936c2369e9dad493a944a2a2d":"processStockLossAction","706781921cb56ffc58b2e2915e1ed780a30c66c8d1":"handleProductScan"},"",""] */ __turbopack_context__.s([
    "getCapitalSummaryAction",
    ()=>getCapitalSummaryAction,
    "getCriticalStockAction",
    ()=>getCriticalStockAction,
    "getExpiringStockAction",
    ()=>getExpiringStockAction,
    "getStockSummary",
    ()=>getStockSummary,
    "handleProductScan",
    ()=>handleProductScan,
    "processComplexStockEntry",
    ()=>processComplexStockEntry,
    "processStockLossAction",
    ()=>processStockLossAction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$repositories$2f$producto$2e$repository$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/repositories/producto.repository.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$repositories$2f$stock$2e$repository$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/repositories/stock.repository.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase-server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
async function handleProductScan(barcode, organizationId, sucursalId) {
    if (!barcode || barcode.trim() === '') {
        return {
            status: 'ERROR',
            error: 'El código de barras no puede estar vacío'
        };
    }
    if (!organizationId || organizationId.trim() === '') {
        return {
            status: 'ERROR',
            error: 'El ID de organización es requerido'
        };
    }
    if (!sucursalId || sucursalId.trim() === '') {
        return {
            status: 'ERROR',
            error: 'El ID de sucursal es requerido'
        };
    }
    try {
        const { data: productos, error: searchError } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$repositories$2f$producto$2e$repository$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["searchProductos"])(organizationId, barcode);
        if (searchError) {
            return {
                status: 'ERROR',
                error: 'Error al buscar el producto',
                details: searchError.message
            };
        }
        // Filtrar exactamente por código de barras
        const producto = productos?.find((p)=>p.barcode?.toLowerCase() === barcode.toLowerCase());
        if (!producto) {
            return {
                status: 'NOT_FOUND',
                barcode: barcode,
                message: `No se encontró ningún producto con el código de barras: ${barcode}`
            };
        }
        const { data: stockDisponible, error: stockError } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$repositories$2f$stock$2e$repository$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getStockDisponible"])(organizationId, sucursalId, producto.id);
        if (stockError) {
            return {
                status: 'ERROR',
                error: 'Error al consultar el stock',
                details: stockError.message
            };
        }
        return {
            status: 'FOUND',
            producto: producto,
            stockDisponible: stockDisponible,
            sucursalId: sucursalId
        };
    } catch (error) {
        return {
            status: 'ERROR',
            error: 'Error inesperado al escanear el producto',
            details: error instanceof Error ? error.message : 'Error desconocido'
        };
    }
}
async function getStockSummary(productoIds, organizationId, sucursalId) {
    const summary = await Promise.all(productoIds.map(async (productoId)=>{
        const { data: stock } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$repositories$2f$stock$2e$repository$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getStockDisponible"])(organizationId, sucursalId, productoId);
        return {
            productoId,
            stock: stock ?? 0
        };
    }));
    return summary;
}
async function processComplexStockEntry(params) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }
        const { data: organizationId } = await supabase.rpc('get_my_org_id');
        if (!organizationId) {
            return {
                success: false,
                error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        const costoNum = params.costoUnitario ?? 0;
        // Registrar entrada de stock usando el repositorio actualizado
        const { data: stockData, error: stockError } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$repositories$2f$stock$2e$repository$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createStockEntrada"])({
            organizationId: organizationId,
            sucursalId: params.sucursalId,
            productoId: params.productoId,
            cantidad: params.cantidad,
            fechaVencimiento: params.fechaVencimiento,
            proveedorId: params.proveedorId ?? undefined,
            costoUnitarioHistorico: costoNum > 0 ? costoNum : undefined
        });
        if (stockError) {
            return {
                success: false,
                error: 'Error al registrar el stock'
            };
        }
        let precioActualizado = false;
        // Actualizar costo del producto si cambió
        if (costoNum > 0) {
            const { data: productoActual, error: productoError } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$repositories$2f$producto$2e$repository$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getProductoById"])(params.productoId);
            if (!productoError && productoActual) {
                const costoAnterior = productoActual.cost ?? 0;
                if (costoAnterior !== costoNum) {
                    // Registrar en historial de precios
                    await supabase.from('price_history').insert({
                        organization_id: organizationId,
                        product_id: params.productoId,
                        old_cost: costoAnterior,
                        new_cost: costoNum,
                        old_price: productoActual.sale_price,
                        new_price: productoActual.sale_price,
                        changed_by: user.id
                    });
                    // Actualizar costo del producto
                    const { error: updateError } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$repositories$2f$producto$2e$repository$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateProducto"])(params.productoId, {
                        costo: costoNum
                    });
                    if (!updateError) {
                        precioActualizado = true;
                    }
                }
            }
        }
        return {
            success: true,
            details: {
                stockId: stockData?.id,
                precioActualizado
            }
        };
    } catch (error) {
        return {
            success: false,
            error: 'Error inesperado al procesar la entrada de stock'
        };
    }
}
async function getCapitalSummaryAction(organizationId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        if (!organizationId) {
            return {
                success: false,
                capitalFisico: 0,
                saldoVirtual: 0,
                error: 'Organization ID es requerido'
            };
        }
        // Usar la vista v_products_with_stock del nuevo schema
        const { data: productosData, error: productosError } = await supabase.from('v_products_with_stock').select('cost, stock, is_service').eq('organization_id', organizationId);
        if (productosError) {
            return {
                success: false,
                capitalFisico: 0,
                saldoVirtual: 0,
                error: `Error al obtener productos: ${productosError.message}`
            };
        }
        // Calcular: cost × stock (excluye servicios y sin stock)
        const capitalFisico = (productosData || []).filter((p)=>!p.is_service && (p.stock || 0) > 0).reduce((suma, p)=>suma + (p.cost || 0) * (p.stock || 0), 0);
        // Saldo virtual desde suppliers
        const { data: suppliersData, error: suppliersError } = await supabase.from('suppliers').select('balance').eq('organization_id', organizationId).eq('is_active', true);
        if (suppliersError) {
            return {
                success: false,
                capitalFisico: 0,
                saldoVirtual: 0,
                error: `Error al obtener proveedores: ${suppliersError.message}`
            };
        }
        const saldoVirtual = (suppliersData || []).reduce((suma, p)=>suma + (p.balance || 0), 0);
        return {
            success: true,
            capitalFisico,
            saldoVirtual
        };
    } catch (error) {
        return {
            success: false,
            capitalFisico: 0,
            saldoVirtual: 0,
            error: error instanceof Error ? error.message : 'Error desconocido al calcular capital'
        };
    }
}
async function getExpiringStockAction(branchId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        if (!branchId) {
            throw new Error('branchId es requerido');
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            throw new Error('No hay sesión activa');
        }
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() + 10);
        const { data, error } = await supabase.from('stock_batches').select('id, quantity, expiration_date, product_id, products(name, emoji, category)').eq('branch_id', branchId).eq('status', 'available').not('expiration_date', 'is', null).lte('expiration_date', fechaLimite.toISOString().split('T')[0]).order('expiration_date', {
            ascending: true
        });
        if (error) throw error;
        return {
            success: true,
            data: data || []
        };
    } catch (error) {
        return {
            success: false,
            data: [],
            error: error instanceof Error ? error.message : 'Error al obtener vencimientos'
        };
    }
}
async function processStockLossAction(stockId, _turnoId, _empleadoId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        if (!stockId) {
            throw new Error('stockId es requerido');
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            throw new Error('No hay sesión activa');
        }
        // Marcar lote como damaged (merma)
        const { error: updateError } = await supabase.from('stock_batches').update({
            status: 'damaged'
        }).eq('id', stockId);
        if (updateError) throw updateError;
        // TODO: Implementar sistema de misiones en nuevo schema si es necesario
        return {
            success: true,
            misionCompletada: false
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error al procesar merma'
        };
    }
}
async function getCriticalStockAction(branchId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        if (!branchId) {
            return {
                success: false,
                stock: [],
                error: 'branchId es requerido'
            };
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                stock: [],
                error: 'No hay sesión activa'
            };
        }
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() + 7);
        const { data, error } = await supabase.from('stock_batches').select('id, product_id, expiration_date, products(name, emoji, sale_price)').eq('branch_id', branchId).eq('status', 'available').lt('expiration_date', fechaLimite.toISOString().split('T')[0]).order('expiration_date', {
            ascending: true
        });
        if (error) {
            return {
                success: false,
                stock: [],
                error: `Error al consultar stock: ${error.message}`
            };
        }
        const stockCritico = (data || []).map((item)=>({
                id: item.id,
                producto_id: item.product_id,
                nombre_producto: item.products?.name || 'Producto',
                emoji_producto: item.products?.emoji || '📦',
                fecha_vencimiento: item.expiration_date,
                precio_venta: item.products?.sale_price || 0
            }));
        return {
            success: true,
            stock: stockCritico
        };
    } catch (error) {
        return {
            success: false,
            stock: [],
            error: error instanceof Error ? error.message : 'Error desconocido al obtener stock crítico'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    handleProductScan,
    getStockSummary,
    processComplexStockEntry,
    getCapitalSummaryAction,
    getExpiringStockAction,
    processStockLossAction,
    getCriticalStockAction
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(handleProductScan, "706781921cb56ffc58b2e2915e1ed780a30c66c8d1", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getStockSummary, "7014b224ae1687da57875543e1d800d6adadde7693", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(processComplexStockEntry, "40f3411cd7a56651189d8f4f54523c537a747e4984", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getCapitalSummaryAction, "4090243096ddef13f26f20bbe15f93e8098ee9428f", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getExpiringStockAction, "40e3f1e884b589c3b237f0cd5da6ea35d97a9a45c4", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(processStockLossAction, "70566edb59723eff9936c2369e9dad493a944a2a2d", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getCriticalStockAction, "40e23d79d46b7f28f098b6544b008618dff14d4766", null);
}),
"[project]/lib/actions/cash.actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ===============================================================================
 * CASH ACTIONS - Server Actions para gestión completa de caja
 * ===============================================================================
 *
 * Archivo consolidado que maneja:
 * - Apertura y cierre de caja diaria (turno)
 * - Movimientos de caja (ingresos/egresos)
 * - Gamificación automática (XP + misiones)
 * - Auditoría completa de efectivo
 *
 * MIGRADO: 2026-01-27 - Schema V2 (tablas en inglés)
 *
 * ===============================================================================
 */ /* __next_internal_action_entry_do_not_use__ [{"40ce988bb569d02627abab4a1e548b3e02a57b9691":"getCajaActivaAction","40d3259b75c69edd2a63dc4c418a90edf27bd7662a":"createCashMovementAction","604dee19f02edc7e0b1cd5ca5672a6d509cc3d2f5b":"cerrarCajaAction","609aa0d42bb36841b20bc35494d7f076998227070d":"getShiftMovementsAction","60b02481f4b5bc1a5fb14f95b984728d8ae305ea59":"abrirCajaAction"},"",""] */ __turbopack_context__.s([
    "abrirCajaAction",
    ()=>abrirCajaAction,
    "cerrarCajaAction",
    ()=>cerrarCajaAction,
    "createCashMovementAction",
    ()=>createCashMovementAction,
    "getCajaActivaAction",
    ()=>getCajaActivaAction,
    "getShiftMovementsAction",
    ()=>getShiftMovementsAction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase-server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/date-fns/format.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$addDays$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/addDays.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
// ─────────────────────────────────────────────────────────────────────────────
// FUNCIONES AUXILIARES (INTERNAS)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Genera misiones automáticas al abrir caja
 *
 * LÓGICA:
 * 1. Misión de vencimientos (si hay stock crítico)
 * 2. Misión de arqueo de cierre (siempre)
 * 3. Misiones desde plantillas (configuradas por el dueño)
 */ async function generateMissions(cashRegisterId, userId, organizationId, branchId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        const today = new Date();
        const expirationLimit = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$addDays$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["addDays"])(today, 10), 'yyyy-MM-dd');
        // PASO 1: Consultar stock crítico (próximo a vencer)
        const { data: criticalStock } = await supabase.from('stock_batches').select('quantity').eq('branch_id', branchId).eq('status', 'available').lt('expiration_date', expirationLimit);
        const totalUnitsAtRisk = criticalStock?.reduce((acc, curr)=>acc + (curr.quantity || 0), 0) || 0;
        const missionsToInsert = [];
        // PASO 2: Crear misión de vencimientos (si hay unidades críticas)
        if (totalUnitsAtRisk > 0) {
            missionsToInsert.push({
                organization_id: organizationId,
                user_id: userId,
                cash_register_id: cashRegisterId,
                type: 'vencimiento',
                description: `Rotación Preventiva: Colocar al frente ${totalUnitsAtRisk} unidades próximas a vencer.`,
                target_value: totalUnitsAtRisk,
                current_value: 0,
                is_completed: false,
                points: 30
            });
        }
        // PASO 3: Crear misión de arqueo de cierre (siempre)
        missionsToInsert.push({
            organization_id: organizationId,
            user_id: userId,
            cash_register_id: cashRegisterId,
            type: 'arqueo_cierre',
            description: 'Realizar el cierre de caja con precisión total.',
            target_value: 1,
            current_value: 0,
            is_completed: false,
            points: 20
        });
        // PASO 4: Agregar plantillas de misiones configuradas
        const { data: templates } = await supabase.from('mission_templates').select('*').eq('organization_id', organizationId).eq('is_active', true).or(`branch_id.is.null,branch_id.eq.${branchId}`);
        if (templates) {
            templates.forEach((t)=>{
                missionsToInsert.push({
                    organization_id: organizationId,
                    user_id: userId,
                    cash_register_id: cashRegisterId,
                    type: 'manual',
                    description: t.description,
                    target_value: 1,
                    current_value: 0,
                    is_completed: false,
                    points: t.points
                });
            });
        }
        // PASO 5: Insertar todas las misiones en bulk
        if (missionsToInsert.length > 0) {
            await supabase.from('missions').insert(missionsToInsert);
        }
    } catch (error) {
        console.error('Error generando misiones:', error);
    }
}
async function abrirCajaAction(montoInicial, sucursalId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // PASO 1: Validar sesión y obtener organización
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }
        const { data: orgId } = await supabase.rpc('get_my_org_id');
        if (!orgId) {
            return {
                success: false,
                error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        // PASO 2: Crear registro de cash_register
        const today = new Date();
        const { data: cashRegister, error: registerError } = await supabase.from('cash_registers').insert({
            organization_id: orgId,
            branch_id: sucursalId,
            date: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(today, 'yyyy-MM-dd'),
            opening_amount: montoInicial,
            is_open: true,
            opened_by: user.id,
            opened_at: today.toISOString()
        }).select().single();
        if (registerError || !cashRegister) {
            return {
                success: false,
                error: `Error al crear la caja diaria: ${registerError?.message || 'Unknown error'}`
            };
        }
        // PASO 3: Generar misiones automáticas
        await generateMissions(cashRegister.id, user.id, orgId, sucursalId);
        return {
            success: true,
            cajaId: cashRegister.id
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al abrir caja'
        };
    }
}
async function cerrarCajaAction(cajaId, montoDeclarado) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // PASO 0: Obtener datos de la caja
        const { data: cashRegister } = await supabase.from('cash_registers').select('id, opening_amount, opened_by, organization_id').eq('id', cajaId).single();
        if (!cashRegister) {
            return {
                success: false,
                exitoArqueo: false,
                dineroEsperado: 0,
                montoDeclarado: 0,
                desvio: 0,
                error: 'No se encontró la caja'
            };
        }
        // PASO 1: CALCULAR VENTAS EN EFECTIVO
        const { data: salesData } = await supabase.from('sales').select('total').eq('cash_register_id', cajaId).eq('payment_method', 'cash');
        const totalVentasEfectivo = salesData?.reduce((sum, item)=>{
            return sum + Number(item.total || 0);
        }, 0) || 0;
        // PASO 2: CALCULAR MOVIMIENTOS MANUALES
        // Excluir categoria='sale' para no duplicar ventas
        const { data: movementsData } = await supabase.from('cash_movements').select('amount, type, category, description').eq('cash_register_id', cajaId).neq('category', 'sale');
        const totalIngresosExtra = movementsData?.filter((m)=>m.type === 'income').reduce((sum, item)=>sum + Number(item.amount), 0) || 0;
        const totalGastos = movementsData?.filter((m)=>m.type === 'expense').reduce((sum, item)=>sum + Number(item.amount), 0) || 0;
        // PASO 3: ECUACIÓN FINAL DEL EFECTIVO ESPERADO
        const dineroEsperado = Number(cashRegister.opening_amount) + totalVentasEfectivo + totalIngresosExtra - totalGastos;
        // PASO 4: CALCULAR DIFERENCIA Y VALIDAR PRECISIÓN
        const desvio = montoDeclarado - dineroEsperado;
        const exitoArqueo = Math.abs(desvio) <= 100 // Tolerancia de $100
        ;
        // PASO 5: GAMIFICACIÓN - COMPLETAR MISIÓN Y OTORGAR XP
        if (exitoArqueo) {
            // Completar misión de arqueo
            await supabase.from('missions').update({
                is_completed: true,
                current_value: 1,
                completed_at: new Date().toISOString()
            }).eq('cash_register_id', cajaId).eq('type', 'arqueo_cierre');
            // Otorgar XP al empleado via memberships
            const { data: membership } = await supabase.from('memberships').select('xp').eq('user_id', cashRegister.opened_by).eq('organization_id', cashRegister.organization_id).single();
            if (membership && membership.xp !== null) {
                await supabase.from('memberships').update({
                    xp: membership.xp + 20
                }).eq('user_id', cashRegister.opened_by).eq('organization_id', cashRegister.organization_id);
            }
        }
        // PASO 6: GUARDAR CIERRE EN BASE DE DATOS
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('cash_registers').update({
            closing_amount: montoDeclarado,
            expected_amount: dineroEsperado,
            variance: desvio,
            is_open: false,
            closed_by: user?.id || null,
            closed_at: new Date().toISOString()
        }).eq('id', cajaId);
        return {
            success: true,
            exitoArqueo,
            dineroEsperado,
            montoDeclarado,
            desvio,
            detalles: {
                montoInicial: Number(cashRegister.opening_amount),
                totalVentasEfectivo,
                totalIngresosExtra,
                totalGastos
            }
        };
    } catch (error) {
        console.error('Error en cierre de caja:', error);
        return {
            success: false,
            exitoArqueo: false,
            dineroEsperado: 0,
            montoDeclarado: 0,
            desvio: 0,
            error: error instanceof Error ? error.message : 'Error desconocido al cerrar caja'
        };
    }
}
async function getCajaActivaAction(sucursalId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        const { data: cashRegister, error } = await supabase.from('cash_registers').select('id, opening_amount, opened_at, opened_by').eq('branch_id', sucursalId).eq('is_open', true).order('opened_at', {
            ascending: false
        }).limit(1).single();
        if (error && error.code !== 'PGRST116') {
            // PGRST116 = no rows found
            return {
                success: false,
                hayCajaAbierta: false,
                error: `Error consultando caja: ${error.message}`
            };
        }
        // Mapear a formato legacy para compatibilidad con componentes
        return {
            success: true,
            hayCajaAbierta: !!cashRegister,
            caja: cashRegister ? {
                id: cashRegister.id,
                monto_inicial: cashRegister.opening_amount,
                fecha_apertura: cashRegister.opened_at,
                empleado_id: cashRegister.opened_by
            } : undefined
        };
    } catch (error) {
        return {
            success: false,
            hayCajaAbierta: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        };
    }
}
async function createCashMovementAction(params) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // VALIDACIONES
        const { monto, descripcion, tipo, turnoId, categoria } = params;
        if (!monto || monto <= 0) {
            return {
                success: false,
                error: 'El monto debe ser mayor a 0'
            };
        }
        if (!descripcion || descripcion.trim().length === 0) {
            return {
                success: false,
                error: 'La descripción es requerida'
            };
        }
        if (!tipo || tipo !== 'ingreso' && tipo !== 'egreso') {
            return {
                success: false,
                error: 'Tipo de movimiento inválido'
            };
        }
        if (!turnoId) {
            return {
                success: false,
                error: 'ID de turno requerido'
            };
        }
        // PASO 1: Obtener usuario y organización
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }
        const { data: orgId } = await supabase.rpc('get_my_org_id');
        if (!orgId) {
            return {
                success: false,
                error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        // Mapear tipo español a inglés
        const typeMap = {
            'ingreso': 'income',
            'egreso': 'expense'
        };
        // PASO 2: Insertar movimiento de caja
        const { error } = await supabase.from('cash_movements').insert({
            organization_id: orgId,
            cash_register_id: turnoId,
            amount: monto,
            description: descripcion.trim(),
            type: typeMap[tipo],
            category: categoria || null,
            user_id: user.id
        });
        if (error) {
            return {
                success: false,
                error: `Error al registrar movimiento: ${error.message}`
            };
        }
        const tipoLabel = tipo === 'egreso' ? 'retiraron' : 'ingresaron';
        return {
            success: true,
            message: `Se ${tipoLabel} $${monto.toLocaleString()} de la caja.`
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al registrar movimiento'
        };
    }
}
async function getShiftMovementsAction(cajaId, tipo) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        if (!cajaId) {
            return {
                success: false,
                movements: [],
                error: 'ID de turno requerido'
            };
        }
        // Mapear tipo español a inglés
        const typeMap = {
            'ingreso': 'income',
            'egreso': 'expense'
        };
        let query = supabase.from('cash_movements').select('*').eq('cash_register_id', cajaId).order('created_at', {
            ascending: false
        });
        // Filtrar por tipo si no es 'all'
        if (tipo && tipo !== 'all') {
            query = query.eq('type', typeMap[tipo]);
        }
        const { data, error } = await query;
        if (error) {
            return {
                success: false,
                movements: [],
                error: `Error al consultar movimientos: ${error.message}`
            };
        }
        return {
            success: true,
            movements: data || []
        };
    } catch (error) {
        return {
            success: false,
            movements: [],
            error: error instanceof Error ? error.message : 'Error desconocido al consultar movimientos'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    abrirCajaAction,
    cerrarCajaAction,
    getCajaActivaAction,
    createCashMovementAction,
    getShiftMovementsAction
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(abrirCajaAction, "60b02481f4b5bc1a5fb14f95b984728d8ae305ea59", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(cerrarCajaAction, "604dee19f02edc7e0b1cd5ca5672a6d509cc3d2f5b", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getCajaActivaAction, "40ce988bb569d02627abab4a1e548b3e02a57b9691", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createCashMovementAction, "40d3259b75c69edd2a63dc4c418a90edf27bd7662a", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getShiftMovementsAction, "609aa0d42bb36841b20bc35494d7f076998227070d", null);
}),
"[project]/lib/constants/roles.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔐 ROLES CONSTANTS - Constantes centralizadas para roles del sistema
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Este archivo centraliza todas las constantes relacionadas con roles
 * para evitar strings hardcodeados y facilitar cambios futuros.
 *
 * USO:
 * import { ROLES, ROLE_LABELS, isOwner } from '@/lib/constants/roles'
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ __turbopack_context__.s([
    "ROLES",
    ()=>ROLES,
    "ROLE_LABELS",
    ()=>ROLE_LABELS,
    "ROLE_VALUES",
    ()=>ROLE_VALUES,
    "VALID_ROLES",
    ()=>VALID_ROLES,
    "getRoleLabel",
    ()=>getRoleLabel,
    "getRoleValue",
    ()=>getRoleValue,
    "isEmployeeRole",
    ()=>isEmployeeRole,
    "isOwnerRole",
    ()=>isOwnerRole,
    "isValidRole",
    ()=>isValidRole,
    "normalizeRole",
    ()=>normalizeRole
]);
const ROLES = {
    OWNER: 'owner',
    EMPLOYEE: 'employee'
};
const VALID_ROLES = [
    ROLES.OWNER,
    ROLES.EMPLOYEE
];
const ROLE_LABELS = {
    owner: 'dueño',
    employee: 'empleado'
};
const ROLE_VALUES = {
    dueño: 'owner',
    empleado: 'employee'
};
function isOwnerRole(role) {
    return role === ROLES.OWNER;
}
function isEmployeeRole(role) {
    return role === ROLES.EMPLOYEE;
}
function getRoleLabel(role) {
    return ROLE_LABELS[role] || 'empleado';
}
function getRoleValue(label) {
    return ROLE_VALUES[label] || 'employee';
}
function isValidRole(role) {
    return VALID_ROLES.includes(role);
}
function normalizeRole(role) {
    // Si ya está en inglés
    if (isValidRole(role)) {
        return role;
    }
    // Si está en español
    if (role === 'dueño') return 'owner';
    if (role === 'empleado') return 'employee';
    // Default
    return 'employee';
}
}),
"[project]/lib/actions/missions.actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 MISSIONS SERVER ACTIONS (CONSOLIDADO)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión completa de misiones y gamificación.
 *
 * FUNCIONALIDADES:
 * - Crear misiones únicas y plantillas recurrentes
 * - Consultar misiones de empleados
 * - Completar misiones manuales
 * - Procesar mermas y actualizar progreso
 * - Gestión de XP
 *
 * MIGRADO: 2026-01-27 - Schema V2 (tablas en inglés)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ /* __next_internal_action_entry_do_not_use__ [{"00027decc7ee7db0c20cac51e30ef1504ca2a230e0":"getEmployeesForMissionsAction","4085af3b461c6c6014446d391b64aa51279d23fc1a":"createMissionAction","606ba1846f4be572dfb96903cb584c1900bbf1b1aa":"getEmployeeMissionsAction","7024f1da317baa26eacaf00562ed0fe771fa14e514":"completeManualMissionAction","788c9679a1ba5b52d6071bf52e053c596c42bbb3d7":"processMermasMissionAction","7f7e9b566cac21c03244539971bb99fb819b3e6578":"getEmpleadosAction","7fe05c88088d20400f31915703e9fb7db3615e16a9":"createMisionAction"},"",""] */ __turbopack_context__.s([
    "completeManualMissionAction",
    ()=>completeManualMissionAction,
    "createMisionAction",
    ()=>createMissionAction,
    "createMissionAction",
    ()=>createMissionAction,
    "getEmpleadosAction",
    ()=>getEmployeesForMissionsAction,
    "getEmployeeMissionsAction",
    ()=>getEmployeeMissionsAction,
    "getEmployeesForMissionsAction",
    ()=>getEmployeesForMissionsAction,
    "processMermasMissionAction",
    ()=>processMermasMissionAction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase-server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2f$roles$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/constants/roles.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
// ───────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ───────────────────────────────────────────────────────────────────────────────
/**
 * Mapea misión del schema V2 a formato legacy para UI
 */ function mapMissionToLegacy(mission) {
    return {
        id: mission.id,
        tipo: mission.type,
        descripcion: mission.description || '',
        objetivo_unidades: mission.target_value,
        unidades_completadas: mission.current_value,
        es_completada: mission.is_completed,
        puntos: mission.points,
        caja_diaria_id: mission.cash_register_id,
        created_at: mission.created_at
    };
}
async function createMissionAction(params) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // Validar sesión
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                tipo: 'mision',
                error: 'No hay sesión activa'
            };
        }
        // Obtener organización
        const { data: organizationId } = await supabase.rpc('get_my_org_id');
        if (!organizationId) {
            return {
                success: false,
                tipo: 'mision',
                error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        // CREAR RUTINA RECURRENTE (plantilla)
        if (params.esRecurrente) {
            const { error } = await supabase.from('mission_templates').insert({
                organization_id: organizationId,
                branch_id: params.sucursalId || null,
                description: params.descripcion,
                points: params.puntos,
                is_active: true
            });
            if (error) {
                return {
                    success: false,
                    tipo: 'rutina',
                    error: `Error creando rutina: ${error.message}`
                };
            }
            return {
                success: true,
                tipo: 'rutina'
            };
        }
        // CREAR MISIÓN ÚNICA
        if (!params.empleadoId) {
            return {
                success: false,
                tipo: 'mision',
                error: 'Falta el ID del empleado para la misión'
            };
        }
        const { error } = await supabase.from('missions').insert({
            organization_id: organizationId,
            cash_register_id: params.turnoId || null,
            user_id: params.empleadoId,
            type: 'manual',
            description: params.descripcion,
            target_value: 1,
            current_value: 0,
            is_completed: false,
            points: params.puntos
        });
        if (error) {
            return {
                success: false,
                tipo: 'mision',
                error: `Error creando misión: ${error.message}`
            };
        }
        return {
            success: true,
            tipo: 'mision'
        };
    } catch (error) {
        return {
            success: false,
            tipo: 'mision',
            error: error instanceof Error ? error.message : 'Error desconocido al crear misión'
        };
    }
}
async function getEmployeesForMissionsAction() {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // Obtener organización actual
        const { data: organizationId } = await supabase.rpc('get_my_org_id');
        if (!organizationId) {
            return {
                success: false,
                empleados: [],
                error: 'No se encontró la organización'
            };
        }
        // Consultar empleados usando memberships (Schema V2)
        const { data, error } = await supabase.from('memberships').select('user_id, display_name').eq('organization_id', organizationId).eq('role', __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2f$roles$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ROLES"].EMPLOYEE).eq('is_active', true);
        if (error) {
            return {
                success: false,
                empleados: [],
                error: `Error obteniendo empleados: ${error.message}`
            };
        }
        // Mapear resultados
        const empleados = (data || []).map((row)=>({
                id: row.user_id,
                nombre: row.display_name || 'Sin nombre'
            }));
        return {
            success: true,
            empleados
        };
    } catch (error) {
        return {
            success: false,
            empleados: [],
            error: error instanceof Error ? error.message : 'Error desconocido al obtener empleados'
        };
    }
}
async function getEmployeeMissionsAction(empleadoId, turnoId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // Validaciones
        if (!empleadoId || !turnoId) {
            return {
                success: false,
                misiones: [],
                error: 'Faltan parámetros requeridos'
            };
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                misiones: [],
                error: 'No hay sesión activa'
            };
        }
        // Consultar misiones (Schema V2)
        const { data, error } = await supabase.from('missions').select('*').eq('user_id', empleadoId).or(`cash_register_id.eq.${turnoId},cash_register_id.is.null`).order('created_at', {
            ascending: true
        });
        if (error) {
            return {
                success: false,
                misiones: [],
                error: `Error al consultar misiones: ${error.message}`
            };
        }
        // Filtrar: turno actual o globales no completadas
        // Y mapear a formato legacy
        const misionesFiltradas = (data || []).filter((m)=>m.cash_register_id === turnoId || !m.cash_register_id && !m.is_completed).map(mapMissionToLegacy);
        return {
            success: true,
            misiones: misionesFiltradas
        };
    } catch (error) {
        return {
            success: false,
            misiones: [],
            error: error instanceof Error ? error.message : 'Error desconocido al cargar misiones'
        };
    }
}
async function completeManualMissionAction(misionId, turnoId, empleadoId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // Validaciones
        if (!misionId || !turnoId || !empleadoId) {
            return {
                success: false,
                error: 'Faltan parámetros requeridos'
            };
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }
        // Obtener datos de la misión (Schema V2)
        const { data: mission, error: missionError } = await supabase.from('missions').select('points, cash_register_id, organization_id').eq('id', misionId).single();
        if (missionError || !mission) {
            return {
                success: false,
                error: 'Misión no encontrada'
            };
        }
        // Actualizar misión como completada
        const updateData = {
            is_completed: true,
            current_value: 1,
            completed_at: new Date().toISOString()
        };
        if (!mission.cash_register_id) {
            updateData.cash_register_id = turnoId;
        }
        const { error: updateError } = await supabase.from('missions').update(updateData).eq('id', misionId);
        if (updateError) {
            return {
                success: false,
                error: `Error al actualizar misión: ${updateError.message}`
            };
        }
        // Sumar XP al membership (Schema V2)
        const { data: membership } = await supabase.from('memberships').select('xp').eq('user_id', empleadoId).eq('organization_id', mission.organization_id).single();
        const nuevoXP = (membership?.xp || 0) + mission.points;
        const { error: xpError } = await supabase.from('memberships').update({
            xp: nuevoXP
        }).eq('user_id', empleadoId).eq('organization_id', mission.organization_id);
        if (xpError) {
            console.error('Error al sumar XP:', xpError);
        }
        return {
            success: true,
            xpGanado: mission.points,
            misionCompletada: true
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al completar misión'
        };
    }
}
async function processMermasMissionAction(stockIds, misionId, turnoId, empleadoId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // Validaciones
        if (!stockIds || stockIds.length === 0) {
            return {
                success: false,
                error: 'No hay stock para mermar'
            };
        }
        if (!misionId || !turnoId || !empleadoId) {
            return {
                success: false,
                error: 'Faltan parámetros requeridos'
            };
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }
        // Actualizar stock_batches a 'damaged' (Schema V2)
        const { error: stockError } = await supabase.from('stock_batches').update({
            status: 'damaged'
        }).in('id', stockIds);
        if (stockError) {
            return {
                success: false,
                error: `Error al actualizar stock: ${stockError.message}`
            };
        }
        // Obtener misión actual (Schema V2)
        const { data: mission, error: missionError } = await supabase.from('missions').select('current_value, target_value, points, cash_register_id, organization_id').eq('id', misionId).single();
        if (missionError || !mission) {
            return {
                success: false,
                error: 'Misión no encontrada'
            };
        }
        // Calcular nuevo progreso
        const unidadesMermadas = stockIds.length;
        const nuevoProgreso = mission.current_value + unidadesMermadas;
        const misionCompletada = nuevoProgreso >= mission.target_value;
        const updateMissionData = {
            current_value: nuevoProgreso,
            is_completed: misionCompletada
        };
        if (misionCompletada) {
            updateMissionData.completed_at = new Date().toISOString();
            if (!mission.cash_register_id) {
                updateMissionData.cash_register_id = turnoId;
            }
        }
        const { error: updateError } = await supabase.from('missions').update(updateMissionData).eq('id', misionId);
        if (updateError) {
            return {
                success: false,
                error: `Error al actualizar misión: ${updateError.message}`
            };
        }
        // Sumar XP si la misión se completó
        let xpGanado = 0;
        if (misionCompletada) {
            const { data: membership } = await supabase.from('memberships').select('xp').eq('user_id', empleadoId).eq('organization_id', mission.organization_id).single();
            const nuevoXP = (membership?.xp || 0) + mission.points;
            const { error: xpError } = await supabase.from('memberships').update({
                xp: nuevoXP
            }).eq('user_id', empleadoId).eq('organization_id', mission.organization_id);
            if (xpError) {
                console.error('Error al sumar XP:', xpError);
            } else {
                xpGanado = mission.points;
            }
        }
        return {
            success: true,
            misionCompletada,
            xpGanado: misionCompletada ? xpGanado : undefined
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al procesar mermas'
        };
    }
}
;
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    createMissionAction,
    getEmployeesForMissionsAction,
    getEmployeeMissionsAction,
    completeManualMissionAction,
    processMermasMissionAction,
    createMissionAction,
    getEmployeesForMissionsAction
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createMissionAction, "4085af3b461c6c6014446d391b64aa51279d23fc1a", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getEmployeesForMissionsAction, "00027decc7ee7db0c20cac51e30ef1504ca2a230e0", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getEmployeeMissionsAction, "606ba1846f4be572dfb96903cb584c1900bbf1b1aa", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(completeManualMissionAction, "7024f1da317baa26eacaf00562ed0fe771fa14e514", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(processMermasMissionAction, "788c9679a1ba5b52d6071bf52e053c596c42bbb3d7", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createMissionAction, "7fe05c88088d20400f31915703e9fb7db3615e16a9", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getEmployeesForMissionsAction, "7f7e9b566cac21c03244539971bb99fb819b3e6578", null);
}),
"[project]/lib/actions/service.actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📱 SERVICE SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de servicios virtuales (cargas de celular, TV, etc).
 * Maneja consultas de saldo de proveedores y transacciones atómicas.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Transacciones atómicas para recargas
 * - Validación de saldo y organización
 *
 * ORIGEN: Refactorización de widget-servicios.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ /* __next_internal_action_entry_do_not_use__ [{"40cf4b3c64e14aef131fbe3d3e2e379edfdc914af1":"getServiceProviderBalanceAction","40d204d238deb570b617ce59492188f2804bb6ff29":"processServiceRechargeAction","7fb02febcf3e4ffda729548e3a063e639f236633c4":"processVirtualRechargeAction"},"",""] */ __turbopack_context__.s([
    "getServiceProviderBalanceAction",
    ()=>getServiceProviderBalanceAction,
    "processServiceRechargeAction",
    ()=>processServiceRechargeAction,
    "processVirtualRechargeAction",
    ()=>processVirtualRechargeAction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase-server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
async function getServiceProviderBalanceAction(tipo = 'servicios') {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Obtener usuario y organización
        // ───────────────────────────────────────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }
        const { data: orgId } = await supabase.rpc('get_my_org_id_v2');
        if (!orgId) {
            return {
                success: false,
                error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 2: Buscar proveedor según tipo
        // ───────────────────────────────────────────────────────────────────────────
        const criterio = tipo === 'SUBE' ? '%SUBE%' : '%servicios%';
        const campo = tipo === 'SUBE' ? 'nombre' : 'rubro';
        const query = supabase.from('proveedores').select('id, saldo_actual, nombre').eq('organization_id', orgId);
        const { data, error } = tipo === 'SUBE' ? await query.ilike('nombre', criterio).single() : await query.ilike('rubro', criterio).limit(1).single();
        if (error) {
            return {
                success: false,
                error: `Error al obtener proveedor: ${error.message}`
            };
        }
        if (!data) {
            return {
                success: false,
                error: `No se encontró proveedor de ${tipo}`
            };
        }
        return {
            success: true,
            provider: data
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al obtener proveedor'
        };
    }
}
async function processServiceRechargeAction(data) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // VALIDACIONES
        // ───────────────────────────────────────────────────────────────────────────
        if (!data.turnoId || !data.proveedorId || !data.montoCarga) {
            return {
                success: false,
                error: 'Datos incompletos para procesar recarga'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 1: Obtener organization_id del turno
        // ───────────────────────────────────────────────────────────────────────────
        const { data: turno, error: turnoError } = await supabase.from('caja_diaria').select('organization_id').eq('id', data.turnoId).single();
        if (turnoError || !turno) {
            return {
                success: false,
                error: 'No se encontró el turno'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 2: Verificar saldo del proveedor
        // ───────────────────────────────────────────────────────────────────────────
        const { data: proveedor, error: proveedorError } = await supabase.from('proveedores').select('saldo_actual').eq('id', data.proveedorId).single();
        if (proveedorError || !proveedor) {
            return {
                success: false,
                error: 'No se encontró el proveedor'
            };
        }
        if (proveedor.saldo_actual < data.montoCarga) {
            return {
                success: false,
                error: 'Saldo insuficiente del proveedor'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // PASO 3: TRANSACCIÓN ATÓMICA
        // ───────────────────────────────────────────────────────────────────────────
        const nuevoSaldo = proveedor.saldo_actual - data.montoCarga;
        // A. Actualizar saldo del proveedor
        const { error: updateError } = await supabase.from('proveedores').update({
            saldo_actual: nuevoSaldo
        }).eq('id', data.proveedorId);
        if (updateError) {
            return {
                success: false,
                error: `Error al actualizar saldo: ${updateError.message}`
            };
        }
        // B. Registrar venta de servicio
        const { error: ventaError } = await supabase.from('ventas_servicios').insert({
            organization_id: turno.organization_id,
            sucursal_id: data.sucursalId,
            caja_diaria_id: data.turnoId,
            proveedor_id: data.proveedorId,
            tipo_servicio: data.tipoServicio,
            monto_carga: data.montoCarga,
            comision: data.comision,
            total_cobrado: data.totalCobrado,
            metodo_pago: data.metodoPago
        });
        if (ventaError) {
            // Rollback: restaurar saldo del proveedor
            await supabase.from('proveedores').update({
                saldo_actual: proveedor.saldo_actual
            }).eq('id', data.proveedorId);
            return {
                success: false,
                error: `Error al registrar venta: ${ventaError.message}`
            };
        }
        // C. Registrar ingreso en caja
        const { error: cajaError } = await supabase.from('movimientos_caja').insert({
            organization_id: turno.organization_id,
            caja_diaria_id: data.turnoId,
            monto: data.totalCobrado,
            tipo: 'ingreso',
            categoria: 'servicios_virtuales',
            descripcion: `Carga ${data.tipoServicio}`,
            created_at: new Date().toISOString()
        });
        if (cajaError) {
            // Rollback: restaurar saldo del proveedor
            await supabase.from('proveedores').update({
                saldo_actual: proveedor.saldo_actual
            }).eq('id', data.proveedorId);
            return {
                success: false,
                error: `Error al registrar movimiento de caja: ${cajaError.message}`
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // ÉXITO
        // ───────────────────────────────────────────────────────────────────────────
        return {
            success: true,
            newBalance: nuevoSaldo,
            message: `Recarga de ${data.tipoServicio} procesada exitosamente`
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al procesar recarga'
        };
    }
}
const processVirtualRechargeAction = processServiceRechargeAction;
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    getServiceProviderBalanceAction,
    processServiceRechargeAction,
    processVirtualRechargeAction
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getServiceProviderBalanceAction, "40cf4b3c64e14aef131fbe3d3e2e379edfdc914af1", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(processServiceRechargeAction, "40d204d238deb570b617ce59492188f2804bb6ff29", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(processVirtualRechargeAction, "7fb02febcf3e4ffda729548e3a063e639f236633c4", null);
}),
"[project]/lib/actions/ventas.actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🛒 VENTAS SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de ventas.
 * Maneja búsqueda de productos y procesamiento de ventas con RPC.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Búsqueda con filtros (ilike, exclusión de servicios)
 * - Procesamiento de ventas con process_sale RPC
 * - Soporte offline con local_id idempotente
 *
 * RPCs UTILIZADAS:
 * - process_sale: Venta atómica con descuento de stock FIFO
 *
 * VISTAS UTILIZADAS:
 * - v_products_with_stock: Productos con stock disponible por branch
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ /* __next_internal_action_entry_do_not_use__ [{"40731c17df5b820fab8837f3fc32e57545c7216f6c":"confirmSaleAction","40f04d246f46d0054a7b5bbd2e875e21de9aef1305":"getSaleDetailAction","60eeed8aa90830317956d9cc120f2f8d205a24f1bf":"getRecentSalesAction","60f79355d8f31594c6014a2ad1e94387c55a04c34a":"searchProductsAction"},"",""] */ __turbopack_context__.s([
    "confirmSaleAction",
    ()=>confirmSaleAction,
    "getRecentSalesAction",
    ()=>getRecentSalesAction,
    "getSaleDetailAction",
    ()=>getSaleDetailAction,
    "searchProductsAction",
    ()=>searchProductsAction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase-server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
async function searchProductsAction(query, branchId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // Validación básica
        if (!query || query.trim().length === 0) {
            return {
                success: true,
                products: []
            };
        }
        if (!branchId) {
            return {
                success: false,
                products: [],
                error: 'Branch no especificado'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // BÚSQUEDA EN VISTA DE PRODUCTOS CON STOCK
        // ───────────────────────────────────────────────────────────────────────────
        const { data, error } = await supabase.from('v_products_with_stock').select('*').eq('branch_id', branchId)// Buscar por nombre (ilike = case-insensitive) o código de barras (exacto)
        .or(`name.ilike.%${query}%,barcode.eq.${query}`)// Excluir servicios
        .eq('is_service', false)// Solo productos activos con stock
        .eq('is_active', true).gt('stock_available', 0).limit(5);
        if (error) {
            return {
                success: false,
                products: [],
                error: `Error en búsqueda: ${error.message}`
            };
        }
        // Mapear resultados al formato del componente
        const products = (data || []).map((p)=>({
                id: p.id || '',
                name: p.name || '',
                price: Number(p.sale_price) || 0,
                stock: Number(p.stock_available) || 0,
                barcode: p.barcode || undefined,
                emoji: p.emoji || undefined
            }));
        return {
            success: true,
            products
        };
    } catch (error) {
        return {
            success: false,
            products: [],
            error: error instanceof Error ? error.message : 'Error desconocido en búsqueda'
        };
    }
}
async function confirmSaleAction(params) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // ───────────────────────────────────────────────────────────────────────────
        // VALIDACIONES
        // ───────────────────────────────────────────────────────────────────────────
        if (!params.items || params.items.length === 0) {
            return {
                success: false,
                error: 'No hay items en la venta'
            };
        }
        if (!params.branchId || !params.cashRegisterId) {
            return {
                success: false,
                error: 'Faltan datos de sucursal o caja'
            };
        }
        if (params.total <= 0) {
            return {
                success: false,
                error: 'El monto total debe ser mayor a cero'
            };
        }
        // ───────────────────────────────────────────────────────────────────────────
        // EJECUTAR RPC PROCESS_SALE
        // ───────────────────────────────────────────────────────────────────────────
        const { data, error } = await supabase.rpc('process_sale', {
            p_branch_id: params.branchId,
            p_cash_register_id: params.cashRegisterId,
            p_items: params.items,
            p_payment_method: params.paymentMethod,
            p_total: params.total,
            p_local_id: params.localId || null,
            p_notes: params.notes || null
        });
        if (error) {
            return {
                success: false,
                error: `Error procesando venta: ${error.message}`
            };
        }
        return {
            success: true,
            saleId: data
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al procesar venta'
        };
    }
}
async function getRecentSalesAction(cashRegisterId, limit = 10) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        const { data, error } = await supabase.from('sales').select(`
        id,
        total,
        payment_method,
        created_at,
        sale_items(count)
      `).eq('cash_register_id', cashRegisterId).order('created_at', {
            ascending: false
        }).limit(limit);
        if (error) {
            return {
                success: false,
                sales: [],
                error: `Error obteniendo ventas: ${error.message}`
            };
        }
        const sales = (data || []).map((s)=>({
                id: s.id,
                total: Number(s.total),
                payment_method: s.payment_method,
                created_at: s.created_at,
                item_count: Array.isArray(s.sale_items) ? s.sale_items.length : 0
            }));
        return {
            success: true,
            sales
        };
    } catch (error) {
        return {
            success: false,
            sales: [],
            error: error instanceof Error ? error.message : 'Error desconocido'
        };
    }
}
async function getSaleDetailAction(saleId) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2d$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
        // Obtener venta
        const { data: sale, error: saleError } = await supabase.from('sales').select('id, total, payment_method, created_at, notes').eq('id', saleId).single();
        if (saleError || !sale) {
            return {
                success: false,
                error: 'Venta no encontrada'
            };
        }
        // Obtener items con nombre de producto
        const { data: items, error: itemsError } = await supabase.from('sale_items').select('id, quantity, unit_price, subtotal, products(name)').eq('sale_id', saleId);
        if (itemsError) {
            return {
                success: false,
                error: `Error obteniendo items: ${itemsError.message}`
            };
        }
        return {
            success: true,
            sale: {
                id: sale.id,
                total: Number(sale.total),
                payment_method: sale.payment_method,
                created_at: sale.created_at,
                notes: sale.notes,
                items: (items || []).map((i)=>({
                        id: i.id,
                        product_name: i.products?.name || 'Producto',
                        quantity: i.quantity,
                        unit_price: Number(i.unit_price),
                        subtotal: Number(i.subtotal)
                    }))
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    searchProductsAction,
    confirmSaleAction,
    getRecentSalesAction,
    getSaleDetailAction
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(searchProductsAction, "60f79355d8f31594c6014a2ad1e94387c55a04c34a", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(confirmSaleAction, "40731c17df5b820fab8837f3fc32e57545c7216f6c", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getRecentSalesAction, "60eeed8aa90830317956d9cc120f2f8d205a24f1bf", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getSaleDetailAction, "40f04d246f46d0054a7b5bbd2e875e21de9aef1305", null);
}),
"[project]/.next-internal/server/app/page/actions.js { ACTIONS_MODULE0 => \"[project]/lib/actions/dashboard.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/lib/actions/product.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/lib/actions/user.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE3 => \"[project]/lib/actions/attendance.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE4 => \"[project]/lib/actions/auth.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE5 => \"[project]/lib/actions/branch.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE6 => \"[project]/lib/actions/provider.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE7 => \"[project]/lib/actions/inventory.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE8 => \"[project]/lib/actions/cash.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE9 => \"[project]/lib/actions/missions.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE10 => \"[project]/lib/actions/service.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE11 => \"[project]/lib/actions/ventas.actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$dashboard$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/dashboard.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$product$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/product.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$user$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/user.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$attendance$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/attendance.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$auth$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/auth.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$branch$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/branch.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$provider$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/provider.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$inventory$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/inventory.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$cash$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/cash.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$missions$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/missions.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$service$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/service.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$ventas$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/ventas.actions.ts [app-rsc] (ecmascript)");
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
;
;
;
;
;
;
;
}),
"[project]/.next-internal/server/app/page/actions.js { ACTIONS_MODULE0 => \"[project]/lib/actions/dashboard.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/lib/actions/product.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/lib/actions/user.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE3 => \"[project]/lib/actions/attendance.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE4 => \"[project]/lib/actions/auth.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE5 => \"[project]/lib/actions/branch.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE6 => \"[project]/lib/actions/provider.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE7 => \"[project]/lib/actions/inventory.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE8 => \"[project]/lib/actions/cash.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE9 => \"[project]/lib/actions/missions.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE10 => \"[project]/lib/actions/service.actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE11 => \"[project]/lib/actions/ventas.actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "000820d3776c231a295006b764fe28b646565a4aef",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$branch$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getBranchesWithQRAction"],
    "0008842f5ca5eec1eca65916006fe2701e2b7c4109",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$provider$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getServiceProvidersAction"],
    "00690c8ceee35666264a8ea3a01de94dfe36ef7c3f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$auth$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getStaffManagementDataAction"],
    "0096db88f67331cbab7b5298afb5e005d136f36032",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$branch$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getBranchesAction"],
    "401c6028156f42d17b0eff5c6bff909e875ffd2d2a",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$product$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["applyHappyHourDiscountAction"],
    "402390b424b065fac8bf0071018ce7b8fc639a7782",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$auth$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cancelInviteAction"],
    "40296b7b0f274704c36b4c00a045832fc5bf7a8fb9",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$attendance$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toggleAttendanceAction"],
    "4037685c5e9267a3d9b9ac5965fe40710ab06d1600",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$product$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["checkExistingProductAction"],
    "404cf2032b68db384150751baa4d1f0d8c4a762a45",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$auth$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["completeProfileSetupAction"],
    "406749a64aa572cdb6f0333d5b6a1bfcb5215ddfd0",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$attendance$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getAttendanceStatusAction"],
    "40731c17df5b820fab8837f3fc32e57545c7216f6c",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$ventas$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["confirmSaleAction"],
    "4090243096ddef13f26f20bbe15f93e8098ee9428f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$inventory$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCapitalSummaryAction"],
    "40a6b0554342b993720c8318133b6388239460babf",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$product$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deleteProductAction"],
    "40a96472ba46c223dae8cd8a9eb2f4b341ad38aefb",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$auth$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["removeEmployeeAction"],
    "40aa9625436d528de53f56574a11eede3faa66ec5b",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$user$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEmployeeDashboardContextAction"],
    "40b2da98de267b0a1987e5d60b58b6cb163dc9276d",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$provider$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getProviderPurchaseHistoryAction"],
    "40cf4b3c64e14aef131fbe3d3e2e379edfdc914af1",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$service$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getServiceProviderBalanceAction"],
    "40d029fc6c95ed9534fed10662ea7633d49df97d3b",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$dashboard$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getInventoryCriticalAction"],
    "40d204d238deb570b617ce59492188f2804bb6ff29",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$service$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["processServiceRechargeAction"],
    "40d312eba4347109edc330e79fc7650186ab50cdb6",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$branch$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createBranchAction"],
    "40d3259b75c69edd2a63dc4c418a90edf27bd7662a",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$cash$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createCashMovementAction"],
    "40e23d79d46b7f28f098b6544b008618dff14d4766",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$inventory$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCriticalStockAction"],
    "40e3f1e884b589c3b237f0cd5da6ea35d97a9a45c4",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$inventory$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getExpiringStockAction"],
    "40f3411cd7a56651189d8f4f54523c537a747e4984",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$inventory$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["processComplexStockEntry"],
    "40fa7cf7591b7a9e26de206f1238e88633f4286ea6",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$branch$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deleteBranchAction"],
    "6023522941ecea325787a73f1e0e3d9d8828af5f81",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$provider$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["rechargeBalanceAction"],
    "60241aa8f8d4f05190de64824f914cd6817daac0b0",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$auth$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["signInWithPasswordAction"],
    "603f7720f2336da855e42f07daa08187dd08444fbd",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$attendance$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["processQRScanAction"],
    "604dee19f02edc7e0b1cd5ca5672a6d509cc3d2f5b",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$cash$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cerrarCajaAction"],
    "606ba1846f4be572dfb96903cb584c1900bbf1b1aa",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$missions$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEmployeeMissionsAction"],
    "607937e3d936efc4984d005834de1842e16a51ffe8",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$auth$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["signInWithMagicLinkAction"],
    "609aa0d42bb36841b20bc35494d7f076998227070d",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$cash$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getShiftMovementsAction"],
    "60aa977d9e70f652e2a321bf878fe8639dcbabc980",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$product$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createFullProductAction"],
    "60b02481f4b5bc1a5fb14f95b984728d8ae305ea59",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$cash$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["abrirCajaAction"],
    "60bda5c9140bd53f382f3ed48381e699233059b624",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$auth$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["checkInvitationAction"],
    "60c031a9fb96ff7df41c67e13c5789aa08cd74cce8",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$provider$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createProviderAction"],
    "60c7bd07d8cf38cea3f7dee6da14b9074677d23080",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$auth$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["inviteEmployeeAction"],
    "60cb25fcc5c5ef2f148937ebd02554bd6dbef5e9fd",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$auth$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["signUpAction"],
    "60f2f52e2b5316743d8df511490b173f59955fedbc",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$product$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateProductAction"],
    "60f2f6388515ba6be9c5be90f1a147a418444d4ca5",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$provider$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getProvidersAction"],
    "60f79355d8f31594c6014a2ad1e94387c55a04c34a",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$ventas$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["searchProductsAction"],
    "70149795d8dd53edff1c31611cde86efdde422c93a",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$branch$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateBranchQRAction"],
    "7024f1da317baa26eacaf00562ed0fe771fa14e514",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$missions$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["completeManualMissionAction"],
    "70566edb59723eff9936c2369e9dad493a944a2a2d",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$inventory$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["processStockLossAction"],
    "70fefa28db228ef2be5fad91633ef642e7e4cad836",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$dashboard$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getOwnerStatsAction"],
    "788c9679a1ba5b52d6071bf52e053c596c42bbb3d7",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$missions$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["processMermasMissionAction"],
    "7f7e9b566cac21c03244539971bb99fb819b3e6578",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$missions$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEmpleadosAction"],
    "7fb02febcf3e4ffda729548e3a063e639f236633c4",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$service$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["processVirtualRechargeAction"],
    "7fe05c88088d20400f31915703e9fb7db3615e16a9",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$missions$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createMisionAction"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$lib$2f$actions$2f$dashboard$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$lib$2f$actions$2f$product$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$lib$2f$actions$2f$user$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$lib$2f$actions$2f$attendance$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE4__$3d3e$__$225b$project$5d2f$lib$2f$actions$2f$auth$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE5__$3d3e$__$225b$project$5d2f$lib$2f$actions$2f$branch$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE6__$3d3e$__$225b$project$5d2f$lib$2f$actions$2f$provider$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE7__$3d3e$__$225b$project$5d2f$lib$2f$actions$2f$inventory$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE8__$3d3e$__$225b$project$5d2f$lib$2f$actions$2f$cash$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE9__$3d3e$__$225b$project$5d2f$lib$2f$actions$2f$missions$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE10__$3d3e$__$225b$project$5d2f$lib$2f$actions$2f$service$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE11__$3d3e$__$225b$project$5d2f$lib$2f$actions$2f$ventas$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/page/actions.js { ACTIONS_MODULE0 => "[project]/lib/actions/dashboard.actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE1 => "[project]/lib/actions/product.actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE2 => "[project]/lib/actions/user.actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE3 => "[project]/lib/actions/attendance.actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE4 => "[project]/lib/actions/auth.actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE5 => "[project]/lib/actions/branch.actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE6 => "[project]/lib/actions/provider.actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE7 => "[project]/lib/actions/inventory.actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE8 => "[project]/lib/actions/cash.actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE9 => "[project]/lib/actions/missions.actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE10 => "[project]/lib/actions/service.actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE11 => "[project]/lib/actions/ventas.actions.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$dashboard$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/dashboard.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$product$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/product.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$user$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/user.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$attendance$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/attendance.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$auth$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/auth.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$branch$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/branch.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$provider$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/provider.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$inventory$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/inventory.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$cash$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/cash.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$missions$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/missions.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$service$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/service.actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$actions$2f$ventas$2e$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/actions/ventas.actions.ts [app-rsc] (ecmascript)");
}),
];

//# sourceMappingURL=_32ff2cd2._.js.map