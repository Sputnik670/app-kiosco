/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 👤 USER SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de usuarios, onboarding y contexto operativo.
 *
 * FUNCIONALIDADES:
 * 1. completeProfile: Maneja el registro inicial (Org + Perfil + Sucursal) vía RPC.
 * 2. getEmployeeDashboardContextAction: Proporciona info consolidada para dashboards.
 *
 * MIGRADO: 2026-01-27 - Schema V2 (tablas en inglés)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import { supabase as supabaseStatic } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createInitialSetup } from '@/lib/repositories/organization.repository'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

export type State = {
  errors?: {
    nombre?: string[]
    nombreNegocio?: string[]
    email?: string[]
  }
  message?: string | null
}

/**
 * Contexto para el dashboard de empleado (formato legacy para UI)
 * rol usa valores en español para compatibilidad con componentes
 */
export interface EmployeeDashboardContext {
  profile: {
    id: string
    nombre: string
    rol: 'dueño' | 'empleado'
    xp: number
  } | null
  organizationId: string
  branchName: string
  isClockedIn: boolean
  activeShift: {
    id: string
    monto_inicial: number
    fecha_apertura: string
  } | null
}

export interface GetEmployeeDashboardContextResult {
  success: boolean
  context?: EmployeeDashboardContext
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Mapea role de BD (owner/employee) a rol UI (dueño/empleado)
 */
function mapRoleToLegacy(role: string): 'dueño' | 'empleado' {
  return role === 'owner' ? 'dueño' : 'empleado'
}

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * ✅ ACTION: Completar Perfil y Crear Organización (Onboarding)
 * Usa la transacción atómica (RPC create_initial_setup).
 */
export async function completeProfile(prevState: State, formData: FormData) {
  const supabaseClient = await createClient()

  // 1. Obtener usuario autenticado
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

  if (authError || !user) {
    return {
      message: 'No se pudo verificar la sesión. Por favor, recarga la página.'
    }
  }

  // 2. Extraer datos del formulario
  const nombre = formData.get('nombre') as string
  const nombreNegocio = formData.get('nombreNegocio') as string
  const email = user.email || ''

  // 3. Validaciones básicas
  const errors: State['errors'] = {}
  if (!nombre || nombre.length < 3) errors.nombre = ['El nombre debe tener al menos 3 caracteres']
  if (!nombreNegocio || nombreNegocio.length < 3) errors.nombreNegocio = ['El nombre del negocio es requerido']

  if (Object.keys(errors).length > 0) {
    return { errors, message: 'Faltan datos requeridos.' }
  }

  try {
    console.log('Iniciando Setup Atómico para:', email)

    // 4. EJECUTAR RPC BLINDADO
    const { data, error } = await createInitialSetup({
      userId: user.id,
      profileName: nombre,
      orgName: nombreNegocio,
      email: email
    })

    if (error) {
      console.error('Error en createInitialSetup:', error)
      return {
        message: 'Error al crear la organización. Es posible que el nombre ya exista o haya un problema de conexión.'
      }
    }

    console.log('Setup completado exitosamente:', data)

  } catch (err) {
    console.error('Error inesperado:', err)
    return {
      message: 'Ocurrió un error inesperado al procesar tu solicitud.'
    }
  }

  // 5. Redirección final
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/**
 * 🎯 ACTION: Obtiene el contexto operativo completo del empleado
 *
 * Schema V2: usa memberships, branches, attendance_logs, cash_registers
 * Mapea a formato legacy para compatibilidad con componentes
 */
export async function getEmployeeDashboardContextAction(
  sucursalId: string
): Promise<GetEmployeeDashboardContextResult> {
  try {
    if (!sucursalId) {
      return { success: false, error: 'ID de sucursal requerido' }
    }

    const supabase = await createClient()

    // PASO 1: Obtener usuario
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return { success: false, error: 'No hay sesión activa' }
    }

    // PASO 2: Obtener organization_id del usuario
    const { data: orgId } = await supabase.rpc('get_my_org_id')

    if (!orgId) {
      return { success: false, error: 'No se encontró tu organización' }
    }

    // PASO 3: Consultas paralelas (Schema V2)
    const [
      membershipResult,
      branchResult,
      attendanceResult,
      cashRegisterResult,
    ] = await Promise.all([
      // 1. Membership con display_name, role, xp
      supabase
        .from('memberships')
        .select('user_id, display_name, role, xp')
        .eq('user_id', user.id)
        .eq('organization_id', orgId)
        .single(),

      // 2. Nombre de la sucursal (branches)
      supabase
        .from('branches')
        .select('name')
        .eq('id', sucursalId)
        .single(),

      // 3. Estado de asistencia (attendance)
      supabase
        .from('attendance')
        .select('id')
        .eq('user_id', user.id)
        .eq('branch_id', sucursalId)
        .is('check_out', null)
        .maybeSingle(),

      // 4. Turno de caja activo (cash_registers)
      supabase
        .from('cash_registers')
        .select('id, opening_amount, opened_at')
        .eq('opened_by', user.id)
        .eq('branch_id', sucursalId)
        .eq('is_open', true)
        .maybeSingle(),
    ])

    // PASO 4: Construir contexto (mapeo a formato legacy)
    const membershipData = membershipResult.data as {
      user_id: string
      display_name: string
      role: string
      xp: number | null
    } | null

    const context: EmployeeDashboardContext = {
      profile: membershipData ? {
        id: membershipData.user_id,
        nombre: membershipData.display_name || 'Operador',
        rol: mapRoleToLegacy(membershipData.role),
        xp: membershipData.xp || 0,
      } : null,
      organizationId: orgId,
      branchName: branchResult.data?.name || 'Sucursal',
      isClockedIn: !!attendanceResult.data,
      activeShift: cashRegisterResult.data ? {
        id: cashRegisterResult.data.id,
        monto_inicial: cashRegisterResult.data.opening_amount,
        fecha_apertura: cashRegisterResult.data.opened_at,
      } : null,
    }

    return { success: true, context }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al obtener contexto',
    }
  }
}
