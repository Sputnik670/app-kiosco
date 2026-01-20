/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🏢 ORGANIZATION REPOSITORY
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Repositorio para gestión de organizaciones.
 * V2: Usa RPC create_initial_setup_v2 (Owner-First) que escribe en user_organization_roles.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database.types'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

type Organization = Database['public']['Tables']['organizations']['Row']
type OrganizationInsert = Database['public']['Tables']['organizations']['Insert']

type Perfil = Database['public']['Tables']['perfiles']['Row']
type Sucursal = Database['public']['Tables']['sucursales']['Row']
type UserOrgRole = Database['public']['Tables']['user_organization_roles']['Row']

export interface InitialSetupData {
  organization: Organization
  perfil: Perfil
  sucursal: Sucursal
  role?: UserOrgRole
}

export interface CreateInitialSetupParams {
  userId: string
  profileName: string
  orgName?: string
  email: string
}

// ───────────────────────────────────────────────────────────────────────────────
// FUNCIONES
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Crea el setup inicial usando una transacción atómica V2 (Owner-First).
 * - Crea organización con owner_id
 * - Crea entrada en user_organization_roles
 * - Crea perfil (compatibilidad temporal)
 * - Crea sucursal inicial
 *
 * @param params - Datos del nuevo dueño
 * @returns InitialSetupData con todas las entidades creadas
 */
export async function createInitialSetup(
  params: CreateInitialSetupParams
): Promise<{ data: InitialSetupData | null; error: Error | null }> {
  try {
    const { userId, profileName, email, orgName = 'Mi Negocio' } = params

    // V2: Usar create_initial_setup_v2 que escribe en user_organization_roles
    const { data, error } = await supabase.rpc('create_initial_setup_v2', {
      p_user_id: userId,
      p_org_name: orgName,
      p_profile_name: profileName,
      p_email: email
    })

    if (error) {
      console.error('Error RPC create_initial_setup_v2:', error)
      return {
        data: null,
        error: new Error(`Error creando organización: ${error.message}`)
      }
    }

    // V2 devuelve estructura JSON con organization, sucursal, role, perfil
    const result = data as unknown as InitialSetupData

    return {
      data: result,
      error: null
    }

  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Error desconocido en createInitialSetup')
    }
  }
}

/**
 * Obtiene una organización por ID
 */
export async function getOrganizationById(
  organizationId: string
): Promise<{ data: Organization | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error: error as Error }
  }
}

/**
 * Actualiza una organización
 */
export async function updateOrganization(
  organizationId: string,
  updates: Partial<Omit<OrganizationInsert, 'id' | 'created_at'>>
): Promise<{ data: Organization | null; error: Error | null }> {
  try {
    const updateData: Partial<OrganizationInsert> = {
      nombre: updates.nombre ?? undefined,
      plan: updates.plan ?? undefined,
    }

    // Limpiar undefined
    Object.keys(updateData).forEach(
      key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]
    )

    const { data, error } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', organizationId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error: error as Error }
  }
}