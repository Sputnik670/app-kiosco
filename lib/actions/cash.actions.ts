/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 💰 CASH MOVEMENT SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de movimientos de caja (ingresos/egresos).
 * Maneja registro de entradas y salidas de dinero durante un turno.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Validación de sesión y organización
 * - Registro atómico de movimientos
 *
 * ORIGEN: Refactorización de registrar-gasto.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Resultado de creación de movimiento de caja
 */
export interface CreateCashMovementResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Movimiento de caja
 */
export interface CashMovement {
  id: string
  organization_id: string
  caja_diaria_id: string
  monto: number
  tipo: 'ingreso' | 'egreso'
  descripcion: string
  categoria: string | null
  created_at: string
}

/**
 * Resultado de consulta de movimientos
 */
export interface GetShiftMovementsResult {
  success: boolean
  movements: CashMovement[]
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 💸 Crea un movimiento de caja (ingreso o egreso)
 *
 * FLUJO:
 * 1. Valida sesión y parámetros
 * 2. Obtiene organization_id del usuario
 * 3. Inserta movimiento en movimientos_caja vinculando organización y turno
 *
 * @param params - Datos del movimiento
 * @param params.monto - Monto del movimiento
 * @param params.descripcion - Descripción del movimiento
 * @param params.tipo - Tipo de movimiento ('ingreso' | 'egreso')
 * @param params.turnoId - ID del turno (caja_diaria_id)
 * @param params.categoria - Categoría opcional del movimiento
 * @returns CreateCashMovementResult - Resultado de la operación
 *
 * ORIGEN: Refactorización de handleGuardar() líneas 19-59
 */
export async function createCashMovementAction(params: {
  monto: number
  descripcion: string
  tipo: 'ingreso' | 'egreso'
  turnoId: string
  categoria?: string
}): Promise<CreateCashMovementResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    const { monto, descripcion, tipo, turnoId, categoria } = params

    if (!monto || monto <= 0) {
      return {
        success: false,
        error: 'El monto debe ser mayor a 0',
      }
    }

    if (!descripcion || descripcion.trim().length === 0) {
      return {
        success: false,
        error: 'La descripción es requerida',
      }
    }

    if (!tipo || (tipo !== 'ingreso' && tipo !== 'egreso')) {
      return {
        success: false,
        error: 'Tipo de movimiento inválido',
      }
    }

    if (!turnoId) {
      return {
        success: false,
        error: 'ID de turno requerido',
      }
    }

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

    const { data: orgId } = await supabase.rpc('get_my_org_id_v2')

    if (!orgId) {
      return {
        success: false,
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Insertar movimiento de caja
    // ───────────────────────────────────────────────────────────────────────────

    const { error } = await supabase
      .from('movimientos_caja')
      .insert({
        organization_id: orgId,
        caja_diaria_id: turnoId,
        monto: monto,
        descripcion: descripcion.trim(),
        tipo: tipo,
        categoria: categoria || null,
      })

    if (error) {
      return {
        success: false,
        error: `Error al registrar movimiento: ${error.message}`,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // RETORNO EXITOSO
    // ───────────────────────────────────────────────────────────────────────────

    const tipoLabel = tipo === 'egreso' ? 'retiraron' : 'ingresaron'
    return {
      success: true,
      message: `Se ${tipoLabel} $${monto.toLocaleString()} de la caja.`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al registrar movimiento',
    }
  }
}

/**
 * 📋 Obtiene todos los movimientos de egreso de un turno
 *
 * FLUJO:
 * 1. Valida parámetros
 * 2. Consulta movimientos_caja filtrando por turno y tipo 'egreso'
 * 3. Ordena por fecha de creación descendente
 *
 * @param cajaId - ID del turno (caja_diaria_id)
 * @returns GetShiftMovementsResult - Lista de movimientos del turno
 *
 * ORIGEN: Refactorización de fetchMovimientos() líneas 26-35
 */
export async function getShiftMovementsAction(
  cajaId: string
): Promise<GetShiftMovementsResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!cajaId) {
      return {
        success: false,
        movements: [],
        error: 'ID de turno requerido',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Consultar movimientos del turno
    // ───────────────────────────────────────────────────────────────────────────

    const { data, error } = await supabase
      .from('movimientos_caja')
      .select('*')
      .eq('caja_diaria_id', cajaId)
      .eq('tipo', 'egreso')
      .order('created_at', { ascending: false })

    if (error) {
      return {
        success: false,
        movements: [],
        error: `Error al consultar movimientos: ${error.message}`,
      }
    }

    return {
      success: true,
      movements: (data as CashMovement[]) || [],
    }
  } catch (error) {
    return {
      success: false,
      movements: [],
      error: error instanceof Error ? error.message : 'Error desconocido al consultar movimientos',
    }
  }
}
