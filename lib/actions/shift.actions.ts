/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⏰ SHIFT SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de turnos (caja_diaria).
 * Maneja apertura, cierre y cálculo de arqueo automático.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Cálculos financieros en el servidor
 * - Validación de sesión y organización
 *
 * ORIGEN: Refactorización de probar-turnos.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Turno activo
 */
export interface ActiveShift {
  id: string
  organization_id: string
  sucursal_id: string
  empleado_id: string
  monto_inicial: number
  fecha_apertura: string
}

/**
 * Resultado de consulta de turno activo
 */
export interface GetActiveShiftResult {
  success: boolean
  shift: ActiveShift | null
  error?: string
}

/**
 * Resultado de apertura de turno
 */
export interface OpenShiftResult {
  success: boolean
  shift?: ActiveShift
  message?: string
  error?: string
}

/**
 * Resumen de arqueo de cierre
 */
export interface ShiftCloseSummary {
  montoInicial: number
  totalVentasEfectivo: number
  totalIngresos: number
  totalEgresos: number
  dineroEsperado: number
  montoFinal: number
  diferencia: number
}

/**
 * Resultado de cierre de turno
 */
export interface CloseShiftResult {
  success: boolean
  summary?: ShiftCloseSummary
  message?: string
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 🔍 Obtiene el turno activo del usuario actual
 *
 * FLUJO:
 * 1. Obtiene sesión y organización del usuario
 * 2. Resuelve automáticamente la primera sucursal de la organización
 * 3. Busca turno abierto (sin fecha_cierre)
 *
 * @returns GetActiveShiftResult - Turno activo o null
 *
 * ORIGEN: Refactorización de cargarTurnoActivo() líneas 23-59
 */
export async function getActiveShiftAction(): Promise<GetActiveShiftResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener usuario y organización
    // ───────────────────────────────────────────────────────────────────────────

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        shift: null,
        error: 'No hay sesión activa',
      }
    }

    const { data: orgId } = await supabase.rpc('get_my_org_id_v2')

    if (!orgId) {
      return {
        success: false,
        shift: null,
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Resolver sucursal automáticamente
    // ───────────────────────────────────────────────────────────────────────────

    const { data: sucursal } = await supabase
      .from('sucursales')
      .select('id')
      .eq('organization_id', orgId)
      .limit(1)
      .single<{ id: string }>()

    if (!sucursal?.id) {
      return {
        success: false,
        shift: null,
        error: 'No se encontró sucursal',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: Buscar turno activo
    // ───────────────────────────────────────────────────────────────────────────

    const { data: shift } = await supabase
      .from('caja_diaria')
      .select('*')
      .eq('empleado_id', user.id)
      .eq('sucursal_id', sucursal.id)
      .is('fecha_cierre', null)
      .maybeSingle()

    return {
      success: true,
      shift: shift as ActiveShift | null,
    }
  } catch (error) {
    return {
      success: false,
      shift: null,
      error: error instanceof Error ? error.message : 'Error desconocido al obtener turno',
    }
  }
}

/**
 * 🚀 Abre un turno nuevo
 *
 * FLUJO:
 * 1. Valida sesión y organización
 * 2. Resuelve sucursal automáticamente
 * 3. Crea nuevo registro en caja_diaria
 *
 * @param montoInicial - Monto inicial de la caja
 * @returns OpenShiftResult - Turno creado
 *
 * ORIGEN: Refactorización de handleAbrirTurno() líneas 61-117
 */
export async function openShiftAction(montoInicial: number): Promise<OpenShiftResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (isNaN(montoInicial) || montoInicial < 0) {
      return {
        success: false,
        error: 'Monto inicial inválido',
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        error: 'No hay sesión activa',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener organización y sucursal
    // ───────────────────────────────────────────────────────────────────────────

    const { data: orgId } = await supabase.rpc('get_my_org_id_v2')

    if (!orgId) {
      return {
        success: false,
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    const { data: sucursal } = await supabase
      .from('sucursales')
      .select('id')
      .eq('organization_id', orgId)
      .limit(1)
      .single<{ id: string }>()

    if (!sucursal?.id) {
      return {
        success: false,
        error: 'No se encontró sucursal',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Crear turno nuevo
    // ───────────────────────────────────────────────────────────────────────────

    const { data, error } = await supabase
      .from('caja_diaria')
      .insert({
        organization_id: orgId,
        sucursal_id: sucursal.id,
        empleado_id: user.id,
        monto_inicial: montoInicial,
        fecha_apertura: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return {
        success: false,
        error: `Error al abrir turno: ${error.message}`,
      }
    }

    return {
      success: true,
      shift: data as ActiveShift,
      message: `Turno abierto exitosamente. ID: ${data.id}`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al abrir turno',
    }
  }
}

/**
 * 🔒 Cierra un turno y calcula el arqueo automáticamente
 *
 * FLUJO:
 * 1. Valida parámetros
 * 2. Calcula ventas en efectivo del turno
 * 3. Calcula ingresos y egresos de movimientos_caja
 * 4. Calcula arqueo: dineroEsperado = inicial + ventas + ingresos - egresos
 * 5. Registra cierre con monto_final, diferencia y fecha_cierre
 *
 * @param shiftId - ID del turno a cerrar
 * @param montoFinal - Monto final contado en la caja
 * @returns CloseShiftResult - Resumen del arqueo
 *
 * ORIGEN: Refactorización de handleCerrarTurno() líneas 119-204
 */
export async function closeShiftAction(
  shiftId: string,
  montoFinal: number
): Promise<CloseShiftResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!shiftId) {
      return {
        success: false,
        error: 'ID de turno requerido',
      }
    }

    if (isNaN(montoFinal) || montoFinal < 0) {
      return {
        success: false,
        error: 'Monto final inválido',
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        error: 'No hay sesión activa',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener datos del turno
    // ───────────────────────────────────────────────────────────────────────────

    const { data: turno, error: turnoError } = await supabase
      .from('caja_diaria')
      .select('monto_inicial')
      .eq('id', shiftId)
      .single<{ monto_inicial: number }>()

    if (turnoError || !turno) {
      return {
        success: false,
        error: 'Turno no encontrado',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Calcular ventas en efectivo
    // ───────────────────────────────────────────────────────────────────────────

    const { data: ventas } = await supabase
      .from('stock')
      .select('cantidad, precio_venta_historico')
      .eq('caja_diaria_id', shiftId)
      .eq('metodo_pago', 'efectivo')
      .eq('tipo_movimiento', 'salida')

    const totalVentasEfectivo = ventas?.reduce(
      (sum, v) => sum + ((v.precio_venta_historico || 0) * (v.cantidad || 1)),
      0
    ) || 0

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: Calcular movimientos manuales (ingresos y egresos)
    // ───────────────────────────────────────────────────────────────────────────

    const { data: movimientos } = await supabase
      .from('movimientos_caja')
      .select('monto, tipo')
      .eq('caja_diaria_id', shiftId)

    const totalIngresos = movimientos?.filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + m.monto, 0) || 0

    const totalEgresos = movimientos?.filter(m => m.tipo === 'egreso')
      .reduce((sum, m) => sum + m.monto, 0) || 0

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 4: Calcular arqueo
    // ───────────────────────────────────────────────────────────────────────────

    const dineroEsperado = turno.monto_inicial + totalVentasEfectivo + totalIngresos - totalEgresos
    const diferencia = montoFinal - dineroEsperado

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 5: Registrar cierre del turno
    // ───────────────────────────────────────────────────────────────────────────

    const { error: closeError } = await supabase
      .from('caja_diaria')
      .update({
        monto_final: montoFinal,
        diferencia: diferencia,
        fecha_cierre: new Date().toISOString(),
      })
      .eq('id', shiftId)

    if (closeError) {
      return {
        success: false,
        error: `Error al cerrar turno: ${closeError.message}`,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 6: Retornar resumen del arqueo
    // ───────────────────────────────────────────────────────────────────────────

    const summary: ShiftCloseSummary = {
      montoInicial: turno.monto_inicial,
      totalVentasEfectivo,
      totalIngresos,
      totalEgresos,
      dineroEsperado,
      montoFinal,
      diferencia,
    }

    return {
      success: true,
      summary,
      message: Math.abs(diferencia) <= 100
        ? '🏆 Arqueo perfecto! Diferencia <= $100'
        : `Turno cerrado. Diferencia: $${diferencia.toLocaleString()}`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al cerrar turno',
    }
  }
}
