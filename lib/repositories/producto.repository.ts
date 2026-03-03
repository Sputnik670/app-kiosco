/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📦 PRODUCT REPOSITORY (actualizado para nuevo schema)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Repositorio para gestión de productos siguiendo el patrón { data, error }.
 * Usa tabla 'products' del nuevo schema.
 *
 * MAPEO DE TABLAS:
 * - productos → products
 * - nombre → name
 * - precio_venta → sale_price
 * - costo → cost
 * - codigo_barras → barcode
 * - categoria → category
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database.types'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

type Product = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']

// Alias para compatibilidad con código existente
export type Producto = Product

/**
 * Parámetros para crear un producto
 */
export interface CreateProductoParams {
  organizationId: string
  nombre: string
  emoji?: string | null
  codigoBarras?: string | null
  categoria?: string | null
  precioVenta?: number | null
  costo?: number | null
}

/**
 * Parámetros para actualizar un producto
 */
export interface UpdateProductoParams {
  nombre?: string
  emoji?: string | null
  codigoBarras?: string | null
  categoria?: string | null
  precioVenta?: number | null
  costo?: number | null
}

// ───────────────────────────────────────────────────────────────────────────────
// FUNCIONES DEL REPOSITORIO
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Crea un nuevo producto en el catálogo
 */
export async function createProducto(
  params: CreateProductoParams
): Promise<{ data: Product | null; error: Error | null }> {
  try {
    const productData: ProductInsert = {
      organization_id: params.organizationId,
      name: params.nombre,
      emoji: params.emoji ?? undefined,
      barcode: params.codigoBarras ?? undefined,
      category: params.categoria ?? undefined,
      sale_price: params.precioVenta ?? 0,
      cost: params.costo ?? 0,
    }

    const { data, error } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single()

    if (error) {
      return {
        data: null,
        error: new Error(`Error creando producto: ${error.message}`),
      }
    }

    if (!data) {
      return {
        data: null,
        error: new Error('No se pudo crear el producto'),
      }
    }

    return { data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Error desconocido en createProducto'),
    }
  }
}

/**
 * Obtiene un producto por su ID
 */
export async function getProductoById(
  productoId: string
): Promise<{ data: Product | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productoId)
      .single()

    if (error) {
      return {
        data: null,
        error: new Error(`Error obteniendo producto: ${error.message}`),
      }
    }

    return { data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Error desconocido en getProductoById'),
    }
  }
}

/**
 * Lista todos los productos de una organización
 */
export async function listProductosByOrganization(
  organizationId: string
): Promise<{ data: Product[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      return {
        data: null,
        error: new Error(`Error listando productos: ${error.message}`),
      }
    }

    return { data: data ?? [], error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Error desconocido en listProductosByOrganization'),
    }
  }
}

/**
 * Actualiza un producto existente
 */
export async function updateProducto(
  productoId: string,
  updates: UpdateProductoParams
): Promise<{ data: Product | null; error: Error | null }> {
  try {
    const updateData: ProductUpdate = {}

    if (updates.nombre !== undefined) updateData.name = updates.nombre
    if (updates.emoji !== undefined) updateData.emoji = updates.emoji
    if (updates.codigoBarras !== undefined) updateData.barcode = updates.codigoBarras
    if (updates.categoria !== undefined) updateData.category = updates.categoria
    if (updates.precioVenta !== undefined) updateData.sale_price = updates.precioVenta ?? undefined
    if (updates.costo !== undefined) updateData.cost = updates.costo ?? undefined

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productoId)
      .select()
      .single()

    if (error) {
      return {
        data: null,
        error: new Error(`Error actualizando producto: ${error.message}`),
      }
    }

    return { data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Error desconocido en updateProducto'),
    }
  }
}

/**
 * Elimina un producto (soft delete - marca como inactivo)
 */
export async function deleteProducto(
  productoId: string
): Promise<{ data: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', productoId)

    if (error) {
      return {
        data: false,
        error: new Error(`Error eliminando producto: ${error.message}`),
      }
    }

    return { data: true, error: null }
  } catch (error) {
    return {
      data: false,
      error: error instanceof Error ? error : new Error('Error desconocido en deleteProducto'),
    }
  }
}

/**
 * Busca productos por nombre o código de barras
 */
export async function searchProductos(
  organizationId: string,
  searchTerm: string
): Promise<{ data: Product[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .or(`name.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`)
      .order('name', { ascending: true })

    if (error) {
      return {
        data: null,
        error: new Error(`Error buscando productos: ${error.message}`),
      }
    }

    return { data: data ?? [], error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Error desconocido en searchProductos'),
    }
  }
}

/**
 * Obtiene productos por categoría
 */
export async function getProductosByCategoria(
  organizationId: string,
  categoria: string
): Promise<{ data: Product[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('category', categoria)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      return {
        data: null,
        error: new Error(`Error obteniendo productos por categoría: ${error.message}`),
      }
    }

    return { data: data ?? [], error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Error desconocido en getProductosByCategoria'),
    }
  }
}
