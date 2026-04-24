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
import { verifyAuth } from '@/lib/actions/auth-helpers'
import { toggleAttendanceSchema, processQRScanSchema, getZodError } from '@/lib/validations'

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
 * Resultado de búsqueda de sucursal activa del empleado
 */
export interface GetActiveBranchResult {
  success: boolean
  branchId: string | null
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
    if (!sucursalId) {
      return {
        success: false,
        activeRecord: null,
        error: 'ID de sucursal requerido',
      }
    }

    const { supabase, user } = await verifyAuth()

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
    const parsed = toggleAttendanceSchema.safeParse({ sucursalId })
    if (!parsed.success) {
      return { success: false, action: null, error: getZodError(parsed) }
    }

    const { supabase, user, orgId } = await verifyAuth()

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
    const parsed = processQRScanSchema.safeParse({ qrData, sucursalId })
    if (!parsed.success) {
      return { success: false, action: null, error: getZodError(parsed) }
    }

    // Validar que el QR pertenezca a la sucursal correcta
    if (qrData.sucursal_id !== sucursalId) {
      return {
        success: false,
        action: null,
        error: 'El QR escaneado no pertenece a esta sucursal',
      }
    }

    const { supabase, user, orgId } = await verifyAuth()

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

// ───────────────────────────────────────────────────────────────────────────────
// FICHAJE POR TARJETA QR DE EMPLEADO (nuevo modelo, 2026-04-23)
// ───────────────────────────────────────────────────────────────────────────────
//
// Cada membership tiene un qr_code UUID único. El dueño imprime una tarjeta por
// empleado (ver tarjeta-qr-empleado.tsx). El kiosco tiene un scanner que corre
// bajo la sesión del dueño/manager. Cuando el empleado llega, se escanea su
// tarjeta y el servidor resuelve qr_code → user_id → abre o cierra turno.
//
// DIFERENCIAS CON processQRScanAction (flujo viejo):
// - Viejo: empleado loguea su cuenta en su celular + escanea QR de sucursal.
// - Nuevo: dueño loguea su cuenta en celular del kiosco + escanea tarjeta del
//   empleado. El QR identifica al empleado, no a la sucursal.
//
// SEGURIDAD:
// - Solo un authenticated user con acceso a la org puede disparar scans.
// - El qr_code se resuelve SERVER-SIDE contra memberships de la misma org.
// - No hay trust del cliente: el client no dice quién es el empleado, el QR sí.

/**
 * Resultado del scan de tarjeta QR de empleado
 */
export interface ProcessEmployeeQRScanResult {
  success: boolean
  action: 'entrada' | 'salida' | null
  employeeName?: string
  hoursWorked?: number       // Horas decimal (ej: 8.25 = 8h 15min). Solo en salida.
  minutesWorked?: number     // Minutos totales. Solo en salida. Para mostrar "8h 15min".
  message?: string
  error?: string
}

/**
 * Procesa el escaneo de la tarjeta QR de un empleado.
 *
 * Modelo (actualizado 2026-04-23): el empleado se loguea en su propio celular
 * y escanea SU PROPIA tarjeta QR desde vista-empleado para abrir/cerrar turno.
 * La tarjeta QR funciona como token físico anti-fraude: al requerir la tarjeta
 * impresa, un empleado no puede fichar desde su casa ni fichar por un compañero.
 *
 * FLUJO:
 * 1. Valida sesión del usuario logueado (el empleado que ficha).
 * 2. Resuelve qrCode → membership, validando misma organización.
 * 3. OWNERSHIP: rechaza si el QR no pertenece al usuario logueado.
 * 4. Busca fichaje activo del empleado (check_out IS NULL en la org).
 * 5. Si no hay activo → INSERT nuevo fichaje (entrada).
 * 6. Si hay activo → UPDATE check_out = now() + calcula horas trabajadas (salida).
 *
 * @param qrCode - UUID del qr_code de la tarjeta escaneada
 * @param branchId - Sucursal en la que trabaja el empleado (la de su sesión)
 * @returns ProcessEmployeeQRScanResult - action, employeeName, horas si salida
 */
export async function processEmployeeQRScanAction(
  qrCode: string,
  branchId: string
): Promise<ProcessEmployeeQRScanResult> {
  try {
    // Validación básica de formato UUID (cheap check antes de ir a DB)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!qrCode || !uuidRegex.test(qrCode)) {
      return {
        success: false,
        action: null,
        error: 'Tarjeta QR no válida',
      }
    }
    if (!branchId || !uuidRegex.test(branchId)) {
      return {
        success: false,
        action: null,
        error: 'Sucursal requerida para el fichaje',
      }
    }

    const { supabase, user, orgId } = await verifyAuth()

    // 1) Resolver QR → membership, validando misma org y empleado activo
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('id, user_id, display_name, is_active, organization_id')
      .eq('qr_code', qrCode)
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .maybeSingle()

    if (membershipError) {
      return {
        success: false,
        action: null,
        error: `Error al resolver tarjeta: ${membershipError.message}`,
      }
    }
    if (!membership) {
      return {
        success: false,
        action: null,
        error: 'Tarjeta no encontrada o empleado inactivo en esta organización',
      }
    }

    // 1.bis) OWNERSHIP: el empleado solo ficha con SU propia tarjeta.
    // Si el usuario logueado escanea la tarjeta de otro compañero, se rechaza.
    // Mantiene limpia la trazabilidad de ventas, misiones y ranking.
    if (membership.user_id !== user.id) {
      return {
        success: false,
        action: null,
        error: 'Esta tarjeta no es tuya. Usá tu propia tarjeta para fichar.',
      }
    }

    const employeeUserId = membership.user_id as string
    const employeeName = membership.display_name as string

    // 2) Validar que la sucursal pertenece a la org (defensivo).
    //    OJO: la columna es `name`, no `nombre` — un typo acá hace que el select
    //    falle y el empleado vea "Sucursal no válida". Solo pedimos `id` porque
    //    el nombre no se usa después.
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id')
      .eq('id', branchId)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (branchError || !branch) {
      return {
        success: false,
        action: null,
        error: 'Sucursal no válida para esta organización',
      }
    }

    // 3) Buscar fichaje activo del empleado EN LA ORG (no solo en esta sucursal:
    //    el empleado no puede tener dos turnos abiertos simultáneos aunque
    //    sean en sucursales distintas)
    const { data: fichajeActivo, error: fichajeError } = await supabase
      .from('attendance')
      .select('id, branch_id, check_in, check_out')
      .eq('user_id', employeeUserId)
      .eq('organization_id', orgId)
      .is('check_out', null)
      .order('check_in', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fichajeError) {
      return {
        success: false,
        action: null,
        error: `Error al consultar fichaje activo: ${fichajeError.message}`,
      }
    }

    const now = new Date()

    // CASO A: ABRIR TURNO (entrada)
    if (!fichajeActivo) {
      const { error: insertError } = await supabase
        .from('attendance')
        .insert({
          organization_id: orgId,
          branch_id: branchId,
          user_id: employeeUserId,
          check_in: now.toISOString(),
        })

      if (insertError) {
        return {
          success: false,
          action: null,
          error: `Error al registrar entrada: ${insertError.message}`,
        }
      }

      return {
        success: true,
        action: 'entrada',
        employeeName,
        message: `Entrada registrada — ${employeeName}`,
      }
    }

    // CASO B: CERRAR TURNO (salida)
    const { error: updateError } = await supabase
      .from('attendance')
      .update({ check_out: now.toISOString() })
      .eq('id', fichajeActivo.id)

    if (updateError) {
      return {
        success: false,
        action: null,
        error: `Error al registrar salida: ${updateError.message}`,
      }
    }

    // Calcular horas trabajadas (para el dueño, no para el empleado)
    const checkInMs = new Date(fichajeActivo.check_in as string).getTime()
    const checkOutMs = now.getTime()
    const diffMinutes = Math.max(0, Math.round((checkOutMs - checkInMs) / 60000))
    const hoursDecimal = Number((diffMinutes / 60).toFixed(2))

    return {
      success: true,
      action: 'salida',
      employeeName,
      hoursWorked: hoursDecimal,
      minutesWorked: diffMinutes,
      message: `Salida registrada — ${employeeName}`,
    }
  } catch (error) {
    return {
      success: false,
      action: null,
      error: error instanceof Error ? error.message : 'Error desconocido al procesar tarjeta QR',
    }
  }
}

/**
 * Lista empleados de la org con su qr_code para que el dueño genere tarjetas
 *
 * USO: Pantalla "Tarjetas QR de empleados" en el dashboard del dueño.
 * Solo owners pueden listar los QR (son credenciales de fichaje).
 *
 * @returns { success, employees: [{ user_id, display_name, qr_code, role, is_active }] }
 */
export async function listEmployeeQRCardsAction(): Promise<{
  success: boolean
  employees?: Array<{
    user_id: string
    display_name: string
    qr_code: string
    role: 'owner' | 'admin' | 'employee'
    is_active: boolean
  }>
  error?: string
}> {
  try {
    const { supabase, orgId } = await verifyAuth()

    // Solo owner puede listar QRs de empleados (son credenciales)
    const { data: isOwner } = await supabase.rpc('is_owner')
    if (!isOwner) {
      return { success: false, error: 'Solo el dueño puede ver las tarjetas QR' }
    }

    const { data, error } = await supabase
      .from('memberships')
      .select('user_id, display_name, qr_code, role, is_active')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('role', { ascending: true })       // owner/admin primero
      .order('display_name', { ascending: true })

    if (error) {
      return { success: false, error: `Error al listar empleados: ${error.message}` }
    }

    return {
      success: true,
      employees: (data || []) as Array<{
        user_id: string
        display_name: string
        qr_code: string
        role: 'owner' | 'admin' | 'employee'
        is_active: boolean
      }>,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Obtiene la sucursal donde el empleado debe trabajar.
 *
 * Prioridad:
 *   1. Si hay turno activo (attendance sin check_out) → devolver esa branch.
 *   2. Fallback: leer membership.branch_id del empleado (asignada por el dueño
 *      al crearlo). Con el pivot de fichaje por tarjeta (2026-04-23), el QR
 *      del local ya no existe — el empleado ya tiene sucursal en membership.
 *
 * USO: page.tsx → sincronizarSucursal. Evita que el empleado caiga en la
 * pantalla vieja "Escanea el QR del local" antes de su primer fichaje.
 *
 * @returns GetActiveBranchResult - branch_id o null si tampoco hay asignada
 */
export async function getActiveBranchAction(): Promise<GetActiveBranchResult> {
  try {
    const { supabase, user } = await verifyAuth()

    // 1) Turno activo
    const { data: activeAttendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('branch_id')
      .eq('user_id', user.id)
      .is('check_out', null)
      .maybeSingle()

    if (attendanceError) {
      return {
        success: false,
        branchId: null,
        error: `Error al consultar fichaje activo: ${attendanceError.message}`,
      }
    }

    if (activeAttendance?.branch_id) {
      return { success: true, branchId: activeAttendance.branch_id }
    }

    // 2) Fallback: branch asignada en la membership activa del empleado
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('branch_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (membershipError) {
      return {
        success: false,
        branchId: null,
        error: `Error al leer membership: ${membershipError.message}`,
      }
    }


    return {
      success: true,
      branchId: membership?.branch_id ?? null,
    }
  } catch (error) {
    return {
      success: false,
      branchId: null,
      error: error instanceof Error ? error.message : 'Error desconocido al obtener sucursal activa',
    }
  }
}
