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
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import { verifyAuth } from '@/lib/actions/auth-helpers'
import type { Database } from '@/types/database.types'
import { resolveJoin } from '@/types/supabase-joins'
import { logger } from '@/lib/logging'
import { searchProductsSchema, confirmSaleSchema, getZodError } from '@/lib/validations'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Tipo de la vista v_products_with_stock desde la BD
 */
type ProductWithStock = Database['public']['Views']['v_products_with_stock']['Row']

/**
 * Métodos de pago soportados
 */
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'wallet' | 'mercadopago'

/**
 * Producto para ventas (vista simplificada para UI)
 */
export interface ProductoVenta {
  id: string
  name: string
  price: number
  stock: number
  barcode?: string
  emoji?: string
}

/**
 * Item de venta para procesar (formato esperado por process_sale RPC)
 */
export interface SaleItemInput {
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
}

/**
 * Parámetros para confirmar una venta
 */
export interface ConfirmSaleParams {
  branchId: string
  cashRegisterId: string
  items: SaleItemInput[]
  paymentMethod: PaymentMethod
  total: number
  localId?: string  // Para sync offline
  notes?: string
}

/**
 * Resultado de búsqueda de productos
 */
export interface SearchProductsResult {
  success: boolean
  products: ProductoVenta[]
  error?: string
}

/**
 * Resultado de confirmación de venta
 */
export interface ConfirmSaleResult {
  success: boolean
  saleId?: string
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 🔍 Busca productos para la venta
 *
 * LÓGICA:
 * - Usa v_products_with_stock (combina productos + stock disponible)
 * - Filtro por branch_id (productos de este local)
 * - Búsqueda: nombre (ilike) o código de barras (exacto)
 * - EXCLUYE servicios: is_service = false
 * - Límite de 5 resultados
 *
 * USO:
 * - Búsqueda predictiva (cada tecla)
 * - Búsqueda por escaneo de código de barras
 *
 * @param query - Término de búsqueda (nombre o código de barras)
 * @param branchId - ID del branch para filtrar productos
 * @returns SearchProductsResult - Lista de productos encontrados
 */
export async function searchProductsAction(
  query: string,
  branchId: string
): Promise<SearchProductsResult> {
  try {
    // Validación Zod
    const parsed = searchProductsSchema.safeParse({ query, branchId })
    if (!parsed.success) {
      return {
        success: false,
        products: [],
        error: getZodError(parsed),
      }
    }

    // Query vacío retorna lista vacía (por debounce del UI)
    if (!query || query.trim().length === 0) {
      return { success: true, products: [] }
    }

    const { supabase } = await verifyAuth()

    // ───────────────────────────────────────────────────────────────────────────
    // BÚSQUEDA EN VISTA DE PRODUCTOS CON STOCK
    // ───────────────────────────────────────────────────────────────────────────

    const { data, error } = await supabase
      .from('v_products_with_stock')
      .select('*')
      .eq('branch_id', branchId)
      // Buscar por nombre (ilike = case-insensitive) o código de barras (exacto)
      .or(`name.ilike.%${query}%,barcode.eq.${query}`)
      // Excluir servicios
      .eq('is_service', false)
      // Solo productos activos con stock
      .eq('is_active', true)
      .gt('stock_available', 0)
      .limit(5)

    if (error) {
      return {
        success: false,
        products: [],
        error: `Error en búsqueda: ${error.message}`,
      }
    }

    // Mapear resultados al formato del componente
    const products: ProductoVenta[] = (data || []).map((p: ProductWithStock) => ({
      id: p.id || '',
      name: p.name || '',
      price: Number(p.sale_price) || 0,
      stock: Number(p.stock_available) || 0,
      barcode: p.barcode || undefined,
      emoji: p.emoji || undefined,
    }))

    return {
      success: true,
      products,
    }
  } catch (error) {
    return {
      success: false,
      products: [],
      error: error instanceof Error ? error.message : 'Error desconocido en búsqueda',
    }
  }
}

/**
 * ✅ Confirma y procesa una venta completa
 *
 * LÓGICA:
 * - Ejecuta RPC process_sale (stored procedure en Supabase)
 * - Vincula la venta a la caja diaria (cash_register_id) para auditoría
 * - Registra método de pago global
 * - Soporte para idempotencia offline via local_id
 *
 * El RPC maneja:
 * - Creación de venta
 * - Creación de sale_items
 * - Descuento de stock FIFO
 * - Registro de movimiento de caja (si es efectivo)
 *
 * @param params - Parámetros de la venta
 * @returns ConfirmSaleResult - Resultado de la operación
 */
export async function confirmSaleAction(
  params: ConfirmSaleParams
): Promise<ConfirmSaleResult> {
  try {
    // Validación Zod
    const parsed = confirmSaleSchema.safeParse(params)
    if (!parsed.success) {
      return {
        success: false,
        error: getZodError(parsed),
      }
    }

    const { supabase } = await verifyAuth()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES ADICIONALES DE NEGOCIO
    // ───────────────────────────────────────────────────────────────────────────

    if (!params.branchId || !params.cashRegisterId) {
      return {
        success: false,
        error: 'Faltan datos de sucursal o caja',
      }
    }

    if (params.total <= 0) {
      return {
        success: false,
        error: 'El monto total debe ser mayor a cero',
      }
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
      p_notes: params.notes || null,
    })

    if (error) {
      logger.error('confirmSaleAction', 'Error procesando venta', error, {
        branchId: params.branchId,
        cashRegisterId: params.cashRegisterId,
        total: params.total,
        itemCount: params.items.length,
        localId: params.localId,
      })
      return {
        success: false,
        error: `Error procesando venta: ${error.message}`,
      }
    }

    return {
      success: true,
      saleId: data, // El RPC retorna el ID de la venta creada
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al procesar venta',
    }
  }
}

/**
 * 📋 Obtiene las ventas recientes de una caja
 *
 * @param cashRegisterId - ID de la caja
 * @param limit - Límite de resultados (default 10)
 * @returns Lista de ventas recientes
 */
export async function getRecentSalesAction(
  cashRegisterId: string,
  limit: number = 10
): Promise<{
  success: boolean
  sales: Array<{
    id: string
    total: number
    payment_method: PaymentMethod
    created_at: string
    item_count: number
  }>
  error?: string
}> {
  try {
    const { supabase } = await verifyAuth()

    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        total,
        payment_method,
        created_at,
        sale_items(count)
      `)
      .eq('cash_register_id', cashRegisterId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return {
        success: false,
        sales: [],
        error: `Error obteniendo ventas: ${error.message}`,
      }
    }

    const sales = (data || []).map(s => ({
      id: s.id,
      total: Number(s.total),
      payment_method: s.payment_method as PaymentMethod,
      created_at: s.created_at,
      item_count: Array.isArray(s.sale_items) ? s.sale_items.length : 0,
    }))

    return {
      success: true,
      sales,
    }
  } catch (error) {
    return {
      success: false,
      sales: [],
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * 📦 Obtiene el detalle de una venta específica
 *
 * @param saleId - ID de la venta
 * @returns Detalle completo de la venta
 */
export async function getSaleDetailAction(saleId: string): Promise<{
  success: boolean
  sale?: {
    id: string
    total: number
    payment_method: PaymentMethod
    created_at: string
    notes: string | null
    items: Array<{
      id: string
      product_name: string
      quantity: number
      unit_price: number
      subtotal: number
    }>
  }
  error?: string
}> {
  try {
    const { supabase } = await verifyAuth()

    // Obtener venta
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('id, total, payment_method, created_at, notes')
      .eq('id', saleId)
      .single()

    if (saleError || !sale) {
      return {
        success: false,
        error: 'Venta no encontrada',
      }
    }

    // Obtener items con nombre de producto
    const { data: items, error: itemsError } = await supabase
      .from('sale_items')
      .select('id, quantity, unit_price, subtotal, products(name)')
      .eq('sale_id', saleId)

    if (itemsError) {
      return {
        success: false,
        error: `Error obteniendo items: ${itemsError.message}`,
      }
    }

    return {
      success: true,
      sale: {
        id: sale.id,
        total: Number(sale.total),
        payment_method: sale.payment_method as PaymentMethod,
        created_at: sale.created_at,
        notes: sale.notes,
        items: (items || []).map(i => ({
          id: i.id,
          product_name: resolveJoin<{ name: string }>(i.products)?.name || 'Producto',
          quantity: i.quantity,
          unit_price: Number(i.unit_price),
          subtotal: Number(i.subtotal),
        })),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
