/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 💳 MERCADO PAGO SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para integración con Mercado Pago QR dinámico.
 * Maneja creación de órdenes de pago, verificación de estado y gestión de credenciales.
 *
 * ARQUITECTURA:
 * - Credenciales encriptadas por organización en Supabase
 * - Cada venta = QR único dinámico
 * - Webhook verifica HMAC-SHA256 y actualiza estado de pago
 * - Polling desde UI cada 2 seg (timeout 5 min)
 * - Soporte para sandbox (testing) y producción
 *
 * FLUJO DE PAGO:
 * 1. Usuario en caja selecciona "QR Mercado Pago"
 * 2. createMercadoPagoOrderAction() → genera QR, guarda en BD
 * 3. UI muestra QR, hace polling con checkMercadoPagoPaymentStatusAction()
 * 4. Cliente escanea y paga en app de MP
 * 5. Webhook recibe notificación, actualiza estado
 * 6. UI detecta cambio de estado → muestra confirmación
 * 7. Venta se registra finalmente en sales table
 *
 * SEGURIDAD:
 * - access_token encriptado con pgcrypto
 * - webhook_secret encriptado
 * - Firma de webhook verificada en route.ts
 * - Validación de timestamp (replay attacks)
 * - Idempotencia via external_reference (sale_id)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import { verifyAuth, verifyOwner } from '@/lib/actions/auth-helpers'
import { logger } from '@/lib/logging'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Configuración de Mercado Pago para una organización
 * Almacenada encriptada en mercadopago_credentials
 */
export interface MercadoPagoConfig {
  accessToken: string
  publicKey: string
  collecterId: string
  webhookSecret: string
  isSandbox: boolean
}

/**
 * Orden de pago QR en Supabase
 */
export interface MercadoPagoOrder {
  id: string
  organization_id: string
  sale_id: string
  external_reference: string
  amount: number
  currency: string
  qr_data: string
  qr_image_url: string | null
  status: 'pending' | 'confirmed' | 'failed' | 'expired' | 'cancelled'
  mp_payment_id: string | null
  mp_transaction_id: string | null
  created_at: string
  expires_at: string
  confirmed_at: string | null
  webhook_received_at: string | null
  notes: string | null
}

/**
 * Resultado de crear orden de pago QR
 */
export interface CreateMercadoPagoOrderResult {
  success: boolean
  orderId?: string
  qrData?: string
  qrImageUrl?: string | null
  expiresAt?: string
  error?: string
  retryable?: boolean
}

/**
 * Resultado de verificar estado de pago
 */
export interface CheckPaymentStatusResult {
  success: boolean
  status?: 'pending' | 'confirmed' | 'failed' | 'expired' | 'cancelled'
  mpPaymentId?: string | null
  confirmedAt?: string | null
  error?: string
}

/**
 * Resultado de obtener configuración de MP
 */
export interface GetMercadoPagoConfigResult {
  success: boolean
  config?: Partial<MercadoPagoConfig>
  error?: string
}

/**
 * Resultado de guardar credenciales
 */
export interface SaveMercadoPagoCredentialsResult {
  success: boolean
  error?: string
  warning?: string
}

/**
 * Resultado de obtener detalle de orden
 */
export interface GetMercadoPagoOrderDetailResult {
  success: boolean
  order?: MercadoPagoOrder
  error?: string
}

/**
 * Resultado de cancelar orden
 */
export interface CancelMercadoPagoOrderResult {
  success: boolean
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

const MP_API_BASE_URL = 'https://api.mercadopago.com'
const QR_EXPIRY_MINUTES = 30
const PAYMENT_CONFIRMATION_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutos

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS PÚBLICAS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 🔑 Obtener configuración de Mercado Pago de la organización
 *
 * VALIDACIÓN:
 * - Usuario autenticado
 * - Organización activa
 *
 * RETORNA:
 * - Configuración sin exponer access_token completo
 * - Solo últimos 4 caracteres para debugging
 *
 * @returns GetMercadoPagoConfigResult
 */
export async function getMercadoPagoConfigAction(): Promise<GetMercadoPagoConfigResult> {
  try {
    const { supabase, orgId } = await verifyAuth()

    // TODO: Implementar desencriptación de credenciales
    // Nota: Supabase tiene pgcrypto para encriptar datos sensibles
    // Patrón esperado:
    // const { data: credentials } = await supabase
    //   .from('mercadopago_credentials')
    //   .select('access_token, public_key, collector_id, webhook_secret, is_sandbox')
    //   .eq('organization_id', orgId)
    //   .eq('is_active', true)
    //   .maybeSingle()

    // Por ahora, retornar error indicativo
    return {
      success: false,
      error: 'TODO: Implementar desencriptación de credenciales en Supabase',
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('getMercadoPagoConfigAction', 'Error obteniendo configuración', err)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * 💾 Guardar o actualizar credenciales de Mercado Pago
 *
 * VALIDACIÓN:
 * - Solo OWNER puede hacer esto
 * - access_token debe validarse con MP API
 * - Encriptar datos sensibles antes de guardar
 *
 * SEGURIDAD:
 * - NO guardar credenciales en env vars
 * - Encriptar en Supabase con pgcrypto
 * - Auditar este action: log quién y cuándo
 *
 * @param accessToken - Access token de MP (se validará)
 * @param webhookSecret - Secret para firmar webhooks
 * @returns SaveMercadoPagoCredentialsResult
 */
export async function saveMercadoPagoCredentialsAction(
  accessToken: string,
  webhookSecret: string
): Promise<SaveMercadoPagoCredentialsResult> {
  try {
    // Solo owner puede configurar integración de pago
    const { supabase, orgId } = await verifyOwner()

    // Validaciones básicas
    if (!accessToken || accessToken.trim().length === 0) {
      return {
        success: false,
        error: 'El access token no puede estar vacío',
      }
    }

    if (!webhookSecret || webhookSecret.trim().length === 0) {
      return {
        success: false,
        error: 'El webhook secret no puede estar vacío',
      }
    }

    // TODO: Validar que accessToken es válido llamando a MP API
    // const isValidToken = await validateMercadoPagoToken(accessToken)
    // if (!isValidToken) {
    //   return { success: false, error: 'Access token inválido' }
    // }

    // TODO: Obtener collector_id desde MP API
    // const { data: mpUser } = await callMercadoPagoAPI('GET', '/users/me', undefined, accessToken)
    // const collecterId = mpUser?.id

    // TODO: Implementar inserción/actualización con encriptación
    // Patrón esperado usando pgcrypto:
    // const { error } = await supabase
    //   .from('mercadopago_credentials')
    //   .upsert({
    //     organization_id: orgId,
    //     access_token: accessToken,  // pgcrypto encriptará automáticamente
    //     webhook_secret: webhookSecret,
    //     collector_id: collecterId,
    //     public_key: mpUser?.public_key,
    //     is_active: true,
    //     is_sandbox: false,  // Ajustar según validación
    //   }, {
    //     onConflict: 'organization_id'
    //   })

    logger.info('saveMercadoPagoCredentialsAction', 'TODO: Implementar guardado de credenciales', {
      orgId,
      tokenLastChars: accessToken.slice(-4),
    })

    return {
      success: false,
      error: 'TODO: Implementar almacenamiento encriptado de credenciales',
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('saveMercadoPagoCredentialsAction', 'Error guardando credenciales', err)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * 🎫 Crear orden de pago QR dinámico
 *
 * FLUJO:
 * 1. Validar que organización tiene credenciales de MP configuradas
 * 2. Validar monto > 0
 * 3. Llamar API de MP para generar QR
 * 4. Guardar orden en tabla mercadopago_orders
 * 5. Retornar QR data y ID de orden para mostrar en UI
 *
 * IDEMPOTENCIA:
 * - external_reference = sale_id garantiza que si se reintenta,
 *   MP retorna la misma orden (no crea duplicados)
 *
 * @param saleId - ID de la venta en Supabase (para vincular y idempotencia)
 * @param amount - Monto total en ARS
 * @param description - Descripción de la venta (ej: "Venta desde kiosco")
 * @returns CreateMercadoPagoOrderResult con QR data
 */
export async function createMercadoPagoOrderAction(
  saleId: string,
  amount: number,
  description: string
): Promise<CreateMercadoPagoOrderResult> {
  try {
    const { supabase, orgId } = await verifyAuth()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDACIONES
    // ───────────────────────────────────────────────────────────────────────────

    if (!saleId || saleId.trim().length === 0) {
      return {
        success: false,
        error: 'Sale ID es requerido',
        retryable: false,
      }
    }

    if (amount <= 0) {
      return {
        success: false,
        error: 'El monto debe ser mayor a cero',
        retryable: false,
      }
    }

    if (amount > 999999999.99) {
      return {
        success: false,
        error: 'El monto excede el límite máximo',
        retryable: false,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // OBTENER CONFIGURACIÓN DE MERCADO PAGO
    // ───────────────────────────────────────────────────────────────────────────

    // TODO: Desencriptar y validar credenciales
    // const credentialsResult = await getMercadoPagoConfigAction()
    // if (!credentialsResult.success || !credentialsResult.config) {
    //   return {
    //     success: false,
    //     error: 'Credenciales de Mercado Pago no configuradas',
    //     retryable: false,
    //   }
    // }

    // const config = credentialsResult.config

    // ───────────────────────────────────────────────────────────────────────────
    // LLAMAR API DE MERCADO PAGO
    // ───────────────────────────────────────────────────────────────────────────

    // TODO: Implementar llamado a API de MP
    // const mpPath = `/instore/orders/qr/seller/collectors/${config.collecterId}/pos/${cashRegisterId}/qrs`
    //
    // const mpResponse = await callMercadoPagoAPI(
    //   'PUT',
    //   mpPath,
    //   {
    //     external_pos_id: cashRegisterId,
    //     total_amount: amount,
    //     description: description || 'Venta desde kiosco',
    //     external_reference: saleId,  // CRÍTICO: idempotencia
    //   },
    //   config.accessToken
    // )
    //
    // if (!mpResponse || !mpResponse.qr_data) {
    //   return {
    //     success: false,
    //     error: 'No se pudo generar QR en Mercado Pago',
    //     retryable: true,  // Reintentar: puede ser error temporal
    //   }
    // }

    // ───────────────────────────────────────────────────────────────────────────
    // GUARDAR ORDEN EN SUPABASE
    // ───────────────────────────────────────────────────────────────────────────

    // TODO: Insertar en mercadopago_orders
    // const expiresAt = new Date(Date.now() + QR_EXPIRY_MINUTES * 60 * 1000).toISOString()
    //
    // const { data: order, error: insertError } = await supabase
    //   .from('mercadopago_orders')
    //   .insert({
    //     organization_id: orgId,
    //     sale_id: saleId,
    //     external_reference: saleId,
    //     amount,
    //     currency: 'ARS',
    //     qr_data: mpResponse.qr_data,
    //     status: 'pending',
    //     created_at: new Date().toISOString(),
    //     expires_at: expiresAt,
    //   })
    //   .select('id, qr_data, expires_at')
    //   .single()

    // if (insertError || !order) {
    //   logger.error('createMercadoPagoOrderAction', 'Error guardando orden', insertError)
    //   return {
    //     success: false,
    //     error: 'No se pudo guardar la orden de pago',
    //     retryable: true,
    //   }
    // }

    logger.info('createMercadoPagoOrderAction', 'TODO: Implementar creación completa de orden QR', {
      orgId,
      saleId,
      amount,
    })

    return {
      success: false,
      error: 'TODO: Implementar integración completa con API de Mercado Pago',
      retryable: false,
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('createMercadoPagoOrderAction', 'Error creando orden de pago', err)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      retryable: true,
    }
  }
}

/**
 * ✅ Verificar estado de pago QR
 *
 * Se llama desde UI cada 2 segundos (polling) mientras se espera confirmación.
 * Retorna estado actual de la orden.
 *
 * NOTAS:
 * - El webhook actualiza el estado automáticamente
 * - Polling es un fallback en caso de webhook lento/perdido
 * - Timeout de UI después de 5 min
 *
 * @param orderId - ID de la orden de pago en Supabase
 * @returns CheckPaymentStatusResult con estado actual
 */
export async function checkMercadoPagoPaymentStatusAction(
  orderId: string
): Promise<CheckPaymentStatusResult> {
  try {
    const { supabase } = await verifyAuth()

    if (!orderId || orderId.trim().length === 0) {
      return {
        success: false,
        error: 'Order ID es requerido',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // OBTENER ORDEN ACTUAL
    // ───────────────────────────────────────────────────────────────────────────

    // TODO: Obtener estado de mercadopago_orders
    // const { data: order, error } = await supabase
    //   .from('mercadopago_orders')
    //   .select('status, mp_payment_id, confirmed_at, expires_at')
    //   .eq('id', orderId)
    //   .maybeSingle()
    //
    // if (error || !order) {
    //   return {
    //     success: false,
    //     error: 'Orden no encontrada',
    //   }
    // }

    // TODO: Si status = pending y expirada, actualizar a expired
    // if (order.status === 'pending' && new Date(order.expires_at) < new Date()) {
    //   await supabase
    //     .from('mercadopago_orders')
    //     .update({ status: 'expired' })
    //     .eq('id', orderId)
    //   return { success: true, status: 'expired' }
    // }

    // return {
    //   success: true,
    //   status: order.status,
    //   mpPaymentId: order.mp_payment_id,
    //   confirmedAt: order.confirmed_at,
    // }

    return {
      success: false,
      error: 'TODO: Implementar verificación de estado de pago',
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('checkMercadoPagoPaymentStatusAction', 'Error verificando estado', err)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * 📋 Obtener detalle completo de una orden de pago
 *
 * Para debugging, auditoría y mostrar historial.
 * Solo retorna si el usuario pertenece a la organización.
 *
 * @param orderId - ID de la orden
 * @returns GetMercadoPagoOrderDetailResult
 */
export async function getMercadoPagoOrderDetailAction(
  orderId: string
): Promise<GetMercadoPagoOrderDetailResult> {
  try {
    const { supabase, orgId } = await verifyAuth()

    if (!orderId) {
      return {
        success: false,
        error: 'Order ID es requerido',
      }
    }

    // TODO: Obtener detalle completo
    // const { data: order, error } = await supabase
    //   .from('mercadopago_orders')
    //   .select('*')
    //   .eq('id', orderId)
    //   .eq('organization_id', orgId)  // Seguridad: solo su org
    //   .maybeSingle()
    //
    // if (error || !order) {
    //   return {
    //     success: false,
    //     error: 'Orden no encontrada',
    //   }
    // }
    //
    // return { success: true, order: order as MercadoPagoOrder }

    return {
      success: false,
      error: 'TODO: Implementar obtención de detalle de orden',
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('getMercadoPagoOrderDetailAction', 'Error obteniendo detalle', err)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * ❌ Cancelar una orden de pago expirada
 *
 * Se llama si:
 * - Timeout de UI (5 min sin confirmación)
 * - QR expiró (30 min)
 * - Usuario presionó "Cancelar" en dialog
 *
 * @param orderId - ID de la orden a cancelar
 * @returns CancelMercadoPagoOrderResult
 */
export async function cancelMercadoPagoOrderAction(
  orderId: string
): Promise<CancelMercadoPagoOrderResult> {
  try {
    const { supabase, orgId } = await verifyAuth()

    if (!orderId) {
      return {
        success: false,
        error: 'Order ID es requerido',
      }
    }

    // TODO: Actualizar estado a cancelled
    // const { error } = await supabase
    //   .from('mercadopago_orders')
    //   .update({
    //     status: 'cancelled',
    //     notes: 'Cancelado por usuario',
    //   })
    //   .eq('id', orderId)
    //   .eq('organization_id', orgId)

    // if (error) {
    //   logger.error('cancelMercadoPagoOrderAction', 'Error cancelando orden', error)
    //   return {
    //     success: false,
    //     error: 'No se pudo cancelar la orden',
    //   }
    // }

    logger.info('cancelMercadoPagoOrderAction', 'Orden cancelada', { orderId })

    return {
      success: false,
      error: 'TODO: Implementar cancelación de orden',
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('cancelMercadoPagoOrderAction', 'Error en cancelación', err)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// FUNCIONES INTERNAS (No exportadas)
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Desencriptar y obtener configuración de Mercado Pago
 *
 * TODO: Implementar usando pgcrypto de Supabase
 * Schema esperado:
 * SELECT
 *   pgp_sym_decrypt(access_token::bytea, 'key') as access_token,
 *   ...
 * FROM mercadopago_credentials
 *
 * @param supabase - Cliente Supabase
 * @param orgId - ID de organización
 * @returns Configuración desencriptada o null
 */
async function getDecryptedMercadoPagoConfig(
  supabase: any,
  orgId: string
): Promise<MercadoPagoConfig | null> {
  // TODO: Implementar desencriptación
  return null
}

/**
 * Llamar API de Mercado Pago de forma segura
 *
 * TODO: Implementar con:
 * - Reintentos con exponential backoff
 * - Rate limiting
 * - Timeout de 10 seg
 * - Logging de todos los calls
 *
 * @param method - GET, POST, PUT, DELETE
 * @param path - Ruta relativa (ej: /users/me)
 * @param body - Payload (si aplica)
 * @param accessToken - Token de autenticación
 * @returns Response data o null si error
 */
async function callMercadoPagoAPI(
  method: string,
  path: string,
  body?: any,
  accessToken?: string
): Promise<any> {
  // TODO: Implementar
  return null
}

/**
 * Validar que un access token es válido con MP
 *
 * TODO: Hacer request a GET /users/me y validar respuesta
 *
 * @param accessToken - Token a validar
 * @returns true si es válido, false si no
 */
async function validateMercadoPagoToken(accessToken: string): Promise<boolean> {
  // TODO: Implementar
  return false
}

/**
 * Generar y almacenar imagen QR en Supabase Storage
 *
 * TODO: Usar librería qr-code para generar PNG
 * Subir a storage/qr-codes/{orderId}.png
 * Retornar URL pública
 *
 * @param qrData - EMVCo string del QR
 * @param orderId - ID de la orden (para naming)
 * @returns URL pública al QR o null si error
 */
async function generateAndStoreQRImage(qrData: string, orderId: string): Promise<string | null> {
  // TODO: Implementar
  return null
}
