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
 */

import { createClient } from '@/lib/supabase-server'
import { Database } from '@/types/database.types'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

type StockBatch = Database['public']['Tables']['stock_batches']['Row']
type StockBatchInsert = Database['public']['Tables']['stock_batches']['Insert']

// Alias para compatibilidad
export type Stock = StockBatch

/**
 * Parámetros para crear un lote de stock (entrada)
 */
export interface CreateStockEntradaParams {
  organizationId: string
  sucursalId: string  // branch_id
  productoId: string  // product_id
  cantidad: number    // quantity
  fechaVencimiento: string // expiration_date, Formato: YYYY-MM-DD
  proveedorId?: string | null // supplier_id
  compraId?: string | null // No existe en nuevo schema, se ignora
  costoUnitarioHistorico?: number | null // unit_cost
}

/**
 * Parámetros para registrar una salida de stock (venta)
 * En el nuevo schema, las ventas usan el RPC process_sale que maneja FIFO automáticamente
 */
export interface CreateStockSalidaParams {
  organizationId: string
  sucursalId: string
  productoId: string
  cantidad: number
}

/**
 * Resumen de stock disponible por producto
 */
export interface StockDisponible {
  productoId: string
  cantidad: number
}

// ───────────────────────────────────────────────────────────────────────────────
// FUNCIONES DEL REPOSITORIO
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Registra una entrada de stock (crea un lote)
 */
export async function createStockEntrada(
  params: CreateStockEntradaParams
): Promise<{ data: StockBatch | null; error: Error | null }> {
  try {
    const supabase = await createClient()
    const batchData: StockBatchInsert = {
      organization_id: params.organizationId,
      branch_id: params.sucursalId,
      product_id: params.productoId,
      quantity: params.cantidad,
      expiration_date: params.fechaVencimiento,
      status: 'available',
      supplier_id: params.proveedorId ?? undefined,
      unit_cost: params.costoUnitarioHistorico ?? undefined,
    }

    const { data, error } = await supabase
      .from('stock_batches')
      .insert(batchData)
      .select()
      .single()

    if (error) {
      return {
        data: null,
        error: new Error(`Error registrando entrada de stock: ${error.message}`),
      }
    }

    if (!data) {
      return {
        data: null,
        error: new Error('No se pudo registrar la entrada de stock'),
      }
    }

    return { data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Error desconocido en createStockEntrada'),
    }
  }
}

/**
 * Registra una salida de stock (DEPRECADO - usar RPC process_sale)
 *
 * NOTA: En el nuevo schema, las ventas se procesan con el RPC process_sale
 * que maneja la lógica FIFO automáticamente. Esta función se mantiene
 * para compatibilidad pero no debería usarse directamente.
 */
export async function createStockSalida(
  params: CreateStockSalidaParams
): Promise<{ data: StockBatch | null; error: Error | null }> {
  try {
    const supabase = await createClient()

    // En el nuevo schema, simplemente actualizamos el lote más antiguo (FIFO)
    // Pero esto es solo para compatibilidad - usar process_sale RPC en su lugar
    const { data: batch, error: fetchError } = await supabase
      .from('stock_batches')
      .select('*')
      .eq('organization_id', params.organizationId)
      .eq('branch_id', params.sucursalId)
      .eq('product_id', params.productoId)
      .eq('status', 'available')
      .gt('quantity', 0)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (fetchError || !batch) {
      return {
        data: null,
        error: new Error('No hay stock disponible'),
      }
    }

    const newQuantity = batch.quantity - params.cantidad
    const newStatus = newQuantity <= 0 ? 'sold' : 'available'

    const { data, error } = await supabase
      .from('stock_batches')
      .update({
        quantity: Math.max(0, newQuantity),
        status: newStatus as 'available' | 'sold' | 'expired' | 'damaged'
      })
      .eq('id', batch.id)
      .select()
      .single()

    if (error) {
      return {
        data: null,
        error: new Error(`Error registrando salida de stock: ${error.message}`),
      }
    }

    return { data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Error desconocido en createStockSalida'),
    }
  }
}

/**
 * Obtiene el stock disponible de un producto en una sucursal
 * Suma todos los lotes disponibles
 */
export async function getStockDisponible(
  organizationId: string,
  sucursalId: string,
  productoId: string
): Promise<{ data: number; error: Error | null }> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('stock_batches')
      .select('quantity')
      .eq('organization_id', organizationId)
      .eq('branch_id', sucursalId)
      .eq('product_id', productoId)
      .eq('status', 'available')

    if (error) {
      return {
        data: 0,
        error: new Error(`Error obteniendo stock: ${error.message}`),
      }
    }

    const totalStock = (data ?? []).reduce((sum, batch) => sum + (batch.quantity ?? 0), 0)

    return { data: totalStock, error: null }
  } catch (error) {
    return {
      data: 0,
      error: error instanceof Error ? error : new Error('Error desconocido en getStockDisponible'),
    }
  }
}

/**
 * Lista todos los lotes de stock de una sucursal
 */
export async function listMovimientosBySucursal(
  organizationId: string,
  sucursalId: string
): Promise<{ data: StockBatch[] | null; error: Error | null }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('stock_batches')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('branch_id', sucursalId)
      .order('created_at', { ascending: false })

    if (error) {
      return {
        data: null,
        error: new Error(`Error listando lotes: ${error.message}`),
      }
    }

    return { data: data ?? [], error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Error desconocido en listMovimientosBySucursal'),
    }
  }
}

/**
 * Obtiene lotes de un producto específico
 */
export async function listMovimientosByProducto(
  organizationId: string,
  productoId: string
): Promise<{ data: StockBatch[] | null; error: Error | null }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('stock_batches')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('product_id', productoId)
      .order('created_at', { ascending: false })

    if (error) {
      return {
        data: null,
        error: new Error(`Error listando lotes del producto: ${error.message}`),
      }
    }

    return { data: data ?? [], error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Error desconocido en listMovimientosByProducto'),
    }
  }
}

/**
 * Obtiene lotes próximos a vencer en una sucursal
 */
export async function getProductosProximosAVencer(
  organizationId: string,
  sucursalId: string,
  diasAnticipacion: number = 30
): Promise<{ data: StockBatch[] | null; error: Error | null }> {
  try {
    const supabase = await createClient()
    const fechaLimite = new Date()
    fechaLimite.setDate(fechaLimite.getDate() + diasAnticipacion)
    const fechaLimiteStr = fechaLimite.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('stock_batches')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('branch_id', sucursalId)
      .eq('status', 'available')
      .not('expiration_date', 'is', null)
      .lte('expiration_date', fechaLimiteStr)
      .order('expiration_date', { ascending: true })

    if (error) {
      return {
        data: null,
        error: new Error(`Error obteniendo productos próximos a vencer: ${error.message}`),
      }
    }

    return { data: data ?? [], error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Error desconocido en getProductosProximosAVencer'),
    }
  }
}

/**
 * Actualiza el estado de productos vencidos
 */
export async function marcarProductosVencidos(
  organizationId: string
): Promise<{ data: number; error: Error | null }> {
  try {
    const supabase = await createClient()
    const fechaHoy = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('stock_batches')
      .update({ status: 'expired' })
      .eq('organization_id', organizationId)
      .eq('status', 'available')
      .lt('expiration_date', fechaHoy)
      .select()

    if (error) {
      return {
        data: 0,
        error: new Error(`Error marcando productos vencidos: ${error.message}`),
      }
    }

    return { data: data?.length ?? 0, error: null }
  } catch (error) {
    return {
      data: 0,
      error: error instanceof Error ? error : new Error('Error desconocido en marcarProductosVencidos'),
    }
  }
}
