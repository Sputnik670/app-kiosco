/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📊 STATS SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para estadísticas y métricas del equipo.
 * Maneja cálculo centralizado de ranking y métricas de empleados.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Consultas optimizadas con agregaciones
 * - Cálculo en servidor de métricas complejas
 *
 * ORIGEN: Refactorización de team-ranking.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'

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
 * 🏆 Obtiene el ranking del equipo con métricas completas
 *
 * FLUJO:
 * 1. Obtiene organization_id del usuario actual
 * 2. Consulta empleados de la organización
 * 3. Para cada empleado, calcula métricas de los últimos 30 días:
 *    - XP total del perfil
 *    - Suma de ventas (precio_venta_historico * cantidad)
 *    - Conteo de misiones completadas
 *    - Suma de diferencia de caja
 * 4. Retorna array ordenado por XP descendente
 *
 * OPTIMIZACIÓN: Consultas paralelas por empleado
 *
 * @returns GetTeamRankingResult - Ranking del equipo
 *
 * ORIGEN: Refactorización de calcularRanking() líneas 30-133
 */
export async function getTeamRankingAction(): Promise<GetTeamRankingResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener usuario y organización
    // ───────────────────────────────────────────────────────────────────────────

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        ranking: [],
        error: 'No hay sesión activa',
      }
    }

    const { data: orgId } = await supabase.rpc('get_my_org_id_v2')

    if (!orgId) {
      return {
        success: false,
        ranking: [],
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Obtener empleados de la organización
    // ───────────────────────────────────────────────────────────────────────────

    const { data: empleados, error: empleadosError } = await supabase
      .from('perfiles')
      .select('id, nombre, xp')
      .eq('organization_id', orgId)
      .eq('rol', 'empleado')

    if (empleadosError || !empleados) {
      return {
        success: false,
        ranking: [],
        error: empleadosError?.message || 'Error al obtener empleados',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: Calcular fecha de inicio (últimos 30 días)
    // ───────────────────────────────────────────────────────────────────────────

    const fechaInicio = new Date()
    fechaInicio.setDate(fechaInicio.getDate() - 30)
    const fechaStr = fechaInicio.toISOString()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 4: Calcular métricas para cada empleado (en paralelo)
    // ───────────────────────────────────────────────────────────────────────────

    const metricas: EmpleadoMetricas[] = await Promise.all(
      empleados.map(async (emp) => {
        // ─────────────────────────────────────────────────────────────────────────
        // A. VENTAS TOTALES
        // ─────────────────────────────────────────────────────────────────────────

        // Obtener turnos del empleado
        const { data: turnosVentas } = await supabase
          .from('caja_diaria')
          .select('id')
          .eq('empleado_id', emp.id)
          .not('fecha_cierre', 'is', null)
          .gte('fecha_apertura', fechaStr)

        let totalVentas = 0

        if (turnosVentas && turnosVentas.length > 0) {
          const turnosIds = turnosVentas.map((t) => t.id)

          // Obtener ventas de esos turnos
          const { data: ventasData } = await supabase
            .from('stock')
            .select('precio_venta_historico, cantidad')
            .eq('estado', 'vendido')
            .in('caja_diaria_id', turnosIds)
            .gte('fecha_venta', fechaStr)

          if (ventasData) {
            totalVentas = ventasData.reduce((sum, v) => {
              const precio = Number(v.precio_venta_historico) || 0
              const cantidad = Number(v.cantidad) || 1
              return sum + precio * cantidad
            }, 0)
          }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // B. MISIONES COMPLETADAS
        // ─────────────────────────────────────────────────────────────────────────

        const { count: misiones } = await supabase
          .from('misiones')
          .select('*', { count: 'exact', head: true })
          .eq('empleado_id', emp.id)
          .eq('es_completada', true)
          .gte('created_at', fechaStr)

        // ─────────────────────────────────────────────────────────────────────────
        // C. DIFERENCIA DE CAJA ACUMULADA
        // ─────────────────────────────────────────────────────────────────────────

        const { data: turnos } = await supabase
          .from('caja_diaria')
          .select('diferencia')
          .eq('empleado_id', emp.id)
          .not('fecha_cierre', 'is', null)
          .gte('fecha_apertura', fechaStr)

        let diffAcumulada = 0
        let countTurnos = 0

        if (turnos) {
          countTurnos = turnos.length
          diffAcumulada = turnos.reduce((sum, t) => {
            return sum + (Number(t.diferencia) || 0)
          }, 0)
        }

        // ─────────────────────────────────────────────────────────────────────────
        // RETORNAR MÉTRICAS DEL EMPLEADO
        // ─────────────────────────────────────────────────────────────────────────

        return {
          id: emp.id,
          nombre: emp.nombre || 'Sin nombre',
          xp: emp.xp || 0,
          ventas_total: totalVentas,
          misiones_completadas: misiones || 0,
          diferencia_caja_acumulada: diffAcumulada,
          turnos_cerrados: countTurnos,
        }
      })
    )

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 5: Ordenar por XP descendente
    // ───────────────────────────────────────────────────────────────────────────

    const rankingOrdenado = metricas.sort((a, b) => b.xp - a.xp)

    return {
      success: true,
      ranking: rankingOrdenado,
    }
  } catch (error) {
    return {
      success: false,
      ranking: [],
      error: error instanceof Error ? error.message : 'Error desconocido al calcular ranking',
    }
  }
}
