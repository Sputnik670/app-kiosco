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
 * - Búsqueda con filtros (ilike, exclusión de servicios SUBE)
 * - Procesamiento de ventas con procesar_venta RPC
 * - Integración con arqueo de caja
 *
 * ORIGEN: Refactorización de caja-ventas.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import type { Json } from '@/types/database.types'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Producto para ventas (vista simplificada)
 */
export interface ProductoVenta {
  id: string
  nombre: string
  precio: number
  stock: number
  codigo_barras?: string
}

/**
 * Item de venta para procesar
 */
export interface ItemVentaInput {
  producto_id: string
  cantidad: number
}

/**
 * Parámetros para confirmar una venta
 */
export interface ConfirmVentaParams {
  sucursalId: string
  turnoId: string
  items: ItemVentaInput[]
  metodoPago: 'efectivo' | 'tarjeta' | 'billetera_virtual'
  montoTotal: number
}

/**
 * Resultado de búsqueda de productos
 */
export interface SearchProductsResult {
  success: boolean
  productos: ProductoVenta[]
  error?: string
}

/**
 * Resultado de confirmación de venta
 */
export interface ConfirmVentaResult {
  success: boolean
  ventaId?: string
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 🔍 Busca productos para la venta
 *
 * LÓGICA (preservada del componente original):
 * - Usa view_productos_con_stock (combina productos + stock disponible)
 * - Filtro por sucursal_id (productos de este local)
 * - Búsqueda: nombre (ilike) o código de barras (exacto)
 * - EXCLUYE servicios virtuales: "Carga SUBE" y "Carga Virtual"
 * - Límite de 5 resultados
 *
 * USO:
 * - Búsqueda predictiva (cada tecla)
 * - Búsqueda por escaneo de código de barras
 *
 * @param query - Término de búsqueda (nombre o código de barras)
 * @param sucursalId - ID de la sucursal para filtrar productos
 * @returns SearchProductsResult - Lista de productos encontrados
 */
export async function searchProductsAction(
  query: string,
  sucursalId: string
): Promise<SearchProductsResult> {
  try {
    const supabase = await createClient()

    // Validación básica
    if (!query || query.trim().length === 0) {
      return {
        success: true,
        productos: [],
      }
    }

    if (!sucursalId) {
      return {
        success: false,
        productos: [],
        error: 'Sucursal no especificada',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // BÚSQUEDA EN VISTA DE PRODUCTOS CON STOCK
    // ───────────────────────────────────────────────────────────────────────────

    const { data, error } = await supabase
      .from('view_productos_con_stock')
      .select('*')
      .eq('sucursal_id', sucursalId)
      // Buscar por nombre (ilike = case-insensitive) o código de barras (exacto)
      .or(`nombre.ilike.%${query}%,codigo_barras.eq.${query}`)
      // IMPORTANTE: Excluir servicios virtuales (no son productos físicos)
      .not('nombre', 'in', '("Carga SUBE","Carga Virtual")')
      .limit(5)

    if (error) {
      return {
        success: false,
        productos: [],
        error: `Error en búsqueda: ${error.message}`,
      }
    }

    // Mapear resultados al formato del componente
    const productos: ProductoVenta[] = (data || []).map((p: any) => ({
      id: p.id,
      nombre: p.nombre,
      precio: p.precio_venta,
      stock: p.stock_disponible,
      codigo_barras: p.codigo_barras,
    }))

    return {
      success: true,
      productos,
    }
  } catch (error) {
    return {
      success: false,
      productos: [],
      error: error instanceof Error ? error.message : 'Error desconocido en búsqueda',
    }
  }
}

/**
 * ✅ Confirma y procesa una venta completa
 *
 * LÓGICA (preservada del componente original):
 * - Ejecuta RPC procesar_venta (stored procedure en Supabase)
 * - Vincula la venta al turno de caja (p_caja_diaria_id) para auditoría
 * - Registra método de pago global
 * - El RPC maneja:
 * - Creación de venta
 * - Creación de detalles_venta (items)
 * - Reducción de stock (FIFO por vencimiento)
 * - Registro de movimiento de caja
 * - Actualización de misiones (XP)
 *
 * IMPORTANTE:
 * - p_caja_diaria_id conecta esta venta con el arqueo de cierre
 * - Esta relación es CRÍTICA para la auditoría de caja
 *
 * @param params - Parámetros de la venta
 * @returns ConfirmVentaResult - Resultado de la operación
 */
export async function confirmVentaAction(
  params: ConfirmVentaParams
): Promise<ConfirmVentaResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!params.items || params.items.length === 0) {
      return {
        success: false,
        error: 'No hay items en la venta',
      }
    }

    if (!params.sucursalId || !params.turnoId) {
      return {
        success: false,
        error: 'Faltan datos de sucursal o turno',
      }
    }

    if (params.montoTotal <= 0) {
      return {
        success: false,
        error: 'El monto total debe ser mayor a cero',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // EJECUTAR RPC PROCESAR_VENTA
    // ───────────────────────────────────────────────────────────────────────────

    const { data, error } = await supabase.rpc('procesar_venta', {
      p_sucursal_id: params.sucursalId,
      p_caja_diaria_id: params.turnoId,
      p_items: params.items as unknown as Json,
      p_metodo_pago_global: params.metodoPago,
      p_monto_total_cliente: params.montoTotal,
    })

    if (error) {
      return {
        success: false,
        error: `Error procesando venta: ${error.message}`,
      }
    }

    return {
      success: true,
      ventaId: data, // El RPC retorna el ID de la venta creada
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al procesar venta',
    }
  }
}