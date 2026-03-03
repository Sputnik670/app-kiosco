/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 MISSIONS SERVER ACTIONS (CONSOLIDADO)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión completa de misiones y gamificación.
 *
 * FUNCIONALIDADES:
 * - Crear misiones únicas y plantillas recurrentes
 * - Consultar misiones de empleados
 * - Completar misiones manuales
 * - Procesar mermas y actualizar progreso
 * - Gestión de XP
 *
 * MIGRADO: 2026-01-27 - Schema V2 (tablas en inglés)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import { verifyAuth, verifyOwner } from '@/lib/actions/auth-helpers'
import { ROLES } from '@/lib/constants/roles'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Parámetros para crear una misión o rutina
 */
export interface CreateMissionParams {
  descripcion: string
  puntos: number
  esRecurrente: boolean
  sucursalId?: string | null
  turnoId?: string | null
  empleadoId?: string
}

/**
 * Resultado de crear misión/rutina
 */
export interface CreateMissionResult {
  success: boolean
  tipo: 'mision' | 'rutina'
  error?: string
}

/**
 * Empleado disponible para asignar misiones
 */
export interface EmployeeInfo {
  id: string
  nombre: string
}

/**
 * Misión completa para UI (formato legacy para compatibilidad con componentes)
 */
export interface MissionData {
  id: string
  tipo: string
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
export interface GetMissionsResult {
  success: boolean
  misiones: MissionData[]
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
// HELPERS INTERNOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Mapea misión del schema V2 a formato legacy para UI
 */
function mapMissionToLegacy(mission: {
  id: string
  type: string
  description: string | null
  target_value: number
  current_value: number
  is_completed: boolean
  points: number
  cash_register_id: string | null
  created_at: string
}): MissionData {
  return {
    id: mission.id,
    tipo: mission.type,
    descripcion: mission.description || '',
    objetivo_unidades: mission.target_value,
    unidades_completadas: mission.current_value,
    es_completada: mission.is_completed,
    puntos: mission.points,
    caja_diaria_id: mission.cash_register_id,
    created_at: mission.created_at,
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// CREAR MISIONES Y RUTINAS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 🎯 Crea una misión única o una rutina recurrente
 *
 * LÓGICA:
 * - Si esRecurrente = true: Inserta en 'mission_templates' (rutina)
 * - Si esRecurrente = false: Inserta en 'missions' (tarea única)
 *
 * RUTINAS (mission_templates):
 * - Se vinculan a una sucursal (o null = global)
 * - Se activan automáticamente en cada apertura de caja
 *
 * MISIONES ÚNICAS (missions):
 * - Se vinculan a un turno específico (cash_register_id)
 * - Se asignan a un empleado específico
 */
export async function createMissionAction(
  params: CreateMissionParams
): Promise<CreateMissionResult> {
  try {
    const { supabase, orgId: organizationId } = await verifyOwner()

    // CREAR RUTINA RECURRENTE (plantilla)
    if (params.esRecurrente) {
      const { error } = await supabase.from('mission_templates').insert({
        organization_id: organizationId,
        branch_id: params.sucursalId || null,
        description: params.descripcion,
        points: params.puntos,
        is_active: true,
      })

      if (error) {
        return {
          success: false,
          tipo: 'rutina',
          error: `Error creando rutina: ${error.message}`,
        }
      }

      return { success: true, tipo: 'rutina' }
    }

    // CREAR MISIÓN ÚNICA
    if (!params.empleadoId) {
      return {
        success: false,
        tipo: 'mision',
        error: 'Falta el ID del empleado para la misión',
      }
    }

    const { error } = await supabase.from('missions').insert({
      organization_id: organizationId,
      cash_register_id: params.turnoId || null,
      user_id: params.empleadoId,
      type: 'manual',
      description: params.descripcion,
      target_value: 1,
      current_value: 0,
      is_completed: false,
      points: params.puntos,
    })

    if (error) {
      return {
        success: false,
        tipo: 'mision',
        error: `Error creando misión: ${error.message}`,
      }
    }

    return { success: true, tipo: 'mision' }
  } catch (error) {
    return {
      success: false,
      tipo: 'mision',
      error: error instanceof Error ? error.message : 'Error desconocido al crear misión',
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// CONSULTAR EMPLEADOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 👥 Obtiene lista de empleados disponibles para asignar misiones
 *
 * Usa memberships para obtener empleados (Schema V2)
 */
export async function getEmployeesForMissionsAction(): Promise<{
  success: boolean
  empleados: EmployeeInfo[]
  error?: string
}> {
  try {
    const { supabase, orgId: organizationId } = await verifyOwner()

    // Consultar empleados usando memberships (Schema V2)
    const { data, error } = await supabase
      .from('memberships')
      .select('user_id, display_name')
      .eq('organization_id', organizationId)
      .eq('role', ROLES.EMPLOYEE)
      .eq('is_active', true)

    if (error) {
      return {
        success: false,
        empleados: [],
        error: `Error obteniendo empleados: ${error.message}`,
      }
    }

    // Mapear resultados
    const empleados: EmployeeInfo[] = (data || []).map((row: { user_id: string; display_name: string }) => ({
      id: row.user_id,
      nombre: row.display_name || 'Sin nombre',
    }))

    return {
      success: true,
      empleados,
    }
  } catch (error) {
    return {
      success: false,
      empleados: [],
      error: error instanceof Error ? error.message : 'Error desconocido al obtener empleados',
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// CONSULTAR MISIONES
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 📋 Obtiene misiones activas y globales de un empleado
 *
 * Filtra por turno actual o misiones globales no completadas
 */
export async function getEmployeeMissionsAction(
  empleadoId: string,
  turnoId: string
): Promise<GetMissionsResult> {
  try {
    // Validaciones
    if (!empleadoId || !turnoId) {
      return {
        success: false,
        misiones: [],
        error: 'Faltan parámetros requeridos',
      }
    }

    const { supabase } = await verifyAuth()

    // Consultar misiones (Schema V2)
    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .eq('user_id', empleadoId)
      .or(`cash_register_id.eq.${turnoId},cash_register_id.is.null`)
      .order('created_at', { ascending: true })

    if (error) {
      return {
        success: false,
        misiones: [],
        error: `Error al consultar misiones: ${error.message}`,
      }
    }

    // Filtrar: turno actual o globales no completadas
    // Y mapear a formato legacy
    const misionesFiltradas = (data || [])
      .filter((m: { cash_register_id: string | null; is_completed: boolean }) =>
        m.cash_register_id === turnoId || (!m.cash_register_id && !m.is_completed)
      )
      .map(mapMissionToLegacy)

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

// ───────────────────────────────────────────────────────────────────────────────
// COMPLETAR MISIONES
// ───────────────────────────────────────────────────────────────────────────────

/**
 * ✅ Completa una misión manual
 *
 * FLUJO:
 * 1. Valida la misión
 * 2. Marca como completada
 * 3. Vincula al turno actual si es global
 * 4. Suma XP al membership
 */
export async function completeManualMissionAction(
  misionId: string,
  turnoId: string,
  empleadoId: string
): Promise<CompleteMissionResult> {
  try {
    // Validaciones
    if (!misionId || !turnoId || !empleadoId) {
      return {
        success: false,
        error: 'Faltan parámetros requeridos',
      }
    }

    const { supabase } = await verifyAuth()

    // Obtener datos de la misión (Schema V2)
    const { data: mission, error: missionError } = await supabase
      .from('missions')
      .select('points, cash_register_id, organization_id')
      .eq('id', misionId)
      .single<{ points: number; cash_register_id: string | null; organization_id: string }>()

    if (missionError || !mission) {
      return {
        success: false,
        error: 'Misión no encontrada',
      }
    }

    // Actualizar misión como completada
    const updateData: { is_completed: boolean; current_value: number; cash_register_id?: string; completed_at: string } = {
      is_completed: true,
      current_value: 1,
      completed_at: new Date().toISOString(),
    }
    if (!mission.cash_register_id) {
      updateData.cash_register_id = turnoId
    }

    const { error: updateError } = await supabase
      .from('missions')
      .update(updateData)
      .eq('id', misionId)

    if (updateError) {
      return {
        success: false,
        error: `Error al actualizar misión: ${updateError.message}`,
      }
    }

    // Sumar XP al membership (Schema V2)
    const { data: membership } = await supabase
      .from('memberships')
      .select('xp')
      .eq('user_id', empleadoId)
      .eq('organization_id', mission.organization_id)
      .single<{ xp: number | null }>()

    const nuevoXP = (membership?.xp || 0) + mission.points

    const { error: xpError } = await supabase
      .from('memberships')
      .update({ xp: nuevoXP })
      .eq('user_id', empleadoId)
      .eq('organization_id', mission.organization_id)

    if (xpError) {
      console.error('Error al sumar XP:', xpError)
    }

    return {
      success: true,
      xpGanado: mission.points,
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
 * 1. Actualiza stock_batches a 'damaged'
 * 2. Calcula nuevo progreso
 * 3. Si se completa, suma XP
 */
export async function processMermasMissionAction(
  stockIds: string[],
  misionId: string,
  turnoId: string,
  empleadoId: string
): Promise<CompleteMissionResult> {
  try {
    // Validaciones
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

    const { supabase } = await verifyAuth()

    // Actualizar stock_batches a 'damaged' (Schema V2)
    const { error: stockError } = await supabase
      .from('stock_batches')
      .update({ status: 'damaged' })
      .in('id', stockIds)

    if (stockError) {
      return {
        success: false,
        error: `Error al actualizar stock: ${stockError.message}`,
      }
    }

    // Obtener misión actual (Schema V2)
    const { data: mission, error: missionError } = await supabase
      .from('missions')
      .select('current_value, target_value, points, cash_register_id, organization_id')
      .eq('id', misionId)
      .single<{
        current_value: number
        target_value: number
        points: number
        cash_register_id: string | null
        organization_id: string
      }>()

    if (missionError || !mission) {
      return {
        success: false,
        error: 'Misión no encontrada',
      }
    }

    // Calcular nuevo progreso
    const unidadesMermadas = stockIds.length
    const nuevoProgreso = mission.current_value + unidadesMermadas
    const misionCompletada = nuevoProgreso >= mission.target_value

    const updateMissionData: {
      current_value: number
      is_completed: boolean
      cash_register_id?: string
      completed_at?: string
    } = {
      current_value: nuevoProgreso,
      is_completed: misionCompletada,
    }

    if (misionCompletada) {
      updateMissionData.completed_at = new Date().toISOString()
      if (!mission.cash_register_id) {
        updateMissionData.cash_register_id = turnoId
      }
    }

    const { error: updateError } = await supabase
      .from('missions')
      .update(updateMissionData)
      .eq('id', misionId)

    if (updateError) {
      return {
        success: false,
        error: `Error al actualizar misión: ${updateError.message}`,
      }
    }

    // Sumar XP si la misión se completó
    let xpGanado = 0

    if (misionCompletada) {
      const { data: membership } = await supabase
        .from('memberships')
        .select('xp')
        .eq('user_id', empleadoId)
        .eq('organization_id', mission.organization_id)
        .single<{ xp: number | null }>()

      const nuevoXP = (membership?.xp || 0) + mission.points

      const { error: xpError } = await supabase
        .from('memberships')
        .update({ xp: nuevoXP })
        .eq('user_id', empleadoId)
        .eq('organization_id', mission.organization_id)

      if (xpError) {
        console.error('Error al sumar XP:', xpError)
      } else {
        xpGanado = mission.points
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

// ───────────────────────────────────────────────────────────────────────────────
// EXPORTS LEGACY (para compatibilidad durante migración)
// ───────────────────────────────────────────────────────────────────────────────

// Re-export con nombres antiguos para compatibilidad
export {
  createMissionAction as createMisionAction,
  getEmployeesForMissionsAction as getEmpleadosAction,
}

// Re-export tipos
export type {
  CreateMissionParams as CreateMisionParams,
  CreateMissionResult as CreateMisionResult,
  EmployeeInfo as EmpleadoInfo,
}
