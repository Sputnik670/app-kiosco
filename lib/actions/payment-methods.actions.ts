/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 💰 MÉTODOS DE COBRO AMPLIOS — Server Actions
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Gestión de las 3 modalidades manuales de cobro que complementan el QR dinámico
 * de Mercado Pago ya integrado:
 *
 *   1. Posnet MP (lector físico, acercado por la reja en kioscos 24h)
 *   2. QR fijo  (imagen del QR estático de MP pegado afuera del kiosco)
 *   3. Alias / CVU (transferencia directa del cliente)
 *
 * Cada organización tiene UNA fila en payment_methods_config, donde cada método
 * tiene su propio flag *_enabled + los datos que lo describen.
 *
 * SEGURIDAD:
 *   - Solo el owner puede guardar / subir QR / borrar.
 *   - RLS en tabla y en storage.objects (prefijo = organization_id).
 *   - Los miembros (empleados) solo pueden leer la config (necesitan mostrar el
 *     QR al cobrar), nunca editarla.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { verifyAuth, verifyOwner } from '@/lib/actions/auth-helpers'
import { logger } from '@/lib/logging'
import { getZodError, savePaymentMethodsConfigSchema } from '@/lib/validations'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS PÚBLICOS
// ───────────────────────────────────────────────────────────────────────────────

export interface PaymentMethodsConfig {
  // Posnet físico
  posnet_mp_enabled: boolean
  posnet_mp_label: string | null
  posnet_mp_notes: string | null

  // QR fijo
  qr_static_enabled: boolean
  qr_static_image_url: string | null
  qr_static_image_path: string | null
  qr_static_holder_name: string | null
  qr_static_instructions: string | null

  // Alias / transferencia
  alias_enabled: boolean
  alias_value: string | null
  alias_cbu_cvu: string | null
  alias_titular_name: string | null
  alias_bank_name: string | null
  alias_instructions: string | null
}

export interface GetPaymentMethodsConfigResult {
  success: boolean
  config?: PaymentMethodsConfig
  error?: string
}

export interface SavePaymentMethodsConfigResult {
  success: boolean
  error?: string
}

export interface UploadQrStaticImageResult {
  success: boolean
  url?: string
  path?: string
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

const STORAGE_BUCKET = 'payment-assets'
const MAX_QR_IMAGE_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const DEFAULT_CONFIG: PaymentMethodsConfig = {
  posnet_mp_enabled: false,
  posnet_mp_label: null,
  posnet_mp_notes: null,
  qr_static_enabled: false,
  qr_static_image_url: null,
  qr_static_image_path: null,
  qr_static_holder_name: null,
  qr_static_instructions: null,
  alias_enabled: false,
  alias_value: null,
  alias_cbu_cvu: null,
  alias_titular_name: null,
  alias_bank_name: null,
  alias_instructions: null,
}

// ───────────────────────────────────────────────────────────────────────────────
// 📥 LEER CONFIGURACIÓN
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene la configuración de métodos de cobro de la organización del usuario.
 * Si no existe ninguna fila, devuelve la configuración por default (todo deshabilitado).
 *
 * Pueden leerla empleados y dueños (RLS valida org_id).
 */
export async function getPaymentMethodsConfigAction(): Promise<GetPaymentMethodsConfigResult> {
  try {
    const { supabase, orgId } = await verifyAuth()

    const { data, error } = await supabase
      .from('payment_methods_config')
      .select(
        `posnet_mp_enabled, posnet_mp_label, posnet_mp_notes,
         qr_static_enabled, qr_static_image_url, qr_static_image_path,
         qr_static_holder_name, qr_static_instructions,
         alias_enabled, alias_value, alias_cbu_cvu, alias_titular_name,
         alias_bank_name, alias_instructions`
      )
      .eq('organization_id', orgId)
      .maybeSingle()

    if (error) {
      logger.error('getPaymentMethodsConfigAction', 'Error leyendo config', error)
      return { success: false, error: 'No se pudo cargar la configuración' }
    }

    return {
      success: true,
      config: data ? (data as PaymentMethodsConfig) : DEFAULT_CONFIG,
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('getPaymentMethodsConfigAction', 'Error inesperado', err)
    return { success: false, error: err.message }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// 💾 GUARDAR CONFIGURACIÓN
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Guarda la configuración de métodos de cobro de la organización.
 * Solo el owner puede ejecutar este action.
 *
 * Hace UPSERT (onConflict: organization_id) — si no había fila, la crea.
 */
export async function savePaymentMethodsConfigAction(
  input: unknown
): Promise<SavePaymentMethodsConfigResult> {
  try {
    const parsed = savePaymentMethodsConfigSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: getZodError(parsed) }
    }

    const { supabase, orgId, user } = await verifyOwner()

    const payload = {
      organization_id: orgId,
      posnet_mp_enabled: parsed.data.posnet_mp_enabled,
      posnet_mp_label: parsed.data.posnet_mp_label ?? null,
      posnet_mp_notes: parsed.data.posnet_mp_notes ?? null,

      qr_static_enabled: parsed.data.qr_static_enabled,
      qr_static_image_url: parsed.data.qr_static_image_url ?? null,
      qr_static_image_path: parsed.data.qr_static_image_path ?? null,
      qr_static_holder_name: parsed.data.qr_static_holder_name ?? null,
      qr_static_instructions: parsed.data.qr_static_instructions ?? null,

      alias_enabled: parsed.data.alias_enabled,
      alias_value: parsed.data.alias_value ?? null,
      alias_cbu_cvu: parsed.data.alias_cbu_cvu ?? null,
      alias_titular_name: parsed.data.alias_titular_name ?? null,
      alias_bank_name: parsed.data.alias_bank_name ?? null,
      alias_instructions: parsed.data.alias_instructions ?? null,
    }

    const { error } = await supabase
      .from('payment_methods_config')
      .upsert(payload, { onConflict: 'organization_id' })

    if (error) {
      logger.error('savePaymentMethodsConfigAction', 'Error guardando config', error)
      return { success: false, error: 'No se pudo guardar la configuración' }
    }

    logger.info('savePaymentMethodsConfigAction', 'Config de cobro guardada', {
      orgId,
      userId: user.id,
      posnet: parsed.data.posnet_mp_enabled,
      qr: parsed.data.qr_static_enabled,
      alias: parsed.data.alias_enabled,
    })

    return { success: true }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('savePaymentMethodsConfigAction', 'Error inesperado', err)
    return { success: false, error: err.message }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// 🖼️ SUBIR IMAGEN DEL QR FIJO
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Sube la imagen del QR fijo (PNG/JPEG/WebP) al bucket 'payment-assets'.
 * La ruta del archivo es `{orgId}/qr-static-{timestamp}.{ext}` — el prefijo
 * orgId es requerido por la RLS de storage.objects.
 *
 * Solo owner. Valida tamaño y MIME. Retorna la URL pública + el path para
 * poder borrar la imagen después si se reemplaza.
 *
 * NOTA: este action recibe un FormData con el archivo. Debe ser llamado
 *       desde un `<form action={...}>` en el cliente o con FormData construido
 *       a mano. No usamos Storage client del browser (evitamos exponer
 *       service role keys o tokens sensibles).
 */
export async function uploadQrStaticImageAction(
  formData: FormData
): Promise<UploadQrStaticImageResult> {
  try {
    const { supabase, orgId, user } = await verifyOwner()

    const file = formData.get('file') as File | null
    if (!file || typeof file === 'string') {
      return { success: false, error: 'No se recibió ningún archivo' }
    }

    if (file.size === 0) {
      return { success: false, error: 'El archivo está vacío' }
    }

    if (file.size > MAX_QR_IMAGE_SIZE_BYTES) {
      return {
        success: false,
        error: 'La imagen no puede superar los 2 MB. Reducila y volvé a intentar.',
      }
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return {
        success: false,
        error: 'Formato no soportado. Usá PNG, JPEG o WebP.',
      }
    }

    // Nombre único — incluye timestamp para evitar cache del navegador
    const ext = file.type === 'image/png'
      ? 'png'
      : file.type === 'image/webp'
      ? 'webp'
      : 'jpg'
    const path = `${orgId}/qr-static-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (uploadError) {
      logger.error('uploadQrStaticImageAction', 'Error subiendo a storage', uploadError)
      return { success: false, error: 'No se pudo subir la imagen' }
    }

    const { data: publicData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path)

    logger.info('uploadQrStaticImageAction', 'Imagen QR fijo subida', {
      orgId,
      userId: user.id,
      path,
      size: file.size,
    })

    return {
      success: true,
      url: publicData.publicUrl,
      path,
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('uploadQrStaticImageAction', 'Error inesperado', err)
    return { success: false, error: err.message }
  }
}

/**
 * Elimina la imagen del QR fijo del storage.
 * Solo owner. Se usa cuando el usuario reemplaza la imagen o deshabilita el método.
 */
export async function deleteQrStaticImageAction(
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!path || !path.trim()) {
      return { success: false, error: 'Path vacío' }
    }

    const { supabase, orgId } = await verifyOwner()

    // Defensa en profundidad: aunque RLS ya filtra por prefijo orgId,
    // validamos acá también antes de llamar al API.
    if (!path.startsWith(`${orgId}/`)) {
      logger.warn('deleteQrStaticImageAction', 'Intento de borrar archivo fuera de la org', {
        orgId,
        path,
      })
      return { success: false, error: 'Ruta de archivo inválida' }
    }

    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path])

    if (error) {
      logger.error('deleteQrStaticImageAction', 'Error borrando imagen', error)
      return { success: false, error: 'No se pudo borrar la imagen' }
    }

    return { success: true }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('deleteQrStaticImageAction', 'Error inesperado', err)
    return { success: false, error: err.message }
  }
}
