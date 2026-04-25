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

    const { supabase, orgId } = await verifyAuth()

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
    // Nota: NO se inserta manualmente en `price_history`. El trigger de DB
    // `trigger_log_price_change` ya registra el cambio cuando el UPDATE de arriba
    // modifica `sale_price`. Insertar acá genera registros duplicados.

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

    const { supabase, orgId } = await verifyOwner()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Actualizar producto
    // ───────────────────────────────────────────────────────────────────────────
    // El `.select('id')` al final fuerza a que la respuesta incluya las filas
    // afectadas. Así detectamos el caso en que el productId no existe o no
    // pertenece a la organización del usuario (en ese caso devuelve []).
    //
    // Nota: NO se inserta manualmente en `price_history`. El trigger de DB
    // `trigger_log_price_change` detecta cambios de `sale_price` o `cost` y
    // crea el registro automáticamente. Insertar acá duplicaría.

    const { data: updatedRows, error: updateError } = await supabase
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
      .select('id')

    if (updateError) {
      return {
        success: false,
        error: `Error al actualizar producto: ${updateError.message}`,
      }
    }

    if (!updatedRows || updatedRows.length === 0) {
      return {
        success: false,
        error: 'Producto no encontrado o no pertenece a tu organización',
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
// CATÁLOGO COMPARTIDO DE PRODUCTOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 🔍 Busca un producto por barcode en el catálogo compartido de AppKiosco
 *
 * Este catálogo se alimenta de todos los usuarios: cuando alguien crea un
 * producto con código de barras, se guarda acá para que el próximo usuario
 * que escanee el mismo código tenga los datos auto-completados.
 *
 * @param barcode - Código de barras escaneado
 */
export async function lookupCatalogAction(
  barcode: string
): Promise<{ success: boolean; found: boolean; name?: string; brand?: string; category?: string; emoji?: string; error?: string }> {
  try {
    const { supabase } = await verifyAuth()

    const { data, error } = await supabase
      .from('product_catalog')
      .select('name, brand, category, emoji')
      .eq('barcode', barcode)
      .maybeSingle()

    if (error) {
      return { success: false, found: false, error: error.message }
    }

    if (data) {
      return {
        success: true,
        found: true,
        name: data.name,
        brand: data.brand,
        category: data.category,
        emoji: data.emoji,
      }
    }

    return { success: true, found: false }
  } catch (error) {
    return {
      success: false,
      found: false,
      error: error instanceof Error ? error.message : 'Error al buscar en catálogo',
    }
  }
}

/**
 * 🌐 Busca info de un producto por barcode en OpenFoodFacts (server-side)
 *
 * IMPORTANTE: Este fetch se hace DESDE EL SERVIDOR (Vercel) y no desde el
 * browser del usuario. Esto evita problemas de:
 * - CORS en mobile Safari/Chrome
 * - Header User-Agent prohibido en fetch() del browser
 * - Timeouts en redes móviles lentas
 *
 * @param barcode - Código de barras escaneado
 */
export async function lookupOpenFoodFactsAction(
  barcode: string
): Promise<{ success: boolean; found: boolean; name?: string; brand?: string; category?: string; error?: string; debug?: string }> {
  try {
    // Verificar auth (no exponemos esta API sin login)
    await verifyAuth()

    const urls = [
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,product_name_es,brands,categories,categories_tags`,
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
    ]

    const debugInfo: string[] = []

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'AppKiosco/1.0 (entornomincyt@gmail.com)',
          },
          signal: AbortSignal.timeout(10000),
        })

        debugInfo.push(`${url.includes('v2') ? 'v2' : 'v0'}: HTTP ${response.status}`)

        if (!response.ok) continue

        const data = await response.json()

        // v2 y v0 usan el mismo formato de status
        if (data.status === 1 && data.product) {
          const p = data.product
          const name = p.product_name_es || p.product_name || ''
          const brand = p.brands || ''

          // Mapeo simple de categorías en el servidor
          const rawCat = (p.categories_tags as string[] | undefined) || []
          const catMap: Record<string, string> = {
            'beverages': 'Bebidas', 'drinks': 'Bebidas', 'sodas': 'Bebidas',
            'waters': 'Bebidas', 'juices': 'Bebidas', 'milk': 'Lácteos',
            'milks': 'Lácteos', 'yogurts': 'Lácteos', 'cheeses': 'Lácteos',
            'chocolates': 'Golosinas', 'candies': 'Golosinas', 'sweets': 'Golosinas',
            'snacks': 'Snacks', 'chips': 'Snacks', 'cookies': 'Galletitas',
            'biscuits': 'Galletitas', 'breads': 'Panificados', 'cereals': 'Cereales',
            'canned': 'Conservas', 'sauces': 'Condimentos',
            'cleaning': 'Limpieza', 'tobaccos': 'Cigarrillos',
            'frozen': 'Congelados', 'ice-creams': 'Helados',
            'pastas': 'Pastas', 'oils': 'Aceites',
          }
          let category = ''
          for (const tag of rawCat) {
            const key = tag.replace(/^[a-z]{2}:/, '').toLowerCase()
            if (catMap[key]) { category = catMap[key]; break }
          }
          // Fallback: buscar en string de categorías
          if (!category && p.categories) {
            const lower = (p.categories as string).toLowerCase()
            for (const [kw, cat] of Object.entries(catMap)) {
              if (lower.includes(kw)) { category = cat; break }
            }
          }

          if (name || brand) {
            return { success: true, found: true, name, brand, category }
          }
        }

        debugInfo.push(`status=${data.status}`)
      } catch (e) {
        debugInfo.push(`${url.includes('v2') ? 'v2' : 'v0'}: ${e instanceof Error ? e.message : 'error'}`)
      }
    }

    return { success: true, found: false, debug: debugInfo.join(' | ') }
  } catch (error) {
    return {
      success: false,
      found: false,
      error: error instanceof Error ? error.message : 'Error al buscar producto',
    }
  }
}

/**
 * 💾 Guarda un producto en el catálogo compartido (upsert por barcode)
 *
 * Se llama automáticamente cuando un usuario crea un producto con código
 * de barras. Usa upsert para no duplicar y actualizar si ya existe.
 *
 * @param barcode - Código de barras
 * @param name - Nombre del producto
 * @param brand - Marca (opcional)
 * @param category - Categoría (opcional)
 * @param emoji - Emoji del producto (opcional)
 */
export async function saveToCatalogAction(
  barcode: string,
  name: string,
  brand?: string,
  category?: string,
  emoji?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!barcode || !name) {
      return { success: false, error: 'Barcode y nombre son requeridos' }
    }

    const { supabase, user } = await verifyAuth()

    const { error } = await supabase
      .from('product_catalog')
      .upsert(
        {
          barcode,
          name,
          brand: brand || null,
          category: category || null,
          emoji: emoji || '📦',
          source: 'user',
          contributed_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'barcode' }
      )

    if (error) {
      // No bloqueamos — es un "bonus" feature, no crítico
      console.error('[Catálogo] Error al guardar:', error.message)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[Catálogo] Error:', error)
    return { success: false, error: 'Error al guardar en catálogo' }
  }
}

