/**
 * ===============================================================================
 * CASH ACTIONS - Server Actions para gestión completa de caja
 * ===============================================================================
 *
 * Archivo consolidado que maneja:
 * - Apertura y cierre de caja diaria (turno)
 * - Movimientos de caja (ingresos/egresos)
 * - Gamificación automática (XP + misiones)
 * - Auditoría completa de efectivo
 *
 * MIGRADO: 2026-01-27 - Schema V2 (tablas en inglés)
 *
 * ===============================================================================
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAuth } from '@/lib/actions/auth-helpers'
import { format, addDays } from 'date-fns'
import { logger } from '@/lib/logging'
import { abrirCajaSchema, cerrarCajaSchema, cashMovementSchema, getZodError } from '@/lib/validations'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS EXPORTADOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resultado de apertura de caja
 */
export interface AbrirCajaResult {
  success: boolean
  cajaId?: string
  error?: string
}

/**
 * Resultado de cierre de caja con auditoría
 */
export interface CerrarCajaResult {
  success: boolean
  exitoArqueo: boolean
  dineroEsperado: number
  montoDeclarado: number
  desvio: number
  detalles?: {
    montoInicial: number
    totalVentasEfectivo: number
    totalIngresosExtra: number
    totalGastos: number
  }
  error?: string
}

/**
 * Resultado de creación de movimiento de caja
 */
export interface CreateCashMovementResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Movimiento de caja (schema V2)
 */
export interface CashMovement {
  id: string
  organization_id: string
  cash_register_id: string
  amount: number
  type: 'income' | 'expense' | 'opening' | 'closing' | 'adjustment'
  description: string | null
  category: string | null
  user_id: string | null
  created_at: string
}

/**
 * Resultado de consulta de movimientos
 */
export interface GetShiftMovementsResult {
  success: boolean
  movements: CashMovement[]
  error?: string
}

/**
 * Estado de caja activa (interfaz legacy para compatibilidad con componentes)
 */
export interface CajaActivaResult {
  success: boolean
  hayCajaAbierta: boolean
  caja?: {
    id: string
    monto_inicial: number
    fecha_apertura: string
    empleado_id: string
  }
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIONES AUXILIARES (INTERNAS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera misiones automáticas al abrir caja
 *
 * LÓGICA:
 * 1. Misión de vencimientos (si hay stock crítico)
 * 2. Misión de arqueo de cierre (siempre)
 * 3. Misiones desde plantillas (configuradas por el dueño)
 */
async function generateMissions(
  cashRegisterId: string,
  userId: string,
  organizationId: string,
  branchId: string
): Promise<void> {
  try {
    const supabase = await createClient()
    const today = new Date()
    const expirationLimit = format(addDays(today, 10), 'yyyy-MM-dd')

    // PASO 1: Consultar stock crítico (próximo a vencer)
    const { data: criticalStock } = await supabase
      .from('stock_batches')
      .select('quantity')
      .eq('branch_id', branchId)
      .eq('status', 'available')
      .lt('expiration_date', expirationLimit)

    const totalUnitsAtRisk = (criticalStock as Array<{ quantity: number }> | null)?.reduce(
      (acc, curr) => acc + (curr.quantity || 0),
      0
    ) || 0

    const missionsToInsert = []

    // PASO 2: Crear misión de vencimientos (si hay unidades críticas)
    if (totalUnitsAtRisk > 0) {
      missionsToInsert.push({
        organization_id: organizationId,
        user_id: userId,
        cash_register_id: cashRegisterId,
        type: 'vencimiento',
        description: `Rotación Preventiva: Colocar al frente ${totalUnitsAtRisk} unidades próximas a vencer.`,
        target_value: totalUnitsAtRisk,
        current_value: 0,
        is_completed: false,
        points: 30,
      })
    }

    // PASO 3: Crear misión de arqueo de cierre (siempre)
    missionsToInsert.push({
      organization_id: organizationId,
      user_id: userId,
      cash_register_id: cashRegisterId,
      type: 'arqueo_cierre',
      description: 'Realizar el cierre de caja con precisión total.',
      target_value: 1,
      current_value: 0,
      is_completed: false,
      points: 20,
    })

    // PASO 4: Agregar plantillas de misiones configuradas
    const { data: templates } = await supabase
      .from('mission_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .or(`branch_id.is.null,branch_id.eq.${branchId}`)

    if (templates) {
      templates.forEach((t: { description: string; points: number }) => {
        missionsToInsert.push({
          organization_id: organizationId,
          user_id: userId,
          cash_register_id: cashRegisterId,
          type: 'manual',
          description: t.description,
          target_value: 1,
          current_value: 0,
          is_completed: false,
          points: t.points,
        })
      })
    }

    // PASO 5: Insertar todas las misiones en bulk
    if (missionsToInsert.length > 0) {
      const { error: insertError } = await supabase.from('missions').insert(missionsToInsert)
      if (insertError) {
        logger.error('generateMissions', 'Error insertando misiones', insertError, {
          cashRegisterId,
          userId,
          missionCount: missionsToInsert.length,
        })
        // No lanzamos error para no bloquear apertura de caja
        // Las misiones son una feature secundaria
      }
    }
  } catch (error) {
    // Log del error pero no bloqueamos la apertura de caja
    logger.error('generateMissions', 'Error generando misiones', error instanceof Error ? error : new Error(String(error)), {
      cashRegisterId,
      userId,
      organizationId,
      branchId,
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS - APERTURA/CIERRE DE CAJA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Abre una nueva caja diaria y genera misiones automáticas
 *
 * FLUJO:
 * 1. Valida sesión y organización
 * 2. Crea registro en cash_registers
 * 3. Genera misiones automáticas (vencimientos + arqueo + plantillas)
 */
export async function abrirCajaAction(
  montoInicial: number,
  sucursalId: string
): Promise<AbrirCajaResult> {
  try {
    // Validación Zod
    const parsed = abrirCajaSchema.safeParse({ montoInicial, sucursalId })
    if (!parsed.success) {
      return { success: false, error: getZodError(parsed) }
    }

    const { supabase, user, orgId } = await verifyAuth()

    // PASO 2: Crear registro de cash_register
    const today = new Date()
    const { data: cashRegister, error: registerError } = await supabase
      .from('cash_registers')
      .insert({
        organization_id: orgId,
        branch_id: sucursalId,
        date: format(today, 'yyyy-MM-dd'),
        opening_amount: montoInicial,
        is_open: true,
        opened_by: user.id,
        opened_at: today.toISOString(),
      })
      .select()
      .single()

    if (registerError || !cashRegister) {
      return {
        success: false,
        error: `Error al crear la caja diaria: ${registerError?.message || 'Unknown error'}`,
      }
    }

    // PASO 3: Generar misiones automáticas
    await generateMissions(cashRegister.id, user.id, orgId, sucursalId)

    return {
      success: true,
      cajaId: cashRegister.id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al abrir caja',
    }
  }
}

/**
 * Cierra la caja diaria con auditoría completa y gamificación
 *
 * FLUJO CRÍTICO:
 * 1. Calcula ventas en efectivo desde sales
 * 2. Calcula movimientos manuales (excluyendo ventas para evitar duplicación)
 * 3. Aplica fórmula: (Base + Ventas + Ingresos) - Gastos = Esperado
 * 4. Valida precisión del arqueo (tolerancia ±$100)
 * 5. Si es preciso: Completa misión + Otorga XP
 * 6. Guarda cierre con diferencia
 */
export async function cerrarCajaAction(
  cajaId: string,
  montoDeclarado: number
): Promise<CerrarCajaResult> {
  try {
    // Validación Zod
    const parsed = cerrarCajaSchema.safeParse({ cajaId, montoDeclarado })
    if (!parsed.success) {
      return {
        success: false,
        exitoArqueo: false,
        dineroEsperado: 0,
        montoDeclarado: 0,
        desvio: 0,
        error: getZodError(parsed),
      }
    }

    const { supabase, user } = await verifyAuth()

    // PASO 1: Obtener datos de la caja
    const { data: cashRegister } = await supabase
      .from('cash_registers')
      .select('id, opening_amount, opened_by, organization_id')
      .eq('id', cajaId)
      .single<{
        id: string
        opening_amount: number
        opened_by: string
        organization_id: string
      }>()

    if (!cashRegister) {
      return {
        success: false,
        exitoArqueo: false,
        dineroEsperado: 0,
        montoDeclarado: 0,
        desvio: 0,
        error: 'No se encontró la caja',
      }
    }

    // PASO 2: Validar que el usuario puede cerrar la caja
    // Solo puede cerrar: el empleado que abrió la caja O el owner
    const { data: isOwner } = await supabase.rpc('is_owner')
    const isOpener = cashRegister.opened_by === user.id

    if (!isOwner && !isOpener) {
      return {
        success: false,
        exitoArqueo: false,
        dineroEsperado: 0,
        montoDeclarado: 0,
        desvio: 0,
        error: 'Solo el empleado que abrió la caja o el dueño pueden cerrarla',
      }
    }

    // PASO 3: CALCULAR VENTAS EN EFECTIVO
    const { data: salesData } = await supabase
      .from('sales')
      .select('total')
      .eq('cash_register_id', cajaId)
      .eq('payment_method', 'cash')

    const totalVentasEfectivo = salesData?.reduce((sum: number, item: { total: number | null }) => {
      return sum + Number(item.total || 0)
    }, 0) || 0

    // PASO 4: CALCULAR MOVIMIENTOS MANUALES
    // Excluir categoria='sale' para no duplicar ventas
    const { data: movementsData } = await supabase
      .from('cash_movements')
      .select('amount, type, category, description')
      .eq('cash_register_id', cajaId)
      .neq('category', 'sale')

    const totalIngresosExtra = movementsData?.filter((m) => m.type === 'income')
      .reduce((sum, item) => sum + Number(item.amount), 0) || 0

    const totalGastos = movementsData?.filter((m) => m.type === 'expense')
      .reduce((sum, item) => sum + Number(item.amount), 0) || 0

    // PASO 5: ECUACIÓN FINAL DEL EFECTIVO ESPERADO
    const dineroEsperado =
      Number(cashRegister.opening_amount) + totalVentasEfectivo + totalIngresosExtra - totalGastos

    // PASO 6: CALCULAR DIFERENCIA Y VALIDAR PRECISIÓN
    const desvio = montoDeclarado - dineroEsperado
    const exitoArqueo = Math.abs(desvio) <= 100 // Tolerancia de $100

    // PASO 7: GAMIFICACIÓN - COMPLETAR MISIÓN Y OTORGAR XP
    if (exitoArqueo) {
      // Completar misión de arqueo
      await supabase
        .from('missions')
        .update({ is_completed: true, current_value: 1, completed_at: new Date().toISOString() })
        .eq('cash_register_id', cajaId)
        .eq('type', 'arqueo_cierre')

      // Otorgar XP al empleado via memberships
      // IMPORTANTE: Usar supabaseAdmin porque la RLS de memberships_update
      // requiere is_org_admin(), y el empleado no puede actualizar su propio XP
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('xp')
        .eq('user_id', cashRegister.opened_by)
        .eq('organization_id', cashRegister.organization_id)
        .single<{ xp: number | null }>()

      if (membership && membership.xp !== null) {
        await supabaseAdmin
          .from('memberships')
          .update({ xp: membership.xp + 20 })
          .eq('user_id', cashRegister.opened_by)
          .eq('organization_id', cashRegister.organization_id)
      }
    }

    // PASO 8: GUARDAR CIERRE EN BASE DE DATOS
    await supabase
      .from('cash_registers')
      .update({
        closing_amount: montoDeclarado,
        expected_amount: dineroEsperado,
        variance: desvio,
        is_open: false,
        closed_by: user.id,
        closed_at: new Date().toISOString(),
      })
      .eq('id', cajaId)

    return {
      success: true,
      exitoArqueo,
      dineroEsperado,
      montoDeclarado,
      desvio,
      detalles: {
        montoInicial: Number(cashRegister.opening_amount),
        totalVentasEfectivo,
        totalIngresosExtra,
        totalGastos,
      },
    }
  } catch (error) {
    console.error('Error en cierre de caja:', error)
    return {
      success: false,
      exitoArqueo: false,
      dineroEsperado: 0,
      montoDeclarado: 0,
      desvio: 0,
      error: error instanceof Error ? error.message : 'Error desconocido al cerrar caja',
    }
  }
}

/**
 * Verifica si hay una caja abierta para la sucursal actual
 * Retorna datos en formato legacy para compatibilidad con componentes
 */
export async function getCajaActivaAction(
  sucursalId: string
): Promise<CajaActivaResult> {
  try {
    const { supabase } = await verifyAuth()

    const { data: cashRegister, error } = await supabase
      .from('cash_registers')
      .select('id, opening_amount, opened_at, opened_by')
      .eq('branch_id', sucursalId)
      .eq('is_open', true)
      .order('opened_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found
      return {
        success: false,
        hayCajaAbierta: false,
        error: `Error consultando caja: ${error.message}`,
      }
    }

    // Mapear a formato legacy para compatibilidad con componentes
    return {
      success: true,
      hayCajaAbierta: !!cashRegister,
      caja: cashRegister ? {
        id: cashRegister.id,
        monto_inicial: cashRegister.opening_amount,
        fecha_apertura: cashRegister.opened_at,
        empleado_id: cashRegister.opened_by || '',
      } : undefined,
    }
  } catch (error) {
    return {
      success: false,
      hayCajaAbierta: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS - MOVIMIENTOS DE CAJA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un movimiento de caja (ingreso o egreso)
 *
 * FLUJO:
 * 1. Valida sesión y parámetros
 * 2. Obtiene organization_id del usuario
 * 3. Inserta movimiento en cash_movements vinculando organización y turno
 */
export async function createCashMovementAction(params: {
  monto: number
  descripcion: string
  tipo: 'ingreso' | 'egreso'
  turnoId: string
  categoria?: string
}): Promise<CreateCashMovementResult> {
  try {
    // Validación Zod
    const parsed = cashMovementSchema.safeParse(params)
    if (!parsed.success) {
      return { success: false, error: getZodError(parsed) }
    }

    const { monto, descripcion, tipo, turnoId, categoria } = params

    if (!tipo || (tipo !== 'ingreso' && tipo !== 'egreso')) {
      return {
        success: false,
        error: 'Tipo de movimiento inválido',
      }
    }

    if (!turnoId) {
      return {
        success: false,
        error: 'ID de turno requerido',
      }
    }

    const { supabase, user, orgId } = await verifyAuth()

    // Mapear tipo español a inglés
    const typeMap: Record<string, 'income' | 'expense'> = {
      'ingreso': 'income',
      'egreso': 'expense',
    }

    // PASO 2: Insertar movimiento de caja
    const { error } = await supabase
      .from('cash_movements')
      .insert({
        organization_id: orgId,
        cash_register_id: turnoId,
        amount: monto,
        description: descripcion.trim(),
        type: typeMap[tipo],
        category: categoria || null,
        user_id: user.id,
      })

    if (error) {
      return {
        success: false,
        error: `Error al registrar movimiento: ${error.message}`,
      }
    }

    const tipoLabel = tipo === 'egreso' ? 'retiraron' : 'ingresaron'
    return {
      success: true,
      message: `Se ${tipoLabel} $${monto.toLocaleString()} de la caja.`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al registrar movimiento',
    }
  }
}

/**
 * Obtiene todos los movimientos de un turno (por defecto solo egresos)
 *
 * FLUJO:
 * 1. Valida parámetros
 * 2. Consulta cash_movements filtrando por turno
 * 3. Ordena por fecha de creación descendente
 */
export async function getShiftMovementsAction(
  cajaId: string,
  tipo?: 'ingreso' | 'egreso' | 'all'
): Promise<GetShiftMovementsResult> {
  try {
    const { supabase } = await verifyAuth()

    if (!cajaId) {
      return {
        success: false,
        movements: [],
        error: 'ID de turno requerido',
      }
    }

    // Mapear tipo español a inglés
    const typeMap: Record<string, 'income' | 'expense'> = {
      'ingreso': 'income',
      'egreso': 'expense',
    }

    let query = supabase
      .from('cash_movements')
      .select('*')
      .eq('cash_register_id', cajaId)
      .order('created_at', { ascending: false })

    // Filtrar por tipo si no es 'all'
    if (tipo && tipo !== 'all') {
      query = query.eq('type', typeMap[tipo])
    }

    const { data, error } = await query

    if (error) {
      return {
        success: false,
        movements: [],
        error: `Error al consultar movimientos: ${error.message}`,
      }
    }

    return {
      success: true,
      movements: (data as CashMovement[]) || [],
    }
  } catch (error) {
    return {
      success: false,
      movements: [],
      error: error instanceof Error ? error.message : 'Error desconocido al consultar movimientos',
    }
  }
}
