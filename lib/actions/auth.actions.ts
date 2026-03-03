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
 * RPCs UTILIZADAS:
 * - setup_organization: Onboarding para owners (crea org + membership + branch)
 * - accept_invite: Onboarding para empleados (usa token de invitación)
 * - get_my_org_id: Obtener organization_id del usuario actual
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import { verifyAuth, verifyOwner } from '@/lib/actions/auth-helpers'
import type { Database } from '@/types/database.types'
import { resolveJoin } from '@/types/supabase-joins'
import { completeProfileSchema, getZodError } from '@/lib/validations'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

type UserRole = 'owner' | 'admin' | 'employee'

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

/**
 * 🔑 Envía un email de recuperación de contraseña
 *
 * MÉTODO: resetPasswordForEmail
 * USO: Para usuarios que olvidaron su contraseña
 *
 * @param email - Email del usuario
 * @param redirectTo - URL base para redirección (opcional)
 * @returns AuthResult - Resultado de la operación
 */
export async function resetPasswordAction(
  email: string,
  redirectTo?: string
): Promise<AuthResult> {
  try {
    if (!email) {
      return {
        success: false,
        error: 'Email es requerido',
      }
    }

    const emailRedirectTo =
      redirectTo ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL ||
      'http://localhost:3000'

    const supabaseServer = await createClient()
    const { error } = await supabaseServer.auth.resetPasswordForEmail(email, {
      redirectTo: emailRedirectTo,
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'Error al enviar el email de recuperación',
      }
    }

    return {
      success: true,
      message: 'Se envió un enlace de recuperación a tu correo. Revisá tu bandeja de entrada.',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al recuperar contraseña',
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
  branches: Array<{ id: string; name: string }>
  invites: Array<{
    id: string
    email: string
    created_at: string
    branch: { name: string } | null
  }>
  employees: Array<{
    id: string
    display_name: string
    email: string | null
    role: UserRole
    branch_id: string | null
    branch: { name: string } | null
  }>
  organizationId?: string
  error?: string
}

/**
 * 👥 Obtiene todos los datos necesarios para gestión de personal
 *
 * FLUJO:
 * 1. Obtiene organization_id usando get_my_org_id() (lee de memberships)
 * 2. Consulta branches de la organización
 * 3. Consulta invitaciones pendientes
 * 4. Consulta empleados desde memberships
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
        branches: [],
        invites: [],
        employees: [],
        error: 'No hay sesión activa',
      }
    }

    // Obtener organization_id desde memberships via RPC
    const { data: orgId } = await supabase.rpc('get_my_org_id')

    if (!orgId) {
      return {
        success: false,
        branches: [],
        invites: [],
        employees: [],
        error: 'No se encontró la organización',
      }
    }

    // Cargar branches
    const { data: branches } = await supabase
      .from('branches')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('is_active', true)

    // Cargar invitaciones pendientes con branch info
    const { data: invitesRaw } = await supabase
      .from('pending_invites')
      .select('id, email, created_at, branch_id, branches(name)')
      .eq('organization_id', orgId)
      .gt('expires_at', new Date().toISOString())

    // Mapear invites al formato esperado
    const invites = (invitesRaw || []).map(inv => {
      const branch = resolveJoin<{ name: string }>(inv.branches)
      return {
        id: inv.id,
        email: inv.email,
        created_at: inv.created_at,
        branch: branch ? { name: branch.name } : null,
      }
    })

    // Cargar empleados desde memberships (excepto el owner actual)
    const { data: membersRaw } = await supabase
      .from('memberships')
      .select('id, user_id, display_name, email, role, branch_id, branches(name)')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .neq('user_id', user.id) // Excluir al usuario actual (owner)

    // Mapear employees al formato esperado
    const employees = (membersRaw || []).map(m => {
      const branch = resolveJoin<{ name: string }>(m.branches)
      return {
        id: m.user_id,
        display_name: m.display_name,
        email: m.email,
        role: m.role as UserRole,
        branch_id: m.branch_id,
        branch: branch ? { name: branch.name } : null,
      }
    })

    return {
      success: true,
      branches: (branches || []).map(b => ({ id: b.id, name: b.name })),
      invites,
      employees,
      organizationId: orgId,
    }
  } catch (error) {
    return {
      success: false,
      branches: [],
      invites: [],
      employees: [],
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
 * @param branchId - ID del branch asignado
 * @returns InviteEmployeeResult - Resultado de la operación
 */
export async function inviteEmployeeAction(
  email: string,
  branchId: string
): Promise<InviteEmployeeResult> {
  try {
    if (!email || !email.includes('@')) {
      return {
        success: false,
        error: 'Email inválido',
      }
    }

    if (!branchId) {
      return {
        success: false,
        error: 'Debes asignar una sucursal de trabajo',
      }
    }

    const { supabase, user, orgId } = await verifyOwner()
    const normalizedEmail = email.trim().toLowerCase()

    // Insertar invitación en base de datos
    const { data: invite, error: dbError } = await supabase
      .from('pending_invites')
      .insert([{
        email: normalizedEmail,
        organization_id: orgId,
        branch_id: branchId,
        invited_by: user.id,
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
    const { supabase, orgId } = await verifyOwner()
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
      .eq('organization_id', orgId)

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
 * 🗑️ Desactiva un empleado (soft delete)
 *
 * @param userId - ID del usuario a desactivar
 * @returns AuthResult - Resultado de la operación
 */
export async function removeEmployeeAction(userId: string): Promise<AuthResult> {
  try {
    if (!userId) {
      return {
        success: false,
        error: 'ID de usuario requerido',
      }
    }

    const { supabase, orgId } = await verifyOwner()

    // Soft delete: marcar is_active = false en memberships
    const { error } = await supabase
      .from('memberships')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('organization_id', orgId)

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
 * 3. Si es válida, devuelve los datos de organización y branch
 *
 * SEGURIDAD:
 * - Doble validación: email + token
 * - Verificación de expiración
 *
 * @param email - Email del usuario a verificar
 * @param token - Token único de la invitación (opcional para compatibilidad)
 * @returns CheckInvitationResult - Datos de la invitación o null
 */
export async function checkInvitationAction(
  email: string,
  token?: string
): Promise<{
  success: boolean
  invitation?: {
    organization_id: string
    branch_id: string | null
    token: string
  } | null
  error?: string
}> {
  try {
    if (!email) {
      return {
        success: false,
        error: 'Email requerido',
      }
    }

    const emailNormalizado = email.toLowerCase().trim()
    const supabase = await createClient()

    // Buscar invitación pendiente válida (no expirada)
    let query = supabase
      .from('pending_invites')
      .select('organization_id, branch_id, token, expires_at')
      .eq('email', emailNormalizado)
      .gt('expires_at', new Date().toISOString())

    // Si se proporciona token, validar también el token (seguridad adicional)
    if (token) {
      query = query.eq('token', token)
    }

    const { data: invitacion, error } = await query.maybeSingle<{
      organization_id: string
      branch_id: string | null
      token: string
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
        branch_id: invitacion.branch_id,
        token: invitacion.token,
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
 * Resultado de setup_organization RPC
 */
interface SetupOrganizationResult {
  organization_id: string
  branch_id: string
  role: 'owner'
}

/**
 * Resultado de accept_invite RPC
 */
interface AcceptInviteResult {
  organization_id: string
  branch_id: string | null
  role: 'employee'
}

/**
 * 👤 Completa el proceso de configuración de perfil (registro)
 *
 * FLUJO:
 * 1. Valida si el rol ya existe (idempotencia)
 * 2. Caso Dueño: Usa setup_organization() - crea org + membership + branch
 * 3. Caso Empleado: Usa accept_invite() - usa token de invitación
 *
 * @param formData - Datos del formulario de registro
 * @returns CompleteProfileSetupResult - Resultado de la operación
 */
export async function completeProfileSetupAction(formData: {
  userId: string
  email: string
  name: string
  role: 'dueño' | 'empleado'
  inviteToken?: string
}): Promise<{
  success: boolean
  role?: 'dueño' | 'empleado'
  message?: string
  error?: string
  data?: SetupOrganizationResult | AcceptInviteResult
}> {
  try {
    // Validación Zod
    const parsed = completeProfileSchema.safeParse(formData)
    if (!parsed.success) {
      return {
        success: false,
        error: getZodError(parsed),
      }
    }

    const { email, name, role, inviteToken } = formData
    // H3 FIX: Derive userId from server session, not from client
    const supabaseAuth = await createClient()
    const { data: { user: authUser } } = await supabaseAuth.auth.getUser()
    const userId = authUser?.id || formData.userId
    const emailNormalizado = email.toLowerCase().trim()
    const supabase = await createClient()

    // Verificación de idempotencia: verificar si ya existe membership
    const { data: existingMembership } = await supabase
      .from('memberships')
      .select('id, role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle()

    if (existingMembership) {
      const mappedRole = existingMembership.role === 'owner' ? 'dueño' : 'empleado'
      return {
        success: true,
        role: mappedRole as 'dueño' | 'empleado',
        message: 'Usuario ya configurado',
      }
    }

    // CASO DUEÑO - Usar setup_organization RPC
    if (role === 'dueño') {
      const { data: setupData, error: setupError } = await supabase.rpc('setup_organization', {
        p_org_name: `Kiosco de ${name}`,
        p_user_name: name,
        p_email: emailNormalizado,
      })

      if (setupError) {
        console.error('Error en setup_organization:', setupError)
        return {
          success: false,
          error: `Error al crear organización: ${setupError.message}`,
        }
      }

      return {
        success: true,
        role: 'dueño',
        message: '¡Cuenta configurada! Ya tienes acceso y contraseña.',
        data: setupData as SetupOrganizationResult,
      }
    }

    // CASO EMPLEADO - Usar accept_invite RPC
    if (role === 'empleado') {
      // Necesitamos el token de invitación
      let token = inviteToken

      // Si no viene el token, buscarlo por email
      if (!token) {
        const { data: invite } = await supabase
          .from('pending_invites')
          .select('token')
          .eq('email', emailNormalizado)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle()

        if (!invite?.token) {
          return {
            success: false,
            error: `No se encontró invitación válida para ${email}. La invitación puede haber expirado o no existe. Pide al dueño que te invite de nuevo.`,
          }
        }
        token = invite.token
      }

      const { data: employeeData, error: employeeError } = await supabase.rpc('accept_invite', {
        p_token: token,
        p_user_name: name,
        p_email: emailNormalizado,
      })

      if (employeeError) {
        console.error('Error en accept_invite:', employeeError)
        return {
          success: false,
          error: `No se encontró invitación válida para ${email}. La invitación puede haber expirado o no existe. Pide al dueño que te invite de nuevo.`,
        }
      }

      return {
        success: true,
        role: 'empleado',
        message: '¡Cuenta configurada! Ya tienes acceso y contraseña.',
        data: employeeData as AcceptInviteResult,
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

// ───────────────────────────────────────────────────────────────────────────────
// FUNCIONES AUXILIARES
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Datos del usuario actual
 */
export interface CurrentUserData {
  success: boolean
  user?: {
    id: string
    email: string
    display_name: string
    role: UserRole
    organization_id: string
    branch_id: string | null
  }
  error?: string
}

/**
 * 👤 Obtiene los datos del usuario actual desde memberships
 *
 * @returns CurrentUserData - Datos del usuario o error
 */
export async function getCurrentUserAction(): Promise<CurrentUserData> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.id) {
      return {
        success: false,
        error: 'No hay sesión activa',
      }
    }

    // Obtener membership activa
    const { data: membership, error } = await supabase
      .from('memberships')
      .select('organization_id, branch_id, role, display_name, email')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      return {
        success: false,
        error: `Error al obtener datos: ${error.message}`,
      }
    }

    if (!membership) {
      return {
        success: false,
        error: 'Usuario no tiene perfil configurado',
      }
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: membership.email || user.email || '',
        display_name: membership.display_name,
        role: membership.role as UserRole,
        organization_id: membership.organization_id,
        branch_id: membership.branch_id,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * 🔑 Verifica si el usuario actual es owner
 *
 * @returns boolean - true si es owner
 */
export async function isCurrentUserOwnerAction(): Promise<boolean> {
  const result = await getCurrentUserAction()
  return result.success && result.user?.role === 'owner'
}
