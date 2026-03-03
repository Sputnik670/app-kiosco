/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🏢 BRANCH SERVER ACTIONS - Schema V2
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de sucursales (branches).
 * Maneja consultas y actualizaciones de QR de fichaje.
 *
 * SCHEMA V2:
 * - Tabla: branches (no sucursales)
 * - Columnas: name (no nombre), address (no direccion)
 * - QRs: qr_entry_url, qr_exit_url (no qr_entrada_url, qr_salida_url)
 * - RPC: get_my_org_id (no get_my_org_id_v2)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import { verifyAuth, verifyOwner } from '@/lib/actions/auth-helpers'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Sucursal con URLs de QR de fichaje
 */
export interface Branch {
  id: string
  nombre: string // Mantenemos el nombre en español para el UI
  qr_entrada_url: string | null
  qr_salida_url: string | null
}

/**
 * Resultado de consulta de sucursales
 */
export interface GetBranchesResult {
  success: boolean
  branches: Branch[]
  error?: string
}

/**
 * Resultado de actualización de QR
 */
export interface UpdateBranchQRResult {
  success: boolean
  error?: string
}

/**
 * Sucursal completa (para gestión general)
 */
export interface BranchFull {
  id: string
  nombre: string
  direccion: string | null
  organization_id: string
  created_at: string | null
}

/**
 * Resultado de listado de sucursales completas
 */
export interface GetBranchesFullResult {
  success: boolean
  branches: BranchFull[]
  error?: string
}

/**
 * Datos para crear una nueva sucursal
 */
export interface CreateBranchData {
  nombre: string
  direccion: string
}

/**
 * Resultado de creación de sucursal
 */
export interface CreateBranchResult {
  success: boolean
  branchId?: string
  error?: string
}

/**
 * Resultado de eliminación de sucursal
 */
export interface DeleteBranchResult {
  success: boolean
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 🏢 Obtiene sucursales con sus URLs de QR de fichaje
 */
export async function getBranchesWithQRAction(): Promise<GetBranchesResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        branches: [],
        error: 'No hay sesión activa',
      }
    }

    // Schema V2: Usar RPC get_my_org_id (lee de memberships)
    const { data: orgId } = await supabase.rpc('get_my_org_id')

    if (!orgId) {
      return {
        success: false,
        branches: [],
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // Schema V2: Usar tabla branches
    const { data: branchesData, error } = await supabase
      .from('branches')
      .select('id, name, qr_entry_url, qr_exit_url')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name')

    if (error) {
      return {
        success: false,
        branches: [],
        error: `Error al cargar sucursales: ${error.message}`,
      }
    }

    // Mapear a tipo Branch (nombres en español para UI)
    const branches: Branch[] = (branchesData || []).map((b) => ({
      id: b.id,
      nombre: b.name,
      qr_entrada_url: b.qr_entry_url || null,
      qr_salida_url: b.qr_exit_url || null,
    }))

    return {
      success: true,
      branches,
    }
  } catch (error) {
    return {
      success: false,
      branches: [],
      error: error instanceof Error ? error.message : 'Error desconocido al cargar sucursales',
    }
  }
}

/**
 * 💾 Actualiza URL de QR de fichaje para una sucursal
 */
export async function updateBranchQRAction(
  sucursalId: string,
  tipo: 'entrada' | 'salida',
  qrUrl: string
): Promise<UpdateBranchQRResult> {
  try {
    const { supabase, orgId } = await verifyOwner()

    if (!sucursalId || !tipo || !qrUrl) {
      return {
        success: false,
        error: 'Parámetros incompletos',
      }
    }

    if (tipo !== 'entrada' && tipo !== 'salida') {
      return {
        success: false,
        error: 'Tipo de QR inválido (debe ser "entrada" o "salida")',
      }
    }

    // Schema V2: Usar columnas qr_entry_url / qr_exit_url
    const updateData: Record<string, string> = {}
    if (tipo === 'entrada') {
      updateData.qr_entry_url = qrUrl
    } else {
      updateData.qr_exit_url = qrUrl
    }

    const { error } = await supabase
      .from('branches')
      .update(updateData)
      .eq('id', sucursalId)
      .eq('organization_id', orgId)

    if (error) {
      return {
        success: false,
        error: `Error al guardar QR: ${error.message}`,
      }
    }

    return {
      success: true,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al guardar QR',
    }
  }
}

/**
 * 🏢 Obtiene todas las sucursales de la organización del usuario
 */
export async function getBranchesAction(): Promise<GetBranchesFullResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        branches: [],
        error: 'No hay sesión activa',
      }
    }

    // Schema V2: Usar RPC get_my_org_id
    const { data: orgId } = await supabase.rpc('get_my_org_id')

    if (!orgId) {
      return {
        success: false,
        branches: [],
        error: 'No se encontró la organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // Schema V2: Usar tabla branches
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, address, organization_id, created_at')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) {
      return {
        success: false,
        branches: [],
        error: `Error al cargar sucursales: ${error.message}`,
      }
    }

    // Mapear a tipo BranchFull (nombres en español para UI)
    const branches: BranchFull[] = (data || []).map((b) => ({
      id: b.id,
      nombre: b.name,
      direccion: b.address,
      organization_id: b.organization_id,
      created_at: b.created_at,
    }))

    return {
      success: true,
      branches,
    }
  } catch (error) {
    return {
      success: false,
      branches: [],
      error: error instanceof Error ? error.message : 'Error desconocido al cargar sucursales',
    }
  }
}

/**
 * ➕ Crea una nueva sucursal
 */
export async function createBranchAction(
  data: CreateBranchData
): Promise<CreateBranchResult> {
  try {
    if (!data.nombre.trim()) {
      return {
        success: false,
        error: 'El nombre es obligatorio',
      }
    }

    const { supabase, orgId } = await verifyOwner()

    // Schema V2: Usar tabla branches con columnas name, address
    const { data: nuevaBranch, error } = await supabase
      .from('branches')
      .insert({
        organization_id: orgId,
        name: data.nombre,
        address: data.direccion,
      })
      .select()
      .single()

    if (error) {
      return {
        success: false,
        error: `Error al crear sucursal: ${error.message}`,
      }
    }

    return {
      success: true,
      branchId: nuevaBranch?.id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al crear sucursal',
    }
  }
}

/**
 * 🗑️ Elimina (soft delete) una sucursal
 */
export async function deleteBranchAction(
  branchId: string
): Promise<DeleteBranchResult> {
  try {
    const { supabase, orgId } = await verifyOwner()

    if (!branchId) {
      return {
        success: false,
        error: 'Branch ID es requerido',
      }
    }

    // Schema V2: Soft delete (is_active = false)
    const { error } = await supabase
      .from('branches')
      .update({ is_active: false })
      .eq('id', branchId)
      .eq('organization_id', orgId)

    if (error) {
      return {
        success: false,
        error: `Error al eliminar sucursal: ${error.message}`,
      }
    }

    return {
      success: true,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al eliminar sucursal',
    }
  }
}
