/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📦 STOCK REPOSITORY
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Repositorio para gestión de inventario (movimientos de stock).
 * Basado en docs/DATABASE_SCHEMA.md (esquema real verificado).
 *
 * ESTÁNDAR MAESTRO:
 * - Todas las tablas tienen: id, organization_id, created_at, updated_at
 * - Patrón de respuesta: { data, error }
 * - Sin lógica de negocio (solo traducción DB ↔ código)
 *
 * NOTAS IMPORTANTES:
 * - NO existe tabla stock_items, solo la tabla "stock"
 * - Cada fila en "stock" representa un movimiento (entrada/salida)
 * - Para obtener stock actual: sumar entradas - salidas por producto
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@/lib/supabase-server'
import { Database } from '@/types/database.types'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

type Stock = Database['public']['Tables']['stock']['Row']
type StockInsert = Database['public']['Tables']['stock']['Insert']

/**
 * Parámetros para crear un movimiento de stock (entrada)
 */
export interface CreateStockEntradaParams {
  organizationId: string
  sucursalId: string
  productoId: string
  cantidad: number
  fechaVencimiento: string // Formato: YYYY-MM-DD
  proveedorId?: string | null
  compraId?: string | null
  costoUnitarioHistorico?: number | null
}

/**
 * Parámetros para registrar una salida de stock (venta)
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
 * Registra una entrada de stock (compra o carga inicial)
 *
 * @param params - Parámetros de la entrada
 * @returns { data, error } - Movimiento creado o error
 *
 * ESQUEMA (según DATABASE_SCHEMA.md):
 * - id: uuid (auto-generado)
 * - organization_id: uuid (FK → organizations)
 * - sucursal_id: uuid (FK → sucursales)
 * - producto_id: uuid (FK → productos)
 * - cantidad: integer (positivo)
 * - tipo_movimiento: 'entrada'
 * - fecha_vencimiento: date
 * - estado: 'disponible' (al crear)
 * - proveedor_id: uuid (opcional)
 * - compra_id: uuid (opcional)
 * - costo_unitario_historico: numeric (opcional)
 * - fecha_ingreso: timestamptz (now())
 * - created_at, updated_at: automáticos
 */
export async function createStockEntrada(
  params: CreateStockEntradaParams
): Promise<{ data: Stock | null; error: Error | null }> {
  try {
    const supabase = await createClient()
    const stockData: StockInsert = {
      organization_id: params.organizationId,
      sucursal_id: params.sucursalId,
      producto_id: params.productoId,
      cantidad: params.cantidad,
      tipo_movimiento: 'entrada',
      fecha_vencimiento: params.fechaVencimiento,
      estado: 'disponible',
      proveedor_id: params.proveedorId ?? undefined,
      compra_id: params.compraId ?? undefined,
      costo_unitario_historico: params.costoUnitarioHistorico ?? undefined,
      fecha_ingreso: new Date().toISOString(),
      // created_at y updated_at son automáticos
    }

    const { data, error } = await supabase
      .from('stock')
      .insert(stockData)
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
 * Registra una salida de stock (venta)
 *
 * @param params - Parámetros de la salida
 * @returns { data, error } - Movimiento creado o error
 *
 * NOTA: Esta función NO valida si hay stock disponible.
 * Debes validar antes de llamarla usando getStockDisponible().
 */
export async function createStockSalida(
  params: CreateStockSalidaParams
): Promise<{ data: Stock | null; error: Error | null }> {
  try {
    const supabase = await createClient()
    const stockData: StockInsert = {
      organization_id: params.organizationId,
      sucursal_id: params.sucursalId,
      producto_id: params.productoId,
      cantidad: params.cantidad,
      tipo_movimiento: 'salida',
      fecha_vencimiento: new Date().toISOString().split('T')[0], // Fecha actual (no aplica en salidas)
      estado: 'vendido',
      fecha_ingreso: new Date().toISOString(),
      // created_at y updated_at son automáticos
    }

    const { data, error } = await supabase
      .from('stock')
      .insert(stockData)
      .select()
      .single()

    if (error) {
      return {
        data: null,
        error: new Error(`Error registrando salida de stock: ${error.message}`),
      }
    }

    if (!data) {
      return {
        data: null,
        error: new Error('No se pudo registrar la salida de stock'),
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
 *
 * @param organizationId - ID de la organización
 * @param sucursalId - ID de la sucursal
 * @param productoId - ID del producto
 * @returns { data, error } - Cantidad disponible o error
 *
 * CÁLCULO: SUM(cantidad) WHERE tipo='entrada' - SUM(cantidad) WHERE tipo='salida'
 */
export async function getStockDisponible(
  organizationId: string,
  sucursalId: string,
  productoId: string
): Promise<{ data: number; error: Error | null }> {
  try {
    const supabase = await createClient()
    // Obtener todas las entradas
    const { data: entradas, error: errorEntradas } = await supabase
      .from('stock')
      .select('cantidad')
      .eq('organization_id', organizationId)
      .eq('sucursal_id', sucursalId)
      .eq('producto_id', productoId)
      .eq('tipo_movimiento', 'entrada')
      .eq('estado', 'disponible')

    if (errorEntradas) {
      return {
        data: 0,
        error: new Error(`Error obteniendo entradas: ${errorEntradas.message}`),
      }
    }

    // Obtener todas las salidas
    const { data: salidas, error: errorSalidas } = await supabase
      .from('stock')
      .select('cantidad')
      .eq('organization_id', organizationId)
      .eq('sucursal_id', sucursalId)
      .eq('producto_id', productoId)
      .eq('tipo_movimiento', 'salida')

    if (errorSalidas) {
      return {
        data: 0,
        error: new Error(`Error obteniendo salidas: ${errorSalidas.message}`),
      }
    }

    const totalEntradas = (entradas ?? []).reduce((sum, mov) => sum + (mov.cantidad ?? 0), 0)
    const totalSalidas = (salidas ?? []).reduce((sum, mov) => sum + (mov.cantidad ?? 0), 0)

    const stockDisponible = totalEntradas - totalSalidas

    return { data: stockDisponible, error: null }
  } catch (error) {
    return {
      data: 0,
      error: error instanceof Error ? error : new Error('Error desconocido en getStockDisponible'),
    }
  }
}

/**
 * Lista todos los movimientos de stock de una sucursal
 *
 * @param organizationId - ID de la organización
 * @param sucursalId - ID de la sucursal
 * @returns { data, error } - Movimientos o error
 */
export async function listMovimientosBySucursal(
  organizationId: string,
  sucursalId: string
): Promise<{ data: Stock[] | null; error: Error | null }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('stock')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('sucursal_id', sucursalId)
      .order('created_at', { ascending: false })

    if (error) {
      return {
        data: null,
        error: new Error(`Error listando movimientos: ${error.message}`),
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
 * Obtiene movimientos de un producto específico
 *
 * @param organizationId - ID de la organización
 * @param productoId - ID del producto
 * @returns { data, error } - Movimientos o error
 */
export async function listMovimientosByProducto(
  organizationId: string,
  productoId: string
): Promise<{ data: Stock[] | null; error: Error | null }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('stock')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('producto_id', productoId)
      .order('created_at', { ascending: false })

    if (error) {
      return {
        data: null,
        error: new Error(`Error listando movimientos del producto: ${error.message}`),
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
 * Obtiene productos próximos a vencer en una sucursal
 *
 * @param organizationId - ID de la organización
 * @param sucursalId - ID de la sucursal
 * @param diasAnticipacion - Días de anticipación para alertar (default: 30)
 * @returns { data, error } - Productos próximos a vencer o error
 */
export async function getProductosProximosAVencer(
  organizationId: string,
  sucursalId: string,
  diasAnticipacion: number = 30
): Promise<{ data: Stock[] | null; error: Error | null }> {
  try {
    const supabase = await createClient()
    const fechaLimite = new Date()
    fechaLimite.setDate(fechaLimite.getDate() + diasAnticipacion)
    const fechaLimiteStr = fechaLimite.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('stock')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('sucursal_id', sucursalId)
      .eq('tipo_movimiento', 'entrada')
      .eq('estado', 'disponible')
      .lte('fecha_vencimiento', fechaLimiteStr)
      .order('fecha_vencimiento', { ascending: true })

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
 *
 * @param organizationId - ID de la organización
 * @returns { data, error } - Cantidad de productos actualizados o error
 *
 * NOTA: Esta función debe ejecutarse periódicamente (ej. diariamente)
 */
export async function marcarProductosVencidos(
  organizationId: string
): Promise<{ data: number; error: Error | null }> {
  try {
    const supabase = await createClient()
    const fechaHoy = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('stock')
      .update({ estado: 'vencido' })
      .eq('organization_id', organizationId)
      .eq('tipo_movimiento', 'entrada')
      .eq('estado', 'disponible')
      .lt('fecha_vencimiento', fechaHoy)
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
