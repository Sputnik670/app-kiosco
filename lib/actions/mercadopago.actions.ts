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
 * - access_token encriptado con Node.js crypto (AES-256-GCM)
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
import { randomBytes, createCipheriv, createDecipheriv, createHmac } from 'crypto'
import { saveMPCredentialsSchema, createMPOrderSchema, getZodError } from '@/lib/validations'

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
  connectedVia?: 'oauth' | 'manual'
  tokenExpiresAt?: string | null
  refreshToken?: string | null
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
 * Resultado de obtener configuración de MP.
 * `hasWebhookSecret` se expone como booleano para que la UI pueda mostrar
 * estado "configurado / falta cargar" sin exponer el secret en sí.
 */
export interface GetMercadoPagoConfigResult {
  success: boolean
  config?: Partial<MercadoPagoConfig> & {
    connectedVia?: string
    hasWebhookSecret?: boolean
  }
  error?: string
}

/**
 * Resultado de desconectar Mercado Pago
 */
export interface DisconnectMercadoPagoResult {
  success: boolean
  error?: string
}

/**
 * Resultado de obtener URL de OAuth
 */
export interface GetMercadoPagoOAuthUrlResult {
  success: boolean
  url?: string
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

/**
 * Resultado de actualizar solo el webhook secret (sin tocar access_token).
 * Útil cuando la org está conectada por OAuth y el access_token vive encriptado
 * en DB sin que el usuario lo tenga en claro: necesita pegar SOLO el secret.
 */
export interface UpdateWebhookSecretResult {
  success: boolean
  error?: string
}

/**
 * Resultado de registrar una sucursal como POS en Mercado Pago.
 * `alreadyRegistered=true` cuando la sucursal ya tenía mp_external_pos_id
 * (skip de la llamada a MP — idempotencia local).
 */
export interface RegisterPosResult {
  success: boolean
  externalPosId?: string
  alreadyRegistered?: boolean
  error?: string
}

/**
 * Estado de registro en Mercado Pago de una sucursal.
 * Usado por la UI de configuración para mostrar la lista con badges de estado.
 */
export interface BranchMpStatus {
  id: string
  name: string
  isRegistered: boolean
  externalPosId: string | null
}

/**
 * Resultado de listar sucursales con su estado en MP
 */
export interface GetBranchesMpStatusResult {
  success: boolean
  branches?: BranchMpStatus[]
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

const MP_API_BASE_URL = 'https://api.mercadopago.com'
const QR_EXPIRY_MINUTES = 30
const PAYMENT_CONFIRMATION_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutos
const MP_API_TIMEOUT_MS = 10 * 1000 // 10 segundos
const MP_MAX_RETRIES = 3
const MP_RETRY_BACKOFF_MS = 1000 // exponencial: 1s, 2s, 4s

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const ENCRYPTION_KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16 // 128 bits

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

    const config = await getDecryptedMercadoPagoConfig(supabase, orgId)

    if (!config) {
      return {
        success: false,
        error: 'Credenciales de Mercado Pago no configuradas',
      }
    }

    // Retornar sin exponer el access token completo ni el webhook secret.
    // hasWebhookSecret le permite a la UI mostrar "ya configurado" sin
    // necesidad de enviar el valor al cliente.
    return {
      success: true,
      config: {
        publicKey: config.publicKey,
        collecterId: config.collecterId,
        isSandbox: config.isSandbox,
        accessToken: `****${config.accessToken.slice(-4)}`, // Enmascarado
        connectedVia: config.connectedVia || 'manual',
        hasWebhookSecret: Boolean(config.webhookSecret && config.webhookSecret.length > 0),
      },
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
 * - Encriptar antes de guardar en Supabase
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
    const parsed = saveMPCredentialsSchema.safeParse({ accessToken, webhookSecret })
    if (!parsed.success) {
      return { success: false, error: getZodError(parsed) }
    }

    // Solo owner puede configurar integración de pago
    const { supabase, orgId, user } = await verifyOwner()

    // Validar que accessToken es válido llamando a MP API
    const mpUser = await validateMercadoPagoToken(accessToken)
    if (!mpUser) {
      return {
        success: false,
        error: 'Access token inválido. Verifica que el token es correcto.',
      }
    }

    const collecterId = String(mpUser.id)
    const publicKey = mpUser.public_key || ''
    const isSandbox = false // Asumir producción por defecto

    logger.info('saveMercadoPagoCredentialsAction', 'Validando credenciales de MP', {
      orgId,
      collecterId,
      userId: user.id,
    })

    // Encriptar datos sensibles
    const encryptedToken = encrypt(accessToken)
    const encryptedSecret = encrypt(webhookSecret)

    // Insertar/actualizar credenciales
    const { data, error } = await supabase
      .from('mercadopago_credentials')
      .upsert(
        {
          organization_id: orgId,
          access_token_encrypted: encryptedToken,
          webhook_secret_encrypted: encryptedSecret,
          collector_id: collecterId,
          public_key: publicKey,
          is_sandbox: isSandbox,
          is_active: true,
        },
        { onConflict: 'organization_id' }
      )
      .select('id')
      .single()

    if (error) {
      logger.error('saveMercadoPagoCredentialsAction', 'Error guardando credenciales en BD', error)
      return {
        success: false,
        error: 'No se pudieron guardar las credenciales',
      }
    }

    logger.info('saveMercadoPagoCredentialsAction', 'Credenciales guardadas exitosamente', {
      orgId,
      collecterId,
      credentialId: data.id,
    })

    return {
      success: true,
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
 * @param branchId - ID de la sucursal
 * @returns CreateMercadoPagoOrderResult con QR data
 */
export async function createMercadoPagoOrderAction(
  saleId: string,
  amount: number,
  description: string,
  branchId: string,
  cashRegisterId: string,
  items: Array<{
    product_id: string
    quantity: number
    unit_price: number
    subtotal: number
  }>
): Promise<CreateMercadoPagoOrderResult> {
  try {
    const parsed = createMPOrderSchema.safeParse({
      saleId, amount, description, branchId, cashRegisterId, items,
    })
    if (!parsed.success) {
      return { success: false, error: getZodError(parsed), retryable: false }
    }

    const { supabase, orgId } = await verifyAuth()

    // ───────────────────────────────────────────────────────────────────────────
    // VALIDAR QUE LA SUCURSAL ESTÁ REGISTRADA COMO POS EN MERCADO PAGO
    // ───────────────────────────────────────────────────────────────────────────
    // Sin mp_external_pos_id, no podemos generar QRs EMVCo en esa sucursal.
    // El registro se hace via registerMercadoPagoPosForBranchAction, ya sea
    // automáticamente al crear la sucursal o manualmente desde configuración.

    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id, mp_external_pos_id, organization_id, is_active')
      .eq('id', branchId)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (branchError || !branch) {
      return {
        success: false,
        error: 'Sucursal no encontrada o no pertenece a tu organización',
        retryable: false,
      }
    }

    if (!branch.mp_external_pos_id) {
      return {
        success: false,
        error:
          'Esta sucursal todavía no está registrada como POS en Mercado Pago. Andá a Ajustes → Mercado Pago → "Registrar sucursales" antes de cobrar QR.',
        retryable: false,
      }
    }

    const externalPosId = branch.mp_external_pos_id

    // ───────────────────────────────────────────────────────────────────────────
    // OBTENER CONFIGURACIÓN DE MERCADO PAGO
    // ───────────────────────────────────────────────────────────────────────────

    const config = await getDecryptedMercadoPagoConfig(supabase, orgId)
    if (!config) {
      return {
        success: false,
        error: 'Credenciales de Mercado Pago no configuradas',
        retryable: false,
      }
    }

    if (!config.collecterId) {
      return {
        success: false,
        error: 'collector_id de Mercado Pago no disponible. Reconectá tu cuenta.',
        retryable: false,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // LLAMAR API DE MERCADO PAGO — QR Dynamic (EMVCo interoperable)
    // ───────────────────────────────────────────────────────────────────────────
    // Endpoint: POST /instore/orders/qr/seller/collectors/{collector_id}/pos/{external_pos_id}/qrs
    //
    // Devuelve `qr_data` con un string EMVCo puro (no URL), que es el estándar
    // interoperable de billeteras virtuales en Argentina/LATAM. Lo leen:
    //   - App de Mercado Pago
    //   - Naranja X, Brubank, Ualá, Cuenta DNI, MODO, Santander, Galicia, BBVA
    //
    // Idempotencia garantizada por external_reference = saleId.
    //
    // NOTA HISTÓRICA: hasta abr-2026 usábamos /checkout/preferences para sortear
    // el requisito de registrar POS por API. La sesión 27-abr-2026 implementó
    // el registro de POS por sucursal y migró este flujo a EMVCo.

    // notification_url: CRÍTICO. Sin esto, MP no envía webhooks aunque la URL
    // esté configurada en el panel de developers (la pasamos por orden).
    let notificationUrl: string | undefined
    try {
      const redirectUri = process.env.MP_REDIRECT_URI
      if (redirectUri) {
        notificationUrl = `${new URL(redirectUri).origin}/api/mercadopago/webhook`
      }
    } catch {
      // MP_REDIRECT_URI no es URL válida → dejamos undefined y MP usa el
      // fallback del panel de developers.
    }

    const totalAmount = Number(amount)

    // Items: el endpoint EMVCo requiere al menos un item con campos específicos
    // (title, description, unit_price, quantity, unit_measure, total_amount).
    // Mandamos UN solo line item con el total — MP no usa nuestro detalle de
    // productos para nada, solo necesita un item para validar el total. El
    // detalle real lo guardamos en cart_snapshot para reconstruir la sale en el
    // webhook.
    const mpRequestBody = {
      external_reference: saleId, // CRÍTICO: idempotencia
      title: description || 'Compra en kiosco',
      description: description || 'Venta desde caja de kiosco',
      total_amount: totalAmount,
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
      items: [
        {
          title: description || 'Compra en kiosco',
          description: 'Venta desde caja',
          unit_price: totalAmount,
          quantity: 1,
          unit_measure: 'unit',
          total_amount: totalAmount,
        },
      ],
    }

    logger.debug('createMercadoPagoOrderAction', 'Llamando API de MP (QR EMVCo)', {
      saleId: saleId.substring(0, 8),
      amount: totalAmount,
      collecterId: config.collecterId,
      externalPosId,
    })

    const mpResponse = await callMercadoPagoAPI(
      'POST',
      `/instore/orders/qr/seller/collectors/${config.collecterId}/pos/${externalPosId}/qrs`,
      mpRequestBody,
      config.accessToken
    )

    // Response esperado: { qr_data: "00020101...", in_store_order_id: "uuid" }
    if (!mpResponse || !mpResponse.qr_data) {
      logger.warn('createMercadoPagoOrderAction', 'MP API no retornó qr_data EMVCo', {
        saleId: saleId.substring(0, 8),
        responseKeys: mpResponse ? Object.keys(mpResponse) : null,
      })
      return {
        success: false,
        error: 'No se pudo generar QR EMVCo en Mercado Pago',
        retryable: true,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // GUARDAR ORDEN EN SUPABASE
    // ───────────────────────────────────────────────────────────────────────────

    const expiresAt = new Date(Date.now() + QR_EXPIRY_MINUTES * 60 * 1000).toISOString()

    const { data: order, error: insertError } = await supabase
      .from('mercadopago_orders')
      .insert({
        organization_id: orgId,
        branch_id: branchId,
        cash_register_id: cashRegisterId,
        // sale_id: la sale real la crea el WEBHOOK cuando MP confirma el pago,
        // usando cart_snapshot. Hasta entonces, sale_id queda null.
        sale_id: null,
        external_reference: saleId,
        amount: totalAmount,
        currency: 'ARS',
        // qr_data ahora guarda un string EMVCo puro (no URL). El componente
        // QRCodeSVG lo encodea igual — el QR lo lee cualquier billetera.
        qr_data: mpResponse.qr_data,
        // mp_order_id: in_store_order_id que devuelve el endpoint EMVCo. El
        // webhook NO lo usa para lookup (usa external_reference), pero lo
        // guardamos para auditoría y debug.
        mp_order_id: mpResponse.in_store_order_id || null,
        status: 'pending',
        // cart_snapshot: items tal cual los espera el RPC process_sale_from_webhook.
        // Si la caja se cierra antes de que MP confirme, el webhook igual puede
        // crear la sale a partir de este snapshot.
        cart_snapshot: items,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .select('id, qr_data, expires_at')
      .single()

    if (insertError || !order) {
      logger.error('createMercadoPagoOrderAction', 'Error guardando orden en BD', insertError)
      return {
        success: false,
        error: 'No se pudo guardar la orden de pago',
        retryable: true,
      }
    }

    logger.info('createMercadoPagoOrderAction', 'Orden QR creada exitosamente', {
      orderId: order.id,
      saleId,
      amount,
    })

    return {
      success: true,
      orderId: order.id,
      qrData: order.qr_data,
      expiresAt: order.expires_at,
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

    const { data: order, error } = await supabase
      .from('mercadopago_orders')
      .select('status, mp_payment_id, confirmed_at, expires_at')
      .eq('id', orderId)
      .maybeSingle()

    if (error || !order) {
      return {
        success: false,
        error: 'Orden no encontrada',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Si status = pending y expirada, actualizar a expired
    // ───────────────────────────────────────────────────────────────────────────

    if (order.status === 'pending' && new Date(order.expires_at) < new Date()) {
      await supabase
        .from('mercadopago_orders')
        .update({ status: 'expired' })
        .eq('id', orderId)

      logger.debug('checkMercadoPagoPaymentStatusAction', 'Orden expirada', { orderId })

      return { success: true, status: 'expired' }
    }

    return {
      success: true,
      status: order.status as any,
      mpPaymentId: order.mp_payment_id,
      confirmedAt: order.confirmed_at,
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

    const { data: order, error } = await supabase
      .from('mercadopago_orders')
      .select('*')
      .eq('id', orderId)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (error || !order) {
      return {
        success: false,
        error: 'Orden no encontrada',
      }
    }

    return { success: true, order: order as MercadoPagoOrder }
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

    // Primero verificar que la orden existe y pertenece a esta org
    const { data: order, error: fetchError } = await supabase
      .from('mercadopago_orders')
      .select('status')
      .eq('id', orderId)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (fetchError || !order) {
      return {
        success: false,
        error: 'Orden no encontrada',
      }
    }

    // Solo se puede cancelar si está pending
    if (order.status !== 'pending') {
      return {
        success: false,
        error: `No se puede cancelar una orden con estado ${order.status}`,
      }
    }

    // Actualizar estado a cancelled
    const { error: updateError } = await supabase
      .from('mercadopago_orders')
      .update({
        status: 'cancelled',
        notes: 'Cancelado por usuario',
      })
      .eq('id', orderId)
      .eq('organization_id', orgId)

    if (updateError) {
      logger.error('cancelMercadoPagoOrderAction', 'Error cancelando orden', updateError)
      return {
        success: false,
        error: 'No se pudo cancelar la orden',
      }
    }

    logger.info('cancelMercadoPagoOrderAction', 'Orden cancelada', { orderId })

    return { success: true }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('cancelMercadoPagoOrderAction', 'Error en cancelación', err)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * 🔗 Vincular una venta con su orden de Mercado Pago
 *
 * Se llama después de crear la venta, para vincular sales.mp_order_id
 * con la orden de MP que se creó con el tempSaleId como external_reference.
 *
 * @param saleId - ID real de la venta en sales
 * @param tempSaleId - ID temporal usado como external_reference al crear el QR
 */
export async function linkSaleToMercadoPagoOrderAction(
  saleId: string,
  tempSaleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, orgId } = await verifyAuth()

    // Buscar la orden de MP por external_reference (tempSaleId)
    const { data: order, error: findError } = await supabase
      .from('mercadopago_orders')
      .select('id')
      .eq('organization_id', orgId)
      .eq('external_reference', tempSaleId)
      .maybeSingle()

    if (findError || !order) {
      logger.warn('linkSaleToMPOrder', 'Orden MP no encontrada', {
        tempSaleId: tempSaleId.substring(0, 8),
        saleId: saleId.substring(0, 8),
      })
      // No es un error crítico — la venta ya se registró
      return { success: true }
    }

    // Actualizar la venta con el mp_order_id
    const { error: updateError } = await supabase
      .from('sales')
      .update({ mp_order_id: order.id })
      .eq('id', saleId)

    if (updateError) {
      logger.error('linkSaleToMPOrder', 'Error vinculando venta a orden MP', updateError)
      return { success: false, error: 'No se pudo vincular la venta con MP' }
    }

    logger.info('linkSaleToMPOrder', 'Venta vinculada a orden MP', {
      saleId: saleId.substring(0, 8),
      orderId: order.id.substring(0, 8),
    })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * 🔗 Obtener URL de OAuth para conectar Mercado Pago
 *
 * Retorna la URL a la que hay que redirigir al usuario.
 * No requiere credenciales del usuario — usa las de la app (nuestra).
 *
 * @returns GetMercadoPagoOAuthUrlResult con URL de autorización
 */
export async function getOAuthUrlAction(): Promise<GetMercadoPagoOAuthUrlResult> {
  try {
    await verifyOwner()

    const appId = process.env.MP_APP_ID
    const redirectUri = process.env.MP_REDIRECT_URI

    if (!appId || !redirectUri) {
      return {
        success: false,
        error: 'La integración OAuth no está configurada en el servidor',
      }
    }

    return {
      success: true,
      url: `/api/mercadopago/oauth/authorize`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * 🔌 Desconectar Mercado Pago de la organización
 *
 * Elimina las credenciales encriptadas.
 * Solo el owner puede hacer esto.
 *
 * @returns DisconnectMercadoPagoResult
 */
export async function disconnectMercadoPagoAction(): Promise<DisconnectMercadoPagoResult> {
  try {
    const { supabase, orgId, user } = await verifyOwner()

    logger.info('disconnectMercadoPagoAction', 'Desconectando Mercado Pago', {
      orgId,
      userId: user.id,
    })

    const { error } = await supabase
      .from('mercadopago_credentials')
      .delete()
      .eq('organization_id', orgId)

    if (error) {
      logger.error('disconnectMercadoPagoAction', 'Error eliminando credenciales', error)
      return {
        success: false,
        error: 'No se pudieron eliminar las credenciales',
      }
    }

    logger.info('disconnectMercadoPagoAction', 'Mercado Pago desconectado', { orgId })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * 🏪 Registrar una sucursal como POS en Mercado Pago (flujo Stores+POS)
 *
 * REQUISITO PREVIO para generar QRs EMVCo interoperables (los que leen
 * Naranja X, Brubank, Ualá, MODO, Cuenta DNI, Santander, etc., además de la
 * app de Mercado Pago).
 *
 * external_pos_id y external_store_id determinísticos:
 *   `KIOSCO<branch_id sin guiones>` (puramente alfanumérico — MP rechaza el
 *   underscore en POST /pos). Garantizan idempotencia local (el mismo branch
 *   siempre genera el mismo Store+POS) y ausencia de colisiones cross-org.
 *
 * FLUJO (en orden):
 *  1. Si la sucursal ya tiene mp_external_pos_id, skip — retornar alreadyRegistered.
 *  2. Si no tiene mp_store_id, crear Store en MP (POST /users/{id}/stores) y
 *     persistir mp_store_id ANTES de seguir (recovery por si falla el POS).
 *  3. Crear POS bajo ese Store (POST /pos con store_id) y persistir el
 *     mp_external_pos_id en branches.
 *
 * VALIDACIÓN:
 * - Solo OWNER (cambia config de la org).
 * - Sucursal tiene que pertenecer a la org del usuario y estar activa.
 * - Org tiene que tener credenciales MP activas con collector_id.
 *
 * MP API:
 *   POST /users/{collector_id}/stores
 *     → devuelve { id }, ese ID es el store_id que necesita el POS.
 *   POST /pos
 *     → body con external_id, store_id (numérico), category, name.
 *
 * NOTA HISTÓRICA: hasta el 27-abr-2026 esta función llamaba a
 *   PUT /instore/orders/qr/seller/collectors/{id}/pos/{external_pos_id}
 * que es un endpoint INEXISTENTE. MP devolvía 404 silencioso, el POS nunca
 * se creaba realmente, y MP igual generaba un qr_data degradado que solo leía
 * la app de MP. Por eso Naranja X y otras billeteras rechazaban el QR con
 * "el código no es para pagar". Validado en producción el 01-may-2026.
 *
 * @param branchId - UUID de la sucursal a registrar
 * @returns RegisterPosResult
 */
export async function registerMercadoPagoPosForBranchAction(
  branchId: string
): Promise<RegisterPosResult> {
  try {
    if (!branchId || typeof branchId !== 'string' || branchId.trim().length === 0) {
      return { success: false, error: 'branchId es requerido' }
    }

    const { supabase, orgId } = await verifyOwner()

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Buscar la sucursal y validar ownership
    // ─────────────────────────────────────────────────────────────────────────
    const { data: branch, error: fetchError } = await supabase
      .from('branches')
      .select('id, name, address, mp_external_pos_id, mp_store_id, organization_id, is_active')
      .eq('id', branchId)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (fetchError || !branch) {
      return {
        success: false,
        error: 'Sucursal no encontrada o no pertenece a tu organización',
      }
    }

    if (branch.is_active === false) {
      return {
        success: false,
        error: 'No se puede registrar una sucursal inactiva',
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Idempotencia local — si ya tiene POS, skip
    // ─────────────────────────────────────────────────────────────────────────
    if (branch.mp_external_pos_id && branch.mp_external_pos_id.length > 0) {
      logger.info('registerMercadoPagoPos', 'Sucursal ya registrada, skip API call', {
        branchId: branch.id.substring(0, 8),
        externalPosId: branch.mp_external_pos_id,
      })
      return {
        success: true,
        externalPosId: branch.mp_external_pos_id,
        alreadyRegistered: true,
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Obtener credenciales de MP
    // ─────────────────────────────────────────────────────────────────────────
    const config = await getDecryptedMercadoPagoConfig(supabase, orgId)
    if (!config) {
      return {
        success: false,
        error: 'Credenciales de Mercado Pago no configuradas. Conectá tu cuenta primero.',
      }
    }

    if (!config.collecterId) {
      return {
        success: false,
        error: 'collector_id de Mercado Pago no disponible. Reconectá tu cuenta.',
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Crear (o reusar) Store en MP
    // ─────────────────────────────────────────────────────────────────────────
    // Si la creación previa del Store ya pasó (mp_store_id persistido), reusamos
    // — no duplicamos stores en la cuenta de MP del dueño.
    let storeId = branch.mp_store_id

    if (!storeId) {
      // CRÍTICO: MP requiere `external_id` puramente alfanumérico [A-Za-z0-9]
      // en POST /pos. El endpoint de Stores sí acepta `_` (lo validamos en
      // 27-abr-2026), pero POST /pos lo rechaza con
      // "external_id must be alphanumeric" (validado 01-may-2026).
      // Mantenemos el mismo formato sin underscore en ambos para consistencia.
      const externalStoreId = `KIOSCO${branchId.replace(/-/g, '')}`

      // CRÍTICO sobre `location`:
      //  - city_name: MP rechaza ciudades fuera de su whitelist. "Don Torcuato"
      //    pasó el probe del 27-abr-2026 (HTTP 201). "Buenos Aires" como ciudad
      //    fue rechazada. Hardcodeado hasta que `branches` tenga columnas
      //    city/state propias (TODO de iteración futura).
      //  - state_name: "Buenos Aires" (provincia) acepta.
      //  - NO mandar country_id ni country_name — MP infiere del seller AR.
      //  - latitude/longitude: hardcodeadas a CABA mientras no haya geo en branches.
      const storeBody = {
        name: (branch.name || 'Sucursal').substring(0, 50),
        external_id: externalStoreId,
        location: {
          street_number: '0',
          street_name: branch.address || 'Sin dirección',
          city_name: 'Don Torcuato',
          state_name: 'Buenos Aires',
          latitude: -34.6037,
          longitude: -58.3816,
          reference: branch.name || '',
        },
        business_hours: {
          monday: [{ open: '08:00', close: '22:00' }],
          tuesday: [{ open: '08:00', close: '22:00' }],
          wednesday: [{ open: '08:00', close: '22:00' }],
          thursday: [{ open: '08:00', close: '22:00' }],
          friday: [{ open: '08:00', close: '22:00' }],
          saturday: [{ open: '08:00', close: '22:00' }],
          sunday: [{ open: '08:00', close: '22:00' }],
        },
      }

      logger.debug('registerMercadoPagoPos', 'Llamando POST /users/{id}/stores', {
        collecterId: config.collecterId,
        externalStoreId,
        branchName: branch.name?.substring(0, 30),
      })

      const storeResponse = await callMercadoPagoAPI(
        'POST',
        `/users/${config.collecterId}/stores`,
        storeBody,
        config.accessToken
      )

      if (!storeResponse || !storeResponse.id) {
        return {
          success: false,
          error:
            'Mercado Pago rechazó la creación del Store. Verificá que tu cuenta esté verificada (KYC) y reintentá. Si persiste, mirá los logs de Vercel.',
        }
      }

      storeId = String(storeResponse.id)

      // Persistir mp_store_id ANTES de crear el POS — recovery: si la creación
      // del POS falla, el próximo retry reusa el Store en vez de crear uno nuevo.
      const { error: storeUpdateError } = await supabase
        .from('branches')
        .update({ mp_store_id: storeId })
        .eq('id', branchId)
        .eq('organization_id', orgId)

      if (storeUpdateError) {
        logger.error(
          'registerMercadoPagoPos',
          'Store creado en MP pero error guardando mp_store_id',
          storeUpdateError
        )
        return {
          success: false,
          error:
            'Store creado en MP pero no pudimos guardarlo localmente. Reintentá — vamos a reusar el Store ya creado.',
        }
      }

      logger.info('registerMercadoPagoPos', 'Store creado en MP', {
        branchId: branch.id.substring(0, 8),
        storeId,
      })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Crear POS bajo ese Store
    // ─────────────────────────────────────────────────────────────────────────
    // Formato external_pos_id: KIOSCO<32 hex chars del branch_id> = 38 chars.
    // SIN underscore — MP rechaza con "external_id must be alphanumeric" (POST /pos).
    // category 621102 = "Quiosco / Almacén general" en el catálogo MCC de MP.
    const externalPosId = `KIOSCO${branchId.replace(/-/g, '')}`

    logger.debug('registerMercadoPagoPos', 'Llamando POST /pos', {
      externalPosId,
      storeId,
      branchName: branch.name?.substring(0, 30),
    })

    const posResponse = await callMercadoPagoAPI(
      'POST',
      '/pos',
      {
        external_id: externalPosId,
        fixed_amount: false,
        name: (branch.name || 'Caja').substring(0, 50),
        category: 621102,
        store_id: Number(storeId),
      },
      config.accessToken
    )

    if (!posResponse || !posResponse.external_id) {
      return {
        success: false,
        error:
          'Store creado en MP pero falló la creación del POS. Mirá los logs de Vercel y reintentá.',
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Persistir external_pos_id en branches
    // ─────────────────────────────────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('branches')
      .update({ mp_external_pos_id: externalPosId })
      .eq('id', branchId)
      .eq('organization_id', orgId)

    if (updateError) {
      // Caso raro: MP aceptó el POS pero la DB no nos deja guardar. La próxima
      // llamada va a saltarse el Store (ya tiene mp_store_id) y re-POST el POS;
      // MP devuelve error "external_id duplicado" pero seguimos persistiendo.
      logger.error(
        'registerMercadoPagoPos',
        'POS creado en MP pero error guardando en BD',
        updateError
      )
      return {
        success: false,
        error: 'POS registrado en MP pero no pudimos guardarlo localmente. Reintentá.',
      }
    }

    logger.info('registerMercadoPagoPos', 'POS registrado exitosamente', {
      orgId,
      branchId: branch.id.substring(0, 8),
      storeId,
      externalPosId,
    })

    return {
      success: true,
      externalPosId,
      alreadyRegistered: false,
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('registerMercadoPagoPos', 'Error inesperado', err)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * 📋 Listar las sucursales activas de la organización con su estado de
 *    registro como POS en Mercado Pago.
 *
 * Usada por configuracion-mercadopago.tsx para mostrar el panel de
 * "Sucursales registradas" con badges de estado por sucursal.
 *
 * @returns GetBranchesMpStatusResult con array de BranchMpStatus
 */
export async function getBranchesMpRegistrationStatusAction(): Promise<GetBranchesMpStatusResult> {
  try {
    const { supabase, orgId } = await verifyAuth()

    const { data, error } = await supabase
      .from('branches')
      .select('id, name, mp_external_pos_id')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      logger.error('getBranchesMpRegistrationStatus', 'Error cargando sucursales', error)
      return { success: false, error: 'No pudimos cargar las sucursales' }
    }

    const branches: BranchMpStatus[] = (data || []).map((b) => ({
      id: b.id,
      name: b.name,
      isRegistered: Boolean(b.mp_external_pos_id),
      externalPosId: b.mp_external_pos_id || null,
    }))

    return { success: true, branches }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('getBranchesMpRegistrationStatus', 'Error inesperado', err)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * 🔐 Actualizar SOLO el webhook secret de Mercado Pago.
 *
 * Caso de uso: la organización ya está conectada (OAuth o manual) y necesita
 * cargar/rotar el webhook secret sin tocar el access_token. El form principal
 * (`saveMercadoPagoCredentialsAction`) requiere ambos campos y valida el token
 * contra MP API: si el token está encriptado en DB (OAuth) el dueño no lo
 * tiene en claro y no puede usar ese flujo.
 *
 * VALIDACIÓN:
 * - Solo OWNER puede hacer esto.
 * - Tiene que existir una fila previa en mercadopago_credentials (no creamos
 *   credenciales completas desde acá: para conexión inicial está OAuth o el
 *   form completo).
 *
 * SEGURIDAD:
 * - Encriptamos con AES-256-GCM antes de guardar (mismo helper que el flujo
 *   completo).
 * - No logueamos el valor del secret.
 *
 * @param webhookSecret - Webhook secret tal cual lo da MP en el panel de
 *   developers. Se encripta antes de persistirlo.
 */
export async function updateMercadoPagoWebhookSecretAction(
  webhookSecret: string
): Promise<UpdateWebhookSecretResult> {
  try {
    if (!webhookSecret || webhookSecret.trim().length === 0) {
      return { success: false, error: 'El webhook secret no puede estar vacío' }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SANITIZACIÓN BULLETPROOF: stripeamos TODO lo que no sea hex char.
    //
    // Historial de bugs:
    //   - 26-abr-2026: zero-width / NBSP se colaron al copy/paste desde el
    //     panel de MP. Trim() no los agarra porque sólo recorta extremos.
    //     Fix parcial: enumerar invisibles "comunes" en regex.
    //   - 27-abr-2026: el regex anterior no cubría rango C1 (U+0080-U+009F)
    //     y se coló U+0083 ("No Break Here"), rompiendo HMAC de nuevo.
    //
    // Lección: enumerar invisibles es jugar al wack-a-mole. El secret de MP
    // es SIEMPRE 64 chars en [0-9a-f] — cualquier otra cosa es ruido. Stripear
    // todo-lo-no-hex es bulletproof y una sola línea.
    //
    // Trade-off: si pegan con typo (ej: una 'g'), también se stripea — la
    // validación de longitud de abajo lo agarra y devuelve error claro.
    // ─────────────────────────────────────────────────────────────────────────
    const sanitized = webhookSecret.replace(/[^0-9a-f]/gi, '')

    // VALIDACIÓN ESTRICTA DE FORMATO: MP emite el webhook secret como 64
    // caracteres hexadecimales lowercase (e.g. `a73ba6a098...04fe`). Si lo
    // que pegaron no es eso, rechazar antes de encriptar para no esconder
    // el bug en DB.
    if (!/^[0-9a-f]{64}$/i.test(sanitized)) {
      return {
        success: false,
        error: `El webhook secret no tiene el formato esperado de Mercado Pago (64 caracteres hexadecimales). Recibimos ${sanitized.length} caracteres tras limpiar espacios. Copialo de nuevo desde el panel de MP — asegurate de seleccionar exactamente desde el primer caracter al último.`,
      }
    }

    const { supabase, orgId, user } = await verifyOwner()

    // Verificar que existe la fila — no creamos credenciales desde acá.
    const { data: existing, error: fetchError } = await supabase
      .from('mercadopago_credentials')
      .select('id')
      .eq('organization_id', orgId)
      .maybeSingle()

    if (fetchError || !existing) {
      return {
        success: false,
        error:
          'No hay credenciales de Mercado Pago todavía. Conectá tu cuenta antes de cargar el webhook secret.',
      }
    }

    const encryptedSecret = encrypt(sanitized)

    const { error: updateError } = await supabase
      .from('mercadopago_credentials')
      .update({ webhook_secret_encrypted: encryptedSecret })
      .eq('organization_id', orgId)

    if (updateError) {
      logger.error(
        'updateMercadoPagoWebhookSecretAction',
        'Error guardando webhook secret',
        updateError
      )
      return { success: false, error: 'No se pudo guardar el webhook secret' }
    }

    logger.info('updateMercadoPagoWebhookSecretAction', 'Webhook secret actualizado', {
      orgId,
      userId: user.id,
      // Preview seguro para auditar — first4/last4 son dato público (visibles
      // en panel MP). NO loggeamos el secret completo.
      secretPreview: `${sanitized.slice(0, 4)}...${sanitized.slice(-4)}`,
      secretLen: sanitized.length,
    })

    return { success: true }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('updateMercadoPagoWebhookSecretAction', 'Error inesperado', err)
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
 * Encriptar un string usando AES-256-GCM
 *
 * @param text - Texto a encriptar
 * @returns String formato "iv:authTag:encrypted" en hex
 */
function encrypt(text: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Retornar iv:authTag:encrypted en hex
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Desencriptar un string encriptado con encrypt()
 *
 * @param encrypted - String formato "iv:authTag:encrypted"
 * @returns Texto desencriptado
 */
function decrypt(encrypted: string): string {
  const key = getEncryptionKey()
  const parts = encrypted.split(':')

  if (parts.length !== 3) {
    throw new Error('Formato de datos encriptados inválido')
  }

  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encryptedText = parts[2]

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Obtener la clave de encriptación desde env var
 *
 * IMPORTANTE: MP_ENCRYPTION_KEY debe ser exactamente 32 bytes (256 bits)
 * Si no está definida o es inválida, lanzar error
 */
function getEncryptionKey(): Buffer {
  const keyEnv = process.env.MP_ENCRYPTION_KEY

  if (!keyEnv) {
    throw new Error('MP_ENCRYPTION_KEY no está configurada')
  }

  // Si la clave es hexadecimal de 64 caracteres (32 bytes)
  if (/^[0-9a-f]{64}$/i.test(keyEnv)) {
    return Buffer.from(keyEnv, 'hex')
  }

  // Si es un string normal, hashear a 32 bytes
  if (keyEnv.length >= 32) {
    return Buffer.from(keyEnv.substring(0, 32), 'utf8')
  }

  // Si es más corto, rellenar con ceros
  const padded = keyEnv.padEnd(32, '\0')
  return Buffer.from(padded.substring(0, 32), 'utf8')
}

/**
 * Desencriptar y obtener configuración de Mercado Pago
 *
 * @param supabase - Cliente Supabase
 * @param orgId - ID de organización
 * @returns Configuración desencriptada o null
 */
async function getDecryptedMercadoPagoConfig(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<MercadoPagoConfig | null> {
  try {
    const { data: credentials, error } = await supabase
      .from('mercadopago_credentials')
      .select(
        'access_token_encrypted, webhook_secret_encrypted, refresh_token_encrypted, public_key, collector_id, is_sandbox, connected_via, token_expires_at'
      )
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .maybeSingle()

    if (error || !credentials) {
      return null
    }

    const accessToken = decrypt(credentials.access_token_encrypted)
    const webhookSecret = credentials.webhook_secret_encrypted
      ? decrypt(credentials.webhook_secret_encrypted)
      : ''
    const refreshToken = credentials.refresh_token_encrypted
      ? decrypt(credentials.refresh_token_encrypted)
      : null

    return {
      accessToken,
      publicKey: credentials.public_key || '',
      collecterId: credentials.collector_id,
      webhookSecret,
      isSandbox: credentials.is_sandbox || false,
      connectedVia: (credentials.connected_via as 'oauth' | 'manual') || 'manual',
      tokenExpiresAt: credentials.token_expires_at,
      refreshToken,
    }
  } catch (err) {
    logger.error('getDecryptedMercadoPagoConfig', 'Error desencriptando credenciales', err as Error)
    return null
  }
}

/**
 * Llamar API de Mercado Pago de forma segura
 *
 * Implementa:
 * - Reintentos con exponential backoff
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
  const url = `${MP_API_BASE_URL}${path}`

  let lastError: Error | null = null

  for (let attempt = 0; attempt < MP_MAX_RETRIES; attempt++) {
    try {
      // Backoff exponencial: 1s, 2s, 4s
      if (attempt > 0) {
        const delayMs = MP_RETRY_BACKOFF_MS * Math.pow(2, attempt - 1)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), MP_API_TIMEOUT_MS)

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        // Leer body como texto primero — funciona aunque MP devuelva HTML,
        // plain text o vacío. Después intentamos parsear como JSON para extraer
        // fields estructurados; si no parsea, igual conservamos el body crudo.
        // Antes hacíamos `response.json().catch(() => ({}))` que perdía todo el
        // body en respuestas non-JSON y solo conservaba `errorData.message`,
        // dejándonos ciegos cuando MP devolvía detalles en `cause`, `error`,
        // arrays de validación, o un HTML de gateway.
        const rawBody = await response.text().catch(() => '')
        let parsed: any = null
        try {
          parsed = rawBody ? JSON.parse(rawBody) : null
        } catch {
          // Body no es JSON — se conserva como string crudo para diagnóstico.
        }

        const summary =
          parsed?.message ||
          parsed?.error ||
          parsed?.cause?.[0]?.description ||
          response.statusText ||
          'sin detalle'

        // Truncamos el body en el message del Error para no inflar logs en cada
        // retry. El body completo se persiste como property del Error y lo
        // extraemos en el logger.error final si todos los reintentos fallan.
        const truncatedBody =
          rawBody.length > 1500 ? rawBody.slice(0, 1500) + '...[truncado]' : rawBody

        const err = new Error(
          `MP API error ${response.status} ${method} ${path}: ${summary}${
            truncatedBody ? ` | body: ${truncatedBody}` : ''
          }`
        )
        ;(err as any).mpStatus = response.status
        ;(err as any).mpRawBody = rawBody
        ;(err as any).mpParsed = parsed
        throw err
      }

      const data = await response.json()
      logger.debug('callMercadoPagoAPI', `Exitoso: ${method} ${path}`, {
        attempt,
        statusCode: response.status,
      })

      return data
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      logger.warn('callMercadoPagoAPI', `Intento ${attempt + 1}/${MP_MAX_RETRIES} falló`, {
        method,
        path,
        error: lastError.message,
      })
    }
  }

  // Después de agotar retries, dumpeamos el body completo (no truncado) en meta
  // para diagnóstico exhaustivo. Es 1 sola entrada por request totalmente fallado,
  // vale la pena el peso en logs.
  logger.error(
    'callMercadoPagoAPI',
    `Todos los reintentos fallaron: ${method} ${path}`,
    lastError!,
    {
      mpStatus: (lastError as any)?.mpStatus,
      mpRawBody: (lastError as any)?.mpRawBody,
    }
  )
  return null
}

/**
 * Validar que un access token es válido con MP
 *
 * Hace request a GET /users/me y valida respuesta
 *
 * @param accessToken - Token a validar
 * @returns User info si es válido, null si no
 */
async function validateMercadoPagoToken(
  accessToken: string
): Promise<{ id: string | number; email: string; public_key?: string } | null> {
  try {
    const response = await callMercadoPagoAPI('GET', '/users/me', undefined, accessToken)

    if (!response || !response.id) {
      return null
    }

    return {
      id: response.id,
      email: response.email,
      public_key: response.public_key,
    }
  } catch (err) {
    logger.error('validateMercadoPagoToken', 'Error validando token', err as Error)
    return null
  }
}

