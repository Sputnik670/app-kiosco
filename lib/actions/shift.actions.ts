/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⏰ SHIFT SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de turnos (cash_registers).
 * Maneja apertura, cierre y cálculo de arqueo automático.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Cálculos financieros en el servidor
 * - Validación de sesión y organización
 *
 * MIGRADO: 2026-01-29 - Schema V2 (cash_registers)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import { format } from 'date-fns'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Turno activo (Schema V2: cash_registers)
 */
export interface ActiveShift {
  id: string
  organization_id: string
  branch_id: string
  opened_by: string
  opening_amount: number
  opened_at: string
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

    const { data: orgId } = await supabase.rpc('get_my_org_id')

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

    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .limit(1)
      .single<{ id: string }>()

    if (!branch?.id) {
      return {
        success: false,
        shift: null,
        error: 'No se encontró sucursal',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: Buscar turno activo (Schema V2: cash_registers)
    // ───────────────────────────────────────────────────────────────────────────

    const { data: shift } = await supabase
      .from('cash_registers')
      .select('id, organization_id, branch_id, opened_by, opening_amount, opened_at')
      .eq('opened_by', user.id)
      .eq('branch_id', branch.id)
      .eq('is_open', true)
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
 * 3. Crea nuevo registro en cash_registers
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

    const { data: orgId } = await supabase.rpc('get_my_org_id')

    if (!orgId) {
      return {
        success: false,
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .limit(1)
      .single<{ id: string }>()

    if (!branch?.id) {
      return {
        success: false,
        error: 'No se encontró sucursal',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Crear turno nuevo (Schema V2: cash_registers)
    // ───────────────────────────────────────────────────────────────────────────

    const today = new Date()
    const { data, error } = await supabase
      .from('cash_registers')
      .insert({
        organization_id: orgId,
        branch_id: branch.id,
        date: format(today, 'yyyy-MM-dd'),
        opening_amount: montoInicial,
        is_open: true,
        opened_by: user.id,
        opened_at: today.toISOString(),
      })
      .select('id, organization_id, branch_id, opened_by, opening_amount, opened_at')
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
 * 3. Calcula ingresos y egresos de cash_movements
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
    // PASO 1: Obtener datos del turno (Schema V2: cash_registers)
    // ───────────────────────────────────────────────────────────────────────────

    const { data: turno, error: turnoError } = await supabase
      .from('cash_registers')
      .select('opening_amount')
      .eq('id', shiftId)
      .single<{ opening_amount: number }>()

    if (turnoError || !turno) {
      return {
        success: false,
        error: 'Turno no encontrado',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Calcular ventas en efectivo (Schema V2: sales)
    // ───────────────────────────────────────────────────────────────────────────

    const { data: ventas } = await supabase
      .from('sales')
      .select('total')
      .eq('cash_register_id', shiftId)
      .eq('payment_method', 'cash')

    const totalVentasEfectivo = ventas?.reduce(
      (sum, v) => sum + Number(v.total || 0),
      0
    ) || 0

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: Calcular movimientos manuales (Schema V2: cash_movements)
    // ───────────────────────────────────────────────────────────────────────────

    const { data: movimientos } = await supabase
      .from('cash_movements')
      .select('amount, type')
      .eq('cash_register_id', shiftId)
      .neq('category', 'sale')

    const totalIngresos = movimientos?.filter(m => m.type === 'income')
      .reduce((sum, m) => sum + Number(m.amount), 0) || 0

    const totalEgresos = movimientos?.filter(m => m.type === 'expense')
      .reduce((sum, m) => sum + Number(m.amount), 0) || 0

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 4: Calcular arqueo
    // ───────────────────────────────────────────────────────────────────────────

    const dineroEsperado = Number(turno.opening_amount) + totalVentasEfectivo + totalIngresos - totalEgresos
    const diferencia = montoFinal - dineroEsperado

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 5: Registrar cierre del turno (Schema V2: cash_registers)
    // ───────────────────────────────────────────────────────────────────────────

    const { error: closeError } = await supabase
      .from('cash_registers')
      .update({
        closing_amount: montoFinal,
        expected_amount: dineroEsperado,
        variance: diferencia,
        is_open: false,
        closed_by: user.id,
        closed_at: new Date().toISOString(),
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
      montoInicial: Number(turno.opening_amount),
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
