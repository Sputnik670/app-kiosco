/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔐 AUTH SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de autenticación.
 * Maneja login, registro y magic links de forma segura.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Autenticación con Supabase Auth
 * - Manejo seguro de redirects
 * - Mensajes de error claros
 *
 * ORIGEN: Refactorización de auth-form.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Resultado de operaciones de autenticación
 */
export interface AuthResult {
  success: boolean
  message?: string
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 🔓 Inicia sesión con email y contraseña
 *
 * MÉTODO: signInWithPassword
 * USO: Para dueños o empleados que ya configuraron contraseña
 *
 * @param email - Email del usuario
 * @param password - Contraseña
 * @returns AuthResult - Resultado de la operación
 */
export async function signInWithPasswordAction(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    // Validaciones básicas
    if (!email || !password) {
      return {
        success: false,
        error: 'Email y contraseña son requeridos',
      }
    }

    const supabaseServer = await createClient()
    const { error } = await supabaseServer.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'Credenciales inválidas',
      }
    }

    return {
      success: true,
      message: '¡Bienvenido! Has iniciado sesión correctamente.',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al iniciar sesión',
    }
  }
}

/**
 * 📝 Registra un nuevo usuario con email y contraseña
 *
 * MÉTODO: signUp
 * USO: Para nuevos dueños que crean su cuenta
 *
 * @param email - Email del nuevo usuario
 * @param password - Contraseña
 * @returns AuthResult - Resultado de la operación
 */
export async function signUpAction(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    // Validaciones básicas
    if (!email || !password) {
      return {
        success: false,
        error: 'Email y contraseña son requeridos',
      }
    }

    if (password.length < 6) {
      return {
        success: false,
        error: 'La contraseña debe tener al menos 6 caracteres',
      }
    }

    const supabaseServer = await createClient()
    const { error } = await supabaseServer.auth.signUp({
      email,
      password,
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'Error al registrar usuario',
      }
    }

    return {
      success: true,
      message: 'Registro exitoso. Revisa tu correo para confirmar tu cuenta.',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al registrar',
    }
  }
}

/**
 * ✨ Envía un Magic Link (enlace de acceso sin contraseña)
 *
 * MÉTODO: signInWithOtp
 * USO: Para empleados invitados o usuarios que olvidaron su contraseña
 *
 * CONFIGURACIÓN:
 * - shouldCreateUser: false (solo para usuarios existentes)
 * - emailRedirectTo: URL base de la aplicación
 *
 * @param email - Email del usuario
 * @param redirectTo - URL base para redirección (opcional, se obtiene del entorno)
 * @returns AuthResult - Resultado de la operación
 */
export async function signInWithMagicLinkAction(
  email: string,
  redirectTo?: string
): Promise<AuthResult> {
  try {
    // Validación básica
    if (!email) {
      return {
        success: false,
        error: 'Email es requerido',
      }
    }

    // Determinar URL de redirección
    // Prioridad: 1) Parámetro, 2) Variable de entorno, 3) Localhost (desarrollo)
    const emailRedirectTo =
      redirectTo ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL ||
      'http://localhost:3000'

    const supabaseServer = await createClient()
    const { error } = await supabaseServer.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
        shouldCreateUser: false, // Solo enviamos link si el usuario ya existe
      },
    })

    if (error) {
      // Mensajes de error personalizados
      if (error.message.includes('not found')) {
        return {
          success: false,
          error: 'No existe una cuenta con este email. Contacta a tu administrador.',
        }
      }

      return {
        success: false,
        error: error.message || 'Error al enviar el enlace',
      }
    }

    return {
      success: true,
      message: 'Enlace enviado. Revisa tu correo y haz clic en el enlace para entrar.',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al enviar magic link',
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// GESTIÓN DE PERSONAL (STAFF MANAGEMENT)
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Datos de gestión de personal
 */
export interface StaffManagementData {
  success: boolean
  sucursales: Array<{ id: string; nombre: string }>
  invites: Array<{
    id: string
    email: string
    created_at: string
    sucursales: { nombre: string } | null
  }>
  empleados: Array<{
    id: string
    nombre: string
    email: string | null
    rol: string
    sucursal_id: string
    sucursales: { nombre: string } | null
  }>
  organizationId?: string
  error?: string
}

/**
 * 👥 Obtiene todos los datos necesarios para gestión de personal
 *
 * FLUJO:
 * 1. Obtiene organization_id usando get_my_org_id_v2() (lee de user_organization_roles)
 * 2. Consulta sucursales de la organización
 * 3. Consulta invitaciones pendientes
 * 4. Consulta empleados desde user_organization_roles + perfiles
 *
 * @returns StaffManagementData - Datos de gestión de personal
 */
export async function getStaffManagementDataAction(): Promise<StaffManagementData> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        sucursales: [],
        invites: [],
        empleados: [],
        error: 'No hay sesión activa',
      }
    }

    // Obtener organization_id desde user_organization_roles
    const { data: orgId } = await supabase.rpc('get_my_org_id_v2')

    if (!orgId) {
      return {
        success: false,
        sucursales: [],
        invites: [],
        empleados: [],
        error: 'No se encontró la organización',
      }
    }

    // Cargar sucursales
    const { data: sucursales } = await supabase
      .from('sucursales')
      .select('id, nombre')
      .eq('organization_id', orgId)

    // Cargar invitaciones pendientes
    const { data: invites } = await supabase
      .from('pending_invites')
      .select('*, sucursales(nombre)')
      .eq('organization_id', orgId)

    // Cargar empleados desde user_organization_roles
    const { data: rolesEmpleados } = await supabase
      .from('user_organization_roles')
      .select(`
        user_id,
        role,
        sucursal_id,
        sucursales(nombre),
        is_active
      `)
      .eq('organization_id', orgId)
      .eq('role', 'employee')
      .eq('is_active', true)

    // Obtener nombres desde perfiles para los empleados
    const empleadoIds = rolesEmpleados?.map(r => r.user_id) || []
    let empleadosConNombre: Array<{
      id: string
      nombre: string
      email: string | null
      rol: string
      sucursal_id: string
      sucursales: { nombre: string } | null
    }> = []

    if (empleadoIds.length > 0) {
      const { data: perfilesEmpleados } = await supabase
        .from('perfiles')
        .select('id, nombre, email')
        .in('id', empleadoIds)

      // Mapear con la info de roles
      empleadosConNombre = (rolesEmpleados || []).map(role => {
        const perfil = perfilesEmpleados?.find(p => p.id === role.user_id)
        // Supabase puede devolver array o objeto para relaciones
        const sucursalData = Array.isArray(role.sucursales)
          ? role.sucursales[0]
          : role.sucursales
        return {
          id: role.user_id,
          nombre: perfil?.nombre || 'Sin nombre',
          email: perfil?.email || null,
          rol: 'empleado', // Mapear 'employee' -> 'empleado' para compatibilidad
          sucursal_id: role.sucursal_id || '',
          sucursales: sucursalData as { nombre: string } | null,
        }
      })
    }

    return {
      success: true,
      sucursales: sucursales || [],
      invites: (invites || []) as StaffManagementData['invites'],
      empleados: empleadosConNombre,
      organizationId: orgId,
    }
  } catch (error) {
    return {
      success: false,
      sucursales: [],
      invites: [],
      empleados: [],
      error: error instanceof Error ? error.message : 'Error desconocido al cargar datos',
    }
  }
}

/**
 * Resultado de invitación de empleado
 */
export interface InviteEmployeeResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * 📧 Invita a un empleado y envía Magic Link
 *
 * @param email - Email del empleado a invitar
 * @param sucursalId - ID de la sucursal asignada
 * @returns InviteEmployeeResult - Resultado de la operación
 */
export async function inviteEmployeeAction(
  email: string,
  sucursalId: string
): Promise<InviteEmployeeResult> {
  try {
    if (!email || !email.includes('@')) {
      return {
        success: false,
        error: 'Email inválido',
      }
    }

    if (!sucursalId) {
      return {
        success: false,
        error: 'Debes asignar una sucursal de trabajo',
      }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        error: 'No hay sesión activa',
      }
    }

    // Obtener organization_id desde user_organization_roles
    const { data: orgId } = await supabase.rpc('get_my_org_id_v2')

    if (!orgId) {
      return {
        success: false,
        error: 'Error de sesión',
      }
    }
    const normalizedEmail = email.trim().toLowerCase()

    // Insertar invitación en base de datos
    const { data: invite, error: dbError } = await supabase
      .from('pending_invites')
      .insert([{
        email: normalizedEmail,
        organization_id: orgId,
        sucursal_id: sucursalId,
      }])
      .select('token')
      .single<{ token: string }>()

    if (dbError) {
      if (dbError.code === '23505') {
        return {
          success: false,
          error: 'Este email ya tiene una invitación pendiente',
        }
      }
      return {
        success: false,
        error: `Error al registrar invitación: ${dbError.message}`,
      }
    }

    if (!invite?.token) {
      return {
        success: false,
        error: 'Error al generar token de invitación',
      }
    }

    // Enviar Magic Link
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL ||
      'http://localhost:3000'

    const emailRedirectTo = `${baseUrl}/signup?token=${invite.token}`

    const { error: magicLinkError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo,
        shouldCreateUser: true,
      },
    })

    if (magicLinkError) {
      return {
        success: false,
        error: `Error al enviar Magic Link: ${magicLinkError.message}`,
      }
    }

    return {
      success: true,
      message: 'Invitación enviada. Se vinculará automáticamente al kiosco asignado.',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al invitar empleado',
    }
  }
}

/**
 * ❌ Cancela una invitación pendiente
 *
 * @param inviteId - ID de la invitación a cancelar
 * @returns AuthResult - Resultado de la operación
 *
 * ORIGEN: Refactorización de borrarInvite() líneas 117-123
 */
export async function cancelInviteAction(inviteId: string): Promise<AuthResult> {
  try {
    const supabase = await createClient()
    if (!inviteId) {
      return {
        success: false,
        error: 'ID de invitación requerido',
      }
    }

    const { error } = await supabase
      .from('pending_invites')
      .delete()
      .eq('id', inviteId)

    if (error) {
      return {
        success: false,
        error: `Error al cancelar invitación: ${error.message}`,
      }
    }

    return {
      success: true,
      message: 'Invitación cancelada',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al cancelar invitación',
    }
  }
}

/**
 * 🗑️ Elimina un empleado (desvincula del sistema)
 *
 * @param perfilId - ID del perfil a eliminar
 * @returns AuthResult - Resultado de la operación
 *
 * ORIGEN: Refactorización de desvincularEmpleado() líneas 125-133
 */
export async function removeEmployeeAction(perfilId: string): Promise<AuthResult> {
  try {
    const supabase = await createClient()
    if (!perfilId) {
      return {
        success: false,
        error: 'ID de perfil requerido',
      }
    }

    const { error } = await supabase
      .from('perfiles')
      .delete()
      .eq('id', perfilId)

    if (error) {
      return {
        success: false,
        error: `Error al desvincular empleado: ${error.message}`,
      }
    }

    return {
      success: true,
      message: 'Empleado dado de baja',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al eliminar empleado',
    }
  }
}

/**
 * 📧 Verifica si existe una invitación pendiente válida para un email y token
 *
 * FLUJO:
 * 1. Busca en pending_invites por email y token
 * 2. Valida que no esté expirada (expires_at > now)
 * 3. Si es válida, devuelve los datos de organización y sucursal
 *
 * SEGURIDAD:
 * - Doble validación: email + token
 * - Verificación de expiración
 * - RLS filtra por organization_id automáticamente
 *
 * @param email - Email del usuario a verificar
 * @param token - Token único de la invitación (opcional para compatibilidad)
 * @returns CheckInvitationResult - Datos de la invitación o null
 *
 * ORIGEN: Refactorización de profile-setup.tsx líneas 31-80
 */
export async function checkInvitationAction(
  email: string,
  token?: string
): Promise<{
  success: boolean
  invitation?: {
    organization_id: string
    sucursal_id: string | null
  } | null
  error?: string
}> {
  try {
    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!email) {
      return {
        success: false,
        error: 'Email requerido',
      }
    }

    const emailNormalizado = email.toLowerCase().trim()
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Buscar invitación pendiente válida (no expirada)
    // ───────────────────────────────────────────────────────────────────────────

    let query = supabase
      .from('pending_invites')
      .select('organization_id, sucursal_id, expires_at')
      .eq('email', emailNormalizado)
      .gt('expires_at', new Date().toISOString())

    // Si se proporciona token, validar también el token (seguridad adicional)
    if (token) {
      query = query.eq('token', token)
    }

    const { data: invitacion, error } = await query.maybeSingle<{
      organization_id: string
      sucursal_id: string | null
      expires_at: string
    }>()

    if (error) {
      console.error('Error buscando invitación:', error)
      return {
        success: false,
        error: `Error al buscar invitación: ${error.message}`,
      }
    }

    if (!invitacion) {
      return {
        success: true,
        invitation: null,
      }
    }

    // Verificar expiración (doble check)
    const expiresAt = new Date(invitacion.expires_at)
    if (expiresAt < new Date()) {
      return {
        success: false,
        error: 'La invitación ha expirado. Solicita una nueva invitación.',
      }
    }

    return {
      success: true,
      invitation: {
        organization_id: invitacion.organization_id,
        sucursal_id: invitacion.sucursal_id,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al verificar invitación',
    }
  }
}

/**
 * 👤 Completa el proceso de configuración de perfil (registro)
 *
 * FLUJO:
 * 1. Valida si el rol ya existe (idempotencia)
 * 2. Caso Dueño: Usa create_initial_setup_v2()
 * 3. Caso Empleado: Usa complete_employee_setup_v2()
 *
 * @param formData - Datos del formulario de registro
 * @returns CompleteProfileSetupResult - Resultado de la operación
 */
export async function completeProfileSetupAction(formData: {
  userId: string
  email: string
  name: string
  role: 'dueño' | 'empleado'
}): Promise<{
  success: boolean
  role?: 'dueño' | 'empleado'
  message?: string
  error?: string
}> {
  try {
    if (!formData.userId || !formData.email || !formData.name || !formData.role) {
      return {
        success: false,
        error: 'Faltan datos requeridos',
      }
    }

    const { userId, email, name, role } = formData
    const emailNormalizado = email.toLowerCase().trim()
    const supabase = await createClient()

    // Verificación de idempotencia
    const { data: existingRole } = await supabase
      .from('user_organization_roles')
      .select('id, role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle()

    if (existingRole) {
      const mappedRole = existingRole.role === 'owner' ? 'dueño' : 'empleado'
      return {
        success: true,
        role: mappedRole as 'dueño' | 'empleado',
        message: 'Usuario ya configurado',
      }
    }

    // CASO DUEÑO
    if (role === 'dueño') {
      const { error: setupError } = await supabase.rpc('create_initial_setup_v2', {
        p_user_id: userId,
        p_org_name: `Kiosco de ${name}`,
        p_profile_name: name,
        p_email: emailNormalizado,
      })

      if (setupError) {
        console.error('Error en create_initial_setup_v2:', setupError)
        return {
          success: false,
          error: `Error al crear organización: ${setupError.message}`,
        }
      }

      return {
        success: true,
        role: 'dueño',
        message: '¡Cuenta configurada! Ya tienes acceso y contraseña.',
      }
    }

    // CASO EMPLEADO
    if (role === 'empleado') {
      const { error: employeeError } = await supabase.rpc('complete_employee_setup_v2', {
        p_user_id: userId,
        p_profile_name: name,
        p_email: emailNormalizado,
      })

      if (employeeError) {
        console.error('Error en complete_employee_setup_v2:', employeeError)
        return {
          success: false,
          error: `No se encontró invitación válida para ${email}. La invitación puede haber expirado o no existe. Pide al dueño que te invite de nuevo.`,
        }
      }

      return {
        success: true,
        role: 'empleado',
        message: '¡Cuenta configurada! Ya tienes acceso y contraseña.',
      }
    }

    return {
      success: false,
      error: 'Rol no válido',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al completar registro',
    }
  }
}
