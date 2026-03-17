/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📅 TIMELINE SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Timeline unificada: agrega datos de ventas, servicios, compras a proveedores,
 * movimientos de stock, cambios de precios, incidentes y notas manuales
 * en una sola vista cronológica por fecha.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { verifyAuth, verifyOwner } from '@/lib/actions/auth-helpers'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

export type TimelineEventType =
  | 'venta'           // Venta de producto
  | 'servicio'        // Venta de servicio virtual (SUBE, recargas)
  | 'compra'          // Compra a proveedor (ingreso de stock)
  | 'compra_servicio' // Compra de crédito a proveedor de servicios
  | 'movimiento_caja' // Ingreso/egreso de caja
  | 'cambio_precio'   // Cambio de precio de producto
  | 'incidente'       // Incidente reportado
  | 'nota'            // Nota manual del dueño

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  timestamp: string           // ISO string
  title: string               // Línea principal
  description: string | null  // Detalle secundario
  amount: number | null       // Monto en ARS (positivo = ingreso, negativo = egreso)
  emoji: string               // Emoji/icono para la UI
  metadata?: Record<string, unknown>  // Data extra para expandir
}

export interface GetTimelineResult {
  success: boolean
  events: TimelineEvent[]
  summary: {
    totalVentas: number
    totalServicios: number
    totalCompras: number
    totalMovimientos: number
  }
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// TIMELINE PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 📅 Obtiene la timeline unificada para una fecha específica
 *
 * Consulta 7 tablas en paralelo y unifica los resultados en un array
 * ordenado cronológicamente.
 */
export async function getTimelineAction(
  date: string, // 'YYYY-MM-DD'
  branchId?: string,
  filters?: TimelineEventType[]
): Promise<GetTimelineResult> {
  try {
    const { supabase, orgId } = await verifyOwner()

    const startOfDay = `${date}T00:00:00.000Z`
    const endOfDay = `${date}T23:59:59.999Z`

    // Ejecutar todas las queries en paralelo
    const [
      salesResult,
      serviceSalesResult,
      purchasesResult,
      servicePurchasesResult,
      cashMovementsResult,
      priceChangesResult,
      incidentsResult,
      notesResult,
    ] = await Promise.all([
      // 1. Ventas de productos
      (!filters || filters.includes('venta'))
        ? supabase
            .from('sales')
            .select('id, total, payment_method, created_at, sale_items(quantity, unit_price, products(name, emoji))')
            .eq('organization_id', orgId)
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay)
            .order('created_at', { ascending: false })
            .limit(200)
        : Promise.resolve({ data: null, error: null }),

      // 2. Ventas de servicios (SUBE, recargas)
      (!filters || filters.includes('servicio'))
        ? supabase
            .from('service_sales')
            .select('id, service_type, total_collected, amount_charged, commission, payment_method, created_at')
            .eq('organization_id', orgId)
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay)
            .order('created_at', { ascending: false })
            .limit(200)
        : Promise.resolve({ data: null, error: null }),

      // 3. Compras a proveedores (ingreso de mercadería)
      (!filters || filters.includes('compra'))
        ? supabase
            .from('purchases')
            .select('id, total, payment_method, date, created_at, invoice_number, suppliers(name)')
            .eq('organization_id', orgId)
            .eq('date', date)
            .order('created_at', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: null, error: null }),

      // 4. Compras de crédito a proveedores de servicios
      (!filters || filters.includes('compra_servicio'))
        ? supabase
            .from('service_purchases')
            .select('id, amount, payment_method, created_at, invoice_number, notes, suppliers(name)')
            .eq('organization_id', orgId)
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay)
            .order('created_at', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: null, error: null }),

      // 5. Movimientos de caja (ingresos/egresos manuales)
      (!filters || filters.includes('movimiento_caja'))
        ? supabase
            .from('cash_movements')
            .select('id, type, amount, category, description, created_at')
            .eq('organization_id', orgId)
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay)
            .is('sale_id', null) // Excluir los generados por ventas
            .order('created_at', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: null, error: null }),

      // 6. Cambios de precios
      (!filters || filters.includes('cambio_precio'))
        ? supabase
            .from('price_history')
            .select('id, old_price, new_price, old_cost, new_cost, created_at, products(name, emoji)')
            .eq('organization_id', orgId)
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay)
            .order('created_at', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: null, error: null }),

      // 7. Incidentes
      (!filters || filters.includes('incidente'))
        ? supabase
            .from('incidents')
            .select('id, type, description, severity, status, created_at, memberships!incidents_employee_id_fkey(display_name)')
            .eq('organization_id', orgId)
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay)
            .order('created_at', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: null, error: null }),

      // 8. Notas manuales del dueño
      (!filters || filters.includes('nota'))
        ? supabase
            .from('owner_notes')
            .select('id, title, content, category, pinned, created_at, note_date')
            .eq('organization_id', orgId)
            .eq('note_date', date)
            .order('pinned', { ascending: false })
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: null, error: null }),
    ])

    // ─── Transformar resultados ───────────────────────────────────────────

    const events: TimelineEvent[] = []

    // 1. Ventas de productos
    let totalVentas = 0
    if (salesResult.data) {
      for (const s of salesResult.data) {
        const items = s.sale_items as unknown as Array<{
          quantity: number; unit_price: number; products: { name: string; emoji?: string } | null
        }> | null
        const total = Number(s.total) || 0
        totalVentas += total
        const productNames = (items || [])
          .map(i => `${i.products?.name || 'Producto'} ×${i.quantity}`)
          .join(', ')
        const firstEmoji = items?.[0]?.products?.emoji || '🛒'

        events.push({
          id: s.id,
          type: 'venta',
          timestamp: s.created_at,
          title: productNames || 'Venta',
          description: paymentLabel(s.payment_method),
          amount: total,
          emoji: firstEmoji,
        })
      }
    }

    // 2. Ventas de servicios
    let totalServicios = 0
    if (serviceSalesResult.data) {
      for (const s of serviceSalesResult.data) {
        const total = Number(s.total_collected) || 0
        const commission = Number(s.commission) || 0
        totalServicios += total
        events.push({
          id: s.id,
          type: 'servicio',
          timestamp: s.created_at,
          title: `${s.service_type || 'Servicio'}`,
          description: `Carga $${Number(s.amount_charged).toLocaleString('es-AR')}${commission > 0 ? ` + comisión $${commission.toLocaleString('es-AR')}` : ''} · ${paymentLabel(s.payment_method)}`,
          amount: total,
          emoji: s.service_type?.toUpperCase().includes('SUBE') ? '🚌' : '📱',
        })
      }
    }

    // 3. Compras a proveedores
    let totalCompras = 0
    if (purchasesResult.data) {
      for (const p of purchasesResult.data) {
        const total = Number(p.total) || 0
        totalCompras += total
        const supplier = (p.suppliers as unknown as { name: string } | null)
        events.push({
          id: p.id,
          type: 'compra',
          timestamp: p.created_at,
          title: `Compra a ${supplier?.name || 'Proveedor'}`,
          description: p.invoice_number ? `Factura ${p.invoice_number}` : paymentLabel(p.payment_method),
          amount: -total, // Negativo porque es egreso
          emoji: '📦',
        })
      }
    }

    // 4. Compras de crédito de servicios
    if (servicePurchasesResult.data) {
      for (const sp of servicePurchasesResult.data) {
        const amount = Number(sp.amount) || 0
        totalCompras += amount
        const supplier = (sp.suppliers as unknown as { name: string } | null)
        events.push({
          id: sp.id,
          type: 'compra_servicio',
          timestamp: sp.created_at,
          title: `Recarga crédito ${supplier?.name || 'Servicios'}`,
          description: sp.notes || paymentLabel(sp.payment_method),
          amount: -amount,
          emoji: '💳',
        })
      }
    }

    // 5. Movimientos de caja
    let totalMovimientos = 0
    if (cashMovementsResult.data) {
      for (const m of cashMovementsResult.data) {
        const amount = Number(m.amount) || 0
        const isIngreso = m.type === 'income'
        totalMovimientos += isIngreso ? amount : -amount
        events.push({
          id: m.id,
          type: 'movimiento_caja',
          timestamp: m.created_at,
          title: `${isIngreso ? 'Ingreso' : 'Egreso'} de caja`,
          description: m.description || m.category || null,
          amount: isIngreso ? amount : -amount,
          emoji: isIngreso ? '💰' : '💸',
        })
      }
    }

    // 6. Cambios de precios
    if (priceChangesResult.data) {
      for (const ph of priceChangesResult.data) {
        const product = (ph.products as unknown as { name: string; emoji?: string } | null)
        const oldPrice = Number(ph.old_price) || 0
        const newPrice = Number(ph.new_price) || 0
        const diff = newPrice - oldPrice
        events.push({
          id: ph.id,
          type: 'cambio_precio',
          timestamp: ph.created_at,
          title: `Precio ${product?.name || 'Producto'}`,
          description: `$${oldPrice.toLocaleString('es-AR')} → $${newPrice.toLocaleString('es-AR')} (${diff > 0 ? '+' : ''}${Math.round(diff / (oldPrice || 1) * 100)}%)`,
          amount: null,
          emoji: product?.emoji || '🏷️',
        })
      }
    }

    // 7. Incidentes
    if (incidentsResult.data) {
      for (const inc of incidentsResult.data) {
        const employee = (inc.memberships as unknown as { display_name: string } | null)
        const severityEmoji = inc.severity === 'high' ? '🔴' : inc.severity === 'medium' ? '🟡' : '🟢'
        events.push({
          id: inc.id,
          type: 'incidente',
          timestamp: inc.created_at,
          title: `Incidente: ${inc.type}`,
          description: `${employee?.display_name || 'Empleado'} — ${inc.description?.slice(0, 80) || ''}`,
          amount: null,
          emoji: severityEmoji,
        })
      }
    }

    // 8. Notas manuales
    if (notesResult.data) {
      for (const n of notesResult.data) {
        events.push({
          id: n.id,
          type: 'nota',
          timestamp: n.created_at,
          title: n.title || 'Nota',
          description: n.content?.slice(0, 120) || null,
          amount: null,
          emoji: n.pinned ? '📌' : '📝',
          metadata: { pinned: n.pinned, category: n.category, fullContent: n.content },
        })
      }
    }

    // Ordenar por timestamp descendente (más reciente primero)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return {
      success: true,
      events,
      summary: {
        totalVentas,
        totalServicios,
        totalCompras,
        totalMovimientos,
      },
    }
  } catch (error) {
    return {
      success: false,
      events: [],
      summary: { totalVentas: 0, totalServicios: 0, totalCompras: 0, totalMovimientos: 0 },
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// OBTENER FECHAS CON ACTIVIDAD (para marcar en calendario)
// ───────────────────────────────────────────────────────────────────────────────

export async function getActiveDatesAction(
  month: number,
  year: number
): Promise<{ success: boolean; dates: string[]; error?: string }> {
  try {
    const { supabase, orgId } = await verifyOwner()

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endMonth = month === 12 ? 1 : month + 1
    const endYear = month === 12 ? year + 1 : year
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

    // Consultar fechas con actividad en paralelo
    const [salesDates, serviceDates, notesDates, purchasesDates] = await Promise.all([
      supabase
        .from('sales')
        .select('created_at')
        .eq('organization_id', orgId)
        .gte('created_at', `${startDate}T00:00:00Z`)
        .lt('created_at', `${endDate}T00:00:00Z`),
      supabase
        .from('service_sales')
        .select('created_at')
        .eq('organization_id', orgId)
        .gte('created_at', `${startDate}T00:00:00Z`)
        .lt('created_at', `${endDate}T00:00:00Z`),
      supabase
        .from('owner_notes')
        .select('note_date')
        .eq('organization_id', orgId)
        .gte('note_date', startDate)
        .lt('note_date', endDate),
      supabase
        .from('purchases')
        .select('date')
        .eq('organization_id', orgId)
        .gte('date', startDate)
        .lt('date', endDate),
    ])

    const allDates = new Set<string>()

    // Extraer fechas únicas
    for (const s of salesDates.data || []) {
      allDates.add(s.created_at.slice(0, 10))
    }
    for (const s of serviceDates.data || []) {
      allDates.add(s.created_at.slice(0, 10))
    }
    for (const n of notesDates.data || []) {
      allDates.add(n.note_date)
    }
    for (const p of purchasesDates.data || []) {
      allDates.add(p.date)
    }

    return { success: true, dates: [...allDates] }
  } catch (error) {
    return { success: false, dates: [], error: error instanceof Error ? error.message : 'Error' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────────────────────────

function paymentLabel(method: string | null): string {
  const map: Record<string, string> = {
    cash: 'Efectivo',
    efectivo: 'Efectivo',
    card: 'Tarjeta',
    tarjeta: 'Tarjeta',
    transfer: 'Transferencia',
    wallet: 'Billetera',
    billetera_virtual: 'Billetera',
  }
  return map[method || ''] || method || ''
}
