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
import { supabaseAdmin } from '@/lib/supabase-admin'
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

    const normalizedEmail = email.trim().toLowerCase()
    const supabaseServer = await createClient()
    const { error } = await supabaseServer.auth.signInWithPassword({
      email: normalizedEmail,
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
 * IMPORTANTE: pasamos `emailRedirectTo` apuntando a /auth/callback para
 * que el link de confirmación entre por el route handler que intercambia
 * el code de PKCE por una sesión. Si se deja vacío, GoTrue usa el Site URL
 * configurado en el dashboard — funciona pero depende de una config
 * remota que puede cambiar y romper el onboarding silenciosamente.
 *
 * @param email - Email del nuevo usuario
 * @param password - Contraseña
 * @param redirectTo - URL base para el link de confirmación (opcional)
 * @returns AuthResult - Resultado de la operación
 */
export async function signUpAction(
  email: string,
  password: string,
  redirectTo?: string
): Promise<AuthResult> {
  try {
    // Validaciones básicas
    if (!email || !password) {
      return {
        success: false,
        error: 'Email y contraseña son requeridos',
      }
    }

    if (password.length < 8) {
      return {
        success: false,
        error: 'La contraseña debe tener al menos 8 caracteres',
      }
    }

    // Forzar el callback para que el code de PKCE se intercambie correctamente
    const emailRedirectTo =
      redirectTo ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL ||
      'http://localhost:3000'

    const normalizedEmail = email.trim().toLowerCase()
    const supabaseServer = await createClient()
    const { error } = await supabaseServer.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo,
      },
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

    const normalizedEmail = email.trim().toLowerCase()
    const supabaseServer = await createClient()
    const { error } = await supabaseServer.auth.signInWithOtp({
      email: normalizedEmail,
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

    const normalizedEmail = email.trim().toLowerCase()
    const supabaseServer = await createClient()
    const { error } = await supabaseServer.auth.resetPasswordForEmail(normalizedEmail, {
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

/**
 * 🔑 Actualiza la contraseña del usuario autenticado actualmente
 *
 * NOTA: Se ejecuta en el servidor para mantener el patrón del proyecto.
 * El usuario debe tener una sesión activa (viene de magic link o recovery link).
 *
 * @param password - Nueva contraseña (mínimo 8 caracteres)
 * @returns AuthResult - Resultado de la operación
 */
export async function updatePasswordAction(password: string): Promise<AuthResult> {
  try {
    if (!password || password.length < 8) {
      return {
        success: false,
        error: 'La contraseña debe tener al menos 8 caracteres',
      }
    }

    const supabaseServer = await createClient()
    const { error } = await supabaseServer.auth.updateUser({ password })

    if (error) {
      return {
        success: false,
        error: error.message || 'Error al actualizar la contraseña',
      }
    }

    return {
      success: true,
      message: 'Contraseña actualizada correctamente.',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al actualizar contraseña',
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
    const { supabase, user, orgId } = await verifyOwner()

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
  inviteLink?: string
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

    // URL base para redirecciones
    const rawUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL ||
      'http://localhost:3000'
    const baseUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`

    // ─── CHECKEAR SI EL USUARIO YA EXISTE EN AUTH ───────────────────────
    // Antes se creaba pending_invite → inviteUserByEmail fallaba → se borraba.
    // Ahora verificamos primero para evitar el patrón "crear para fallar".
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    })
    // listUsers no filtra por email, buscar con getUserByEmail que es más directo
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(
      '' // placeholder — usamos getUserByEmail abajo
    ).catch(() => ({ data: null }))
    // Método correcto: buscar por email en la lista de usuarios invitados
    // Supabase Admin no tiene getUserByEmail directo, pero inviteUserByEmail
    // retorna error descriptivo. Usamos una heurística: si el email ya tiene
    // una membership activa en ESTA org, es re-invitación segura.
    const { data: existingMembership } = await supabaseAdmin
      .from('memberships')
      .select('id, is_active')
      .eq('email', normalizedEmail)
      .eq('organization_id', orgId)
      .maybeSingle()

    // CASO RE-INVITACIÓN: usuario ya tiene membership (activa o inactiva) en esta org
    if (existingMembership) {
      // Reactivar membership si estaba desactivada
      await supabaseAdmin
        .from('memberships')
        .update({ is_active: true, branch_id: branchId })
        .eq('id', existingMembership.id)

      // Generar link de recovery para que establezca contraseña nueva
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: normalizedEmail,
        options: {
          redirectTo: `${baseUrl}/auth/callback?next=/auth/set-password`,
        },
      })

      if (linkError || !linkData?.properties?.action_link) {
        return {
          success: false,
          error: `Error al generar link de acceso: ${linkError?.message || 'No se pudo generar el link'}`,
        }
      }

      return {
        success: true,
        message: 'El empleado ya tiene cuenta. Compartile este link para que cree su contraseña y pueda entrar siempre:',
        inviteLink: linkData.properties.action_link,
      }
    }

    // ─── NUEVA INVITACIÓN ───────────────────────────────────────────────
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

    const redirectTo = `${baseUrl}/?invite_token=${invite.token}`

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo,
        data: {
          invite_token: invite.token,
          organization_id: orgId,
          branch_id: branchId,
        },
      }
    )

    if (inviteError) {
      // Si a pesar del check previo el usuario ya existe en auth pero NO tenía
      // membership (caso edge: usuario registrado que nunca completó setup),
      // generar magiclink que vuelva con el invite_token.
      //
      // FIX 2026-04-22: Antes borrábamos el pending_invite y mandábamos a
      // /auth/set-password, pero accept_invite nunca se llamaba → sin membership.
      // Ahora PRESERVAMOS el pending_invite y usamos magiclink con redirect a
      // /?invite_token=xxx → ProfileSetup detecta el token → accept_invite
      // crea la membership correctamente.
      if (inviteError.message?.includes('already been registered') ||
          inviteError.message?.includes('already exists')) {

        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: normalizedEmail,
          options: {
            redirectTo: `${baseUrl}/?invite_token=${invite.token}`,
          },
        })

        if (linkError || !linkData?.properties?.action_link) {
          // Si falla la generación del magiclink, sí limpiamos el pending_invite
          // huérfano para no dejar basura.
          await supabase
            .from('pending_invites')
            .delete()
            .eq('token', invite.token)

          return {
            success: false,
            error: `Error al generar link de acceso: ${linkError?.message || 'No se pudo generar el link'}`,
          }
        }

        return {
          success: true,
          message: 'El empleado ya tiene cuenta en el sistema. Compartile este link para que se sume a tu organización:',
          inviteLink: linkData.properties.action_link,
        }
      }

      return {
        success: false,
        error: `Error al enviar invitación: ${inviteError.message}`,
      }
    }

    return {
      success: true,
      message: 'Invitación enviada. El empleado recibirá un email para crear su cuenta.',
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

    // 1. Cerrar turnos abiertos del empleado antes de desvincularlo
    //    Si no se cierra, queda un turno fantasma sin dueño activo
    const { data: openShifts } = await supabase
      .from('cash_registers')
      .select('id')
      .eq('organization_id', orgId)
      .eq('opened_by', userId)
      .eq('is_open', true)

    if (openShifts && openShifts.length > 0) {
      const shiftIds = openShifts.map(s => s.id)
      await supabase
        .from('cash_registers')
        .update({
          is_open: false,
          closed_at: new Date().toISOString(),
          closed_by: userId,  // Se registra que cerró su propio turno (por baja)
        })
        .in('id', shiftIds)
    }

    // 2. Soft delete: marcar is_active = false en memberships
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
      message: openShifts && openShifts.length > 0
        ? 'Empleado dado de baja. Se cerró su turno abierto automáticamente.'
        : 'Empleado dado de baja',
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

    // Usar admin client: el empleado nuevo NO tiene membership,
    // así que las RLS de pending_invites lo bloquean con el client normal
    let query = supabaseAdmin
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
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const userId = authUser?.id || formData.userId
    const emailNormalizado = email.toLowerCase().trim()

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
      // NOTA: Usamos supabaseAdmin porque el empleado nuevo NO tiene membership
      // y las RLS de pending_invites requieren ser owner/admin de la org
      if (!token) {
        const { data: invite } = await supabaseAdmin
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
    const { supabase, user } = await verifyAuth()

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
