/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📦 INVENTORY SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de inventario y escaneo de productos.
 * Conecta los repositorios con la lógica de negocio.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Validación de parámetros
 * - Uso de repositorios para acceso a datos
 * - Retorno tipado con estados claros
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { searchProductos, updateProducto, getProductoById } from '@/lib/repositories/producto.repository'
import { getStockDisponible, createStockEntrada } from '@/lib/repositories/stock.repository'
import { createClient } from '@/lib/supabase-server'
import { Database } from '@/types/database.types'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

type Producto = Database['public']['Tables']['productos']['Row']

/**
 * Resultado cuando el producto SÍ existe en el catálogo
 */
export interface ProductFoundResult {
  status: 'FOUND'
  producto: Producto
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
 *
 * FLUJO:
 * 1. Busca el producto por código de barras en la organización
 * 2. Si existe, consulta el stock disponible en la sucursal
 * 3. Retorna el producto con su stock o un estado NOT_FOUND
 *
 * @param barcode - Código de barras escaneado
 * @param organizationId - ID de la organización
 * @param sucursalId - ID de la sucursal actual
 * @returns ProductScanResult - Producto encontrado, no encontrado o error
 *
 * CASOS DE USO:
 * - Escaneo con cámara del teléfono
 * - Escaneo con lector de mano USB/Bluetooth
 * - Búsqueda manual por código de barras
 *
 * EJEMPLO:
 * ```typescript
 * const result = await handleProductScan('7790123456789', orgId, sucursalId)
 *
 * if (result.status === 'FOUND') {
 *   console.log(`Producto: ${result.producto.nombre}`)
 *   console.log(`Stock: ${result.stockDisponible}`)
 * } else if (result.status === 'NOT_FOUND') {
 *   // Invitar al usuario a crear el producto
 *   console.log('Producto no encontrado. ¿Desea crearlo?')
 * }
 * ```
 */
export async function handleProductScan(
  barcode: string,
  organizationId: string,
  sucursalId: string
): Promise<ProductScanResult> {
  // ─────────────────────────────────────────────────────────────────────────────
  // VALIDACIONES
  // ─────────────────────────────────────────────────────────────────────────────

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
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Buscar producto por código de barras
    // ───────────────────────────────────────────────────────────────────────────

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

    // Filtrar exactamente por código de barras (searchProductos busca también en nombre)
    const producto = productos?.find(
      (p) => p.codigo_barras?.toLowerCase() === barcode.toLowerCase()
    )

    // ───────────────────────────────────────────────────────────────────────────
    // CASO: Producto NO encontrado
    // ───────────────────────────────────────────────────────────────────────────

    if (!producto) {
      return {
        status: 'NOT_FOUND',
        barcode: barcode,
        message: `No se encontró ningún producto con el código de barras: ${barcode}`,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Obtener stock disponible en la sucursal
    // ───────────────────────────────────────────────────────────────────────────

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

    // ───────────────────────────────────────────────────────────────────────────
    // CASO: Producto ENCONTRADO
    // ───────────────────────────────────────────────────────────────────────────

    return {
      status: 'FOUND',
      producto: producto,
      stockDisponible: stockDisponible,
      sucursalId: sucursalId,
    }
  } catch (error) {
    // ───────────────────────────────────────────────────────────────────────────
    // MANEJO DE ERRORES INESPERADOS
    // ───────────────────────────────────────────────────────────────────────────

    return {
      status: 'ERROR',
      error: 'Error inesperado al escanear el producto',
      details: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * 📊 Obtiene un resumen rápido de stock para múltiples productos
 *
 * Útil para dashboards o listados de productos con stock.
 *
 * @param productoIds - Array de IDs de productos
 * @param organizationId - ID de la organización
 * @param sucursalId - ID de la sucursal
 * @returns Array de { productoId, stock }
 */
export async function getStockSummary(
  productoIds: string[],
  organizationId: string,
  sucursalId: string
): Promise<{ productoId: string; stock: number }[]> {
  const summary = await Promise.all(
    productoIds.map(async (productoId) => {
      const { data: stock } = await getStockDisponible(
        organizationId,
        sucursalId,
        productoId
      )
      return {
        productoId,
        stock: stock ?? 0,
      }
    })
  )

  return summary
}

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS PARA ENTRADA COMPLEJA DE STOCK
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Parámetros para el ingreso complejo de stock
 * (compra + stock + historial de precios + movimiento de caja)
 */
export interface ComplexStockEntryParams {
  // Datos básicos
  productoId: string
  sucursalId: string
  cantidad: number
  fechaVencimiento: string // Formato: YYYY-MM-DD

  // Datos de costos
  costoUnitario?: number

  // Datos del proveedor (opcional)
  proveedorId?: string
  estadoPago?: 'pendiente' | 'pagado'
  medioPago?: 'efectivo' | 'transferencia' | 'debito'
  fechaVencimientoPago?: string // ISO string
}

/**
 * Resultado del ingreso complejo de stock
 */
export interface ComplexStockEntryResult {
  success: boolean
  error?: string
  details?: {
    compraId?: string
    stockId?: string
    precioActualizado?: boolean
    movimientoCajaRegistrado?: boolean
  }
}

/**
 * 📦 Procesa una entrada compleja de stock (REFACTORIZADO de agregar-stock.tsx)
 *
 * FLUJO COMPLETO:
 * 1. Obtiene organización del usuario actual
 * 2. Si hay proveedor + costo: registra la compra
 * 3. Si el pago es en efectivo: registra egreso en movimientos_caja
 * 4. Registra la entrada de stock usando el repositorio
 * 5. Si cambió el costo: actualiza historial_precios y costo del producto
 *
 * @param params - Parámetros del ingreso
 * @returns ComplexStockEntryResult - Resultado de la operación
 *
 * ORIGEN: Refactorización del método handleGuardar() del componente agregar-stock.tsx
 */
export async function processComplexStockEntry(
  params: ComplexStockEntryParams
): Promise<ComplexStockEntryResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener usuario y organización
    // ───────────────────────────────────────────────────────────────────────────

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        error: 'No hay sesión activa',
      }
    }

    const { data: organizationId } = await supabase.rpc('get_my_org_id_v2')

    if (!organizationId) {
      return {
        success: false,
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    let compraId: string | null = null
    let movimientoCajaRegistrado = false

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Registrar compra (si hay proveedor y costo)
    // ───────────────────────────────────────────────────────────────────────────

    const costoNum = params.costoUnitario ?? 0
    const montoTotal = costoNum * params.cantidad

    if (params.proveedorId && costoNum > 0) {
      const { data: compraData, error: compraError } = await (supabase
        .from('compras') as any)
        .insert([{
          organization_id: organizationId,
          proveedor_id: params.proveedorId,
          monto_total: montoTotal,
          estado_pago: params.estadoPago ?? 'pendiente',
          medio_pago: params.estadoPago === 'pagado' ? params.medioPago : null,
          fecha_compra: new Date().toISOString(),
          vencimiento_pago: params.estadoPago === 'pendiente' ? params.fechaVencimientoPago : null,
        }])
        .select()
        .single()

      if (compraError) {
        return {
          success: false,
          error: 'Error al registrar la compra',
          details: { compraId: undefined },
        }
      }

      compraId = compraData.id

      // ─────────────────────────────────────────────────────────────────────────
      // PASO 3: Registrar egreso en caja (si pago en efectivo)
      // ─────────────────────────────────────────────────────────────────────────

      if (params.estadoPago === 'pagado' && params.medioPago === 'efectivo') {
        const { data: cajaActiva } = await supabase
          .from('caja_diaria')
          .select('id')
          .eq('sucursal_id', params.sucursalId)
          .is('fecha_cierre', null)
          .single<{ id: string }>()

        if (cajaActiva?.id) {
          const { error: movimientoError } = await (supabase
            .from('movimientos_caja') as any)
            .insert({
              caja_diaria_id: cajaActiva.id,
              organization_id: organizationId,
              monto: montoTotal,
              tipo: 'egreso',
              descripcion: `Pago Proveedor: Ingreso de mercadería (Lote)`,
              categoria: 'proveedores',
            })

          if (!movimientoError) {
            movimientoCajaRegistrado = true
          }
        }
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 4: Registrar entrada de stock usando el repositorio
    // ───────────────────────────────────────────────────────────────────────────

    const { data: stockData, error: stockError } = await createStockEntrada({
      organizationId: organizationId,
      sucursalId: params.sucursalId,
      productoId: params.productoId,
      cantidad: params.cantidad,
      fechaVencimiento: params.fechaVencimiento,
      proveedorId: params.proveedorId ?? undefined,
      compraId: compraId,
      costoUnitarioHistorico: costoNum > 0 ? costoNum : undefined,
    })

    if (stockError) {
      return {
        success: false,
        error: 'Error al registrar el stock',
        details: { compraId: compraId ?? undefined },
      }
    }

    let precioActualizado = false

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 5: Actualizar historial de precios y costo del producto (si cambió)
    // ───────────────────────────────────────────────────────────────────────────

    if (costoNum > 0) {
      const { data: productoActual, error: productoError } = await getProductoById(
        params.productoId
      )

      if (!productoError && productoActual) {
        const costoAnterior = productoActual.costo ?? 0

        // Solo actualizar si el costo cambió
        if (costoAnterior !== costoNum) {
          // Registrar en historial de precios
          await (supabase.from('historial_precios') as any).insert({
            organization_id: organizationId,
            producto_id: params.productoId,
            costo_anterior: costoAnterior,
            costo_nuevo: costoNum,
            precio_venta_anterior: productoActual.precio_venta,
            precio_venta_nuevo: productoActual.precio_venta,
            empleado_id: user.id,
            fecha_cambio: new Date().toISOString(),
          })

          // Actualizar costo del producto usando el repositorio
          const { error: updateError } = await updateProducto(params.productoId, {
            costo: costoNum,
          })

          if (!updateError) {
            precioActualizado = true
          }
        }
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // RETORNO EXITOSO
    // ───────────────────────────────────────────────────────────────────────────

    return {
      success: true,
      details: {
        compraId: compraId ?? undefined,
        stockId: stockData?.id,
        precioActualizado,
        movimientoCajaRegistrado,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: 'Error inesperado al procesar la entrada de stock',
      details: undefined,
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// RESUMEN DE CAPITAL (Capital Físico + Saldo Virtual)
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Resultado del resumen de capital
 */
export interface CapitalSummaryResult {
  success: boolean
  capitalFisico: number
  saldoVirtual: number
  error?: string
}

/**
 * 💰 Obtiene el resumen de capital de la organización
 *
 * LÓGICA (preservada del componente original):
 *
 * CAPITAL FÍSICO:
 * - Suma del valor del inventario: costo × stock_disponible
 * - Solo productos físicos (excluye categoría "Servicios")
 * - Solo productos con stock > 0
 * - Usa view_productos_con_stock para datos en tiempo real
 *
 * SALDO VIRTUAL:
 * - Suma de saldo_actual de proveedores del rubro "Servicios"
 * - Representa crédito prepago (ej: SUBE, recarga de celular)
 *
 * @param organizationId - ID de la organización
 * @returns CapitalSummaryResult - Resumen de capital
 *
 * ORIGEN: Refactorización de capital-badges.tsx
 */
export async function getCapitalSummaryAction(
  organizationId: string
): Promise<CapitalSummaryResult> {
  try {
    const supabase = await createClient()

    // Validación
    if (!organizationId) {
      return {
        success: false,
        capitalFisico: 0,
        saldoVirtual: 0,
        error: 'Organization ID es requerido',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Calcular Capital Físico (inventario valorizado)
    // ───────────────────────────────────────────────────────────────────────────

    const { data: productosData, error: productosError } = await supabase
      .from('view_productos_con_stock')
      .select('costo, stock_disponible, categoria')
      .eq('organization_id', organizationId)

    if (productosError) {
      return {
        success: false,
        capitalFisico: 0,
        saldoVirtual: 0,
        error: `Error al obtener productos: ${productosError.message}`,
      }
    }

    // Filtrar y calcular: costo × stock (excluye servicios y sin stock)
    const capitalFisico = (productosData || [])
      .filter((p: any) =>
        p.categoria !== 'Servicios' &&
        (p.stock_disponible || 0) > 0
      )
      .reduce((suma: number, p: any) =>
        suma + ((p.costo || 0) * (p.stock_disponible || 0)),
        0
      )

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Calcular Saldo Virtual (proveedores de servicios)
    // ───────────────────────────────────────────────────────────────────────────

    const { data: proveedoresData, error: proveedoresError } = await supabase
      .from('proveedores')
      .select('saldo_actual')
      .eq('organization_id', organizationId)
      .eq('rubro', 'Servicios')

    if (proveedoresError) {
      return {
        success: false,
        capitalFisico: 0,
        saldoVirtual: 0,
        error: `Error al obtener proveedores: ${proveedoresError.message}`,
      }
    }

    // Sumar saldos de todos los proveedores de servicios
    const saldoVirtual = (proveedoresData || [])
      .reduce((suma: number, p: any) =>
        suma + (p.saldo_actual || 0),
        0
      )

    // ───────────────────────────────────────────────────────────────────────────
    // RETORNO EXITOSO
    // ───────────────────────────────────────────────────────────────────────────

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
 *
 * @param sucursalId - ID de la sucursal
 * @returns Array de stock con productos próximos a vencer
 */
export async function getExpiringStockAction(sucursalId: string) {
  try {
    const supabase = await createClient()

    if (!sucursalId) {
      throw new Error('sucursalId es requerido')
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      throw new Error('No hay sesión activa')
    }

    const fechaLimite = new Date()
    fechaLimite.setDate(fechaLimite.getDate() + 10)

    const { data, error } = await supabase
      .from('stock')
      .select('id, cantidad, fecha_vencimiento, producto_id, productos(nombre, unidad_medida, emoji, categoria)')
      .eq('sucursal_id', sucursalId)
      .eq('tipo_movimiento', 'entrada')
      .eq('estado', 'pendiente')
      .not('fecha_vencimiento', 'is', null)
      .lte('fecha_vencimiento', fechaLimite.toISOString())
      .order('fecha_vencimiento', { ascending: true })

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
 *
 * FLUJO:
 * 1. Marca el stock como 'mermado'
 * 2. Busca misión activa de tipo 'vencimiento' en el turno
 * 3. Actualiza progreso de la misión
 * 4. Si se completa la misión, otorga XP al empleado
 *
 * @param stockId - ID del registro de stock a mermar
 * @param turnoId - ID del turno actual (caja_diaria_id)
 * @param empleadoId - ID del empleado que realiza la acción
 * @returns Resultado de la operación
 */
export async function processStockLossAction(
  stockId: string,
  turnoId: string,
  empleadoId: string
) {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!stockId || !turnoId || !empleadoId) {
      throw new Error('Faltan parámetros requeridos')
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      throw new Error('No hay sesión activa')
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Marcar stock como mermado
    // ───────────────────────────────────────────────────────────────────────────

    const { error: updateError } = await supabase
      .from('stock')
      .update({
        estado: 'mermado',
        fecha_mermado: new Date().toISOString(),
      })
      .eq('id', stockId)

    if (updateError) throw updateError

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Buscar misión activa de vencimiento
    // ───────────────────────────────────────────────────────────────────────────

    const { data: misiones } = await supabase
      .from('misiones')
      .select('id, objetivo_unidades, unidades_completadas, puntos')
      .eq('caja_diaria_id', turnoId)
      .eq('tipo', 'vencimiento')
      .eq('es_completada', false)
      .maybeSingle()

    if (misiones) {
      const nuevasUnidades = (misiones.unidades_completadas || 0) + 1
      const completada = misiones.objetivo_unidades !== null &&
        nuevasUnidades >= misiones.objetivo_unidades

      // ─────────────────────────────────────────────────────────────────────────
      // PASO 3: Actualizar progreso de misión
      // ─────────────────────────────────────────────────────────────────────────

      await supabase
        .from('misiones')
        .update({
          unidades_completadas: nuevasUnidades,
          es_completada: completada,
        })
        .eq('id', misiones.id)

      // ─────────────────────────────────────────────────────────────────────────
      // PASO 4: Otorgar XP si la misión se completó
      // ─────────────────────────────────────────────────────────────────────────

      if (completada && misiones.puntos !== null) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('xp')
          .eq('id', empleadoId)
          .single<{ xp: number | null }>()

        if (perfil && perfil.xp !== null) {
          await supabase
            .from('perfiles')
            .update({ xp: perfil.xp + misiones.puntos })
            .eq('id', empleadoId)
        }
      }
    }

    return {
      success: true,
      misionCompletada: misiones ? (misiones.unidades_completadas || 0) + 1 >= (misiones.objetivo_unidades || 0) : false,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar merma',
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// STOCK CRÍTICO (PARA MISIONES)
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Stock crítico para misiones
 */
export interface CriticalStock {
  id: string
  producto_id: string
  nombre_producto: string
  emoji_producto: string
  fecha_vencimiento: string
  precio_venta: number
}

/**
 * Resultado de consulta de stock crítico
 */
export interface GetCriticalStockResult {
  success: boolean
  stock: CriticalStock[]
  error?: string
}

/**
 * 📦 Obtiene stock disponible que vence en menos de 7 días
 *
 * FLUJO:
 * 1. Calcula fecha límite (hoy + 7 días)
 * 2. Consulta stock disponible que venza antes de esa fecha
 * 3. Filtra por sucursal específica
 *
 * @param sucursalId - ID de la sucursal
 * @returns GetCriticalStockResult - Stock crítico
 *
 * ORIGEN: Refactorización de handleOpenMermarModal() líneas 90-123
 */
export async function getCriticalStockAction(
  sucursalId: string
): Promise<GetCriticalStockResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!sucursalId) {
      return {
        success: false,
        stock: [],
        error: 'sucursalId es requerido',
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        stock: [],
        error: 'No hay sesión activa',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Calcular fecha límite (7 días)
    // ───────────────────────────────────────────────────────────────────────────

    const fechaLimite = new Date()
    fechaLimite.setDate(fechaLimite.getDate() + 7)

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Consultar stock crítico
    // ───────────────────────────────────────────────────────────────────────────

    const { data, error } = await supabase
      .from('stock')
      .select(`id, producto_id, fecha_vencimiento, productos(nombre, emoji, precio_venta)`)
      .eq('sucursal_id', sucursalId)
      .eq('estado', 'disponible')
      .lt('fecha_vencimiento', fechaLimite.toISOString().split('T')[0])
      .order('fecha_vencimiento', { ascending: true })

    if (error) {
      return {
        success: false,
        stock: [],
        error: `Error al consultar stock: ${error.message}`,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: Formatear resultado
    // ───────────────────────────────────────────────────────────────────────────

    const stockCritico: CriticalStock[] = (data || []).map((item: any) => ({
      id: item.id,
      producto_id: item.producto_id,
      nombre_producto: item.productos?.nombre || 'Producto',
      emoji_producto: item.productos?.emoji || '📦',
      fecha_vencimiento: item.fecha_vencimiento,
      precio_venta: item.productos?.precio_venta || 0,
    }))

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
