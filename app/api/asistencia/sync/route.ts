/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔄 API DE SINCRONIZACIÓN DE ASISTENCIA OFFLINE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Endpoint para sincronizar fichajes (entrada/salida) realizados offline.
 *
 * CARACTERÍSTICAS:
 * - Idempotente: Usa local_id para evitar duplicados
 * - Validación de sesión y organización
 * - Soporta entradas y salidas
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

interface SyncAsistenciaRequest {
  localId: string
  organizationId: string
  branchId: string
  userId: string
  tipo: 'entrada' | 'salida'
  timestamp: number // momento real del fichaje
  attendanceId?: string | null // para salidas: ID del registro activo
}

interface SyncAsistenciaResponse {
  success: boolean
  attendanceId?: string
  action?: 'entrada' | 'salida'
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// HANDLER POST
// ───────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse<SyncAsistenciaResponse>> {
  try {
    const supabase = await createClient()

    // Verificar sesión
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Parsear body
    const body: SyncAsistenciaRequest = await request.json()

    // Validación básica
    if (!body.localId || !body.branchId || !body.organizationId || !body.tipo || !body.timestamp) {
      return NextResponse.json(
        { success: false, error: 'Datos incompletos: localId, branchId, organizationId, tipo y timestamp son requeridos' },
        { status: 400 }
      )
    }

    if (body.tipo !== 'entrada' && body.tipo !== 'salida') {
      return NextResponse.json(
        { success: false, error: 'Tipo debe ser "entrada" o "salida"' },
        { status: 400 }
      )
    }

    // Validar que el timestamp sea razonable (no más de 48h en el pasado)
    const maxAge = 48 * 60 * 60 * 1000 // 48 horas
    const now = Date.now()
    if (body.timestamp > now + 60000 || body.timestamp < now - maxAge) {
      return NextResponse.json(
        { success: false, error: 'Timestamp fuera de rango válido (máximo 48h de antigüedad)' },
        { status: 400 }
      )
    }

    // Verificar que el usuario pertenece a la organización
    const { data: orgId } = await supabase.rpc('get_my_org_id')
    if (!orgId || orgId !== body.organizationId) {
      return NextResponse.json(
        { success: false, error: 'No perteneces a esta organización' },
        { status: 403 }
      )
    }

    const fichajeTimestamp = new Date(body.timestamp).toISOString()

    // ─────────────────────────────────────────────────────────────────────────
    // CASO: ENTRADA
    // ─────────────────────────────────────────────────────────────────────────
    if (body.tipo === 'entrada') {
      // Verificar idempotencia: buscar si ya existe una entrada cercana
      // (mismo usuario, misma sucursal, dentro de 5 minutos del timestamp)
      const fiveMinBefore = new Date(body.timestamp - 5 * 60 * 1000).toISOString()
      const fiveMinAfter = new Date(body.timestamp + 5 * 60 * 1000).toISOString()

      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', user.id)
        .eq('branch_id', body.branchId)
        .gte('check_in', fiveMinBefore)
        .lte('check_in', fiveMinAfter)
        .maybeSingle()

      if (existing) {
        // Ya existe — idempotente
        return NextResponse.json({
          success: true,
          attendanceId: existing.id,
          action: 'entrada',
        })
      }

      // Insertar nueva entrada
      const { data: newRecord, error: insertError } = await supabase
        .from('attendance')
        .insert({
          organization_id: body.organizationId,
          branch_id: body.branchId,
          user_id: user.id,
          check_in: fichajeTimestamp,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('Error sincronizando entrada de asistencia:', insertError.message)
        return NextResponse.json(
          { success: false, error: 'Error al registrar entrada' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        attendanceId: newRecord.id,
        action: 'entrada',
      })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CASO: SALIDA
    // ─────────────────────────────────────────────────────────────────────────
    if (body.tipo === 'salida') {
      // Buscar el registro activo (check_out = null)
      let attendanceId = body.attendanceId

      if (!attendanceId) {
        // Si no viene el ID, buscar el fichaje abierto más reciente
        const { data: activeRecord } = await supabase
          .from('attendance')
          .select('id')
          .eq('user_id', user.id)
          .eq('branch_id', body.branchId)
          .is('check_out', null)
          .order('check_in', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!activeRecord) {
          return NextResponse.json(
            { success: false, error: 'No hay fichaje activo para cerrar' },
            { status: 404 }
          )
        }

        attendanceId = activeRecord.id
      }

      // Verificar que no tenga ya check_out (idempotencia)
      const { data: record } = await supabase
        .from('attendance')
        .select('id, check_out')
        .eq('id', attendanceId)
        .single()

      if (record?.check_out) {
        // Ya tiene salida — idempotente
        return NextResponse.json({
          success: true,
          attendanceId: record.id,
          action: 'salida',
        })
      }

      // Actualizar con check_out
      const { error: updateError } = await supabase
        .from('attendance')
        .update({ check_out: fichajeTimestamp })
        .eq('id', attendanceId)

      if (updateError) {
        console.error('Error sincronizando salida de asistencia:', updateError.message)
        return NextResponse.json(
          { success: false, error: 'Error al registrar salida' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        attendanceId: attendanceId || undefined,
        action: 'salida',
      })
    }

    return NextResponse.json(
      { success: false, error: 'Tipo no válido' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error en sync de asistencia:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
