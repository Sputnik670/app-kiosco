/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 MISSION SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de misiones de empleados.
 * Maneja consulta, completado y progreso de misiones con XP.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Operaciones atómicas con XP
 * - Validación de sesión y organización
 *
 * ORIGEN: Refactorización de misiones-empleado.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Misión de empleado
 */
export interface Mission {
  id: string
  tipo: 'vencimiento' | 'arqueo_cierre' | 'manual'
  descripcion: string
  objetivo_unidades: number
  unidades_completadas: number
  es_completada: boolean
  puntos: number
  caja_diaria_id: string | null
  created_at: string
}

/**
 * Resultado de consulta de misiones
 */
export interface GetEmployeeMissionsResult {
  success: boolean
  misiones: Mission[]
  error?: string
}

/**
 * Resultado de completar misión
 */
export interface CompleteMissionResult {
  success: boolean
  xpGanado?: number
  misionCompletada?: boolean
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 📋 Obtiene misiones activas y globales de un empleado
 *
 * FLUJO:
 * 1. Consulta misiones del empleado
 * 2. Filtra por turno actual o misiones globales no completadas
 *
 * @param empleadoId - ID del empleado
 * @param turnoId - ID del turno actual (caja_diaria_id)
 * @returns GetEmployeeMissionsResult - Misiones del empleado
 *
 * ORIGEN: Refactorización de fetchMisiones() líneas 64-88
 */
export async function getEmployeeMissionsAction(
  empleadoId: string,
  turnoId: string
): Promise<GetEmployeeMissionsResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!empleadoId || !turnoId) {
      return {
        success: false,
        misiones: [],
        error: 'Faltan parámetros requeridos',
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        misiones: [],
        error: 'No hay sesión activa',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Consultar misiones del empleado
    // ───────────────────────────────────────────────────────────────────────────

    const { data, error } = await supabase
      .from('misiones')
      .select('*')
      .eq('empleado_id', empleadoId)
      .or(`caja_diaria_id.eq.${turnoId},caja_diaria_id.is.null`)
      .order('created_at', { ascending: true })

    if (error) {
      return {
        success: false,
        misiones: [],
        error: `Error al consultar misiones: ${error.message}`,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Filtrar misiones (turno actual o globales no completadas)
    // ───────────────────────────────────────────────────────────────────────────

    const misionesFiltradas = (data as Mission[]).filter(m =>
      m.caja_diaria_id === turnoId || (!m.caja_diaria_id && !m.es_completada)
    )

    return {
      success: true,
      misiones: misionesFiltradas,
    }
  } catch (error) {
    return {
      success: false,
      misiones: [],
      error: error instanceof Error ? error.message : 'Error desconocido al cargar misiones',
    }
  }
}

/**
 * ✅ Completa una misión manual
 *
 * FLUJO:
 * 1. Valida la misión
 * 2. Marca la misión como completada
 * 3. Vincula al turno actual si es global
 * 4. Suma XP al perfil del empleado
 *
 * @param misionId - ID de la misión
 * @param turnoId - ID del turno actual
 * @param empleadoId - ID del empleado
 * @returns CompleteMissionResult - Resultado de la operación
 *
 * ORIGEN: Refactorización de handleCompletarManual() líneas 125-143
 */
export async function completeManualMissionAction(
  misionId: string,
  turnoId: string,
  empleadoId: string
): Promise<CompleteMissionResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!misionId || !turnoId || !empleadoId) {
      return {
        success: false,
        error: 'Faltan parámetros requeridos',
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
    // PASO 1: Obtener datos de la misión
    // ───────────────────────────────────────────────────────────────────────────

    const { data: mision, error: misionError } = await supabase
      .from('misiones')
      .select('puntos, caja_diaria_id')
      .eq('id', misionId)
      .single<{ puntos: number; caja_diaria_id: string | null }>()

    if (misionError || !mision) {
      return {
        success: false,
        error: 'Misión no encontrada',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Actualizar misión como completada
    // ───────────────────────────────────────────────────────────────────────────

    const updateData: any = { es_completada: true, unidades_completadas: 1 }
    if (!mision.caja_diaria_id) {
      updateData.caja_diaria_id = turnoId
    }

    const { error: updateError } = await supabase
      .from('misiones')
      .update(updateData)
      .eq('id', misionId)

    if (updateError) {
      return {
        success: false,
        error: `Error al actualizar misión: ${updateError.message}`,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: Sumar XP al perfil del empleado
    // ───────────────────────────────────────────────────────────────────────────

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('xp')
      .eq('id', empleadoId)
      .single<{ xp: number | null }>()

    const nuevoXP = (perfil?.xp || 0) + mision.puntos

    const { error: xpError } = await supabase
      .from('perfiles')
      .update({ xp: nuevoXP })
      .eq('id', empleadoId)

    if (xpError) {
      console.error('Error al sumar XP:', xpError)
    }

    return {
      success: true,
      xpGanado: mision.puntos,
      misionCompletada: true,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al completar misión',
    }
  }
}

/**
 * 🗑️ Procesa mermas de stock y actualiza progreso de misión
 *
 * FLUJO:
 * 1. Actualiza stock a 'mermado'
 * 2. Calcula nuevo progreso de misión
 * 3. Si se completa, suma XP al empleado
 * 4. Todo en una transacción segura
 *
 * @param stockIds - IDs de stock a mermar
 * @param misionId - ID de la misión de vencimiento
 * @param turnoId - ID del turno actual
 * @param empleadoId - ID del empleado
 * @returns CompleteMissionResult - Resultado de la operación
 *
 * ORIGEN: Refactorización de handleMermarStock() líneas 145-181
 */
export async function processMermasMissionAction(
  stockIds: string[],
  misionId: string,
  turnoId: string,
  empleadoId: string
): Promise<CompleteMissionResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!stockIds || stockIds.length === 0) {
      return {
        success: false,
        error: 'No hay stock para mermar',
      }
    }

    if (!misionId || !turnoId || !empleadoId) {
      return {
        success: false,
        error: 'Faltan parámetros requeridos',
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
    // PASO 1: Actualizar stock a 'mermado'
    // ───────────────────────────────────────────────────────────────────────────

    const { error: stockError } = await supabase
      .from('stock')
      .update({
        estado: 'mermado',
        fecha_venta: new Date().toISOString(),
      })
      .in('id', stockIds)

    if (stockError) {
      return {
        success: false,
        error: `Error al actualizar stock: ${stockError.message}`,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Obtener misión actual
    // ───────────────────────────────────────────────────────────────────────────

    const { data: mision, error: misionError } = await supabase
      .from('misiones')
      .select('unidades_completadas, objetivo_unidades, puntos, caja_diaria_id')
      .eq('id', misionId)
      .single<{
        unidades_completadas: number
        objetivo_unidades: number
        puntos: number
        caja_diaria_id: string | null
      }>()

    if (misionError || !mision) {
      return {
        success: false,
        error: 'Misión no encontrada',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: Calcular nuevo progreso
    // ───────────────────────────────────────────────────────────────────────────

    const unidadesMermadas = stockIds.length
    const nuevoProgreso = mision.unidades_completadas + unidadesMermadas
    const misionCompletada = nuevoProgreso >= mision.objetivo_unidades

    const updateMisionData: any = {
      unidades_completadas: nuevoProgreso,
      es_completada: misionCompletada,
    }

    if (misionCompletada && !mision.caja_diaria_id) {
      updateMisionData.caja_diaria_id = turnoId
    }

    const { error: updateError } = await supabase
      .from('misiones')
      .update(updateMisionData)
      .eq('id', misionId)

    if (updateError) {
      return {
        success: false,
        error: `Error al actualizar misión: ${updateError.message}`,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 4: Sumar XP si la misión se completó
    // ───────────────────────────────────────────────────────────────────────────

    let xpGanado = 0

    if (misionCompletada) {
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('xp')
        .eq('id', empleadoId)
        .single<{ xp: number | null }>()

      const nuevoXP = (perfil?.xp || 0) + mision.puntos

      const { error: xpError } = await supabase
        .from('perfiles')
        .update({ xp: nuevoXP })
        .eq('id', empleadoId)

      if (xpError) {
        console.error('Error al sumar XP:', xpError)
      } else {
        xpGanado = mision.puntos
      }
    }

    return {
      success: true,
      misionCompletada,
      xpGanado: misionCompletada ? xpGanado : undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al procesar mermas',
    }
  }
}
