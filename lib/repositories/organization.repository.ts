/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🏢 ORGANIZATION REPOSITORY (actualizado para nuevo schema)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Repositorio para gestión de organizaciones.
 * Usa RPC setup_organization del nuevo schema.
 *
 * MAPEO DE TABLAS:
 * - perfiles → memberships
 * - sucursales → branches
 * - user_organization_roles → memberships (consolidado)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database.types'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

type Organization = Database['public']['Tables']['organizations']['Row']
type Branch = Database['public']['Tables']['branches']['Row']
type Membership = Database['public']['Tables']['memberships']['Row']

export interface InitialSetupData {
  organization: Organization
  branch: Branch
  membership: Membership
  // Alias para compatibilidad
  perfil?: Membership
  sucursal?: Branch
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
 * Crea el setup inicial usando RPC setup_organization.
 * - Crea organización con owner_id
 * - Crea membership para el owner
 * - Crea branch inicial
 */
export async function createInitialSetup(
  params: CreateInitialSetupParams
): Promise<{ data: InitialSetupData | null; error: Error | null }> {
  try {
    const { profileName, email, orgName = 'Mi Negocio' } = params

    // Usar setup_organization del nuevo schema
    const { data, error } = await supabase.rpc('setup_organization', {
      p_org_name: orgName,
      p_display_name: profileName,
      p_email: email,
      p_branch_name: 'Sucursal Principal'
    })

    if (error) {
      console.error('Error RPC setup_organization:', error)
      return {
        data: null,
        error: new Error(`Error creando organización: ${error.message}`)
      }
    }

    // El RPC devuelve { organization_id, branch_id, membership_id }
    const result = data as { organization_id: string; branch_id: string; membership_id: string }

    // Obtener los datos completos
    const [orgResult, branchResult, membershipResult] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', result.organization_id).single(),
      supabase.from('branches').select('*').eq('id', result.branch_id).single(),
      supabase.from('memberships').select('*').eq('id', result.membership_id).single(),
    ])

    if (orgResult.error || branchResult.error || membershipResult.error) {
      return {
        data: null,
        error: new Error('Error obteniendo datos creados')
      }
    }

    return {
      data: {
        organization: orgResult.data,
        branch: branchResult.data,
        membership: membershipResult.data,
        // Alias para compatibilidad
        perfil: membershipResult.data,
        sucursal: branchResult.data,
      },
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
  updates: { name?: string; plan?: 'free' | 'basic' | 'premium' | 'enterprise' }
): Promise<{ data: Organization | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', organizationId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error: error as Error }
  }
}
