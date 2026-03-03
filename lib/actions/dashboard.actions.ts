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
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import { verifyAuth } from '@/lib/actions/auth-helpers'
import type { Database } from '@/types/database.types'
import { resolveJoin } from '@/types/supabase-joins'
import type { QuickSnapshot } from '@/types/dashboard.types'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

type DailySales = Database['public']['Views']['v_daily_sales']['Row']
type ExpiringStock = Database['public']['Views']['v_expiring_stock']['Row']
type ProductWithStock = Database['public']['Views']['v_products_with_stock']['Row']

/**
 * Desglose de métodos de pago
 */
export interface PaymentBreakdown {
  cash: number
  card: number
  transfer: number
  wallet: number
}

/**
 * Top producto más vendido
 */
export interface TopProduct {
  name: string
  count: number
  emoji?: string
}

/**
 * Métricas financieras de negocio (BI)
 */
export interface BusinessMetrics {
  gross: number          // Ingresos totales
  net: number            // Utilidad neta
  margin: number         // % de margen sobre ventas
  traceable: number      // Monto en métodos rastreables (card, transfer, wallet)
  cash: number           // Monto en efectivo
  ROI: number            // Retorno sobre inversión
}

/**
 * Estadísticas completas del owner
 */
export interface OwnerStatsResult {
  success: boolean
  totalSold: number
  netProfit: number
  ROI: number
  paymentBreakdown: PaymentBreakdown
  topProducts: TopProduct[]
  businessMetrics: BusinessMetrics
  saleCount: number
  error?: string
}

/**
 * Producto con stock bajo
 */
export interface LowStockProduct {
  id: string
  name: string
  emoji: string | null
  currentStock: number
  minStock: number
  category: string | null
}

/**
 * Item crítico por vencimiento
 */
export interface ExpiringItem {
  id: string
  productId: string
  productName: string
  emoji: string | null
  expirationDate: string
  quantity: number
  daysUntilExpiry: number
  valueAtRisk: number
}

/**
 * Inventario crítico (stock bajo + vencimientos)
 */
export interface InventoryCriticalResult {
  success: boolean
  lowStock: LowStockProduct[]
  expiringItems: {
    totalValue: number
    totalUnits: number
    items: ExpiringItem[]
  }
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

const DEFAULT_LOW_STOCK_THRESHOLD = 5

/**
 * Porcentaje estimado de costo sobre precio de venta.
 * Margen típico de kiosco argentino: 40-60% de costo.
 * Configurable por organización en futuras versiones.
 * Valor default: 0.55 (55% costo → 45% margen bruto).
 */
const DEFAULT_COST_RATIO = 0.55

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 📊 Obtiene estadísticas financieras completas del dueño
 *
 * CÁLCULOS:
 * - Gross: Suma de totales de todas las ventas
 * - Net: Gross - costos estimados + ingresos manuales - egresos manuales
 * - Margin: (Utilidad / Gross) × 100
 * - Traceable: Monto en métodos rastreables (card, transfer, wallet)
 * - Cash: Monto en efectivo
 *
 * @param branchId - ID del branch
 * @param dateFrom - Fecha inicio del rango (ISO string)
 * @param dateTo - Fecha fin del rango (ISO string)
 * @returns OwnerStatsResult - Estadísticas completas
 */
export async function getOwnerStatsAction(
  branchId: string,
  dateFrom: string,
  dateTo: string,
  costRatio: number = DEFAULT_COST_RATIO
): Promise<OwnerStatsResult> {
  try {
    const { supabase } = await verifyAuth()

    // Validaciones
    if (!branchId) {
      return createEmptyStatsResult('Branch no especificado')
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Consultar resumen de ventas desde v_daily_sales
    // ───────────────────────────────────────────────────────────────────────────

    let query = supabase
      .from('v_daily_sales')
      .select('*')
      .eq('branch_id', branchId)

    if (dateFrom) query = query.gte('date', dateFrom)
    if (dateTo) query = query.lte('date', dateTo)

    const { data: salesData, error: salesError } = await query

    if (salesError) {
      return createEmptyStatsResult(`Error al obtener ventas: ${salesError.message}`)
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Calcular métricas financieras
    // ───────────────────────────────────────────────────────────────────────────

    let gross = 0
    let saleCount = 0
    const paymentBreakdown: PaymentBreakdown = {
      cash: 0,
      card: 0,
      transfer: 0,
      wallet: 0,
    }

    ;(salesData || []).forEach((row: DailySales) => {
      const amount = Number(row.total_amount) || 0
      const count = Number(row.sale_count) || 0

      gross += amount
      saleCount += count

      // Desglose por método de pago
      const method = row.payment_method as keyof PaymentBreakdown
      if (method && paymentBreakdown.hasOwnProperty(method)) {
        paymentBreakdown[method] += amount
      }
    })

    // Traceable = card + transfer + wallet
    const traceable = paymentBreakdown.card + paymentBreakdown.transfer + paymentBreakdown.wallet
    const cashAmount = paymentBreakdown.cash

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: Consultar movimientos manuales de caja
    // ───────────────────────────────────────────────────────────────────────────

    let movQuery = supabase
      .from('cash_movements')
      .select('type, amount, category')
      .eq('organization_id', (await supabase.rpc('get_my_org_id')).data || '')

    // Filter by cash_register that belongs to the branch
    const { data: registers } = await supabase
      .from('cash_registers')
      .select('id')
      .eq('branch_id', branchId)

    if (registers && registers.length > 0) {
      const registerIds = registers.map(r => r.id)
      movQuery = movQuery.in('cash_register_id', registerIds)
    }

    const { data: movements } = await movQuery

    let manualIncome = 0
    let manualExpense = 0

    ;(movements || []).forEach((m) => {
      // Skip sale-related movements (already counted)
      if (m.category === 'sale' || m.category === 'ventas') return

      const amount = Number(m.amount) || 0
      if (m.type === 'income') {
        manualIncome += amount
      } else if (m.type === 'expense') {
        manualExpense += amount
      }
    })

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 4: Obtener top productos vendidos (filtrado por branch vía sales)
    // ───────────────────────────────────────────────────────────────────────────

    // Primero obtenemos los IDs de ventas de esta sucursal en el rango de fechas
    let salesQuery = supabase
      .from('sales')
      .select('id')
      .eq('branch_id', branchId)

    if (dateFrom) salesQuery = salesQuery.gte('created_at', dateFrom)
    if (dateTo) salesQuery = salesQuery.lte('created_at', dateTo)

    const { data: branchSales } = await salesQuery
    const saleIds = (branchSales || []).map(s => s.id)

    // Si no hay ventas, retornamos vacío para top products
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let topData: any[] | null = null

    if (saleIds.length > 0) {
      const { data } = await supabase
        .from('sale_items')
        .select('quantity, products(name, emoji)')
        .in('sale_id', saleIds)
      topData = data
    }

    const productCounts: Record<string, { count: number; emoji?: string }> = {}

    ;(topData || []).forEach((item) => {
      const product = resolveJoin<{ name: string; emoji?: string }>(item.products)
      if (!product?.name) return

      if (!productCounts[product.name]) {
        productCounts[product.name] = { count: 0, emoji: product.emoji || undefined }
      }
      productCounts[product.name].count += item.quantity
    })

    const topProducts: TopProduct[] = Object.entries(productCounts)
      .map(([name, { count, emoji }]) => ({ name, count, emoji }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 5: Calcular métricas finales
    // ───────────────────────────────────────────────────────────────────────────

    // Costo estimado configurable (default 55% del bruto)
    const ratio = Math.max(0, Math.min(1, costRatio))
    const estimatedCost = gross * ratio
    const productProfit = gross - estimatedCost
    const net = productProfit + manualIncome - manualExpense
    const margin = gross > 0 ? (productProfit / gross) * 100 : 0
    const ROI = estimatedCost > 0 ? (net / estimatedCost) * 100 : 0

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
        ROI,
      },
    }
  } catch (error) {
    return createEmptyStatsResult(
      error instanceof Error ? error.message : 'Error desconocido al obtener estadísticas'
    )
  }
}

/**
 * 🚨 Obtiene inventario crítico (stock bajo + vencimientos próximos)
 *
 * @param branchId - ID del branch
 * @returns InventoryCriticalResult - Alertas de inventario
 */
export async function getInventoryCriticalAction(
  branchId: string
): Promise<InventoryCriticalResult> {
  try {
    const { supabase } = await verifyAuth()

    // Validaciones
    if (!branchId) {
      return {
        success: false,
        lowStock: [],
        expiringItems: { totalValue: 0, totalUnits: 0, items: [] },
        error: 'Branch no especificado',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener productos con stock bajo desde v_products_with_stock
    // ───────────────────────────────────────────────────────────────────────────

    const { data: productsData, error: productsError } = await supabase
      .from('v_products_with_stock')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .eq('is_service', false)

    if (productsError) {
      return {
        success: false,
        lowStock: [],
        expiringItems: { totalValue: 0, totalUnits: 0, items: [] },
        error: `Error al obtener productos: ${productsError.message}`,
      }
    }

    // Filtrar productos con stock bajo
    const lowStock: LowStockProduct[] = (productsData || [])
      .filter((p: ProductWithStock) => {
        const stock = Number(p.stock_available) || 0
        const minStock = Number(p.min_stock) || DEFAULT_LOW_STOCK_THRESHOLD
        return stock <= minStock
      })
      .map((p: ProductWithStock) => ({
        id: p.id || '',
        name: p.name || '',
        emoji: p.emoji || null,
        currentStock: Number(p.stock_available) || 0,
        minStock: Number(p.min_stock) || DEFAULT_LOW_STOCK_THRESHOLD,
        category: p.category || null,
      }))

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Obtener productos próximos a vencer desde v_expiring_stock
    // ───────────────────────────────────────────────────────────────────────────

    const { data: expiringData, error: expiringError } = await supabase
      .from('v_expiring_stock')
      .select('*')
      .eq('branch_id', branchId)
      .order('days_until_expiry', { ascending: true })

    if (expiringError) {
      return {
        success: false,
        lowStock,
        expiringItems: { totalValue: 0, totalUnits: 0, items: [] },
        error: `Error al obtener vencimientos: ${expiringError.message}`,
      }
    }

    let totalValue = 0
    let totalUnits = 0
    const items: ExpiringItem[] = (expiringData || []).map((e: ExpiringStock) => {
      const value = Number(e.value_at_risk) || 0
      const qty = Number(e.quantity) || 0
      totalValue += value
      totalUnits += qty

      return {
        id: e.organization_id || '', // Using org_id as fallback since stock_batches.id isn't in view
        productId: e.product_id || '',
        productName: e.product_name || '',
        emoji: e.emoji || null,
        expirationDate: e.expiration_date || '',
        quantity: qty,
        daysUntilExpiry: Number(e.days_until_expiry) || 0,
        valueAtRisk: value,
      }
    })

    return {
      success: true,
      lowStock,
      expiringItems: {
        totalValue,
        totalUnits,
        items,
      },
    }
  } catch (error) {
    return {
      success: false,
      lowStock: [],
      expiringItems: { totalValue: 0, totalUnits: 0, items: [] },
      error: error instanceof Error ? error.message : 'Error desconocido al obtener inventario crítico',
    }
  }
}

/**
 * 📅 Obtiene resumen de ventas por día para gráficos
 *
 * @param branchId - ID del branch
 * @param days - Número de días hacia atrás (default 7)
 * @returns Datos para gráfico de ventas
 */
export async function getDailySalesChartAction(
  branchId: string,
  days: number = 7
): Promise<{
  success: boolean
  data: Array<{
    date: string
    total: number
    count: number
  }>
  error?: string
}> {
  try {
    const { supabase } = await verifyAuth()

    if (!branchId) {
      return {
        success: false,
        data: [],
        error: 'Branch no especificado',
      }
    }

    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - days)

    const { data, error } = await supabase
      .from('v_daily_sales')
      .select('date, total_amount, sale_count')
      .eq('branch_id', branchId)
      .gte('date', dateFrom.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (error) {
      return {
        success: false,
        data: [],
        error: `Error: ${error.message}`,
      }
    }

    // Agrupar por fecha (puede haber múltiples métodos de pago por día)
    const grouped: Record<string, { total: number; count: number }> = {}

    ;(data || []).forEach((row) => {
      const date = row.date || ''
      if (!grouped[date]) {
        grouped[date] = { total: 0, count: 0 }
      }
      grouped[date].total += Number(row.total_amount) || 0
      grouped[date].count += Number(row.sale_count) || 0
    })

    const chartData = Object.entries(grouped)
      .map(([date, { total, count }]) => ({ date, total, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      success: true,
      data: chartData,
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * 📸 Snapshot rápido de KPIs del día para la landing del dueño
 *
 * Muestra un resumen consolidado sin necesidad de elegir sucursal:
 * - Ventas totales de hoy (todas las sucursales)
 * - Última diferencia de caja
 * - Cantidad de productos con stock bajo
 */
export async function getQuickSnapshotAction(
  organizationId: string
): Promise<QuickSnapshot> {
  // Return type imported from @/types/dashboard.types
  try {
    const { supabase } = await verifyAuth()

    if (!organizationId) {
      return { success: false, ventasHoy: 0, cantVentas: 0, productosStockBajo: 0, error: 'Org no especificada' }
    }

    const today = new Date().toISOString().split('T')[0]

    // Ventas de hoy (todas las sucursales de la org)
    const { data: salesData } = await supabase
      .from('v_daily_sales')
      .select('total_amount, sale_count')
      .eq('date', today)

    let ventasHoy = 0
    let cantVentas = 0
    ;(salesData || []).forEach((row) => {
      ventasHoy += Number(row.total_amount) || 0
      cantVentas += Number(row.sale_count) || 0
    })

    // Productos con stock bajo (todas las sucursales)
    const { data: lowStockData } = await supabase
      .from('v_products_with_stock')
      .select('id, stock_available, min_stock')
      .eq('is_active', true)
      .eq('is_service', false)

    const productosStockBajo = (lowStockData || []).filter((p) => {
      const stock = Number(p.stock_available) || 0
      const minStock = Number(p.min_stock) || DEFAULT_LOW_STOCK_THRESHOLD
      return stock <= minStock
    }).length

    return {
      success: true,
      ventasHoy,
      cantVentas,
      productosStockBajo,
    }
  } catch {
    return { success: false, ventasHoy: 0, cantVentas: 0, productosStockBajo: 0, error: 'Error al obtener snapshot' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────────────────────────

function createEmptyStatsResult(errorMessage: string): OwnerStatsResult {
  return {
    success: false,
    totalSold: 0,
    netProfit: 0,
    ROI: 0,
    paymentBreakdown: { cash: 0, card: 0, transfer: 0, wallet: 0 },
    topProducts: [],
    saleCount: 0,
    businessMetrics: { gross: 0, net: 0, margin: 0, traceable: 0, cash: 0, ROI: 0 },
    error: errorMessage,
  }
}
