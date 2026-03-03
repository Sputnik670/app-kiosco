/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔐 AUTH HELPERS CENTRALIZADOS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Helpers de autenticación y autorización para Server Actions.
 * Reemplazan el patrón repetido de getUser() + get_my_org_id() en cada action.
 *
 * PRINCIPIOS:
 * - NUNCA aceptar organizationId del cliente
 * - SIEMPRE verificar sesión antes de cualquier operación
 * - Roles verificados contra memberships (fuente de verdad)
 * - Error temprano: si no hay auth, throw inmediato
 *
 * USO:
 *   const { supabase, user, orgId } = await verifyAuth()
 *   const { supabase, user, orgId } = await verifyOwner()
 *   const { supabase, user, orgId, role } = await verifyMembership()
 *   const orgId = await getServerOrgId(supabase)
 *
 * CREADO: 2026-02-25 — Post-auditoría de seguridad (P0 fixes)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@/lib/supabase-server'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/** Tipo inferido del cliente Supabase (compatible con tablas no tipadas aún) */
type SupabaseClientType = Awaited<ReturnType<typeof createClient>>

export interface AuthContext {
  supabase: SupabaseClientType
  user: { id: string; email?: string }
  orgId: string
}

export interface MembershipContext extends AuthContext {
  role: 'owner' | 'admin' | 'employee'
  branchId: string | null
}

// ───────────────────────────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 🔐 Verifica que el usuario está autenticado y tiene organización
 *
 * VALIDA:
 * 1. Sesión activa (getUser)
 * 2. Membership activa con organización (get_my_org_id)
 *
 * LANZA Error si:
 * - No hay sesión → 'No autenticado'
 * - No hay organización → 'Sin organización activa'
 *
 * @returns AuthContext con supabase client, user y orgId
 */
export async function verifyAuth(): Promise<AuthContext> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user?.id) {
    throw new Error('No autenticado')
  }

  const { data: orgId } = await supabase.rpc('get_my_org_id')
  if (!orgId) {
    throw new Error('Sin organización activa')
  }

  return { supabase, user: { id: user.id, email: user.email }, orgId }
}

/**
 * 👑 Verifica que el usuario es OWNER de su organización
 *
 * VALIDA:
 * 1. Todo lo de verifyAuth()
 * 2. Rol === 'owner' via is_owner() RPC
 *
 * LANZA Error si:
 * - No es owner → 'Solo el dueño puede realizar esta acción'
 *
 * @returns AuthContext (misma interfaz que verifyAuth)
 */
export async function verifyOwner(): Promise<AuthContext> {
  const ctx = await verifyAuth()

  const { data: isOwner } = await ctx.supabase.rpc('is_owner')
  if (!isOwner) {
    throw new Error('Solo el dueño puede realizar esta acción')
  }

  return ctx
}

/**
 * 🧑‍💼 Verifica que el usuario tiene membership activa y retorna su rol
 *
 * VALIDA:
 * 1. Sesión activa (getUser)
 * 2. Membership activa con organización
 * 3. Retorna rol y branch_id para autorización granular
 *
 * LANZA Error si:
 * - No hay sesión → 'No autenticado'
 * - No hay membership → 'Sin membresía activa'
 *
 * @returns MembershipContext con role y branchId adicionales
 */
export async function verifyMembership(): Promise<MembershipContext> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user?.id) {
    throw new Error('No autenticado')
  }

  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('organization_id, role, branch_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (membershipError || !membership) {
    throw new Error('Sin membresía activa')
  }

  return {
    supabase,
    user: { id: user.id, email: user.email },
    orgId: membership.organization_id,
    role: membership.role as 'owner' | 'admin' | 'employee',
    branchId: membership.branch_id,
  }
}

/**
 * 🏢 Obtiene el org_id del usuario autenticado desde el servidor
 *
 * NUNCA usar organizationId enviado desde el cliente.
 * Siempre derivar del servidor via get_my_org_id() RPC.
 *
 * @param supabase - Cliente Supabase ya autenticado
 * @returns org_id string
 * @throws Error si no hay organización
 */
export async function getServerOrgId(supabase: SupabaseClientType): Promise<string> {
  const { data: orgId } = await supabase.rpc('get_my_org_id')
  if (!orgId) {
    throw new Error('Sin organización activa')
  }
  return orgId
}
