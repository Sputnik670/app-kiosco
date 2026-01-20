/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 👤 USER SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de usuarios, onboarding y contexto operativo.
 * * FUNCIONALIDADES:
 * 1. completeProfile: Maneja el registro inicial (Org + Perfil + Sucursal) vía RPC.
 * 2. getEmployeeDashboardContextAction: Proporciona info consolidada para dashboards.
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

export interface EmployeeDashboardContext {
  profile: {
    id: string
    nombre: string
    rol: 'dueño' | 'empleado'
    xp: number
  } | null
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
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * ✅ ACTION: Completar Perfil y Crear Organización (Onboarding)
 * * Usa la transacción atómica (RPC create_initial_setup).
 */
export async function completeProfile(prevState: State, formData: FormData) {
  // ⚡ AWAIT IMPORTANTE: createClient es async ahora
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
    console.log('🚀 Iniciando Setup Atómico para:', email)

    // 4. EJECUTAR RPC BLINDADO
    const { data, error } = await createInitialSetup({
      userId: user.id,
      profileName: nombre,
      orgName: nombreNegocio,
      email: email
    })

    if (error) {
      console.error('❌ Error en createInitialSetup:', error)
      return {
        message: 'Error al crear la organización. Es posible que el nombre ya exista o haya un problema de conexión.'
      }
    }

    console.log('✅ Setup completado exitosamente:', data)

  } catch (err) {
    console.error('❌ Error inesperado:', err)
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
 */
export async function getEmployeeDashboardContextAction(
  sucursalId: string
): Promise<GetEmployeeDashboardContextResult> {
  try {
    if (!sucursalId) {
      return { success: false, error: 'ID de sucursal requerido' }
    }

    // ⚡ AWAIT IMPORTANTE: createClient es async ahora
    // Usamos el cliente dinámico porque necesitamos ver la sesión del usuario
    const supabase = await createClient()

    // PASO 1: Obtener usuario
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return { success: false, error: 'No hay sesión activa' }
    }

    // PASO 2: Consultas paralelas
    const [
      perfilResult,
      sucursalResult,
      asistenciaResult,
      cajaResult,
    ] = await Promise.all([
      // 1. Perfil del usuario
      supabase
        .from('perfiles')
        .select('id, nombre, rol, xp')
        .eq('id', user.id)
        .single(),

      // 2. Nombre de la sucursal
      supabase
        .from('sucursales')
        .select('nombre')
        .eq('id', sucursalId)
        .single(),

      // 3. Estado de asistencia
      supabase
        .from('asistencia')
        .select('id')
        .eq('empleado_id', user.id)
        .eq('sucursal_id', sucursalId)
        .is('salida', null)
        .maybeSingle(),

      // 4. Turno de caja activo
      supabase
        .from('caja_diaria')
        .select('id, monto_inicial, fecha_apertura')
        .eq('empleado_id', user.id)
        .eq('sucursal_id', sucursalId)
        .is('fecha_cierre', null)
        .maybeSingle(),
    ])

    // PASO 3: Construir contexto
    const context: EmployeeDashboardContext = {
      profile: perfilResult.data as EmployeeDashboardContext['profile'],
      branchName: sucursalResult.data?.nombre || 'Sucursal',
      isClockedIn: !!asistenciaResult.data,
      activeShift: cajaResult.data as EmployeeDashboardContext['activeShift'],
    }

    return { success: true, context }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al obtener contexto',
    }
  }
}