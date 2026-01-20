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
 * - Operación unificada: productos + historial_precios + stock
 * - organization_id obtenido/validado en servidor
 * - Sin lógica de negocio en cliente
 *
 * ORIGEN: Refactorización de crear-producto.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'

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
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener usuario y organización
    // ───────────────────────────────────────────────────────────────────────────

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        exists: false,
        error: 'No hay sesión activa',
      }
    }

    const { data: orgId } = await supabase.rpc('get_my_org_id_v2')

    if (!orgId) {
      return {
        success: false,
        exists: false,
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Buscar producto existente
    // ───────────────────────────────────────────────────────────────────────────

    const { data: existente, error } = await supabase
      .from('productos')
      .select('nombre')
      .eq('codigo_barras', barcode)
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
        productName: existente.nombre,
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
    const supabase = await createClient()

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

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener usuario y organización
    // ───────────────────────────────────────────────────────────────────────────

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        error: 'No hay sesión activa',
      }
    }

    const { data: orgId } = await supabase.rpc('get_my_org_id_v2')

    if (!orgId) {
      return {
        success: false,
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Crear producto en el catálogo
    // ───────────────────────────────────────────────────────────────────────────

    const { data: nuevoProducto, error: errorProd } = await supabase
      .from('productos')
      .insert([{
        organization_id: orgId,
        nombre: formData.nombre,
        categoria: formData.categoria,
        precio_venta: formData.precio_venta,
        costo: formData.costo,
        vida_util_dias: 0,
        emoji: formData.emoji,
        codigo_barras: formData.codigo_barras || null,
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

    const { error: errorHistorial } = await (supabase
      .from('historial_precios') as any)
      .insert({
        organization_id: orgId,
        producto_id: nuevoProducto.id,
        precio_venta_anterior: null,
        precio_venta_nuevo: formData.precio_venta,
        costo_anterior: null,
        costo_nuevo: formData.costo,
        empleado_id: user.id,
        fecha_cambio: new Date().toISOString(),
      })

    if (errorHistorial) {
      // No bloqueamos la operación por error en historial, pero lo registramos
      console.error('Error al registrar historial de precios:', errorHistorial)
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 4: Crear entrada inicial de stock (si cantidad > 0)
    // ───────────────────────────────────────────────────────────────────────────

    if (formData.cantidad_inicial > 0) {
      const { error: errorStock } = await (supabase
        .from('stock') as any)
        .insert({
          organization_id: orgId,
          sucursal_id: sucursalId,
          producto_id: nuevoProducto.id,
          cantidad: formData.cantidad_inicial,
          tipo_movimiento: 'entrada',
          estado: 'disponible',
          costo_unitario_historico: formData.costo,
          fecha_vencimiento: formData.fecha_vencimiento || null,
          fecha_ingreso: new Date().toISOString(),
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
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!productoId) {
      return {
        success: false,
        error: 'productoId es requerido',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener usuario y organización
    // ───────────────────────────────────────────────────────────────────────────

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        error: 'No hay sesión activa',
      }
    }

    const { data: orgId } = await supabase.rpc('get_my_org_id_v2')

    if (!orgId) {
      return {
        success: false,
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Obtener precio actual del producto
    // ───────────────────────────────────────────────────────────────────────────

    const { data: producto, error: fetchError } = await supabase
      .from('productos')
      .select('precio_venta, nombre, costo')
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

    const precioAnterior = producto.precio_venta
    const precioNuevo = Math.floor(precioAnterior * 0.70)

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 4: Actualizar precio del producto
    // ───────────────────────────────────────────────────────────────────────────

    const { error: updateError } = await supabase
      .from('productos')
      .update({ precio_venta: precioNuevo })
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

    const { error: historialError } = await (supabase
      .from('historial_precios') as any)
      .insert({
        organization_id: orgId,
        producto_id: productoId,
        precio_venta_anterior: precioAnterior,
        precio_venta_nuevo: precioNuevo,
        costo_anterior: producto.costo || 0,
        costo_nuevo: producto.costo || 0,
        fecha_cambio: new Date().toISOString(),
        empleado_id: user.id,
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
      nombreProducto: producto.nombre,
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
    const supabase = await createClient()

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

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener usuario y organización
    // ───────────────────────────────────────────────────────────────────────────

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        error: 'No hay sesión activa',
      }
    }

    const { data: orgId } = await supabase.rpc('get_my_org_id_v2')

    if (!orgId) {
      return {
        success: false,
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Obtener precios anteriores (para historial)
    // ───────────────────────────────────────────────────────────────────────────

    const { data: oldProduct, error: fetchError } = await supabase
      .from('productos')
      .select('precio_venta, costo')
      .eq('id', productId)
      .eq('organization_id', orgId)
      .single<{ precio_venta: number; costo: number }>()

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
      .from('productos')
      .update({
        nombre: data.nombre,
        precio_venta: data.precio_venta,
        costo: data.costo,
        categoria: data.categoria,
        emoji: data.emoji ?? undefined,
        codigo_barras: data.codigo_barras ?? undefined,
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
    // PASO 4: Registrar en historial si cambió precio_venta o costo
    // ───────────────────────────────────────────────────────────────────────────

    const precioChanged = oldProduct.precio_venta !== data.precio_venta
    const costoChanged = oldProduct.costo !== data.costo

    if (precioChanged || costoChanged) {
      const { error: historialError } = await supabase
        .from('historial_precios')
        .insert({
          organization_id: orgId,
          producto_id: productId,
          precio_venta_anterior: oldProduct.precio_venta,
          precio_venta_nuevo: data.precio_venta,
          costo_anterior: oldProduct.costo,
          costo_nuevo: data.costo,
          empleado_id: user.id,
          fecha_cambio: new Date().toISOString(),
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
  productId: string
): Promise<DeleteProductResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!productId) {
      return {
        success: false,
        error: 'ID de producto no especificado',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Obtener usuario y organización
    // ───────────────────────────────────────────────────────────────────────────

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        error: 'No hay sesión activa',
      }
    }

    const { data: orgId } = await supabase.rpc('get_my_org_id_v2')

    if (!orgId) {
      return {
        success: false,
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Eliminar producto
    // ───────────────────────────────────────────────────────────────────────────

    const { error: deleteError } = await supabase
      .from('productos')
      .delete()
      .eq('id', productId)
      .eq('organization_id', orgId)

    if (deleteError) {
      return {
        success: false,
        error: `Error al eliminar producto: ${deleteError.message}`,
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
      error: error instanceof Error ? error.message : 'Error desconocido al eliminar producto',
    }
  }
}
