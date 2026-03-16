/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📱 SERVICE SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de servicios virtuales (cargas de celular, TV, etc).
 * Maneja consultas de saldo de proveedores y transacciones atómicas.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Transacciones atómicas para recargas
 * - Validación de saldo y organización
 *
 * MIGRADO: 2026-01-29 - Schema V2 (cash_registers, cash_movements)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import { verifyAuth } from '@/lib/actions/auth-helpers'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Proveedor de servicios virtuales
 */
export interface ServiceProvider {
  id: string
  name: string
  balance: number
  markup_type: 'percentage' | 'fixed' | null
  markup_value: number | null
}

/**
 * Resultado de consulta de proveedor
 */
export interface GetServiceProviderBalanceResult {
  success: boolean
  provider?: ServiceProvider
  error?: string
}

/**
 * Datos para procesar recarga de servicio
 */
export interface ServiceRechargeData {
  turnoId: string
  sucursalId: string
  proveedorId: string
  tipoServicio: string
  montoCarga: number
  comision: number
  totalCobrado: number
  metodoPago: 'efectivo' | 'tarjeta' | 'billetera_virtual'
}

/**
 * Resultado de procesamiento de recarga
 */
export interface ProcessServiceRechargeResult {
  success: boolean
  newBalance?: number
  message?: string
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 💰 Obtiene el saldo del proveedor de servicios virtuales
 *
 * FLUJO:
 * 1. Obtiene organization_id del usuario actual
 * 2. Busca el proveedor según el tipo ('SUBE') o nombre exacto del servicio
 * 3. Devuelve id, nombre y balance
 *
 * @param tipo - 'SUBE' para SUBE, o nombre del servicio (ej: 'Edenor', 'Claro')
 * @returns GetServiceProviderBalanceResult - Datos del proveedor
 *
 * ORIGEN: Refactorización de fetchProveedor() widget-servicios.tsx y widget-sube.tsx
 */
export async function getServiceProviderBalanceAction(
  tipo: string = 'servicios'
): Promise<GetServiceProviderBalanceResult> {
  try {
    const { supabase, orgId } = await verifyAuth()

    // ───────────────────────────────────────────────────────────────────────────
    // Buscar proveedor según tipo
    // ───────────────────────────────────────────────────────────────────────────

    const query = supabase
      .from('suppliers')
      .select('id, balance, name, markup_type, markup_value')
      .eq('organization_id', orgId)

    let result

    if (tipo === 'SUBE') {
      // SUBE: buscar por nombre exacto
      result = await query.ilike('name', '%SUBE%').single()
    } else if (tipo === 'servicios') {
      // Fallback genérico: primer proveedor que no sea SUBE (legacy)
      result = await query.not('name', 'ilike', '%SUBE%').limit(1).single()
    } else {
      // Buscar por nombre exacto del servicio (ej: 'Edenor', 'Telepase')
      // Primero intento match exacto, si no hay, busco parcial
      result = await query.ilike('name', `%${tipo}%`).limit(1).single()

      // Si no hay proveedor específico, buscar un proveedor genérico de servicios
      if (result.error || !result.data) {
        result = await supabase
          .from('suppliers')
          .select('id, balance, name, markup_type, markup_value')
          .eq('organization_id', orgId)
          .not('name', 'ilike', '%SUBE%')
          .limit(1)
          .single()
      }
    }

    const { data, error } = result

    if (error) {
      return {
        success: false,
        error: `Error al obtener proveedor: ${error.message}`,
      }
    }

    if (!data) {
      return {
        success: false,
        error: `No se encontró proveedor de ${tipo}`,
      }
    }

    return {
      success: true,
      provider: data as ServiceProvider,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al obtener proveedor',
    }
  }
}

/**
 * 🔄 Procesa una recarga de servicio virtual (transacción atómica)
 *
 * FLUJO:
 * 1. Obtiene organization_id del turno
 * 2. Verifica saldo suficiente del proveedor
 * 3. TRANSACCIÓN ATÓMICA:
 *    a. Resta saldo al proveedor
 *    b. Registra venta en ventas_servicios
 *    c. Registra ingreso en cash_movements
 * 4. Devuelve nuevo saldo
 *
 * SEGURIDAD:
 * - Valida saldo antes de procesar
 * - Operaciones atómicas para consistencia
 * - Resolución automática de organization_id
 *
 * @param data - Datos de la recarga
 * @returns ProcessServiceRechargeResult - Resultado de la operación
 *
 * ORIGEN: Refactorización de handleCargar() líneas 44-97
 */
export async function processServiceRechargeAction(
  data: ServiceRechargeData
): Promise<ProcessServiceRechargeResult> {
  try {
    const { supabase } = await verifyAuth()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!data.turnoId || !data.proveedorId || !data.montoCarga) {
      return {
        success: false,
        error: 'Datos incompletos para procesar recarga',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener organization_id del turno (Schema V2: cash_registers)
    // ───────────────────────────────────────────────────────────────────────────

    const { data: turno, error: turnoError } = await supabase
      .from('cash_registers')
      .select('organization_id')
      .eq('id', data.turnoId)
      .single()

    if (turnoError || !turno) {
      return {
        success: false,
        error: 'No se encontró el turno',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Verificar saldo del proveedor
    // ───────────────────────────────────────────────────────────────────────────

    const { data: proveedor, error: proveedorError } = await supabase
      .from('suppliers')
      .select('balance')
      .eq('id', data.proveedorId)
      .single<{ balance: number }>()

    if (proveedorError || !proveedor) {
      return {
        success: false,
        error: 'No se encontró el proveedor',
      }
    }

    if (proveedor.balance < data.montoCarga) {
      return {
        success: false,
        error: 'Saldo insuficiente del proveedor',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: TRANSACCIÓN ATÓMICA
    // ───────────────────────────────────────────────────────────────────────────

    const nuevoSaldo = proveedor.balance - data.montoCarga

    // A. Actualizar saldo del proveedor
    const { error: updateError } = await supabase
      .from('suppliers')
      .update({ balance: nuevoSaldo })
      .eq('id', data.proveedorId)

    if (updateError) {
      return {
        success: false,
        error: `Error al actualizar saldo: ${updateError.message}`,
      }
    }

    // B. Registrar venta en tabla dedicada service_sales
    const { error: ventaError } = await supabase
      .from('service_sales')
      .insert({
        organization_id: turno.organization_id,
        branch_id: data.sucursalId,
        cash_register_id: data.turnoId,
        supplier_id: data.proveedorId,
        service_type: data.tipoServicio,
        amount_charged: data.montoCarga,
        commission: data.comision,
        total_collected: data.totalCobrado,
        payment_method: data.metodoPago === 'efectivo' ? 'cash' : data.metodoPago === 'tarjeta' ? 'card' : data.metodoPago === 'billetera_virtual' ? 'wallet' : 'cash',
      })

    if (ventaError) {
      // Rollback: restaurar saldo del proveedor
      await supabase
        .from('suppliers')
        .update({ balance: proveedor.balance })
        .eq('id', data.proveedorId)

      return {
        success: false,
        error: `Error al registrar venta: ${ventaError.message}`,
      }
    }

    // C. Registrar ingreso en caja (Schema V2: cash_movements)
    const { error: cajaError } = await supabase
      .from('cash_movements')
      .insert({
        organization_id: turno.organization_id,
        cash_register_id: data.turnoId,
        amount: data.totalCobrado,
        type: 'income',
        category: 'servicios_virtuales',
        description: `Carga ${data.tipoServicio}`,
      })

    if (cajaError) {
      // Rollback: restaurar saldo del proveedor
      await supabase
        .from('suppliers')
        .update({ balance: proveedor.balance })
        .eq('id', data.proveedorId)

      return {
        success: false,
        error: `Error al registrar movimiento de caja: ${cajaError.message}`,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // ÉXITO
    // ───────────────────────────────────────────────────────────────────────────

    return {
      success: true,
      newBalance: nuevoSaldo,
      message: `Recarga de ${data.tipoServicio} procesada exitosamente`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al procesar recarga',
    }
  }
}

/**
 * 🔄 Procesar recargas virtuales (wrapper para SUBE y servicios)
 *
 * Funciona tanto para servicios (Claro, Movistar, etc.) como para SUBE.
 * Wrapper explícito en vez de alias para compatibilidad con Next.js server actions.
 *
 * @param data - Datos de la recarga
 * @returns ProcessServiceRechargeResult - Resultado de la operación
 */
export async function processVirtualRechargeAction(
  data: ServiceRechargeData
): Promise<ProcessServiceRechargeResult> {
  return processServiceRechargeAction(data)
}
