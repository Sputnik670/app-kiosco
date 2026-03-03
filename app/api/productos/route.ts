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

    // Obtener sucursalId de query params
    const { searchParams } = new URL(request.url)
    const sucursalId = searchParams.get('sucursalId')

    if (!sucursalId) {
      return NextResponse.json(
        { success: false, error: 'sucursalId es requerido' },
        { status: 400 }
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
      return NextResponse.json(
        { success: false, error: `Error obteniendo productos: ${error.message}` },
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
