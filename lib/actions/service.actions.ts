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
  nombre: string
  saldo_actual: number
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
  metodoPago: 'efectivo' | 'billetera_virtual'
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
 * 2. Busca el proveedor según el tipo ('servicios' o 'SUBE')
 * 3. Devuelve id, nombre y saldo_actual
 *
 * @param tipo - Tipo de proveedor: 'servicios' o 'SUBE'
 * @returns GetServiceProviderBalanceResult - Datos del proveedor
 *
 * ORIGEN: Refactorización de fetchProveedor() widget-servicios.tsx y widget-sube.tsx
 */
export async function getServiceProviderBalanceAction(
  tipo: 'servicios' | 'SUBE' = 'servicios'
): Promise<GetServiceProviderBalanceResult> {
  try {
    const { supabase, orgId } = await verifyAuth()

    // ───────────────────────────────────────────────────────────────────────────
    // Buscar proveedor según tipo
    // ───────────────────────────────────────────────────────────────────────────

    const criterio = tipo === 'SUBE' ? '%SUBE%' : '%servicios%'
    const campo = tipo === 'SUBE' ? 'nombre' : 'rubro'

    const query = supabase
      .from('proveedores')
      .select('id, saldo_actual, nombre')
      .eq('organization_id', orgId)

    const { data, error } = tipo === 'SUBE'
      ? await query.ilike('nombre', criterio).single()
      : await query.ilike('rubro', criterio).limit(1).single()

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
      .from('proveedores')
      .select('saldo_actual')
      .eq('id', data.proveedorId)
      .single<{ saldo_actual: number }>()

    if (proveedorError || !proveedor) {
      return {
        success: false,
        error: 'No se encontró el proveedor',
      }
    }

    if (proveedor.saldo_actual < data.montoCarga) {
      return {
        success: false,
        error: 'Saldo insuficiente del proveedor',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: TRANSACCIÓN ATÓMICA
    // ───────────────────────────────────────────────────────────────────────────

    const nuevoSaldo = proveedor.saldo_actual - data.montoCarga

    // A. Actualizar saldo del proveedor
    const { error: updateError } = await supabase
      .from('proveedores')
      .update({ saldo_actual: nuevoSaldo })
      .eq('id', data.proveedorId)

    if (updateError) {
      return {
        success: false,
        error: `Error al actualizar saldo: ${updateError.message}`,
      }
    }

    // B. Registrar venta de servicio
    const { error: ventaError } = await supabase
      .from('ventas_servicios')
      .insert({
        organization_id: turno.organization_id,
        sucursal_id: data.sucursalId,
        caja_diaria_id: data.turnoId,
        proveedor_id: data.proveedorId,
        tipo_servicio: data.tipoServicio,
        monto_carga: data.montoCarga,
        comision: data.comision,
        total_cobrado: data.totalCobrado,
        metodo_pago: data.metodoPago,
      })

    if (ventaError) {
      // Rollback: restaurar saldo del proveedor
      await supabase
        .from('proveedores')
        .update({ saldo_actual: proveedor.saldo_actual })
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
        .from('proveedores')
        .update({ saldo_actual: proveedor.saldo_actual })
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
 * 🔄 Alias para procesar recargas virtuales (nombre genérico)
 *
 * Funciona tanto para servicios (Claro, Movistar, etc.) como para SUBE.
 * Es la misma función que processServiceRechargeAction.
 *
 * @param data - Datos de la recarga
 * @returns ProcessServiceRechargeResult - Resultado de la operación
 */
export const processVirtualRechargeAction = processServiceRechargeAction
