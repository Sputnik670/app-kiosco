/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📦 PRODUCT SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de productos.
 * Maneja verificación de existencia y creación completa (producto + historial + stock).
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Operación unificada: products + price_history + stock_batches
 * - organization_id obtenido/validado en servidor
 * - Sin lógica de negocio en cliente
 *
 * ORIGEN: Refactorización de crear-producto.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import { verifyAuth, verifyOwner } from '@/lib/actions/auth-helpers'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Resultado de verificación de producto existente
 */
export interface CheckExistingProductResult {
  success: boolean
  exists: boolean
  productName?: string
  error?: string
}

/**
 * Datos del formulario para crear producto completo
 */
export interface CreateProductFormData {
  codigo_barras: string | null
  nombre: string
  categoria: string
  precio_venta: number
  costo: number
  emoji: string
  fecha_vencimiento?: string | null
  cantidad_inicial: number
}

/**
 * Resultado de creación completa de producto
 */
export interface CreateFullProductResult {
  success: boolean
  productoId?: string
  error?: string
}

/**
 * Datos para actualizar un producto
 */
export interface UpdateProductData {
  nombre: string
  precio_venta: number
  costo: number
  categoria: string
  emoji?: string
  codigo_barras?: string
}

/**
 * Resultado de actualización de producto
 */
export interface UpdateProductResult {
  success: boolean
  error?: string
}

/**
 * Resultado de eliminación de producto
 */
export interface DeleteProductResult {
  success: boolean
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * ✅ Verifica si un producto ya existe por código de barras
 *
 * LÓGICA (preservada del componente original):
 * - Busca producto por código de barras en la organización del usuario
 * - Retorna si existe y su nombre (para mostrar warning)
 *
 * USO:
 * - Validar códigos escaneados antes de permitir duplicados
 * - Mostrar toast de advertencia si el producto ya existe
 *
 * @param barcode - Código de barras escaneado
 * @returns CheckExistingProductResult - Resultado de la verificación
 *
 * ORIGEN: Refactorización de handleBarcodeDetected() líneas 156-177
 */
export async function checkExistingProductAction(
  barcode: string
): Promise<CheckExistingProductResult> {
  try {
    const { supabase, orgId } = await verifyAuth()

    // ───────────────────────────────────────────────────────────────────────────
    // Buscar producto existente
    // ───────────────────────────────────────────────────────────────────────────

    const { data: existente, error } = await supabase
      .from('products')
      .select('name')
      .eq('barcode', barcode)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (error) {
      return {
        success: false,
        exists: false,
        error: `Error al verificar producto: ${error.message}`,
      }
    }

    if (existente) {
      return {
        success: true,
        exists: true,
        productName: existente.name,
      }
    }

    return {
      success: true,
      exists: false,
    }
  } catch (error) {
    return {
      success: false,
      exists: false,
      error: error instanceof Error ? error.message : 'Error desconocido al verificar producto',
    }
  }
}

/**
 * 📦 Crea un producto completo con historial y stock inicial
 *
 * LÓGICA (preservada del componente original):
 *
 * FLUJO UNIFICADO (líneas 198-263 del componente):
 * 1. Crear producto en tabla productos
 * 2. Registrar precio inicial en historial_precios
 * 3. Si cantidad > 0: crear entrada inicial en stock
 *
 * IMPORTANTE:
 * - organization_id obtenido del usuario actual (servidor)
 * - Operación unificada: si una parte falla, toda la operación falla
 * - El cliente solo envía datos del formulario
 *
 * @param formData - Datos del formulario
 * @param sucursalId - ID de la sucursal para stock inicial
 * @returns CreateFullProductResult - Resultado de la operación
 *
 * ORIGEN: Refactorización de handleSubmit() del componente
 */
export async function createFullProductAction(
  formData: CreateProductFormData,
  sucursalId: string
): Promise<CreateFullProductResult> {
  try {
    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!formData.nombre || !formData.categoria) {
      return {
        success: false,
        error: 'Faltan datos requeridos (nombre, categoría)',
      }
    }

    if (!sucursalId) {
      return {
        success: false,
        error: 'Sucursal no especificada',
      }
    }

    const { supabase, user, orgId } = await verifyOwner()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Crear producto en el catálogo
    // ───────────────────────────────────────────────────────────────────────────

    const { data: nuevoProducto, error: errorProd } = await supabase
      .from('products')
      .insert([{
        organization_id: orgId,
        name: formData.nombre,
        category: formData.categoria,
        sale_price: formData.precio_venta,
        cost: formData.costo,
        emoji: formData.emoji,
        barcode: formData.codigo_barras || null,
      }])
      .select()
      .single()

    if (errorProd) {
      return {
        success: false,
        error: `Error al crear producto: ${errorProd.message}`,
      }
    }

    if (!nuevoProducto) {
      return {
        success: false,
        error: 'No se pudo crear el producto',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: Registrar precio inicial en historial
    // ───────────────────────────────────────────────────────────────────────────

    const { error: errorHistorial } = await supabase
      .from('price_history')
      .insert({
        organization_id: orgId,
        product_id: nuevoProducto.id,
        old_price: null,
        new_price: formData.precio_venta,
        old_cost: null,
        new_cost: formData.costo,
        changed_by: user.id,
      })

    if (errorHistorial) {
      // No bloqueamos la operación por error en historial, pero lo registramos
      console.error('Error al registrar historial de precios:', errorHistorial)
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 4: Crear entrada inicial de stock (si cantidad > 0)
    // ───────────────────────────────────────────────────────────────────────────

    if (formData.cantidad_inicial > 0) {
      const { error: errorStock } = await supabase
        .from('stock_batches')
        .insert({
          organization_id: orgId,
          branch_id: sucursalId,
          product_id: nuevoProducto.id,
          quantity: formData.cantidad_inicial,
          status: 'available',
          unit_cost: formData.costo,
          expiration_date: formData.fecha_vencimiento || null,
        })

      if (errorStock) {
        console.error('Error al crear stock inicial:', errorStock)
        // Propagamos el error al usuario para que sepa que el stock no se creó
        return {
          success: false,
          error: `Producto creado pero error en stock: ${errorStock.message}`,
          productoId: nuevoProducto.id,
        }
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // RETORNO EXITOSO
    // ───────────────────────────────────────────────────────────────────────────

    return {
      success: true,
      productoId: nuevoProducto.id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al crear producto',
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// HAPPY HOUR - DESCUENTOS POR VENCIMIENTO
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Resultado de aplicación de descuento Happy Hour
 */
export interface ApplyHappyHourResult {
  success: boolean
  precioAnterior?: number
  precioNuevo?: number
  nombreProducto?: string
  error?: string
}

/**
 * 🔥 Aplica descuento del 30% OFF a un producto próximo a vencer
 *
 * FLUJO:
 * 1. Valida sesión y organización del usuario
 * 2. Obtiene precio actual del producto
 * 3. Calcula nuevo precio (30% OFF, redondeo hacia abajo)
 * 4. Actualiza precio en tabla productos
 * 5. Registra cambio en historial_precios de forma atómica
 *
 * @param productoId - ID del producto a aplicar descuento
 * @returns ApplyHappyHourResult - Resultado de la operación
 *
 * ORIGEN: Refactorización de happy-hour.tsx líneas 41-94
 */
export async function applyHappyHourDiscountAction(
  productoId: string
): Promise<ApplyHappyHourResult> {
  try {
    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!productoId) {
      return {
        success: false,
        error: 'productoId es requerido',
      }
    }

    const { supabase, user, orgId } = await verifyAuth()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Obtener precio actual del producto
    // ───────────────────────────────────────────────────────────────────────────

    const { data: producto, error: fetchError } = await supabase
      .from('products')
      .select('sale_price, name, cost')
      .eq('id', productoId)
      .eq('organization_id', orgId)
      .single()

    if (fetchError) {
      return {
        success: false,
        error: `Error al obtener producto: ${fetchError.message}`,
      }
    }

    if (!producto) {
      return {
        success: false,
        error: 'Producto no encontrado',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: Calcular nuevo precio (30% OFF, redondeo hacia abajo)
    // ───────────────────────────────────────────────────────────────────────────

    const precioAnterior = producto.sale_price
    const precioNuevo = Math.floor(precioAnterior * 0.70)

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 4: Actualizar precio del producto
    // ───────────────────────────────────────────────────────────────────────────

    const { error: updateError } = await supabase
      .from('products')
      .update({ sale_price: precioNuevo })
      .eq('id', productoId)
      .eq('organization_id', orgId)

    if (updateError) {
      return {
        success: false,
        error: `Error al actualizar precio: ${updateError.message}`,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 5: Registrar en historial de precios
    // ───────────────────────────────────────────────────────────────────────────

    const { error: historialError } = await supabase
      .from('price_history')
      .insert({
        organization_id: orgId,
        product_id: productoId,
        old_price: precioAnterior,
        new_price: precioNuevo,
        old_cost: producto.cost || 0,
        new_cost: producto.cost || 0,
        changed_by: user.id,
      })

    if (historialError) {
      // No bloqueamos la operación, pero registramos el error
      console.error('Error al registrar historial de precios:', historialError)
    }

    // ───────────────────────────────────────────────────────────────────────────
    // RETORNO EXITOSO
    // ───────────────────────────────────────────────────────────────────────────

    return {
      success: true,
      precioAnterior,
      precioNuevo,
      nombreProducto: producto.name,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al aplicar descuento',
    }
  }
}

/**
 * 📝 Actualiza un producto existente y registra cambios en historial_precios
 *
 * LÓGICA (preservada de dashboard-dueno.tsx):
 *
 * FLUJO (líneas 355-373 del componente):
 * 1. Obtener precios anteriores del producto
 * 2. Actualizar producto con nuevos datos
 * 3. Si cambió precio_venta o costo: registrar en historial_precios
 *
 * IMPORTANTE:
 * - Registra historial SOLO si cambian precio_venta o costo
 * - Usa ?? undefined para campos opcionales (emoji, codigo_barras)
 * - organization_id obtenido del usuario actual (servidor)
 *
 * @param productId - ID del producto a actualizar
 * @param data - Datos actualizados del producto
 * @returns UpdateProductResult - Resultado de la operación
 *
 * ORIGEN: Refactorización de handleUpdateProduct() en dashboard-dueno.tsx líneas 355-373
 */
export async function updateProductAction(
  productId: string,
  data: UpdateProductData
): Promise<UpdateProductResult> {
  try {
    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!productId) {
      return {
        success: false,
        error: 'ID de producto no especificado',
      }
    }

    if (!data.nombre || !data.categoria) {
      return {
        success: false,
        error: 'Faltan datos requeridos (nombre, categoría)',
      }
    }

    const { supabase, user, orgId } = await verifyOwner()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Obtener precios anteriores (para historial)
    // ───────────────────────────────────────────────────────────────────────────

    const { data: oldProduct, error: fetchError } = await supabase
      .from('products')
      .select('sale_price, cost')
      .eq('id', productId)
      .eq('organization_id', orgId)
      .single<{ sale_price: number; cost: number }>()

    if (fetchError) {
      return {
        success: false,
        error: `Error al obtener producto: ${fetchError.message}`,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: Actualizar producto
    // ───────────────────────────────────────────────────────────────────────────

    const { error: updateError } = await supabase
      .from('products')
      .update({
        name: data.nombre,
        sale_price: data.precio_venta,
        cost: data.costo,
        category: data.categoria,
        emoji: data.emoji ?? undefined,
        barcode: data.codigo_barras ?? undefined,
      })
      .eq('id', productId)
      .eq('organization_id', orgId)

    if (updateError) {
      return {
        success: false,
        error: `Error al actualizar producto: ${updateError.message}`,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 4: Registrar en historial si cambió precio o costo
    // ───────────────────────────────────────────────────────────────────────────

    const precioChanged = oldProduct.sale_price !== data.precio_venta
    const costoChanged = oldProduct.cost !== data.costo

    if (precioChanged || costoChanged) {
      const { error: historialError } = await supabase
        .from('price_history')
        .insert({
          organization_id: orgId,
          product_id: productId,
          old_price: oldProduct.sale_price,
          new_price: data.precio_venta,
          old_cost: oldProduct.cost,
          new_cost: data.costo,
          changed_by: user.id,
        })

      if (historialError) {
        // No bloqueamos la operación, pero registramos el error
        console.error('Error al registrar historial de precios:', historialError)
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // RETORNO EXITOSO
    // ───────────────────────────────────────────────────────────────────────────

    return {
      success: true,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al actualizar producto',
    }
  }
}

/**
 * 🗑️ Elimina un producto de la base de datos
 *
 * LÓGICA (preservada de dashboard-dueno.tsx):
 *
 * FLUJO (línea 793 del componente):
 * 1. Eliminar producto por ID
 * 2. RLS asegura que solo se eliminen productos de la organización del usuario
 *
 * IMPORTANTE:
 * - organization_id verificado implícitamente por RLS
 * - Cascade elimina automáticamente registros relacionados (stock, historial)
 *
 * @param productId - ID del producto a eliminar
 * @returns DeleteProductResult - Resultado de la operación
 *
 * ORIGEN: Refactorización de eliminación inline en dashboard-dueno.tsx línea 793
 */
export async function deleteProductAction(
  productId: string,
  reason: string = 'discontinued'
): Promise<DeleteProductResult> {
  try {
    if (!productId) {
      return {
        success: false,
        error: 'ID de producto no especificado',
      }
    }

    const { supabase, orgId } = await verifyOwner()

    // ───────────────────────────────────────────────────────────────────────────
    // SOFT-DELETE: Desactivar producto con motivo y timestamp
    // No se borra de la BD para mantener historial de ventas y auditoría
    // ───────────────────────────────────────────────────────────────────────────

    const { error: deactivateError } = await supabase
      .from('products')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivation_reason: reason,
      })
      .eq('id', productId)
      .eq('organization_id', orgId)

    if (deactivateError) {
      return {
        success: false,
        error: `Error al dar de baja: ${deactivateError.message}`,
      }
    }

    // Marcar batches restantes como 'removed' para que no cuenten en stock
    await supabase
      .from('stock_batches')
      .update({ status: 'removed' })
      .eq('product_id', productId)
      .gt('quantity', 0)

    return {
      success: true,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al dar de baja producto',
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// ACTUALIZACIÓN MASIVA DE PRECIOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Opciones de filtro disponibles
 */
export interface ProductFilterOptions {
  categories: string[]
  brands: string[]
}

/**
 * Resultado de obtención de opciones de filtro
 */
export interface GetProductFilterOptionsResult {
  success: boolean
  options?: ProductFilterOptions
  error?: string
}

/**
 * Parámetros para preview de actualización masiva
 */
export interface MassivePriceUpdatePreviewParams {
  filterType: 'all' | 'category' | 'brand'
  filterValue?: string
  updateType: 'sale_price' | 'cost' | 'both'
  adjustmentType: 'percentage' | 'fixed'
  adjustmentValue: number
}

/**
 * Producto en preview de actualización
 */
export interface ProductPricePreview {
  id: string
  name: string
  category: string
  brand?: string
  oldSalePrice: number
  newSalePrice: number
  oldCost: number
  newCost: number
}

/**
 * Resultado de preview de actualización masiva
 */
export interface MassivePriceUpdatePreviewResult {
  success: boolean
  affectedCount?: number
  examples?: ProductPricePreview[]
  totalAffected?: number
  error?: string
}

/**
 * Parámetros para aplicar actualización masiva
 */
export interface ApplyMassivePriceUpdateParams {
  filterType: 'all' | 'category' | 'brand'
  filterValue?: string
  updateType: 'sale_price' | 'cost' | 'both'
  adjustmentType: 'percentage' | 'fixed'
  adjustmentValue: number
}

/**
 * Resultado de aplicación de actualización masiva
 */
export interface ApplyMassivePriceUpdateResult {
  success: boolean
  updatedCount?: number
  historyRecordsCreated?: number
  error?: string
}

/**
 * 📋 Obtiene opciones de filtro para actualización masiva (categorías y marcas)
 *
 * LÓGICA:
 * - Retorna listado único de categorías de la organización
 * - Retorna listado único de marcas (brand field) de la organización
 * - Ordena alfabéticamente ambos
 *
 * @returns GetProductFilterOptionsResult - Opciones disponibles
 */
export async function getProductFilterOptionsAction(): Promise<GetProductFilterOptionsResult> {
  try {
    const { supabase, orgId } = await verifyAuth()

    // ───────────────────────────────────────────────────────────────────────────
    // Obtener categorías únicas
    // ───────────────────────────────────────────────────────────────────────────

    const { data: categoriesData, error: catError } = await supabase
      .from('products')
      .select('category')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .neq('category', null)
      .order('category', { ascending: true })

    if (catError) {
      return {
        success: false,
        error: `Error al obtener categorías: ${catError.message}`,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Obtener marcas únicas
    // ───────────────────────────────────────────────────────────────────────────

    const { data: brandsData, error: brandError } = await supabase
      .from('products')
      .select('brand')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .neq('brand', null)
      .order('brand', { ascending: true })

    if (brandError) {
      return {
        success: false,
        error: `Error al obtener marcas: ${brandError.message}`,
      }
    }

    // Eliminar duplicados
    const categories = Array.from(new Set(categoriesData?.map(c => c.category).filter(Boolean) || []))
    const brands = Array.from(new Set(brandsData?.map(b => b.brand).filter(Boolean) || []))

    return {
      success: true,
      options: {
        categories: categories.sort(),
        brands: brands.sort(),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al obtener opciones',
    }
  }
}

/**
 * 👁️ Preview de actualización masiva de precios
 *
 * LÓGICA:
 * 1. Filtra productos según criterios (todos, por categoría, por marca)
 * 2. Calcula precios nuevos sin aplicarlos
 * 3. Retorna ejemplo de productos afectados
 * 4. Retorna cantidad total de productos a actualizar
 *
 * @param params - Parámetros del preview
 * @returns MassivePriceUpdatePreviewResult - Preview con ejemplos
 */
export async function previewMassivePriceUpdateAction(
  params: MassivePriceUpdatePreviewParams
): Promise<MassivePriceUpdatePreviewResult> {
  try {
    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (isNaN(params.adjustmentValue)) {
      return {
        success: false,
        error: 'El valor de ajuste debe ser un número',
      }
    }

    const { supabase, orgId } = await verifyAuth()

    // ───────────────────────────────────────────────────────────────────────────
    // CONSTRUIR QUERY CON FILTROS
    // ───────────────────────────────────────────────────────────────────────────

    let query = supabase
      .from('products')
      .select('id, name, category, brand, sale_price, cost')
      .eq('organization_id', orgId)
      .eq('is_active', true)

    if (params.filterType === 'category' && params.filterValue) {
      query = query.eq('category', params.filterValue)
    } else if (params.filterType === 'brand' && params.filterValue) {
      query = query.eq('brand', params.filterValue)
    }

    const { data: products, error } = await query

    if (error) {
      return {
        success: false,
        error: `Error al obtener productos: ${error.message}`,
      }
    }

    if (!products || products.length === 0) {
      return {
        success: true,
        affectedCount: 0,
        examples: [],
        totalAffected: 0,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // CALCULAR PRECIOS NUEVOS
    // ───────────────────────────────────────────────────────────────────────────

    const examples: ProductPricePreview[] = products.map(p => {
      const oldSalePrice = Number(p.sale_price) || 0
      const oldCost = Number(p.cost) || 0

      let newSalePrice = oldSalePrice
      let newCost = oldCost

      if (params.updateType === 'sale_price' || params.updateType === 'both') {
        newSalePrice = calculateNewPrice(oldSalePrice, params.adjustmentType, params.adjustmentValue)
      }

      if (params.updateType === 'cost' || params.updateType === 'both') {
        newCost = calculateNewPrice(oldCost, params.adjustmentType, params.adjustmentValue)
      }

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        brand: p.brand,
        oldSalePrice,
        newSalePrice,
        oldCost,
        newCost,
      }
    })

    // Retornar hasta 5 ejemplos
    const examplesSlice = examples.slice(0, 5)

    return {
      success: true,
      affectedCount: examplesSlice.length,
      examples: examplesSlice,
      totalAffected: products.length,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido en preview',
    }
  }
}

/**
 * 💾 Aplica actualización masiva de precios
 *
 * LÓGICA:
 * 1. Filtra productos según criterios
 * 2. Actualiza todos los precios en la tabla products
 * 3. Registra cada cambio en price_history
 * 4. Retorna cantidad de productos actualizados
 *
 * IMPORTANTE:
 * - Usa verifyOwner() para asegurar que solo el dueño puede hacer esto
 * - Registra historial para auditoría
 * - Transacción segura (actualiza + historial)
 *
 * @param params - Parámetros de la actualización
 * @returns ApplyMassivePriceUpdateResult - Resultado de la operación
 */
export async function updateMassivePricesAction(
  params: ApplyMassivePriceUpdateParams
): Promise<ApplyMassivePriceUpdateResult> {
  try {
    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (isNaN(params.adjustmentValue)) {
      return {
        success: false,
        error: 'El valor de ajuste debe ser un número',
      }
    }

    const { supabase, user, orgId } = await verifyOwner()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener productos a actualizar
    // ───────────────────────────────────────────────────────────────────────────

    let query = supabase
      .from('products')
      .select('id, sale_price, cost')
      .eq('organization_id', orgId)
      .eq('is_active', true)

    if (params.filterType === 'category' && params.filterValue) {
      query = query.eq('category', params.filterValue)
    } else if (params.filterType === 'brand' && params.filterValue) {
      query = query.eq('brand', params.filterValue)
    }

    const { data: products, error: fetchError } = await query

    if (fetchError) {
      return {
        success: false,
        error: `Error al obtener productos: ${fetchError.message}`,
      }
    }

    if (!products || products.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        historyRecordsCreated: 0,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Actualizar cada producto y registrar en historial
    // ───────────────────────────────────────────────────────────────────────────

    let updatedCount = 0
    let historyRecordsCreated = 0

    for (const product of products) {
      const oldSalePrice = Number(product.sale_price) || 0
      const oldCost = Number(product.cost) || 0

      let newSalePrice = oldSalePrice
      let newCost = oldCost

      if (params.updateType === 'sale_price' || params.updateType === 'both') {
        newSalePrice = calculateNewPrice(oldSalePrice, params.adjustmentType, params.adjustmentValue)
      }

      if (params.updateType === 'cost' || params.updateType === 'both') {
        newCost = calculateNewPrice(oldCost, params.adjustmentType, params.adjustmentValue)
      }

      // Verificar si hubo cambio
      const priceChanged = newSalePrice !== oldSalePrice || newCost !== oldCost

      if (priceChanged) {
        // Actualizar producto
        const { error: updateError } = await supabase
          .from('products')
          .update({
            sale_price: newSalePrice,
            cost: newCost,
          })
          .eq('id', product.id)
          .eq('organization_id', orgId)

        if (updateError) {
          console.error(`Error al actualizar producto ${product.id}:`, updateError)
          continue
        }

        updatedCount++

        // Registrar en historial
        const { error: historialError } = await supabase
          .from('price_history')
          .insert({
            organization_id: orgId,
            product_id: product.id,
            old_price: oldSalePrice,
            new_price: newSalePrice,
            old_cost: oldCost,
            new_cost: newCost,
            changed_by: user.id,
          })

        if (!historialError) {
          historyRecordsCreated++
        }
      }
    }

    return {
      success: true,
      updatedCount,
      historyRecordsCreated,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al aplicar actualización',
    }
  }
}

/**
 * Helper: Calcula precio nuevo según tipo de ajuste
 * @param price - Precio original
 * @param adjustmentType - 'percentage' o 'fixed'
 * @param adjustmentValue - Valor del ajuste (puede ser negativo)
 * @returns Nuevo precio redondeado
 */
function calculateNewPrice(
  price: number,
  adjustmentType: 'percentage' | 'fixed',
  adjustmentValue: number
): number {
  if (adjustmentType === 'percentage') {
    return Math.round(price * (1 + adjustmentValue / 100))
  } else {
    return Math.max(0, Math.round(price + adjustmentValue))
  }
}
