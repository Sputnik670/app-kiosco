/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📦 PRODUCTO REPOSITORY
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Repositorio para gestión de productos siguiendo el patrón { data, error }.
 * Basado en docs/DATABASE_SCHEMA.md (esquema real verificado).
 *
 * ESTÁNDAR MAESTRO:
 * - Todas las tablas tienen: id, organization_id, created_at, updated_at
 * - Patrón de respuesta: { data, error }
 * - Sin lógica de negocio (solo traducción DB ↔ código)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database.types'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

type Producto = Database['public']['Tables']['productos']['Row']
type ProductoInsert = Database['public']['Tables']['productos']['Insert']
type ProductoUpdate = Database['public']['Tables']['productos']['Update']

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
 *
 * @param params - Parámetros del producto
 * @returns { data, error } - Producto creado o error
 *
 * ESQUEMA (según DATABASE_SCHEMA.md):
 * - id: uuid (auto-generado)
 * - organization_id: uuid (FK → organizations)
 * - nombre: text (obligatorio)
 * - emoji: text (opcional)
 * - codigo_barras: text (opcional)
 * - categoria: text (opcional)
 * - precio_venta: numeric (opcional)
 * - costo: numeric (opcional)
 * - created_at, updated_at: automáticos
 */
export async function createProducto(
  params: CreateProductoParams
): Promise<{ data: Producto | null; error: Error | null }> {
  try {
    const productoData: ProductoInsert = {
      organization_id: params.organizationId,
      nombre: params.nombre,
      emoji: params.emoji ?? undefined,
      codigo_barras: params.codigoBarras ?? undefined,
      categoria: params.categoria ?? undefined,
      precio_venta: params.precioVenta ?? undefined,
      costo: params.costo ?? undefined,
      // created_at y updated_at son automáticos (DEFAULT now())
    }

    const { data, error } = await supabase
      .from('productos')
      .insert(productoData)
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
 *
 * @param productoId - ID del producto
 * @returns { data, error } - Producto o error
 */
export async function getProductoById(
  productoId: string
): Promise<{ data: Producto | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('productos')
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
 *
 * @param organizationId - ID de la organización
 * @returns { data, error } - Lista de productos o error
 */
export async function listProductosByOrganization(
  organizationId: string
): Promise<{ data: Producto[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('organization_id', organizationId)
      .order('nombre', { ascending: true })

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
 *
 * @param productoId - ID del producto
 * @param updates - Campos a actualizar
 * @returns { data, error } - Producto actualizado o error
 */
export async function updateProducto(
  productoId: string,
  updates: UpdateProductoParams
): Promise<{ data: Producto | null; error: Error | null }> {
  try {
    const updateData: ProductoUpdate = {
      nombre: updates.nombre ?? undefined,
      emoji: updates.emoji ?? undefined,
      codigo_barras: updates.codigoBarras ?? undefined,
      categoria: updates.categoria ?? undefined,
      precio_venta: updates.precioVenta ?? undefined,
      costo: updates.costo ?? undefined,
      // updated_at se actualiza automáticamente por trigger
    }

    // Eliminar campos undefined
    Object.keys(updateData).forEach(
      key => updateData[key as keyof ProductoUpdate] === undefined && delete updateData[key as keyof ProductoUpdate]
    )

    const { data, error } = await supabase
      .from('productos')
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
 * Elimina un producto (soft delete o hard delete según necesidad)
 *
 * @param productoId - ID del producto
 * @returns { data, error } - Confirmación o error
 *
 * NOTA: Implementación hard delete. Si necesitas soft delete,
 * agrega una columna 'activo' en la tabla productos.
 */
export async function deleteProducto(
  productoId: string
): Promise<{ data: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('productos')
      .delete()
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
 *
 * @param organizationId - ID de la organización
 * @param searchTerm - Término de búsqueda
 * @returns { data, error } - Productos encontrados o error
 */
export async function searchProductos(
  organizationId: string,
  searchTerm: string
): Promise<{ data: Producto[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('organization_id', organizationId)
      .or(`nombre.ilike.%${searchTerm}%,codigo_barras.ilike.%${searchTerm}%`)
      .order('nombre', { ascending: true })

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
 *
 * @param organizationId - ID de la organización
 * @param categoria - Categoría a filtrar
 * @returns { data, error } - Productos de la categoría o error
 */
export async function getProductosByCategoria(
  organizationId: string,
  categoria: string
): Promise<{ data: Producto[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('categoria', categoria)
      .order('nombre', { ascending: true })

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
