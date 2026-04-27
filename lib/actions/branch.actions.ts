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
import { createBranchSchema, updateBranchSchema, updateBranchQRSchema, getZodError, idSchema } from '@/lib/validations'
import { registerMercadoPagoPosForBranchAction } from '@/lib/actions/mercadopago.actions'
import { logger } from '@/lib/logging'

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

export interface UpdateBranchData {
  nombre: string
  direccion?: string
}

export interface UpdateBranchResult {
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
    const { supabase, orgId } = await verifyAuth()

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
    const parsed = updateBranchQRSchema.safeParse({ sucursalId, tipo, qrUrl })
    if (!parsed.success) {
      return { success: false, error: getZodError(parsed) }
    }

    const { supabase, orgId } = await verifyOwner()

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
    const { supabase, orgId } = await verifyAuth()

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
    const parsed = createBranchSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: getZodError(parsed) }
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

    // ─────────────────────────────────────────────────────────────────────────
    // AUTO-REGISTRO COMO POS EN MERCADO PAGO (best-effort, no bloqueante)
    // ─────────────────────────────────────────────────────────────────────────
    // Si la org tiene MP conectado, intentamos registrar la sucursal como POS
    // automáticamente para que pueda generar QRs EMVCo desde el primer momento.
    // Si falla (no hay credenciales, MP rechaza, etc.), no bloqueamos la
    // creación de la sucursal — el dueño puede reintentar manualmente desde
    // Configuración → Mercado Pago → "Registrar sucursales".
    if (nuevaBranch?.id) {
      try {
        const posResult = await registerMercadoPagoPosForBranchAction(nuevaBranch.id)
        if (!posResult.success) {
          logger.info('createBranchAction', 'Auto-registro POS en MP omitido', {
            branchId: nuevaBranch.id.substring(0, 8),
            reason: posResult.error,
          })
        }
      } catch (mpError) {
        // Failsafe extra: si el action explota inesperadamente, igual seguimos.
        const err = mpError instanceof Error ? mpError : new Error(String(mpError))
        logger.error('createBranchAction', 'Excepción en auto-registro POS', err)
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
    const parsed = idSchema.safeParse(branchId)
    if (!parsed.success) {
      return { success: false, error: 'Branch ID inválido' }
    }

    const { supabase, orgId } = await verifyOwner()

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

/**
 * ✏️ Actualiza nombre y dirección de una sucursal
 */
export async function updateBranchAction(
  branchId: string,
  data: UpdateBranchData
): Promise<UpdateBranchResult> {
  try {
    const parsed = updateBranchSchema.safeParse({ branchId, ...data })
    if (!parsed.success) {
      return { success: false, error: getZodError(parsed) }
    }

    const { supabase, orgId } = await verifyOwner()

    const updateData: Record<string, string> = { name: data.nombre.trim() }
    if (data.direccion !== undefined) {
      updateData.address = data.direccion
    }

    const { error } = await supabase
      .from('branches')
      .update(updateData)
      .eq('id', branchId)
      .eq('organization_id', orgId)

    if (error) {
      return { success: false, error: `Error al actualizar: ${error.message}` }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
