/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ATTENDANCE SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de asistencia/fichaje de empleados.
 * Maneja registro de entrada y salida en sucursales.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Validación de sesión y organización
 * - Operaciones atómicas de fichaje
 *
 * MIGRADO: 2026-02-25 - Schema V2 (tabla 'attendance', columnas en inglés)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Registro de asistencia (Schema V2: tabla 'attendance')
 */
export interface AttendanceRecord {
  id: string
  organization_id: string
  branch_id: string
  user_id: string
  check_in: string
  check_out: string | null
  created_at: string
}

/**
 * Resultado de consulta de estado de asistencia
 */
export interface GetAttendanceStatusResult {
  success: boolean
  activeRecord: AttendanceRecord | null
  error?: string
}

/**
 * Resultado de toggle de asistencia
 */
export interface ToggleAttendanceResult {
  success: boolean
  action: 'entrada' | 'salida' | null
  record?: AttendanceRecord
  message?: string
  error?: string
}

/**
 * Datos del QR de fichaje
 */
export interface QRFichajeData {
  tipo: 'entrada' | 'salida'
  sucursal_id: string
  sucursal_nombre: string
}

/**
 * Resultado de procesamiento de QR
 */
export interface ProcessQRScanResult {
  success: boolean
  action: 'entrada' | 'salida' | null
  message?: string
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el estado de asistencia actual del empleado en una sucursal
 *
 * FLUJO:
 * 1. Valida sesión del usuario
 * 2. Busca registro de asistencia abierto (check_out = null)
 * 3. Devuelve el fichaje activo si existe
 *
 * @param sucursalId - ID de la sucursal (branch_id)
 * @returns GetAttendanceStatusResult - Estado de asistencia
 */
export async function getAttendanceStatusAction(
  sucursalId: string
): Promise<GetAttendanceStatusResult> {
  try {
    const supabase = await createClient()

    if (!sucursalId) {
      return {
        success: false,
        activeRecord: null,
        error: 'ID de sucursal requerido',
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        activeRecord: null,
        error: 'No hay sesión activa',
      }
    }

    const { data, error } = await supabase
      .from('attendance')
      .select('id, organization_id, branch_id, user_id, check_in, check_out, created_at')
      .eq('user_id', user.id)
      .eq('branch_id', sucursalId)
      .is('check_out', null)
      .maybeSingle()

    if (error) {
      return {
        success: false,
        activeRecord: null,
        error: `Error al consultar asistencia: ${error.message}`,
      }
    }

    return {
      success: true,
      activeRecord: data as AttendanceRecord | null,
    }
  } catch (error) {
    return {
      success: false,
      activeRecord: null,
      error: error instanceof Error ? error.message : 'Error desconocido al consultar asistencia',
    }
  }
}

/**
 * Registra entrada o salida de empleado (toggle)
 *
 * FLUJO:
 * 1. Valida sesión y obtiene organization_id
 * 2. Busca fichaje activo
 * 3. ENTRADA: Si no hay fichaje activo, inserta nuevo registro
 * 4. SALIDA: Si hay fichaje activo, actualiza campo check_out
 *
 * @param sucursalId - ID de la sucursal (branch_id)
 * @returns ToggleAttendanceResult - Resultado de la operación
 */
export async function toggleAttendanceAction(
  sucursalId: string
): Promise<ToggleAttendanceResult> {
  try {
    const supabase = await createClient()

    if (!sucursalId) {
      return {
        success: false,
        action: null,
        error: 'ID de sucursal requerido',
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        action: null,
        error: 'No hay sesión activa',
      }
    }

    const { data: orgId } = await supabase.rpc('get_my_org_id')

    if (!orgId) {
      return {
        success: false,
        action: null,
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // Verificar fichaje activo
    const { data: fichajeActivo } = await supabase
      .from('attendance')
      .select('id, organization_id, branch_id, user_id, check_in, check_out, created_at')
      .eq('user_id', user.id)
      .eq('branch_id', sucursalId)
      .is('check_out', null)
      .maybeSingle()

    // CASO 1: REGISTRAR ENTRADA
    if (!fichajeActivo) {
      const { data, error } = await supabase
        .from('attendance')
        .insert({
          organization_id: orgId,
          branch_id: sucursalId,
          user_id: user.id,
          check_in: new Date().toISOString(),
        })
        .select('id, organization_id, branch_id, user_id, check_in, check_out, created_at')
        .single()

      if (error) {
        return {
          success: false,
          action: null,
          error: `Error al registrar entrada: ${error.message}`,
        }
      }

      return {
        success: true,
        action: 'entrada',
        record: data as AttendanceRecord,
        message: 'Entrada registrada',
      }
    }

    // CASO 2: REGISTRAR SALIDA
    const { error: updateError } = await supabase
      .from('attendance')
      .update({ check_out: new Date().toISOString() })
      .eq('id', fichajeActivo.id)

    if (updateError) {
      return {
        success: false,
        action: null,
        error: `Error al registrar salida: ${updateError.message}`,
      }
    }

    return {
      success: true,
      action: 'salida',
      message: 'Salida registrada',
    }
  } catch (error) {
    return {
      success: false,
      action: null,
      error: error instanceof Error ? error.message : 'Error desconocido al procesar fichaje',
    }
  }
}

/**
 * Procesa el escaneo de QR para fichaje de entrada/salida
 *
 * FLUJO:
 * 1. Valida sesión y obtiene organization_id
 * 2. Valida que el QR pertenezca a una sucursal válida
 * 3. ENTRADA: Registra nueva entrada si no existe fichaje activo
 * 4. SALIDA: Actualiza salida si existe fichaje activo
 *
 * @param qrData - Datos parseados del QR escaneado
 * @param sucursalId - ID de la sucursal (validación adicional)
 * @returns ProcessQRScanResult - Resultado de la operación
 */
export async function processQRScanAction(
  qrData: QRFichajeData,
  sucursalId: string
): Promise<ProcessQRScanResult> {
  try {
    const supabase = await createClient()

    if (!qrData.sucursal_id || !sucursalId) {
      return {
        success: false,
        action: null,
        error: 'Datos de sucursal incompletos',
      }
    }

    // Validar que el QR pertenezca a la sucursal correcta
    if (qrData.sucursal_id !== sucursalId) {
      return {
        success: false,
        action: null,
        error: 'El QR escaneado no pertenece a esta sucursal',
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        action: null,
        error: 'No hay sesión activa',
      }
    }

    const { data: orgId } = await supabase.rpc('get_my_org_id')

    if (!orgId) {
      return {
        success: false,
        action: null,
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // CASO 1: REGISTRAR ENTRADA
    if (qrData.tipo === 'entrada') {
      // Verificar que no exista un fichaje activo
      const { data: fichajeActivo } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', user.id)
        .eq('branch_id', qrData.sucursal_id)
        .is('check_out', null)
        .maybeSingle()

      if (fichajeActivo) {
        return {
          success: false,
          action: null,
          error: 'Ya tienes un fichaje activo en esta sucursal',
        }
      }

      const { error } = await supabase
        .from('attendance')
        .insert({
          organization_id: orgId,
          branch_id: qrData.sucursal_id,
          user_id: user.id,
          check_in: new Date().toISOString(),
        })

      if (error) {
        return {
          success: false,
          action: null,
          error: `Error al registrar entrada: ${error.message}`,
        }
      }

      return {
        success: true,
        action: 'entrada',
        message: `Entrada registrada en ${qrData.sucursal_nombre}`,
      }
    }

    // CASO 2: REGISTRAR SALIDA
    if (qrData.tipo === 'salida') {
      const { data: asistenciaActual } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', user.id)
        .eq('branch_id', qrData.sucursal_id)
        .is('check_out', null)
        .maybeSingle()

      if (!asistenciaActual) {
        return {
          success: false,
          action: null,
          error: 'No tienes una entrada registrada en este local',
        }
      }

      const { error } = await supabase
        .from('attendance')
        .update({ check_out: new Date().toISOString() })
        .eq('id', asistenciaActual.id)

      if (error) {
        return {
          success: false,
          action: null,
          error: `Error al registrar salida: ${error.message}`,
        }
      }

      return {
        success: true,
        action: 'salida',
        message: 'Jornada finalizada correctamente',
      }
    }

    return {
      success: false,
      action: null,
      error: 'Tipo de QR no válido',
    }
  } catch (error) {
    return {
      success: false,
      action: null,
      error: error instanceof Error ? error.message : 'Error desconocido al procesar QR',
    }
  }
}
