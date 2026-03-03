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
 */

'use server'

import { searchProductos, updateProducto, getProductoById } from '@/lib/repositories/producto.repository'
import { getStockDisponible, createStockEntrada } from '@/lib/repositories/stock.repository'
import { createClient } from '@/lib/supabase-server'
import { verifyAuth } from '@/lib/actions/auth-helpers'
import { Database } from '@/types/database.types'
import { resolveJoin } from '@/types/supabase-joins'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

type Product = Database['public']['Tables']['products']['Row']

/**
 * Resultado cuando el producto SÍ existe en el catálogo
 */
export interface ProductFoundResult {
  status: 'FOUND'
  producto: Product
  stockDisponible: number
  sucursalId: string
}

/**
 * Resultado cuando el producto NO existe en el catálogo
 */
export interface ProductNotFoundResult {
  status: 'NOT_FOUND'
  barcode: string
  message: string
}

/**
 * Resultado cuando ocurre un error en la búsqueda
 */
export interface ProductScanError {
  status: 'ERROR'
  error: string
  details?: string
}

/**
 * Tipo unión de todos los posibles resultados
 */
export type ProductScanResult = ProductFoundResult | ProductNotFoundResult | ProductScanError

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 🔍 Escanea un código de barras y retorna el producto + stock disponible
 */
export async function handleProductScan(
  barcode: string,
  organizationId: string,
  sucursalId: string
): Promise<ProductScanResult> {
  if (!barcode || barcode.trim() === '') {
    return {
      status: 'ERROR',
      error: 'El código de barras no puede estar vacío',
    }
  }

  if (!organizationId || organizationId.trim() === '') {
    return {
      status: 'ERROR',
      error: 'El ID de organización es requerido',
    }
  }

  if (!sucursalId || sucursalId.trim() === '') {
    return {
      status: 'ERROR',
      error: 'El ID de sucursal es requerido',
    }
  }

  try {
    const { data: productos, error: searchError } = await searchProductos(
      organizationId,
      barcode
    )

    if (searchError) {
      return {
        status: 'ERROR',
        error: 'Error al buscar el producto',
        details: searchError.message,
      }
    }

    // Filtrar exactamente por código de barras
    const producto = productos?.find(
      (p) => p.barcode?.toLowerCase() === barcode.toLowerCase()
    )

    if (!producto) {
      return {
        status: 'NOT_FOUND',
        barcode: barcode,
        message: `No se encontró ningún producto con el código de barras: ${barcode}`,
      }
    }

    const { data: stockDisponible, error: stockError } = await getStockDisponible(
      organizationId,
      sucursalId,
      producto.id
    )

    if (stockError) {
      return {
        status: 'ERROR',
        error: 'Error al consultar el stock',
        details: stockError.message,
      }
    }

    return {
      status: 'FOUND',
      producto: producto,
      stockDisponible: stockDisponible,
      sucursalId: sucursalId,
    }
  } catch (error) {
    return {
      status: 'ERROR',
      error: 'Error inesperado al escanear el producto',
      details: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Obtiene un resumen rápido de stock para múltiples productos
 *
 * OPTIMIZADO: 2026-02-25 — 1 query batch con .in() en vez de N queries individuales
 */
export async function getStockSummary(
  productoIds: string[],
  organizationId: string,
  sucursalId: string
): Promise<{ productoId: string; stock: number }[]> {
  if (!productoIds || productoIds.length === 0) {
    return []
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('stock_batches')
      .select('product_id, quantity')
      .eq('organization_id', organizationId)
      .eq('branch_id', sucursalId)
      .eq('status', 'available')
      .in('product_id', productoIds)

    if (error) {
      return productoIds.map(id => ({ productoId: id, stock: 0 }))
    }

    // Agrupar cantidades por product_id
    const stockMap = new Map<string, number>()
    for (const batch of data || []) {
      const pid = batch.product_id
      stockMap.set(pid, (stockMap.get(pid) || 0) + (batch.quantity ?? 0))
    }

    return productoIds.map(id => ({
      productoId: id,
      stock: stockMap.get(id) || 0,
    }))
  } catch {
    return productoIds.map(id => ({ productoId: id, stock: 0 }))
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS PARA ENTRADA COMPLEJA DE STOCK
// ───────────────────────────────────────────────────────────────────────────────

export interface ComplexStockEntryParams {
  productoId: string
  sucursalId: string
  cantidad: number
  fechaVencimiento: string
  costoUnitario?: number
  proveedorId?: string
  estadoPago?: 'pendiente' | 'pagado'
  medioPago?: 'efectivo' | 'transferencia' | 'debito'
  fechaVencimientoPago?: string
}

export interface ComplexStockEntryResult {
  success: boolean
  error?: string
  details?: {
    stockId?: string
    precioActualizado?: boolean
  }
}

/**
 * 📦 Procesa una entrada compleja de stock
 */
export async function processComplexStockEntry(
  params: ComplexStockEntryParams
): Promise<ComplexStockEntryResult> {
  try {
    const { supabase, user, orgId: organizationId } = await verifyAuth()

    const costoNum = params.costoUnitario ?? 0

    // Registrar entrada de stock usando el repositorio actualizado
    const { data: stockData, error: stockError } = await createStockEntrada({
      organizationId: organizationId,
      sucursalId: params.sucursalId,
      productoId: params.productoId,
      cantidad: params.cantidad,
      fechaVencimiento: params.fechaVencimiento,
      proveedorId: params.proveedorId ?? undefined,
      costoUnitarioHistorico: costoNum > 0 ? costoNum : undefined,
    })

    if (stockError) {
      return {
        success: false,
        error: 'Error al registrar el stock',
      }
    }

    let precioActualizado = false

    // Actualizar costo del producto si cambió
    if (costoNum > 0) {
      const { data: productoActual, error: productoError } = await getProductoById(
        params.productoId
      )

      if (!productoError && productoActual) {
        const costoAnterior = productoActual.cost ?? 0

        if (costoAnterior !== costoNum) {
          // Registrar en historial de precios
          await supabase.from('price_history').insert({
            organization_id: organizationId,
            product_id: params.productoId,
            old_cost: costoAnterior,
            new_cost: costoNum,
            old_price: productoActual.sale_price,
            new_price: productoActual.sale_price,
            changed_by: user.id,
          })

          // Actualizar costo del producto
          const { error: updateError } = await updateProducto(params.productoId, {
            costo: costoNum,
          })

          if (!updateError) {
            precioActualizado = true
          }
        }
      }
    }

    return {
      success: true,
      details: {
        stockId: stockData?.id,
        precioActualizado,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: 'Error inesperado al procesar la entrada de stock',
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// RESUMEN DE CAPITAL
// ───────────────────────────────────────────────────────────────────────────────

export interface CapitalSummaryResult {
  success: boolean
  capitalFisico: number
  saldoVirtual: number
  error?: string
}

/**
 * 💰 Obtiene el resumen de capital de la organización
 */
export async function getCapitalSummaryAction(
  _organizationId?: string
): Promise<CapitalSummaryResult> {
  try {
    const { supabase, orgId: organizationId } = await verifyAuth()

    // Usar la vista v_products_with_stock del nuevo schema
    const { data: productosData, error: productosError } = await supabase
      .from('v_products_with_stock')
      .select('cost, stock, is_service')
      .eq('organization_id', organizationId)

    if (productosError) {
      return {
        success: false,
        capitalFisico: 0,
        saldoVirtual: 0,
        error: `Error al obtener productos: ${productosError.message}`,
      }
    }

    // Calcular: cost × stock (excluye servicios y sin stock)
    const capitalFisico = (productosData || [])
      .filter((p: any) =>
        !p.is_service &&
        (p.stock || 0) > 0
      )
      .reduce((suma: number, p: any) =>
        suma + ((p.cost || 0) * (p.stock || 0)),
        0
      )

    // Saldo virtual desde suppliers
    const { data: suppliersData, error: suppliersError } = await supabase
      .from('suppliers')
      .select('balance')
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    if (suppliersError) {
      return {
        success: false,
        capitalFisico: 0,
        saldoVirtual: 0,
        error: `Error al obtener proveedores: ${suppliersError.message}`,
      }
    }

    const saldoVirtual = (suppliersData || [])
      .reduce((suma: number, p: any) =>
        suma + (p.balance || 0),
        0
      )

    return {
      success: true,
      capitalFisico,
      saldoVirtual,
    }
  } catch (error) {
    return {
      success: false,
      capitalFisico: 0,
      saldoVirtual: 0,
      error: error instanceof Error ? error.message : 'Error desconocido al calcular capital',
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// GESTIÓN DE VENCIMIENTOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 📅 Obtiene stock próximo a vencer (menos de 10 días)
 */
export async function getExpiringStockAction(branchId: string) {
  try {
    const { supabase } = await verifyAuth()

    if (!branchId) {
      throw new Error('branchId es requerido')
    }

    const fechaLimite = new Date()
    fechaLimite.setDate(fechaLimite.getDate() + 10)

    const { data, error } = await supabase
      .from('stock_batches')
      .select('id, quantity, expiration_date, product_id, products(name, emoji, category)')
      .eq('branch_id', branchId)
      .eq('status', 'available')
      .not('expiration_date', 'is', null)
      .lte('expiration_date', fechaLimite.toISOString().split('T')[0])
      .order('expiration_date', { ascending: true })

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error) {
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Error al obtener vencimientos',
    }
  }
}

/**
 * 🗑️ Procesa la merma de un producto vencido
 */
export async function processStockLossAction(
  stockId: string,
  _turnoId: string,
  _empleadoId: string
) {
  try {
    const { supabase } = await verifyAuth()

    if (!stockId) {
      throw new Error('stockId es requerido')
    }

    // Marcar lote como damaged (merma)
    const { error: updateError } = await supabase
      .from('stock_batches')
      .update({ status: 'damaged' })
      .eq('id', stockId)

    if (updateError) throw updateError

    // TODO: Implementar sistema de misiones en nuevo schema si es necesario

    return {
      success: true,
      misionCompletada: false,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar merma',
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// STOCK CRÍTICO
// ───────────────────────────────────────────────────────────────────────────────

export interface CriticalStock {
  id: string
  producto_id: string
  nombre_producto: string
  emoji_producto: string
  fecha_vencimiento: string
  precio_venta: number
}

export interface GetCriticalStockResult {
  success: boolean
  stock: CriticalStock[]
  error?: string
}

/**
 * 📦 Obtiene stock disponible que vence en menos de 7 días
 */
export async function getCriticalStockAction(
  branchId: string
): Promise<GetCriticalStockResult> {
  try {
    const { supabase } = await verifyAuth()

    if (!branchId) {
      return {
        success: false,
        stock: [],
        error: 'branchId es requerido',
      }
    }

    const fechaLimite = new Date()
    fechaLimite.setDate(fechaLimite.getDate() + 7)

    const { data, error } = await supabase
      .from('stock_batches')
      .select('id, product_id, expiration_date, products(name, emoji, sale_price)')
      .eq('branch_id', branchId)
      .eq('status', 'available')
      .lt('expiration_date', fechaLimite.toISOString().split('T')[0])
      .order('expiration_date', { ascending: true })

    if (error) {
      return {
        success: false,
        stock: [],
        error: `Error al consultar stock: ${error.message}`,
      }
    }

    const stockCritico: CriticalStock[] = (data || []).map((item: any) => {
      const product = resolveJoin<{ name: string; emoji?: string; sale_price?: number }>(item.products)
      return {
        id: item.id,
        producto_id: item.product_id,
        nombre_producto: product?.name || 'Producto',
        emoji_producto: product?.emoji || '📦',
        fecha_vencimiento: item.expiration_date,
        precio_venta: product?.sale_price || 0,
      }
    })

    return {
      success: true,
      stock: stockCritico,
    }
  } catch (error) {
    return {
      success: false,
      stock: [],
      error: error instanceof Error ? error.message : 'Error desconocido al obtener stock crítico',
    }
  }
}
