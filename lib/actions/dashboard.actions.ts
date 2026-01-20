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
 * - Consultas a reportes_ventas_unificados (vista optimizada)
 * - Análisis de inventario crítico
 *
 * ORIGEN: Refactorización de dashboard-dueno.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Desglose de métodos de pago
 */
export interface PaymentBreakdown {
  efectivo: number
  tarjeta: number
  transferencia: number
  billetera_virtual: number
  otro: number
}

/**
 * Top producto más vendido
 */
export interface TopProduct {
  name: string
  count: number
}

/**
 * Métricas financieras de negocio (BI)
 */
export interface BusinessMetrics {
  bruto: number           // Ingresos totales
  neta: number            // Utilidad neta (bruto - costos + movimientos manuales)
  margen: number          // % de margen sobre ventas
  blanco: number          // Monto en métodos rastreables
  negro: number           // Monto en efectivo
  ROI: number             // Retorno sobre inversión
}

/**
 * Estadísticas completas del owner
 */
export interface OwnerStatsResult {
  success: boolean
  totalVendido: number
  utilidadNeta: number
  ROI: number
  paymentBreakdown: PaymentBreakdown
  topProductos: TopProduct[]
  businessMetrics: BusinessMetrics
  error?: string
}

/**
 * Producto crítico de inventario
 */
export interface CriticalProduct {
  id: string
  producto: string
  emoji: string | null
  stock_actual: number
  mejor_proveedor: string | null
  mejor_precio: number | null
}

/**
 * Item crítico por vencimiento
 */
export interface ExpiringItem {
  id: string
  nombre: string
  emoji: string | null
  fecha_vencimiento: string
  cantidad: number
  monto: number
}

/**
 * Inventario crítico (stock bajo + vencimientos)
 */
export interface InventoryCriticalResult {
  success: boolean
  stockBajo: CriticalProduct[]
  capitalEnRiesgo: {
    capital: number
    unidades: number
    criticos: ExpiringItem[]
  }
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

const UMBRAL_STOCK_BAJO = 5

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 📊 Obtiene estadísticas financieras completas del dueño
 *
 * LÓGICA (preservada del componente original):
 *
 * CÁLCULOS UNIFICADOS (líneas 321-361 useMemo biMetrics):
 * - Bruto: Suma de monto_total de todas las ventas unificadas
 * - Costo: Suma de costo_unitario × unidades_vendidas
 * - Neta: (Bruto - Costo) + Ingresos manuales - Egresos manuales
 * - Margen: (Utilidad / Bruto) × 100
 * - Blanco/Negro: Separación por método de pago rastreable
 *
 * DESGLOSE MÉTODOS DE PAGO (líneas 255-266):
 * - Suma por cada método: efectivo, tarjeta, transferencia, billetera_virtual, otro
 *
 * TOP PRODUCTOS (líneas 267-280):
 * - Conteo de unidades_vendidas por descripción
 * - Top 5 ordenados descendente
 *
 * @param sucursalId - ID de la sucursal
 * @param fechaDesde - Fecha inicio del rango (ISO string)
 * @param fechaHasta - Fecha fin del rango (ISO string)
 * @returns OwnerStatsResult - Estadísticas completas
 *
 * ORIGEN: Refactorización de fetchData() + useMemo biMetrics
 */
export async function getOwnerStatsAction(
  sucursalId: string,
  fechaDesde: string,
  fechaHasta: string
): Promise<OwnerStatsResult> {
  try {
    const supabase = await createClient()

    // Validaciones
    if (!sucursalId) {
      return {
        success: false,
        totalVendido: 0,
        utilidadNeta: 0,
        ROI: 0,
        paymentBreakdown: { efectivo: 0, tarjeta: 0, transferencia: 0, billetera_virtual: 0, otro: 0 },
        topProductos: [],
        businessMetrics: { bruto: 0, neta: 0, margen: 0, blanco: 0, negro: 0, ROI: 0 },
        error: 'Sucursal no especificada',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Consultar ventas unificadas (vista reportes_ventas_unificados)
    // ───────────────────────────────────────────────────────────────────────────

    let query = (supabase as any)
      .from('reportes_ventas_unificados')
      .select('*')
      .eq('sucursal_id', sucursalId)

    if (fechaDesde) query = query.gte('fecha_venta', fechaDesde)
    if (fechaHasta) query = query.lte('fecha_venta', fechaHasta)

    const { data: ventasData, error: ventasError } = await query.order('fecha_venta', { ascending: false })

    if (ventasError) {
      return {
        success: false,
        totalVendido: 0,
        utilidadNeta: 0,
        ROI: 0,
        paymentBreakdown: { efectivo: 0, tarjeta: 0, transferencia: 0, billetera_virtual: 0, otro: 0 },
        topProductos: [],
        businessMetrics: { bruto: 0, neta: 0, margen: 0, blanco: 0, negro: 0, ROI: 0 },
        error: `Error al obtener ventas: ${ventasError.message}`,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Calcular métricas financieras (biMetrics del useMemo)
    // ───────────────────────────────────────────────────────────────────────────

    let bruto = 0
    let costo = 0
    let blanco = 0
    const paymentBreakdown: PaymentBreakdown = {
      efectivo: 0,
      tarjeta: 0,
      transferencia: 0,
      billetera_virtual: 0,
      otro: 0,
    }
    const counts: Record<string, number> = {}

    ;(ventasData || []).forEach((venta: any) => {
      // Ingresos brutos
      bruto += venta.monto_total || 0

      // Costos
      costo += (venta.costo_unitario || 0) * (venta.unidades_vendidas || 0)

      // Métodos en blanco (rastreables)
      if (['tarjeta', 'transferencia', 'billetera_virtual'].includes(venta.metodo_pago)) {
        blanco += venta.monto_total || 0
      }

      // Desglose por método de pago
      const metodoPago = (venta.metodo_pago || 'efectivo') as keyof PaymentBreakdown
      if (paymentBreakdown.hasOwnProperty(metodoPago)) {
        paymentBreakdown[metodoPago] += venta.monto_total || 0
      } else {
        paymentBreakdown.otro += venta.monto_total || 0
      }

      // Conteo para top productos
      const nombre = venta.descripcion || 'Varios'
      counts[nombre] = (counts[nombre] || 0) + (venta.unidades_vendidas || 0)
    })

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: Consultar movimientos manuales de caja
    // ───────────────────────────────────────────────────────────────────────────

    let cajaQuery = supabase
      .from('caja_diaria')
      .select('movimientos_caja(*)')
      .eq('sucursal_id', sucursalId)

    if (fechaDesde) cajaQuery = cajaQuery.gte('fecha_apertura', fechaDesde)
    if (fechaHasta) cajaQuery = cajaQuery.lte('fecha_apertura', fechaHasta)

    const { data: cajaData } = await cajaQuery

    let manualIngresos = 0
    let manualEgresos = 0

    ;(cajaData || []).forEach((turno: any) => {
      ;(turno.movimientos_caja || []).forEach((m: any) => {
        // Evitar doble conteo de ventas
        if (m.categoria === 'ventas') return

        if (m.tipo === 'ingreso') {
          manualIngresos += m.monto || 0
        } else if (m.tipo === 'egreso') {
          manualEgresos += m.monto || 0
        }
      })
    })

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 4: Calcular métricas finales
    // ───────────────────────────────────────────────────────────────────────────

    const utilidadProductos = bruto - costo
    const neta = utilidadProductos + manualIngresos - manualEgresos
    const margen = bruto > 0 ? (utilidadProductos / bruto) * 100 : 0
    const negro = bruto - blanco
    const ROI = costo > 0 ? (neta / costo) * 100 : 0

    // Top productos
    const topProductos: TopProduct[] = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      success: true,
      totalVendido: bruto,
      utilidadNeta: neta,
      ROI,
      paymentBreakdown,
      topProductos,
      businessMetrics: {
        bruto,
        neta,
        margen,
        blanco,
        negro,
        ROI,
      },
    }
  } catch (error) {
    return {
      success: false,
      totalVendido: 0,
      utilidadNeta: 0,
      ROI: 0,
      paymentBreakdown: { efectivo: 0, tarjeta: 0, transferencia: 0, billetera_virtual: 0, otro: 0 },
      topProductos: [],
      businessMetrics: { bruto: 0, neta: 0, margen: 0, blanco: 0, negro: 0, ROI: 0 },
      error: error instanceof Error ? error.message : 'Error desconocido al obtener estadísticas',
    }
  }
}

/**
 * 🚨 Obtiene inventario crítico (stock bajo + vencimientos próximos)
 *
 * LÓGICA (preservada del componente original):
 *
 * STOCK BAJO (líneas 233-239):
 * - Productos con stock <= UMBRAL_STOCK_BAJO (5 unidades)
 * - Excluye categoría "Servicios"
 * - Incluye mejor proveedor y último precio conocido
 *
 * CAPITAL EN RIESGO (líneas 303-316):
 * - Stock que vence en próximos 10 días
 * - Calcula monto total en riesgo: precio_venta × cantidad
 * - Ordenado por fecha de vencimiento ascendente
 *
 * @param sucursalId - ID de la sucursal
 * @param organizationId - ID de la organización
 * @returns InventoryCriticalResult - Alertas de inventario
 *
 * ORIGEN: Refactorización de fetchData() líneas 227-316
 */
export async function getInventoryCriticalAction(
  sucursalId: string,
  organizationId: string
): Promise<InventoryCriticalResult> {
  try {
    const supabase = await createClient()

    // Validaciones
    if (!sucursalId || !organizationId) {
      return {
        success: false,
        stockBajo: [],
        capitalEnRiesgo: { capital: 0, unidades: 0, criticos: [] },
        error: 'Parámetros incompletos',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener productos con stock bajo
    // ───────────────────────────────────────────────────────────────────────────

    const { data: cat } = await supabase
      .from('productos')
      .select('*')
      .eq('organization_id', organizationId)

    const { data: stk } = await supabase
      .from('view_productos_con_stock')
      .select('id, stock_disponible')
      .eq('sucursal_id', sucursalId)

    const stockBajo: CriticalProduct[] = []

    if (cat) {
      const fusion = cat.map((p: any) => ({
        ...p,
        stock_disponible: stk?.find((s: any) => s.id === p.id)?.stock_disponible || 0,
      }))

      const bajas = fusion.filter(
        (p: any) => (p.stock_disponible || 0) <= UMBRAL_STOCK_BAJO && p.categoria !== 'Servicios'
      )

      for (const p of bajas) {
        const { data: h } = await supabase
          .from('stock')
          .select('costo_unitario_historico, proveedores(nombre)')
          .eq('producto_id', p.id)
          .not('proveedor_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)

        stockBajo.push({
          id: p.id,
          producto: p.nombre,
          emoji: p.emoji,
          stock_actual: p.stock_disponible,
          mejor_proveedor: h?.[0]?.proveedores ? (h[0].proveedores as any).nombre : null,
          mejor_precio: h?.[0]?.costo_unitario_historico || null,
        })
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Calcular capital en riesgo por vencimiento
    // ───────────────────────────────────────────────────────────────────────────

    const { data: stkRiesgo } = await supabase
      .from('stock')
      .select('*, productos(nombre, precio_venta, emoji)')
      .eq('sucursal_id', sucursalId)
      .eq('tipo_movimiento', 'entrada')
      .eq('estado', 'disponible')

    let capitalTotal = 0
    let unidadesTotal = 0
    const criticos: ExpiringItem[] = []

    if (stkRiesgo) {
      const hoy = new Date()
      const limite = new Date()
      limite.setDate(hoy.getDate() + 10)

      stkRiesgo.forEach((i: any) => {
        const vDate = i.fecha_vencimiento ? new Date(i.fecha_vencimiento) : null
        if (vDate && vDate <= limite) {
          const monto = (i.productos?.precio_venta || 0) * (i.cantidad || 1)
          capitalTotal += monto
          unidadesTotal += i.cantidad || 1

          criticos.push({
            id: i.id,
            nombre: i.productos?.nombre || 'Sin nombre',
            emoji: i.productos?.emoji,
            fecha_vencimiento: i.fecha_vencimiento,
            cantidad: i.cantidad || 0,
            monto,
          })
        }
      })

      // Ordenar por fecha de vencimiento ascendente
      criticos.sort(
        (a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime()
      )
    }

    return {
      success: true,
      stockBajo,
      capitalEnRiesgo: {
        capital: capitalTotal,
        unidades: unidadesTotal,
        criticos,
      },
    }
  } catch (error) {
    return {
      success: false,
      stockBajo: [],
      capitalEnRiesgo: { capital: 0, unidades: 0, criticos: [] },
      error: error instanceof Error ? error.message : 'Error desconocido al obtener inventario crítico',
    }
  }
}
