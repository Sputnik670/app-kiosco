/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔄 API DE SINCRONIZACIÓN DE VENTAS OFFLINE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Endpoint para sincronizar ventas realizadas en modo offline.
 *
 * CARACTERÍSTICAS:
 * - Idempotente: Si la venta ya existe (por local_id), retorna éxito sin duplicar
 * - Validación de datos
 * - Uso del RPC process_sale para consistencia transaccional (Schema V2)
 *
 * MIGRADO: 2026-01-27 - Schema V2 (tablas en inglés, process_sale con p_local_id)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import type { Json } from '@/types/database.types'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Métodos de pago soportados (Schema V2)
 */
type PaymentMethod = 'cash' | 'card' | 'wallet' | 'transfer'

interface SyncVentaRequest {
  localId: string
  sucursalId: string
  turnoId: string
  organizationId: string
  items: Array<{
    producto_id: string
    cantidad: number
    precio_unitario: number
    nombre: string
    subtotal: number
  }>
  metodoPago: PaymentMethod
  montoTotal: number
  vendedorId?: string | null
  createdAt: number // timestamp
}

interface SyncVentaResponse {
  success: boolean
  ventaId?: string
  error?: string
  alreadyExists?: boolean
}

// ───────────────────────────────────────────────────────────────────────────────
// HANDLER POST
// ───────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse<SyncVentaResponse>> {
  try {
    const supabase = await createClient()

    // ─────────────────────────────────────────────────────────────────────────
    // AUTENTICACIÓN: Verificar que el usuario está autenticado
    // ─────────────────────────────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Parsear body
    const body: SyncVentaRequest = await request.json()

    // ─────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ─────────────────────────────────────────────────────────────────────────

    if (!body.localId) {
      return NextResponse.json(
        { success: false, error: 'localId es requerido' },
        { status: 400 }
      )
    }

    if (!body.sucursalId) {
      return NextResponse.json(
        { success: false, error: 'sucursalId es requerido' },
        { status: 400 }
      )
    }

    if (!body.turnoId) {
      return NextResponse.json(
        { success: false, error: 'turnoId (cash_register_id) es requerido' },
        { status: 400 }
      )
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'items es requerido y no puede estar vacío' },
        { status: 400 }
      )
    }

    if (body.montoTotal <= 0) {
      return NextResponse.json(
        { success: false, error: 'montoTotal debe ser mayor a 0' },
        { status: 400 }
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AUTORIZACIÓN: Verificar que el usuario pertenece a la organización
    // ─────────────────────────────────────────────────────────────────────────
    const { data: userOrgId } = await supabase.rpc('get_my_org_id')
    if (!userOrgId) {
      return NextResponse.json(
        { success: false, error: 'Usuario sin organización asignada' },
        { status: 403 }
      )
    }

    // Validar que la organización enviada coincide con la del usuario
    if (body.organizationId && body.organizationId !== userOrgId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado para esta organización' },
        { status: 403 }
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VERIFICAR QUE EL TURNO (CAJA) EXISTE Y ESTÁ ABIERTO
    // Usa tabla cash_registers (Schema V2)
    // ─────────────────────────────────────────────────────────────────────────

    let cashRegisterId = body.turnoId

    const { data: turno, error: turnoError } = await supabase
      .from('cash_registers')
      .select('id, is_open')
      .eq('id', body.turnoId)
      .single()

    if (turnoError || !turno) {
      // Si el turno no existe, intentar asignar al turno activo de la sucursal
      const { data: turnoActivo, error: turnoActivoError } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('branch_id', body.sucursalId)
        .eq('is_open', true)
        .order('opened_at', { ascending: false })
        .limit(1)
        .single()

      if (turnoActivoError || !turnoActivo) {
        return NextResponse.json(
          {
            success: false,
            error: 'No hay turno de caja activo. Por favor abra una caja primero.'
          },
          { status: 400 }
        )
      }

      // Usar el turno activo en lugar del original
      cashRegisterId = turnoActivo.id
    } else if (!turno.is_open) {
      // El turno original está cerrado, buscar uno activo
      const { data: turnoActivo } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('branch_id', body.sucursalId)
        .eq('is_open', true)
        .order('opened_at', { ascending: false })
        .limit(1)
        .single()

      if (turnoActivo) {
        cashRegisterId = turnoActivo.id
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'El turno de caja está cerrado y no hay uno activo.'
          },
          { status: 400 }
        )
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PROCESAR VENTA CON RPC process_sale (Schema V2)
    // El RPC maneja idempotencia internamente via p_local_id
    // Si local_id ya existe, retorna el ID existente sin crear duplicado
    // ─────────────────────────────────────────────────────────────────────────

    // Preparar items en formato esperado por el RPC V2
    const itemsParaRPC = body.items.map((item) => ({
      product_id: item.producto_id,
      quantity: item.cantidad,
      unit_price: item.precio_unitario,
      subtotal: item.precio_unitario * item.cantidad,
    }))

    const { data: ventaId, error: ventaError } = await supabase.rpc('process_sale', {
      p_branch_id: body.sucursalId,
      p_cash_register_id: cashRegisterId,
      p_items: itemsParaRPC as unknown as Json,
      p_payment_method: body.metodoPago,
      p_total: body.montoTotal,
      p_local_id: body.localId,  // ← CLAVE PARA IDEMPOTENCIA
      p_notes: null,
    })

    if (ventaError) {
      // Analizar el error para dar mejor feedback
      const errorMessage = ventaError.message.toLowerCase()

      if (errorMessage.includes('stock') || errorMessage.includes('insuficiente') || errorMessage.includes('insufficient')) {
        return NextResponse.json(
          { success: false, error: 'Stock insuficiente para uno o más productos' },
          { status: 400 }
        )
      }

      if (errorMessage.includes('sucursal') || errorMessage.includes('branch') || errorMessage.includes('no encontrada') || errorMessage.includes('not found')) {
        return NextResponse.json(
          { success: false, error: 'Sucursal no válida' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { success: false, error: `Error procesando venta: ${ventaError.message}` },
        { status: 500 }
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ÉXITO
    // El RPC retorna el ID de la venta (nueva o existente si era duplicada)
    // ─────────────────────────────────────────────────────────────────────────

    return NextResponse.json({
      success: true,
      ventaId: ventaId,
      alreadyExists: false, // El RPC no indica si ya existía, pero retorna éxito
    })

  } catch (error) {
    console.error('Error en sync de venta:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// HANDLER GET - Para verificar estado del endpoint
// ───────────────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/ventas/sync',
    methods: ['POST'],
    description: 'Endpoint para sincronizar ventas realizadas en modo offline (Schema V2)',
    features: [
      'Idempotencia via local_id',
      'Usa RPC process_sale',
      'Tablas: cash_registers, sales, sale_items',
    ],
  })
}
