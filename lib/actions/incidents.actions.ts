/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🚨 INCIDENTS SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de incidentes/errores con justificaciones.
 * El dueño reporta errores, el empleado justifica, ambos pueden resolver.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { verifyAuth, verifyOwner } from '@/lib/actions/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createIncidentSchema, justifyIncidentSchema, resolveIncidentSchema, getZodError } from '@/lib/validations'
import { addXpEventAction } from '@/lib/actions/xp.actions'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

export interface Incident {
  id: string
  employee_id: string
  employee_name?: string
  branch_id: string | null
  type: string
  description: string
  severity: string
  resolution: string | null
  justification: string | null
  justification_type: string | null
  status: string
  created_at: string
  resolved_at: string | null
  // Campos v2: descargo + resolución formal
  employee_message: string | null
  resolution_notes: string | null
  resolution_type: string | null
  xp_deducted: number
}

export interface CreateIncidentParams {
  employeeId: string
  branchId?: string
  cashRegisterId?: string
  type: 'error' | 'cash_difference' | 'stock_loss' | 'attendance' | 'other'
  description: string
  severity: 'low' | 'medium' | 'high'
  resolution?: string // Instrucciones de cómo solucionarlo
}

// ───────────────────────────────────────────────────────────────────────────────
// CREAR INCIDENTE (Dueño)
// ───────────────────────────────────────────────────────────────────────────────

export async function createIncidentAction(params: CreateIncidentParams) {
  try {
    const parsed = createIncidentSchema.safeParse(params)
    if (!parsed.success) {
      return { success: false, error: getZodError(parsed) }
    }

    const { supabase, user, orgId } = await verifyOwner()

    const { error } = await supabase.from('incidents').insert({
      organization_id: orgId,
      branch_id: params.branchId || null,
      employee_id: params.employeeId,
      reported_by: user.id,
      cash_register_id: params.cashRegisterId || null,
      type: params.type,
      description: params.description,
      severity: params.severity,
      resolution: params.resolution || null,
      status: 'open',
    })

    if (error) {
      return { success: false, error: `Error creando incidente: ${error.message}` }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// LISTAR INCIDENTES
// ───────────────────────────────────────────────────────────────────────────────

export async function getIncidentsAction(filters?: {
  employeeId?: string
  status?: string
  branchId?: string
}): Promise<{ success: boolean; incidents: Incident[]; error?: string }> {
  try {
    const { supabase, orgId } = await verifyAuth()

    let query = supabase
      .from('incidents')
      .select('*, memberships!incidents_employee_id_fkey(display_name)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (filters?.employeeId) {
      query = query.eq('employee_id', filters.employeeId)
    }
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.branchId) {
      query = query.eq('branch_id', filters.branchId)
    }

    const { data, error } = await query

    if (error) {
      // Fallback sin join si la FK no existe
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('incidents')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (fallbackError) {
        return { success: false, incidents: [], error: fallbackError.message }
      }

      return {
        success: true,
        incidents: (fallbackData || []).map(d => ({
          ...d,
          employee_name: undefined,
        })),
      }
    }

    const incidents: Incident[] = (data || []).map((d: any) => ({
      id: d.id,
      employee_id: d.employee_id,
      employee_name: d.memberships?.display_name || undefined,
      branch_id: d.branch_id,
      type: d.type,
      description: d.description,
      severity: d.severity,
      resolution: d.resolution,
      justification: d.justification,
      justification_type: d.justification_type,
      status: d.status,
      created_at: d.created_at,
      resolved_at: d.resolved_at,
      employee_message: d.employee_message || null,
      resolution_notes: d.resolution_notes || null,
      resolution_type: d.resolution_type || null,
      xp_deducted: d.xp_deducted || 0,
    }))

    return { success: true, incidents }
  } catch (error) {
    return { success: false, incidents: [], error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// JUSTIFICAR INCIDENTE (Empleado)
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Empleado envía su descargo para un incidente.
 * El mensaje es OBLIGATORIO — no se puede enviar sin texto.
 * El status pasa a 'awaiting_resolution' para que el dueño lo revise.
 *
 * También soporta el formato legacy con justification_type para
 * mantener compatibilidad con componentes existentes.
 */
export async function justifyIncidentAction(
  incidentId: string,
  justification: string,
  justificationType: 'desconocimiento' | 'olvido' | 'externo' | 'otro'
) {
  try {
    const parsed = justifyIncidentSchema.safeParse({ incidentId, justification, justificationType })
    if (!parsed.success) {
      return { success: false, error: getZodError(parsed) }
    }

    if (!justification || justification.trim().length < 5) {
      return { success: false, error: 'El descargo es obligatorio (mínimo 5 caracteres)' }
    }

    const { supabase } = await verifyAuth()

    const { error } = await supabase
      .from('incidents')
      .update({
        justification,
        justification_type: justificationType,
        employee_message: justification, // campo v2
        status: 'awaiting_resolution',
      })
      .eq('id', incidentId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// RESOLVER / DESCARTAR INCIDENTE (Dueño)
// ───────────────────────────────────────────────────────────────────────────────

export async function resolveIncidentAction(
  incidentId: string,
  status: 'resolved' | 'dismissed',
  resolution?: string
) {
  try {
    const parsed = resolveIncidentSchema.safeParse({ incidentId, status, resolution })
    if (!parsed.success) {
      return { success: false, error: getZodError(parsed) }
    }

    const { supabase } = await verifyOwner()

    const updateData: Record<string, any> = {
      status,
      resolved_at: new Date().toISOString(),
    }
    if (resolution) {
      updateData.resolution = resolution
    }

    const { error } = await supabase
      .from('incidents')
      .update(updateData)
      .eq('id', incidentId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// RESOLVER INCIDENTE V2 — Con tipo de resolución y devolución de XP
// ───────────────────────────────────────────────────────────────────────────────

export type ResolutionType = 'sin_consecuencias' | 'capacitacion' | 'advertencia' | 'sancion' | 'desvinculacion'

/**
 * Resolución formal de un incidente por el dueño (v2).
 *
 * FLUJO:
 * 1. Valida que el incidente existe y tiene descargo del empleado
 * 2. Guarda resolution_type + resolution_notes
 * 3. Si resolution_type === 'sin_consecuencias' y hay xp_deducted > 0,
 *    devuelve el XP descontado registrando un evento 'absolucion'
 * 4. Cierra el incidente
 */
export async function resolveIncidentV2Action(params: {
  incidentId: string
  resolutionType: ResolutionType
  resolutionNotes: string
}): Promise<{ success: boolean; xpRestored?: number; error?: string }> {
  try {
    const { incidentId, resolutionType, resolutionNotes } = params

    if (!incidentId) {
      return { success: false, error: 'ID de incidente requerido' }
    }
    if (!resolutionNotes || resolutionNotes.trim().length < 3) {
      return { success: false, error: 'Las notas de resolución son obligatorias' }
    }

    const { user, orgId } = await verifyOwner()

    // Leer incidente actual (con supabaseAdmin para evitar RLS issues)
    const { data: incident, error: readError } = await supabaseAdmin
      .from('incidents')
      .select('id, employee_id, branch_id, xp_deducted, status, employee_message')
      .eq('id', incidentId)
      .eq('organization_id', orgId)
      .single()

    if (readError || !incident) {
      return { success: false, error: 'Incidente no encontrado' }
    }

    // Validar que el empleado ya envió su descargo
    if (!incident.employee_message && incident.status === 'open') {
      return { success: false, error: 'El empleado aún no envió su descargo. El descargo es obligatorio antes de resolver.' }
    }

    // Actualizar incidente
    const { error: updateError } = await supabaseAdmin
      .from('incidents')
      .update({
        status: 'resolved',
        resolution_type: resolutionType,
        resolution_notes: resolutionNotes,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', incidentId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Si fue absuelto y hay XP descontado, devolver
    let xpRestored = 0
    if (resolutionType === 'sin_consecuencias' && incident.xp_deducted && incident.xp_deducted > 0) {
      xpRestored = incident.xp_deducted

      await addXpEventAction({
        organizationId: orgId,
        branchId: incident.branch_id,
        userId: incident.employee_id,
        eventType: 'absolucion',
        points: xpRestored, // positivo: devuelve los puntos
        description: `Puntos devueltos por resolución sin consecuencias: ${resolutionNotes}`,
        incidentId,
        createdBy: user.id,
      })
    }

    return { success: true, xpRestored }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// OBTENER INCIDENTES DEL EMPLEADO ACTUAL (para vista empleado)
// ───────────────────────────────────────────────────────────────────────────────

export async function getMyIncidentsAction(): Promise<{ success: boolean; incidents: Incident[]; error?: string }> {
  try {
    const { supabase, user } = await verifyAuth()

    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('employee_id', user.id)
      .in('status', ['open', 'justified', 'awaiting_resolution'])
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, incidents: [], error: error.message }
    }

    return {
      success: true,
      incidents: (data || []).map(d => ({
        id: d.id,
        employee_id: d.employee_id,
        branch_id: d.branch_id,
        type: d.type,
        description: d.description,
        severity: d.severity,
        resolution: d.resolution,
        justification: d.justification,
        justification_type: d.justification_type,
        status: d.status,
        created_at: d.created_at,
        resolved_at: d.resolved_at,
        employee_message: d.employee_message || null,
        resolution_notes: d.resolution_notes || null,
        resolution_type: d.resolution_type || null,
        xp_deducted: d.xp_deducted || 0,
      })),
    }
  } catch (error) {
    return { success: false, incidents: [], error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}
