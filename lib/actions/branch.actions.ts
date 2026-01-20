/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🏢 BRANCH (SUCURSALES) SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de sucursales.
 * Maneja consultas y actualizaciones de QR de fichaje.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - organization_id obtenido/validado en servidor
 * - Gestión segura de URLs de QR (qr_entrada_url, qr_salida_url)
 *
 * ORIGEN: Refactorización de generar-qr-fichaje.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Sucursal con URLs de QR de fichaje
 */
export interface Branch {
  id: string
  nombre: string
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
 *
 * LÓGICA (V2 - Owner-First):
 * - Obtiene organización usando get_my_org_id_v2() (lee de user_organization_roles)
 * - Consulta sucursales con qr_entrada_url y qr_salida_url
 * - Ordena alfabéticamente por nombre
 *
 * USO:
 * - Listar sucursales en selector de QR
 * - Mostrar estado de QRs guardados (indicador verde)
 *
 * @returns GetBranchesResult - Lista de sucursales con QRs
 *
 * ORIGEN: Refactorización de cargarSucursales() líneas 31-81
 * MIGRACIÓN: V2 - Lee de user_organization_roles
 */
export async function getBranchesWithQRAction(): Promise<GetBranchesResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener usuario y organización usando V2
    // ───────────────────────────────────────────────────────────────────────────

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        branches: [],
        error: 'No hay sesión activa',
      }
    }

    // V2: Usar RPC que lee de user_organization_roles
    const { data: orgIdV2 } = await supabase.rpc('get_my_org_id_v2')

    const orgId: string | null = orgIdV2

    if (!orgId) {
      return {
        success: false,
        branches: [],
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Consultar sucursales con QRs
    // ───────────────────────────────────────────────────────────────────────────

    const { data: sucursalesData, error } = await supabase
      .from('sucursales')
      .select('id, nombre, qr_entrada_url, qr_salida_url')
      .eq('organization_id', orgId)
      .order('nombre')

    if (error) {
      return {
        success: false,
        branches: [],
        error: `Error al cargar sucursales: ${error.message}`,
      }
    }

    // Mapear a tipo Branch (asegurar nulls explícitos)
    const branches: Branch[] = (sucursalesData || []).map((s: any) => ({
      id: s.id,
      nombre: s.nombre,
      qr_entrada_url: s.qr_entrada_url || null,
      qr_salida_url: s.qr_salida_url || null,
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
 *
 * LÓGICA (preservada del componente original):
 * - Actualiza qr_entrada_url o qr_salida_url según el tipo
 * - Operación atómica en base de datos
 * - No requiere validación de organización (RLS la maneja)
 *
 * SEGURIDAD:
 * - Row Level Security valida que el usuario tenga acceso a la sucursal
 * - No se pasa organization_id en el WHERE (RLS lo maneja automáticamente)
 *
 * @param sucursalId - ID de la sucursal
 * @param tipo - "entrada" o "salida"
 * @param qrUrl - URL generada para el QR
 * @returns UpdateBranchQRResult - Resultado de la operación
 *
 * ORIGEN: Refactorización de guardarQR() líneas 96-116
 */
export async function updateBranchQRAction(
  sucursalId: string,
  tipo: 'entrada' | 'salida',
  qrUrl: string
): Promise<UpdateBranchQRResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

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

    // ───────────────────────────────────────────────────────────────────────────
    // ACTUALIZACIÓN
    // ───────────────────────────────────────────────────────────────────────────

    const updateData: Record<string, string> = {}
    if (tipo === 'entrada') {
      updateData.qr_entrada_url = qrUrl
    } else {
      updateData.qr_salida_url = qrUrl
    }

    const { error } = await supabase
      .from('sucursales')
      .update(updateData)
      .eq('id', sucursalId)

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
 *
 * LÓGICA (V2 - Owner-First):
 *
 * FLUJO OPTIMIZADO:
 * 1. Obtener usuario autenticado
 * 2. Obtener organization_id usando get_my_org_id_v2() (lee de user_organization_roles)
 * 3. Consultar sucursales de esa organización
 * 4. Ordenar por fecha de creación (más antiguas primero)
 *
 * IMPORTANTE:
 * - organization_id obtenido del servidor (seguridad multi-tenant)
 * - El componente NO maneja orgId en su estado
 * - Retorna información completa de sucursales (nombre, dirección, etc.)
 *
 * @returns GetBranchesFullResult - Lista de sucursales
 *
 * ORIGEN: Refactorización de loadOrg() + fetchSucursales() del componente
 * MIGRACIÓN: V2 - Lee de user_organization_roles
 */
export async function getBranchesAction(): Promise<GetBranchesFullResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener usuario y organización usando V2
    // ───────────────────────────────────────────────────────────────────────────

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        branches: [],
        error: 'No hay sesión activa',
      }
    }

    // V2: Usar RPC que lee de user_organization_roles
    const { data: orgIdV2 } = await supabase.rpc('get_my_org_id_v2')

    const orgId: string | null = orgIdV2

    if (!orgId) {
      return {
        success: false,
        branches: [],
        error: 'No se encontró la organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Consultar sucursales
    // ───────────────────────────────────────────────────────────────────────────

    const { data, error } = await supabase
      .from('sucursales')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true })

    if (error) {
      return {
        success: false,
        branches: [],
        error: `Error al cargar sucursales: ${error.message}`,
      }
    }

    return {
      success: true,
      branches: (data as BranchFull[]) || [],
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
 *
 * LÓGICA (V2 - Owner-First):
 *
 * VALIDACIONES:
 * - nombre es obligatorio (trim para evitar espacios vacíos)
 * - organization_id obtenido usando get_my_org_id_v2()
 *
 * FLUJO:
 * 1. Validar nombre
 * 2. Obtener organización del usuario
 * 3. Insertar sucursal
 * 4. Retornar ID de la nueva sucursal
 *
 * @param data - Datos de la nueva sucursal
 * @returns CreateBranchResult - Resultado de la operación
 *
 * ORIGEN: Refactorización de handleCreate() del componente
 * MIGRACIÓN: V2 - Lee de user_organization_roles
 */
export async function createBranchAction(
  data: CreateBranchData
): Promise<CreateBranchResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!data.nombre.trim()) {
      return {
        success: false,
        error: 'El nombre es obligatorio',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener usuario y organización usando V2
    // ───────────────────────────────────────────────────────────────────────────

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        error: 'No hay sesión activa',
      }
    }

    // V2: Usar RPC que lee de user_organization_roles
    const { data: orgIdV2 } = await supabase.rpc('get_my_org_id_v2')

    const orgId: string | null = orgIdV2

    if (!orgId) {
      return {
        success: false,
        error: 'No se encontró la organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Crear sucursal
    // ───────────────────────────────────────────────────────────────────────────

    const { data: nuevaSucursal, error } = await supabase
      .from('sucursales')
      .insert({
        organization_id: orgId,
        nombre: data.nombre,
        direccion: data.direccion,
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
      branchId: nuevaSucursal?.id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al crear sucursal',
    }
  }
}

/**
 * 🗑️ Elimina una sucursal
 *
 * LÓGICA (preservada del componente original - líneas 101-115):
 *
 * ⚠️ OPERACIÓN PELIGROSA:
 * - Al borrar la sucursal, SE BORRARÁ EN CASCADA:
 *   - Todas las ventas
 *   - Todo el stock
 *   - Todas las cajas diarias
 * - El componente debe mostrar confirmación ANTES de llamar esta acción
 *
 * SEGURIDAD:
 * - RLS valida que el usuario tenga acceso a la sucursal
 * - No se requiere pasar organization_id (RLS lo maneja)
 *
 * @param branchId - ID de la sucursal a eliminar
 * @returns DeleteBranchResult - Resultado de la operación
 *
 * ORIGEN: Refactorización de handleDelete() del componente
 */
export async function deleteBranchAction(
  branchId: string
): Promise<DeleteBranchResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!branchId) {
      return {
        success: false,
        error: 'Branch ID es requerido',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // ELIMINACIÓN (CASCADA EN DB)
    // ───────────────────────────────────────────────────────────────────────────

    const { error } = await supabase
      .from('sucursales')
      .delete()
      .eq('id', branchId)

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
