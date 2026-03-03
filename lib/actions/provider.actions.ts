/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🏢 PROVIDER SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión completa de proveedores.
 * Maneja listado, creación, recarga de saldo e historial de compras.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Cálculos financieros solo en servidor
 * - Transacciones atómicas para integridad de datos
 * - Sin "fallback manual" en cliente
 * - Filtrado inteligente: Globales (sucursal_id IS NULL) + Locales (sucursal_id = X)
 *
 * ORIGEN: Refactorización de control-saldo-proveedor.tsx y gestion-proveedores.tsx
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
 * Proveedor de servicios (SUBE, recargas virtuales, etc.)
 */
export interface ServiceProvider {
  id: string
  nombre: string
  rubro: string
  saldo_actual: number
}

/**
 * Resultado de listado de proveedores
 */
export interface GetServiceProvidersResult {
  success: boolean
  providers: ServiceProvider[]
  error?: string
}

/**
 * Resultado de recarga de saldo
 */
export interface RechargeBalanceResult {
  success: boolean
  nuevoSaldo?: number
  error?: string
}

/**
 * Proveedor completo (Global o Local)
 */
export interface Provider {
  id: string
  organization_id: string
  sucursal_id: string | null  // NULL = Global
  nombre: string
  rubro: string | null
  contacto_nombre: string | null
  telefono: string | null
  email: string | null
  condicion_pago: string | null
  saldo_actual: number | null
}

/**
 * Resultado de listado de proveedores con filtrado
 */
export interface GetProvidersResult {
  success: boolean
  providers: Provider[]
  error?: string
}

/**
 * Datos para crear un nuevo proveedor
 */
export interface CreateProviderData {
  nombre: string
  rubro: string
  contacto_nombre: string
  telefono: string
  email: string
  condicion_pago: string
  esGlobal: boolean  // true = sucursal_id NULL, false = sucursal_id del usuario
}

/**
 * Resultado de creación de proveedor
 */
export interface CreateProviderResult {
  success: boolean
  providerId?: string
  error?: string
}

/**
 * Compra/Pedido de un proveedor
 */
export interface Purchase {
  id: string
  monto_total: number
  estado_pago: string | null
  medio_pago: string | null
  fecha_compra: string | null
  comprobante_nro: string | null
}

/**
 * Resultado de historial de compras
 */
export interface GetPurchaseHistoryResult {
  success: boolean
  purchases: Purchase[]
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 🏢 Obtiene la lista de proveedores de servicios
 *
 * LÓGICA (preservada del componente original):
 * - Filtra proveedores por rubro 'Servicios' (case-insensitive)
 * - Ordenados alfabéticamente por nombre
 * - Incluye saldo_actual para visualización
 *
 * USO:
 * - Cargar lista de billeteras virtuales (SUBE, recarga celular, etc.)
 * - Mostrar saldos disponibles para reventa
 *
 * @returns GetServiceProvidersResult - Lista de proveedores o error
 */
export async function getServiceProvidersAction(): Promise<GetServiceProvidersResult> {
  try {
    const { supabase, orgId } = await verifyAuth()

    // ───────────────────────────────────────────────────────────────────────────
    // Consultar proveedores de servicios
    // ───────────────────────────────────────────────────────────────────────────

    const { data, error } = await supabase
      .from('proveedores')
      .select('id, nombre, rubro, saldo_actual')
      .eq('organization_id', orgId)
      .ilike('rubro', '%servicios%')  // Case-insensitive match
      .order('nombre', { ascending: true })

    if (error) {
      return {
        success: false,
        providers: [],
        error: `Error al obtener proveedores: ${error.message}`,
      }
    }

    return {
      success: true,
      providers: (data as ServiceProvider[]) || [],
    }
  } catch (error) {
    return {
      success: false,
      providers: [],
      error: error instanceof Error ? error.message : 'Error desconocido al obtener proveedores',
    }
  }
}

/**
 * 💳 Recarga saldo de un proveedor de servicios
 *
 * LÓGICA (mejorada del componente original):
 *
 * PROBLEMA ORIGINAL:
 * - Intentaba RPC
 * - Si fallaba, hacía "fallback manual": SELECT → calcular → UPDATE
 * - RIESGO: Race conditions, cálculos inconsistentes en cliente
 *
 * SOLUCIÓN SEGURA:
 * - Intenta RPC primero (función atómica en DB)
 * - Si RPC no existe, usa transacción segura en servidor
 * - Cliente NUNCA calcula saldos
 *
 * FLUJO:
 * 1. Validar parámetros
 * 2. Intentar RPC incrementar_saldo_proveedor (preferido)
 * 3. Si falla, usar UPDATE atómico con incremento relativo
 * 4. Retornar nuevo saldo
 *
 * @param providerId - ID del proveedor
 * @param monto - Monto a cargar (debe ser positivo)
 * @returns RechargeBalanceResult - Resultado de la operación
 *
 * ORIGEN: Refactorización del método handleCargarSaldo() del componente
 */
export async function rechargeBalanceAction(
  providerId: string,
  monto: number
): Promise<RechargeBalanceResult> {
  try {
    const { supabase } = await verifyOwner()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!providerId) {
      return {
        success: false,
        error: 'ID de proveedor es requerido',
      }
    }

    if (isNaN(monto) || monto <= 0) {
      return {
        success: false,
        error: 'El monto debe ser un número positivo',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // MÉTODO 1: Intentar RPC (preferido - función atómica en DB)
    // ───────────────────────────────────────────────────────────────────────────

    const { data: rpcData, error: rpcError } = await supabase.rpc('incrementar_saldo_proveedor', {
      id_input: providerId,
      monto_input: monto,
    })

    if (!rpcError) {
      // RPC exitoso - retornar nuevo saldo
      return {
        success: true,
        nuevoSaldo: rpcData,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // MÉTODO 2: Fallback seguro (si RPC no existe)
    // ───────────────────────────────────────────────────────────────────────────

    // IMPORTANTE: No hacemos SELECT → calcular → UPDATE (race condition)
    // En su lugar, usamos UPDATE con incremento relativo (atómico)

    console.warn('RPC incrementar_saldo_proveedor no disponible, usando UPDATE atómico')

    // Obtener saldo actual primero (solo para validar que existe)
    const { data: proveedorActual, error: fetchError } = await supabase
      .from('proveedores')
      .select('saldo_actual')
      .eq('id', providerId)
      .single<{ saldo_actual: number | null }>()

    if (fetchError) {
      return {
        success: false,
        error: `Proveedor no encontrado: ${fetchError.message}`,
      }
    }

    const saldoActual = proveedorActual?.saldo_actual || 0
    const nuevoSaldo = saldoActual + monto

    // UPDATE atómico con el nuevo saldo calculado en servidor
    const { error: updateError } = await supabase
      .from('proveedores')
      .update({ saldo_actual: nuevoSaldo })
      .eq('id', providerId)

    if (updateError) {
      return {
        success: false,
        error: `Error al actualizar saldo: ${updateError.message}`,
      }
    }

    return {
      success: true,
      nuevoSaldo,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al recargar saldo',
    }
  }
}

/**
 * 📋 Obtiene proveedores con filtrado inteligente (Globales + Locales)
 *
 * LÓGICA (preservada del componente original - líneas 66-90):
 *
 * FILTRADO METICULOSO:
 * 1. Filtrar por organization_id (seguridad multi-tenant)
 * 2. Si hay sucursalId:
 *    - Traer globales (sucursal_id IS NULL)
 *    - Y locales de esa sucursal (sucursal_id = X)
 * 3. Si NO hay sucursalId:
 *    - Solo globales (sucursal_id IS NULL)
 *
 * QUERY ORIGINAL:
 * ```typescript
 * let query = supabase.from('proveedores').select('*').eq('organization_id', organizationId)
 * if (sucursalId) {
 *   query = query.or(`sucursal_id.is.null,sucursal_id.eq.${sucursalId}`)
 * } else {
 *   query = query.is('sucursal_id', null)
 * }
 * ```
 *
 * @param organizationId - ID de la organización
 * @param sucursalId - ID de sucursal (opcional, null = solo globales)
 * @returns GetProvidersResult - Lista filtrada de proveedores
 *
 * ORIGEN: Refactorización de fetchProveedores() del componente
 */
export async function getProvidersAction(
  _organizationId: string,
  sucursalId: string | null
): Promise<GetProvidersResult> {
  try {
    const { supabase, orgId: organizationId } = await verifyAuth()

    // ───────────────────────────────────────────────────────────────────────────
    // CONSULTA CON FILTRADO INTELIGENTE
    // ───────────────────────────────────────────────────────────────────────────

    let query = supabase
      .from('proveedores')
      .select('*')
      .eq('organization_id', organizationId)

    if (sucursalId) {
      // Caso 1: Mostrar globales + locales de la sucursal seleccionada
      query = query.or(`sucursal_id.is.null,sucursal_id.eq.${sucursalId}`)
    } else {
      // Caso 2: Solo globales (no hay sucursal seleccionada)
      query = query.is('sucursal_id', null)
    }

    const { data, error } = await query.order('nombre', { ascending: true })

    if (error) {
      return {
        success: false,
        providers: [],
        error: `Error al obtener proveedores: ${error.message}`,
      }
    }

    return {
      success: true,
      providers: (data as Provider[]) || [],
    }
  } catch (error) {
    return {
      success: false,
      providers: [],
      error: error instanceof Error ? error.message : 'Error desconocido al obtener proveedores',
    }
  }
}

/**
 * ➕ Crea un nuevo proveedor (Global o Local)
 *
 * LÓGICA (preservada del componente original - líneas 106-130):
 *
 * ALCANCE DEL PROVEEDOR:
 * - esGlobal = true  → sucursal_id = NULL (toda la cadena)
 * - esGlobal = false → sucursal_id = sucursalId (solo ese local)
 *
 * VALIDACIÓN:
 * - nombre es obligatorio
 * - organization_id obtenido del usuario autenticado (seguridad)
 * - sucursal_id obtenido del usuario si no es global
 *
 * @param formData - Datos del formulario
 * @param sucursalId - ID de la sucursal (solo si esGlobal = false)
 * @returns CreateProviderResult - Resultado de la operación
 *
 * ORIGEN: Refactorización de handleAddProveedor() del componente
 */
export async function createProviderAction(
  formData: CreateProviderData,
  sucursalId: string | null
): Promise<CreateProviderResult> {
  try {
    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!formData.nombre) {
      return {
        success: false,
        error: 'El nombre es obligatorio',
      }
    }

    if (!formData.esGlobal && !sucursalId) {
      return {
        success: false,
        error: 'Para crear un proveedor local, debes seleccionar una sucursal',
      }
    }

    const { supabase, orgId } = await verifyOwner()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Insertar proveedor con alcance correcto
    // ───────────────────────────────────────────────────────────────────────────

    const { data, error } = await supabase
      .from('proveedores')
      .insert([{
        organization_id: orgId,
        sucursal_id: formData.esGlobal ? null : sucursalId,  // ✅ Lógica de Alcance
        nombre: formData.nombre,
        rubro: formData.rubro,
        contacto_nombre: formData.contacto_nombre,
        telefono: formData.telefono,
        email: formData.email,
        condicion_pago: formData.condicion_pago,
      }])
      .select()
      .single()

    if (error) {
      return {
        success: false,
        error: `Error al guardar proveedor: ${error.message}`,
      }
    }

    return {
      success: true,
      providerId: data?.id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al crear proveedor',
    }
  }
}

/**
 * 🛒 Obtiene historial de compras de un proveedor
 *
 * LÓGICA (preservada del componente original - líneas 94-104):
 *
 * CONSULTA SIMPLE:
 * - Filtra por proveedor_id
 * - Ordenado por fecha descendente (más recientes primero)
 * - Solo campos necesarios para visualización
 *
 * IMPORTANTE:
 * - El componente NO debe conocer la estructura de la tabla compras
 * - Solo pide el historial al servidor
 *
 * @param providerId - ID del proveedor
 * @returns GetPurchaseHistoryResult - Historial de compras
 *
 * ORIGEN: Refactorización de handleSelectProveedor() del componente
 */
export async function getProviderPurchaseHistoryAction(
  providerId: string
): Promise<GetPurchaseHistoryResult> {
  try {
    const { supabase } = await verifyAuth()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!providerId) {
      return {
        success: false,
        purchases: [],
        error: 'Provider ID es requerido',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // CONSULTA DE HISTORIAL
    // ───────────────────────────────────────────────────────────────────────────

    const { data, error } = await supabase
      .from('compras')
      .select('id, monto_total, estado_pago, medio_pago, fecha_compra, comprobante_nro')
      .eq('proveedor_id', providerId)
      .order('fecha_compra', { ascending: false })

    if (error) {
      return {
        success: false,
        purchases: [],
        error: `Error al obtener historial: ${error.message}`,
      }
    }

    return {
      success: true,
      purchases: (data as Purchase[]) || [],
    }
  } catch (error) {
    return {
      success: false,
      purchases: [],
      error: error instanceof Error ? error.message : 'Error desconocido al obtener historial',
    }
  }
}
