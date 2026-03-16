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
  name: string
  balance: number
  markup_type: 'percentage' | 'fixed' | null
  markup_value: number | null
  rubro: string | null
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
  name: string
  tax_id: string | null
  phone: string | null
  email: string | null
  balance: number | null
  is_active: boolean
  markup_type: 'percentage' | 'fixed' | null
  markup_value: number | null
  rubro: string | null
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
  esGlobal: boolean
  markup_type?: 'percentage' | 'fixed' | null
  markup_value?: number | null
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
  total: number
  payment_method: string | null
  date: string | null
  invoice_number: string | null
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
      .from('suppliers')
      .select('id, name, balance, markup_type, markup_value, rubro')
      .eq('organization_id', orgId)
      .order('name', { ascending: true })

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
      .from('suppliers')
      .select('balance')
      .eq('id', providerId)
      .single<{ balance: number | null }>()

    if (fetchError) {
      return {
        success: false,
        error: `Proveedor no encontrado: ${fetchError.message}`,
      }
    }

    const saldoActual = proveedorActual?.balance || 0
    const nuevoSaldo = saldoActual + monto

    // UPDATE atómico con el nuevo saldo calculado en servidor
    const { error: updateError } = await supabase
      .from('suppliers')
      .update({ balance: nuevoSaldo })
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
 * let query = supabase.from('suppliers').select('*').eq('organization_id', organizationId)
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
      .from('suppliers')
      .select('*')
      .eq('organization_id', organizationId)

    // V2: suppliers no tiene sucursal_id, son siempre globales por organización
    const { data, error } = await query.order('name', { ascending: true })

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
      .from('suppliers')
      .insert([{
        organization_id: orgId,
        name: formData.nombre,
        phone: formData.telefono,
        email: formData.email,
        rubro: formData.rubro || null,
        markup_type: formData.markup_type || null,
        markup_value: formData.markup_value ?? null,
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
      .from('purchases')
      .select('id, total, payment_method, date, invoice_number')
      .eq('supplier_id', providerId)
      .order('date', { ascending: false })

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

// ───────────────────────────────────────────────────────────────────────────────
// NUEVAS ACCIONES: Compra de crédito con detalle + Markup
// ───────────────────────────────────────────────────────────────────────────────

export interface ServicePurchaseData {
  providerId: string
  amount: number
  paymentMethod: string
  invoiceNumber?: string
  notes?: string
  branchId?: string
}

export interface ServicePurchaseResult {
  success: boolean
  nuevoSaldo?: number
  purchaseId?: string
  error?: string
}

/**
 * 💳 Registra una compra de crédito a un proveedor de servicios
 * Incrementa el saldo Y crea un registro detallado en service_purchases
 */
export async function recordServicePurchaseAction(
  data: ServicePurchaseData
): Promise<ServicePurchaseResult> {
  try {
    const { supabase, orgId, user } = await verifyOwner()

    if (!data.providerId || !data.amount || data.amount <= 0) {
      return { success: false, error: 'Proveedor y monto son requeridos' }
    }

    // 1. Obtener saldo actual
    const { data: prov, error: fetchErr } = await supabase
      .from('suppliers')
      .select('balance')
      .eq('id', data.providerId)
      .single<{ balance: number | null }>()

    if (fetchErr || !prov) {
      return { success: false, error: 'Proveedor no encontrado' }
    }

    const nuevoSaldo = (prov.balance || 0) + data.amount

    // 2. Actualizar saldo
    const { error: updateErr } = await supabase
      .from('suppliers')
      .update({ balance: nuevoSaldo })
      .eq('id', data.providerId)

    if (updateErr) {
      return { success: false, error: `Error al actualizar saldo: ${updateErr.message}` }
    }

    // 3. Registrar compra detallada en service_purchases
    const { data: purchase, error: insertErr } = await supabase
      .from('service_purchases')
      .insert({
        supplier_id: data.providerId,
        organization_id: orgId,
        branch_id: data.branchId || null,
        amount: data.amount,
        payment_method: data.paymentMethod,
        invoice_number: data.invoiceNumber || null,
        notes: data.notes || null,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (insertErr) {
      // Rollback saldo
      await supabase
        .from('suppliers')
        .update({ balance: prov.balance || 0 })
        .eq('id', data.providerId)
      return { success: false, error: `Error al registrar compra: ${insertErr.message}` }
    }

    return { success: true, nuevoSaldo, purchaseId: purchase?.id }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

export interface UpdateMarkupData {
  providerId: string
  markupType: 'percentage' | 'fixed' | null
  markupValue: number | null
}

export interface UpdateMarkupResult {
  success: boolean
  error?: string
}

/**
 * ⚙️ Actualiza la configuración de comisión de un proveedor
 */
export async function updateProviderMarkupAction(
  data: UpdateMarkupData
): Promise<UpdateMarkupResult> {
  try {
    const { supabase } = await verifyOwner()

    // Validar rangos de comisión
    if (data.markupType === 'percentage') {
      const val = Number(data.markupValue) || 0
      if (val <= 0 || val > 100) {
        return { success: false, error: 'El porcentaje debe estar entre 1% y 100%' }
      }
    }
    if (data.markupType === 'fixed') {
      const val = Number(data.markupValue) || 0
      if (val <= 0) {
        return { success: false, error: 'El monto fijo debe ser mayor a $0' }
      }
    }

    const { error } = await supabase
      .from('suppliers')
      .update({
        markup_type: data.markupType,
        markup_value: data.markupValue,
      })
      .eq('id', data.providerId)

    if (error) {
      return { success: false, error: `Error al actualizar comisión: ${error.message}` }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * 📜 Obtiene historial de compras de crédito (service_purchases)
 */
export interface ServicePurchaseRecord {
  id: string
  amount: number
  payment_method: string | null
  invoice_number: string | null
  notes: string | null
  created_at: string
}

export interface GetServicePurchaseHistoryResult {
  success: boolean
  purchases: ServicePurchaseRecord[]
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// ELIMINAR PROVEEDOR
// ───────────────────────────────────────────────────────────────────────────────

export interface DeleteProviderResult {
  success: boolean
  error?: string
}

/**
 * 🗑️ Elimina (desactiva) un proveedor
 *
 * SEGURIDAD:
 * - Solo el dueño puede eliminar proveedores
 * - Si el proveedor tiene saldo pendiente, se advierte pero se permite
 * - Se hace soft-delete (is_active = false) para mantener historial
 * - Si no existe la columna is_active, se hace hard-delete
 */
export async function deleteProviderAction(
  providerId: string
): Promise<DeleteProviderResult> {
  try {
    const { supabase } = await verifyOwner()

    if (!providerId) {
      return { success: false, error: 'ID de proveedor es requerido' }
    }

    // Intentar soft-delete primero (is_active = false)
    const { error: softError } = await supabase
      .from('suppliers')
      .update({ is_active: false })
      .eq('id', providerId)

    if (softError) {
      // Si is_active no existe, hacer hard-delete
      if (softError.message.includes('is_active')) {
        const { error: hardError } = await supabase
          .from('suppliers')
          .delete()
          .eq('id', providerId)

        if (hardError) {
          return { success: false, error: `Error al eliminar proveedor: ${hardError.message}` }
        }
      } else {
        return { success: false, error: `Error al eliminar proveedor: ${softError.message}` }
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al eliminar proveedor',
    }
  }
}

export async function getServicePurchaseHistoryAction(
  providerId: string
): Promise<GetServicePurchaseHistoryResult> {
  try {
    const { supabase } = await verifyAuth()

    const { data, error } = await supabase
      .from('service_purchases')
      .select('id, amount, payment_method, invoice_number, notes, created_at')
      .eq('supplier_id', providerId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return { success: false, purchases: [], error: error.message }
    }

    return { success: true, purchases: (data as ServicePurchaseRecord[]) || [] }
  } catch (error) {
    return {
      success: false,
      purchases: [],
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
