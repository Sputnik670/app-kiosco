/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * STATS SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para estadísticas y métricas del equipo.
 * Maneja cálculo centralizado de ranking y métricas de empleados.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Consultas batch en lugar de N+1
 * - Cálculo en servidor de métricas complejas
 *
 * MIGRADO: 2026-01-29 - Schema V2 (cash_registers, sales, missions)
 * OPTIMIZADO: 2026-02-25 - Eliminado patrón N+1 (4N queries → 4 queries)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import { verifyAuth } from '@/lib/actions/auth-helpers'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Métricas de empleado para ranking
 */
export interface EmpleadoMetricas {
  id: string
  nombre: string
  xp: number
  ventas_total: number
  misiones_completadas: number
  diferencia_caja_acumulada: number
  turnos_cerrados: number
}

/**
 * Resultado de consulta de ranking
 */
export interface GetTeamRankingResult {
  success: boolean
  ranking: EmpleadoMetricas[]
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el ranking del equipo con métricas completas
 *
 * FLUJO OPTIMIZADO (4 queries totales en lugar de 4N):
 * 1. Obtiene memberships (empleados + XP)
 * 2. Batch: todos los cash_registers cerrados en 30 días para esos users
 * 3. Batch: todas las ventas de esos cash_registers
 * 4. Batch: todas las misiones completadas de esos users en 30 días
 * 5. Agrupa en JS por user_id
 *
 * @returns GetTeamRankingResult - Ranking del equipo
 */
export async function getTeamRankingAction(): Promise<GetTeamRankingResult> {
  try {
    const { supabase, orgId } = await verifyAuth()

    // ─────────────────────────────────────────────────────────────────────────
    // Obtener empleados de la organización
    // ─────────────────────────────────────────────────────────────────────────

    const { data: membershipsData, error: empleadosError } = await supabase
      .from('memberships')
      .select('user_id, display_name, xp')
      .eq('organization_id', orgId)
      .eq('role', 'employee')
      .eq('is_active', true)

    if (empleadosError || !membershipsData) {
      return {
        success: false,
        ranking: [],
        error: empleadosError?.message || 'Error al obtener empleados',
      }
    }

    if (membershipsData.length === 0) {
      return { success: true, ranking: [] }
    }

    const employeeIds = membershipsData.map(m => m.user_id)

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 3: Fecha de inicio (últimos 30 días)
    // ─────────────────────────────────────────────────────────────────────────

    const fechaInicio = new Date()
    fechaInicio.setDate(fechaInicio.getDate() - 30)
    const fechaStr = fechaInicio.toISOString()

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 4: Batch query — cash_registers cerrados de TODOS los empleados
    // ─────────────────────────────────────────────────────────────────────────

    const { data: allShifts } = await supabase
      .from('cash_registers')
      .select('id, opened_by, variance')
      .in('opened_by', employeeIds)
      .eq('is_open', false)
      .gte('opened_at', fechaStr)

    // Indexar turnos por opened_by
    const shiftsByUser = new Map<string, { ids: string[]; variance: number; count: number }>()
    for (const shift of allShifts || []) {
      const userId = shift.opened_by as string
      if (!shiftsByUser.has(userId)) {
        shiftsByUser.set(userId, { ids: [], variance: 0, count: 0 })
      }
      const entry = shiftsByUser.get(userId)!
      entry.ids.push(shift.id)
      entry.variance += Number(shift.variance) || 0
      entry.count += 1
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 5: Batch query — ventas de TODOS esos turnos
    // ─────────────────────────────────────────────────────────────────────────

    const allShiftIds = (allShifts || []).map(s => s.id)
    const salesByShift = new Map<string, number>()

    if (allShiftIds.length > 0) {
      const { data: allSales } = await supabase
        .from('sales')
        .select('cash_register_id, total')
        .in('cash_register_id', allShiftIds)
        .gte('created_at', fechaStr)

      for (const sale of allSales || []) {
        const regId = sale.cash_register_id
        salesByShift.set(regId, (salesByShift.get(regId) || 0) + Number(sale.total || 0))
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 6: Batch query — misiones completadas de TODOS los empleados
    // ─────────────────────────────────────────────────────────────────────────

    const { data: allMissions } = await supabase
      .from('missions')
      .select('user_id')
      .in('user_id', employeeIds)
      .eq('is_completed', true)
      .gte('created_at', fechaStr)

    const missionsByUser = new Map<string, number>()
    for (const m of allMissions || []) {
      missionsByUser.set(m.user_id, (missionsByUser.get(m.user_id) || 0) + 1)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 7: Ensamblar métricas por empleado
    // ─────────────────────────────────────────────────────────────────────────

    const ranking: EmpleadoMetricas[] = membershipsData.map(emp => {
      const userShifts = shiftsByUser.get(emp.user_id)

      // Sumar ventas de todos los turnos de este empleado
      let totalVentas = 0
      if (userShifts) {
        for (const shiftId of userShifts.ids) {
          totalVentas += salesByShift.get(shiftId) || 0
        }
      }

      return {
        id: emp.user_id,
        nombre: emp.display_name || 'Sin nombre',
        xp: emp.xp || 0,
        ventas_total: totalVentas,
        misiones_completadas: missionsByUser.get(emp.user_id) || 0,
        diferencia_caja_acumulada: userShifts?.variance || 0,
        turnos_cerrados: userShifts?.count || 0,
      }
    })

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 8: Ordenar por XP descendente
    // ─────────────────────────────────────────────────────────────────────────

    ranking.sort((a, b) => b.xp - a.xp)

    return {
      success: true,
      ranking,
    }
  } catch (error) {
    return {
      success: false,
      ranking: [],
      error: error instanceof Error ? error.message : 'Error desconocido al calcular ranking',
    }
  }
}
