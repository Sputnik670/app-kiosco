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
    const { supabase, orgId } = await verifyOwner()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('incidents').insert({
      organization_id: orgId,
      branch_id: params.branchId || null,
      employee_id: params.employeeId,
      reported_by: user!.id,
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
    }))

    return { success: true, incidents }
  } catch (error) {
    return { success: false, incidents: [], error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// JUSTIFICAR INCIDENTE (Empleado)
// ───────────────────────────────────────────────────────────────────────────────

export async function justifyIncidentAction(
  incidentId: string,
  justification: string,
  justificationType: 'desconocimiento' | 'olvido' | 'externo' | 'otro'
) {
  try {
    const { supabase } = await verifyAuth()

    const { error } = await supabase
      .from('incidents')
      .update({
        justification,
        justification_type: justificationType,
        status: 'justified',
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
// OBTENER INCIDENTES DEL EMPLEADO ACTUAL (para vista empleado)
// ───────────────────────────────────────────────────────────────────────────────

export async function getMyIncidentsAction(): Promise<{ success: boolean; incidents: Incident[]; error?: string }> {
  try {
    const { supabase } = await verifyAuth()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, incidents: [], error: 'No autenticado' }

    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('employee_id', user.id)
      .in('status', ['open', 'justified'])
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
      })),
    }
  } catch (error) {
    return { success: false, incidents: [], error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}
