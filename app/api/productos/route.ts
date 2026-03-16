/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📦 API DE PRODUCTOS - Para cache offline
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Endpoint para obtener todos los productos de una sucursal.
 * Usado principalmente para poblar el cache de productos offline.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import type { ProductoFromServer } from '@/lib/offline/product-cache'

// ───────────────────────────────────────────────────────────────────────────────
// HANDLER GET
// ───────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    // ─── AUTH: Verificar que el usuario esté logueado ───
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Obtener sucursalId de query params
    const { searchParams } = new URL(request.url)
    const sucursalId = searchParams.get('sucursalId')

    if (!sucursalId) {
      return NextResponse.json(
        { success: false, error: 'sucursalId es requerido' },
        { status: 400 }
      )
    }

    // ─── AUTH: Verificar que la sucursal pertenece a la organización del usuario ───
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Usuario sin organización' },
        { status: 403 }
      )
    }

    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('id', sucursalId)
      .eq('organization_id', membership.organization_id)
      .single()

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Sucursal no pertenece a tu organización' },
        { status: 403 }
      )
    }

    // Obtener productos con stock de la vista
    const { data, error } = await supabase
      .from('view_productos_con_stock')
      .select('*')
      .eq('sucursal_id', sucursalId)
      // Excluir servicios virtuales
      .not('nombre', 'in', '("Carga SUBE","Carga Virtual")')
      .order('nombre', { ascending: true })

    if (error) {
      console.error('Error obteniendo productos:', error.message)
      return NextResponse.json(
        { success: false, error: 'Error obteniendo productos' },
        { status: 500 }
      )
    }

    // Mapear a formato esperado
    const productos: ProductoFromServer[] = (data || []).map((p) => ({
      id: p.id || '',
      nombre: p.nombre || '',
      categoria: p.categoria,
      codigo_barras: p.codigo_barras,
      costo: p.costo,
      emoji: p.emoji,
      precio_venta: p.precio_venta || 0,
      stock_disponible: p.stock_disponible || 0,
      stock_minimo: p.stock_minimo,
      sucursal_id: p.sucursal_id || sucursalId,
      organization_id: p.organization_id || '',
    }))

    return NextResponse.json({
      success: true,
      productos,
      count: productos.length,
    })

  } catch (error) {
    console.error('Error en API de productos:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
