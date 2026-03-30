/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * XP SERVER ACTIONS — Sistema de rendimiento y XP automático
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Lógica central para:
 * - Registrar eventos de XP (positivos y negativos)
 * - Leer configuración de rendimiento por organización
 * - Consultar historial con agregados diario/semanal/mensual
 * - XP manual del dueño (premio/sanción)
 * - Evaluar puntualidad en apertura de caja
 * - Evaluar diferencias en cierre de caja
 *
 * IMPORTANTE: Usa supabaseAdmin para TODAS las escrituras de XP
 * porque la RLS de memberships no permite que el empleado actualice
 * su propio XP.
 *
 * CREADO: 2026-03-29
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAuth, verifyOwner } from '@/lib/actions/auth-helpers'
import { logger } from '@/lib/logging'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

export type XpEventType =
  | 'apertura_puntual'
  | 'llegada_tarde'
  | 'cierre_limpio'
  | 'diferencia_caja'
  | 'mision_completada'
  | 'mision_incumplida'
  | 'xp_manual'
  | 'absolucion'

export interface XpConfig {
  xp_apertura_puntual: number
  xp_tardanza_leve: number
  xp_tardanza_grave: number
  tardanza_tolerancia_min: number
  tardanza_grave_min: number
  xp_cierre_limpio: number
  xp_diferencia_grave: number
  umbral_diferencia_leve: number
  umbral_diferencia_grave: number
  xp_mision_incumplida: number
}

export interface XpEvent {
  id: string
  event_type: XpEventType
  points: number
  description: string | null
  created_at: string
  user_id: string
}

export interface XpSummaryRow {
  user_id: string
  display_name: string
  xp_gained: number
  xp_lost: number
  xp_balance: number
  incident_count: number
  incidents_resolved: number
  total_variance: number
}

// Defaults — se usan si la org no tiene xp_config
const XP_DEFAULTS: XpConfig = {
  xp_apertura_puntual: 20,
  xp_tardanza_leve: -25,
  xp_tardanza_grave: -50,
  tardanza_tolerancia_min: 15,
  tardanza_grave_min: 60,
  xp_cierre_limpio: 30,
  xp_diferencia_grave: -40,
  umbral_diferencia_leve: 200,
  umbral_diferencia_grave: 1000,
  xp_mision_incumplida: -10,
}

// ───────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene la configuración de XP de la org, o los defaults si no existe
 */
export async function getXpConfigAction(orgId?: string): Promise<{
  success: boolean
  config: XpConfig
  error?: string
}> {
  try {
    let organizationId = orgId
    if (!organizationId) {
      const ctx = await verifyAuth()
      organizationId = ctx.orgId
    }

    const { data } = await supabaseAdmin
      .from('xp_config')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (!data) {
      return { success: true, config: { ...XP_DEFAULTS } }
    }

    return {
      success: true,
      config: {
        xp_apertura_puntual: data.xp_apertura_puntual,
        xp_tardanza_leve: data.xp_tardanza_leve,
        xp_tardanza_grave: data.xp_tardanza_grave,
        tardanza_tolerancia_min: data.tardanza_tolerancia_min,
        tardanza_grave_min: data.tardanza_grave_min,
        xp_cierre_limpio: data.xp_cierre_limpio,
        xp_diferencia_grave: data.xp_diferencia_grave,
        umbral_diferencia_leve: Number(data.umbral_diferencia_leve),
        umbral_diferencia_grave: Number(data.umbral_diferencia_grave),
        xp_mision_incumplida: data.xp_mision_incumplida,
      },
    }
  } catch (error) {
    return {
      success: false,
      config: { ...XP_DEFAULTS },
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// FUNCIÓN CENTRAL: REGISTRAR EVENTO DE XP
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Registra un evento de XP y actualiza memberships.xp en una sola operación.
 *
 * Esta función es el ÚNICO punto de escritura de XP en toda la app.
 * Cualquier cambio de XP (automático o manual) pasa por acá.
 *
 * USA supabaseAdmin para bypass de RLS.
 */
export async function addXpEventAction(params: {
  organizationId: string
  branchId?: string | null
  userId: string
  eventType: XpEventType
  points: number
  description: string
  cashRegisterId?: string | null
  incidentId?: string | null
  createdBy?: string | null
}): Promise<{ success: boolean; newXp?: number; error?: string }> {
  try {
    const {
      organizationId,
      branchId,
      userId,
      eventType,
      points,
      description,
      cashRegisterId,
      incidentId,
      createdBy,
    } = params

    // 1. Insertar evento en xp_events
    const { error: insertError } = await supabaseAdmin
      .from('xp_events')
      .insert({
        organization_id: organizationId,
        branch_id: branchId || null,
        user_id: userId,
        event_type: eventType,
        points,
        description,
        cash_register_id: cashRegisterId || null,
        incident_id: incidentId || null,
        created_by: createdBy || null,
      })

    if (insertError) {
      logger.error('addXpEventAction', 'Error insertando xp_event', insertError, {
        userId,
        eventType,
        points,
      })
      return { success: false, error: `Error registrando evento XP: ${insertError.message}` }
    }

    // 2. Actualizar memberships.xp (leer + sumar)
    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('xp')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single<{ xp: number | null }>()

    const currentXp = membership?.xp || 0
    const newXp = Math.max(0, currentXp + points) // XP nunca baja de 0

    const { error: updateError } = await supabaseAdmin
      .from('memberships')
      .update({ xp: newXp })
      .eq('user_id', userId)
      .eq('organization_id', organizationId)

    if (updateError) {
      logger.error('addXpEventAction', 'Error actualizando XP en memberships', updateError, {
        userId,
        currentXp,
        newXp,
      })
      return { success: false, error: `Error actualizando XP: ${updateError.message}` }
    }

    return { success: true, newXp }
  } catch (error) {
    logger.error('addXpEventAction', 'Error inesperado', error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// EVALUAR PUNTUALIDAD AL ABRIR CAJA
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Evalúa si la apertura de caja fue puntual y registra el evento XP correspondiente.
 * Se llama desde abrirCajaAction() después de crear el cash_register.
 *
 * LÓGICA:
 * - Lee branch_schedules para obtener horario esperado
 * - Si no hay horario configurado, no hace nada (la sucursal aún no está configurada)
 * - Compara hora actual con open_time + tolerancia
 * - Registra evento positivo o negativo + crea incident si es tardanza
 */
export async function evaluateOpeningPunctualityAction(params: {
  organizationId: string
  branchId: string
  userId: string
  cashRegisterId: string
  openedAt: Date
}): Promise<{ success: boolean; punctual?: boolean; points?: number }> {
  try {
    const { organizationId, branchId, userId, cashRegisterId, openedAt } = params

    // 1. Leer TODOS los turnos activos de la sucursal
    const { data: shifts } = await supabaseAdmin
      .from('branch_schedules')
      .select('shift_name, open_time, open_tolerance_minutes, is_active')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('shift_order', { ascending: true })

    // Sin turnos configurados → no evaluar
    if (!shifts || shifts.length === 0) {
      return { success: true }
    }

    // 2. Encontrar el turno más cercano a la hora de apertura
    const openedMinutes = openedAt.getHours() * 60 + openedAt.getMinutes()

    let closestShift = shifts[0]
    let closestDiff = Infinity

    for (const shift of shifts) {
      const [h, m] = (shift.open_time as string).split(':').map(Number)
      const shiftMinutes = h * 60 + m
      // Diferencia absoluta (considerar que podría abrir antes del turno)
      const diff = Math.abs(openedMinutes - shiftMinutes)
      if (diff < closestDiff) {
        closestDiff = diff
        closestShift = shift
      }
    }

    // 3. Leer config de XP de la org
    const { config } = await getXpConfigAction(organizationId)

    // 4. Calcular diferencia en minutos (positivo = tarde, negativo = temprano)
    const [targetHour, targetMin] = (closestShift.open_time as string).split(':').map(Number)
    const diffMinutes = openedMinutes - (targetHour * 60 + targetMin)

    const tolerance = closestShift.open_tolerance_minutes || config.tardanza_tolerancia_min

    // 5. Evaluar
    if (diffMinutes <= tolerance) {
      // PUNTUAL: premio
      await addXpEventAction({
        organizationId,
        branchId,
        userId,
        eventType: 'apertura_puntual',
        points: config.xp_apertura_puntual,
        description: `Apertura puntual — turno ${closestShift.shift_name} (${diffMinutes > 0 ? '+' + diffMinutes : diffMinutes} min)`,
        cashRegisterId,
      })
      return { success: true, punctual: true, points: config.xp_apertura_puntual }
    }

    // TARDANZA
    const isGrave = diffMinutes > config.tardanza_grave_min
    const points = isGrave ? config.xp_tardanza_grave : config.xp_tardanza_leve
    const severity = isGrave ? 'high' : 'medium'

    // Crear incident automático
    const { data: incident } = await supabaseAdmin
      .from('incidents')
      .insert({
        organization_id: organizationId,
        branch_id: branchId,
        employee_id: userId,
        reported_by: userId,
        cash_register_id: cashRegisterId,
        type: 'attendance',
        description: `Tardanza de ${diffMinutes} min en turno ${closestShift.shift_name} (horario esperado: ${closestShift.open_time})`,
        severity,
        status: 'open',
        xp_deducted: Math.abs(points),
      })
      .select('id')
      .single()

    // Registrar evento XP negativo
    await addXpEventAction({
      organizationId,
      branchId,
      userId,
      eventType: 'llegada_tarde',
      points,
      description: `Tardanza de ${diffMinutes} min en turno ${closestShift.shift_name} (${isGrave ? 'grave' : 'leve'})`,
      cashRegisterId,
      incidentId: incident?.id || null,
    })

    return { success: true, punctual: false, points }
  } catch (error) {
    logger.error('evaluateOpeningPunctualityAction', 'Error evaluando puntualidad', error instanceof Error ? error : new Error(String(error)))
    return { success: false }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// EVALUAR CIERRE DE CAJA
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Evalúa la diferencia de caja al cerrar y registra el evento XP correspondiente.
 * También evalúa misiones incumplidas del turno.
 *
 * Se llama desde cerrarCajaAction() después de calcular la variance.
 */
export async function evaluateClosingAction(params: {
  organizationId: string
  branchId: string
  userId: string
  cashRegisterId: string
  variance: number
}): Promise<{ success: boolean }> {
  try {
    const { organizationId, branchId, userId, cashRegisterId, variance } = params
    const absVariance = Math.abs(variance)

    // 1. Leer config de XP
    const { config } = await getXpConfigAction(organizationId)

    // 2. Evaluar diferencia de caja
    if (absVariance < Number(config.umbral_diferencia_leve)) {
      // CIERRE LIMPIO: premio
      await addXpEventAction({
        organizationId,
        branchId,
        userId,
        eventType: 'cierre_limpio',
        points: config.xp_cierre_limpio,
        description: `Cierre limpio (diferencia: $${variance.toFixed(0)})`,
        cashRegisterId,
      })
    } else if (absVariance >= Number(config.umbral_diferencia_grave)) {
      // DIFERENCIA GRAVE: penalidad + incident
      const { data: incident } = await supabaseAdmin
        .from('incidents')
        .insert({
          organization_id: organizationId,
          branch_id: branchId,
          employee_id: userId,
          reported_by: userId,
          cash_register_id: cashRegisterId,
          type: 'cash_difference',
          description: `Diferencia de caja: $${variance.toFixed(0)} (umbral: $${config.umbral_diferencia_grave})`,
          severity: 'high',
          status: 'open',
          xp_deducted: Math.abs(config.xp_diferencia_grave),
        })
        .select('id')
        .single()

      await addXpEventAction({
        organizationId,
        branchId,
        userId,
        eventType: 'diferencia_caja',
        points: config.xp_diferencia_grave,
        description: `Diferencia de caja grave: $${variance.toFixed(0)}`,
        cashRegisterId,
        incidentId: incident?.id || null,
      })
    } else {
      // DIFERENCIA LEVE ($200-$999): aviso sin XP
      await supabaseAdmin
        .from('incidents')
        .insert({
          organization_id: organizationId,
          branch_id: branchId,
          employee_id: userId,
          reported_by: userId,
          cash_register_id: cashRegisterId,
          type: 'cash_difference',
          description: `Diferencia de caja leve: $${variance.toFixed(0)} (sin penalidad, aviso)`,
          severity: 'low',
          status: 'open',
          xp_deducted: 0,
        })
    }

    // 3. Evaluar misiones incumplidas del turno
    const { data: uncompletedMissions } = await supabaseAdmin
      .from('missions')
      .select('id, description')
      .eq('cash_register_id', cashRegisterId)
      .eq('is_completed', false)

    if (uncompletedMissions && uncompletedMissions.length > 0) {
      const missionNames = uncompletedMissions
        .map((m: { description: string }) => m.description)
        .join(', ')

      // Un solo incident por todas las misiones incumplidas del turno
      const totalPenalty = config.xp_mision_incumplida * uncompletedMissions.length

      const { data: incident } = await supabaseAdmin
        .from('incidents')
        .insert({
          organization_id: organizationId,
          branch_id: branchId,
          employee_id: userId,
          reported_by: userId,
          cash_register_id: cashRegisterId,
          type: 'other',
          description: `${uncompletedMissions.length} misión(es) incumplida(s): ${missionNames}`,
          severity: uncompletedMissions.length >= 3 ? 'high' : 'low',
          status: 'open',
          xp_deducted: Math.abs(totalPenalty),
        })
        .select('id')
        .single()

      await addXpEventAction({
        organizationId,
        branchId,
        userId,
        eventType: 'mision_incumplida',
        points: totalPenalty,
        description: `${uncompletedMissions.length} misión(es) incumplida(s) al cerrar caja`,
        cashRegisterId,
        incidentId: incident?.id || null,
      })
    }

    return { success: true }
  } catch (error) {
    logger.error('evaluateClosingAction', 'Error evaluando cierre', error instanceof Error ? error : new Error(String(error)))
    return { success: false }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// XP MANUAL DEL DUEÑO
// ───────────────────────────────────────────────────────────────────────────────

/**
 * El dueño otorga o descuenta XP manualmente a un empleado.
 * Crea un incident de tipo xp_manual para registro.
 */
export async function addManualXpAction(params: {
  employeeId: string
  branchId?: string | null
  points: number
  message: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { employeeId, branchId, points, message } = params

    if (!message || message.trim().length < 3) {
      return { success: false, error: 'El mensaje es obligatorio (mínimo 3 caracteres)' }
    }

    if (points === 0) {
      return { success: false, error: 'Los puntos no pueden ser 0' }
    }

    const { user, orgId } = await verifyOwner()

    const isPositive = points > 0
    const incidentType = isPositive ? 'other' : 'other'
    const severity = isPositive ? 'low' : 'medium'

    // Crear incident para registro
    const { data: incident } = await supabaseAdmin
      .from('incidents')
      .insert({
        organization_id: orgId,
        branch_id: branchId || null,
        employee_id: employeeId,
        reported_by: user.id,
        type: incidentType,
        description: `Ajuste manual de puntos: ${isPositive ? '+' : ''}${points} — ${message}`,
        severity,
        status: isPositive ? 'resolved' : 'open',
        resolution: isPositive ? message : null,
        resolution_type: isPositive ? 'sin_consecuencias' : null,
        resolution_notes: isPositive ? `Premio otorgado por: ${message}` : null,
        resolved_at: isPositive ? new Date().toISOString() : null,
        xp_deducted: isPositive ? 0 : Math.abs(points),
      })
      .select('id')
      .single()

    // Registrar evento XP
    await addXpEventAction({
      organizationId: orgId,
      branchId,
      userId: employeeId,
      eventType: 'xp_manual',
      points,
      description: `${isPositive ? 'Premio' : 'Penalidad'} manual: ${message}`,
      incidentId: incident?.id || null,
      createdBy: user.id,
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// GUARDAR CONFIGURACIÓN DE RENDIMIENTO
// ───────────────────────────────────────────────────────────────────────────────

/**
 * El dueño guarda su configuración personalizada de reglas de rendimiento.
 * Upsert: si no existe fila para la org, la crea. Si existe, la actualiza.
 */
export async function saveXpConfigAction(config: Partial<XpConfig>): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const { orgId } = await verifyOwner()

    const { error } = await supabaseAdmin
      .from('xp_config')
      .upsert(
        {
          organization_id: orgId,
          ...config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' }
      )

    if (error) {
      return { success: false, error: `Error guardando configuración: ${error.message}` }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// HISTORIAL DE XP
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene historial de eventos XP con filtros
 */
export async function getXpHistoryAction(filters?: {
  userId?: string
  branchId?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
}): Promise<{ success: boolean; events: XpEvent[]; error?: string }> {
  try {
    const { orgId } = await verifyAuth()

    let query = supabaseAdmin
      .from('xp_events')
      .select('id, event_type, points, description, created_at, user_id')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(filters?.limit || 100)

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId)
    }
    if (filters?.branchId) {
      query = query.eq('branch_id', filters.branchId)
    }
    if (filters?.dateFrom) {
      query = query.gte('created_at', filters.dateFrom)
    }
    if (filters?.dateTo) {
      query = query.lte('created_at', filters.dateTo)
    }

    const { data, error } = await query

    if (error) {
      return { success: false, events: [], error: error.message }
    }

    return { success: true, events: (data || []) as XpEvent[] }
  } catch (error) {
    return { success: false, events: [], error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// RESUMEN POR PERÍODO (para vista de dueño)
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Genera resumen de rendimiento por empleado para un período dado.
 * Agrega: XP ganado, XP perdido, balance, incidentes, diferencia de caja acumulada.
 */
export async function getXpSummaryAction(params: {
  dateFrom: string
  dateTo: string
  branchId?: string
}): Promise<{ success: boolean; summary: XpSummaryRow[]; error?: string }> {
  try {
    const { orgId } = await verifyOwner()
    const { dateFrom, dateTo, branchId } = params

    // 1. Obtener todos los eventos XP del período
    let xpQuery = supabaseAdmin
      .from('xp_events')
      .select('user_id, points, event_type')
      .eq('organization_id', orgId)
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo)

    if (branchId) {
      xpQuery = xpQuery.eq('branch_id', branchId)
    }

    const { data: xpEvents } = await xpQuery

    // 2. Obtener incidentes del período
    let incQuery = supabaseAdmin
      .from('incidents')
      .select('employee_id, status')
      .eq('organization_id', orgId)
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo)

    if (branchId) {
      incQuery = incQuery.eq('branch_id', branchId)
    }

    const { data: incidents } = await incQuery

    // 3. Obtener variance acumulada de cash_registers del período
    let cashQuery = supabaseAdmin
      .from('cash_registers')
      .select('opened_by, variance')
      .eq('organization_id', orgId)
      .gte('opened_at', dateFrom)
      .lte('opened_at', dateTo)
      .not('variance', 'is', null)

    if (branchId) {
      cashQuery = cashQuery.eq('branch_id', branchId)
    }

    const { data: cashRegisters } = await cashQuery

    // 4. Obtener nombres de empleados
    const { data: members } = await supabaseAdmin
      .from('memberships')
      .select('user_id, display_name')
      .eq('organization_id', orgId)
      .eq('role', 'employee')
      .eq('is_active', true)

    // 5. Agregar datos por empleado
    const employeeMap = new Map<string, XpSummaryRow>()

    // Inicializar con empleados
    for (const m of members || []) {
      employeeMap.set(m.user_id, {
        user_id: m.user_id,
        display_name: m.display_name || 'Sin nombre',
        xp_gained: 0,
        xp_lost: 0,
        xp_balance: 0,
        incident_count: 0,
        incidents_resolved: 0,
        total_variance: 0,
      })
    }

    // Sumar XP
    for (const ev of xpEvents || []) {
      const row = employeeMap.get(ev.user_id)
      if (!row) continue
      if (ev.points > 0) {
        row.xp_gained += ev.points
      } else {
        row.xp_lost += ev.points
      }
      row.xp_balance += ev.points
    }

    // Contar incidentes
    for (const inc of incidents || []) {
      const row = employeeMap.get(inc.employee_id)
      if (!row) continue
      row.incident_count++
      if (inc.status === 'resolved' || inc.status === 'dismissed') {
        row.incidents_resolved++
      }
    }

    // Sumar variance
    for (const cr of cashRegisters || []) {
      const row = employeeMap.get(cr.opened_by)
      if (!row) continue
      row.total_variance += Math.abs(Number(cr.variance || 0))
    }

    return {
      success: true,
      summary: Array.from(employeeMap.values()),
    }
  } catch (error) {
    return {
      success: false,
      summary: [],
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// GUARDAR TURNO DE SUCURSAL (multi-turno)
// ───────────────────────────────────────────────────────────────────────────────

export interface BranchShift {
  branch_id: string
  shift_name: string
  shift_order: number
  open_time: string
  open_tolerance_minutes: number
  is_active: boolean
}

/**
 * El dueño configura un turno de una sucursal.
 * Upsert por (branch_id, shift_name) — el constraint UNIQUE compuesto.
 */
export async function saveBranchScheduleAction(params: {
  branchId: string
  shiftName: string       // "Mañana", "Tarde", "Noche"
  shiftOrder: number      // 1, 2, 3
  openTime: string        // "HH:MM"
  toleranceMinutes?: number
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { orgId } = await verifyOwner()
    const { branchId, shiftName, shiftOrder, openTime, toleranceMinutes } = params

    if (!/^\d{2}:\d{2}$/.test(openTime)) {
      return { success: false, error: 'Formato de hora inválido. Usar HH:MM' }
    }

    if (!shiftName || shiftName.trim().length === 0) {
      return { success: false, error: 'El nombre del turno es obligatorio' }
    }

    const { error } = await supabaseAdmin
      .from('branch_schedules')
      .upsert(
        {
          branch_id: branchId,
          organization_id: orgId,
          shift_name: shiftName.trim(),
          shift_order: shiftOrder,
          open_time: openTime,
          open_tolerance_minutes: toleranceMinutes || 15,
          is_active: true,
        },
        { onConflict: 'branch_id,shift_name' }
      )

    if (error) {
      return { success: false, error: `Error guardando turno: ${error.message}` }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

/**
 * Elimina un turno de una sucursal (hard delete).
 */
export async function deleteBranchShiftAction(params: {
  branchId: string
  shiftName: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { orgId } = await verifyOwner()

    const { error } = await supabaseAdmin
      .from('branch_schedules')
      .delete()
      .eq('branch_id', params.branchId)
      .eq('organization_id', orgId)
      .eq('shift_name', params.shiftName)

    if (error) {
      return { success: false, error: `Error eliminando turno: ${error.message}` }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

/**
 * Obtiene los turnos de todas las sucursales de la organización.
 * Devuelve múltiples filas por sucursal (una por turno).
 */
export async function getBranchSchedulesAction(): Promise<{
  success: boolean
  schedules: BranchShift[]
  error?: string
}> {
  try {
    const { supabase, orgId } = await verifyAuth()

    const { data, error } = await supabase
      .from('branch_schedules')
      .select('branch_id, shift_name, shift_order, open_time, open_tolerance_minutes, is_active')
      .eq('organization_id', orgId)
      .order('shift_order', { ascending: true })

    if (error) {
      return { success: false, schedules: [], error: error.message }
    }

    return { success: true, schedules: (data || []) as BranchShift[] }
  } catch (error) {
    return { success: false, schedules: [], error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}
