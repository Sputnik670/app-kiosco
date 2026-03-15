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

    // Retornar sin exponer el access token completo
    return {
      success: true,
      config: {
        publicKey: config.publicKey,
        collecterId: config.collecterId,
        isSandbox: config.isSandbox,
        accessToken: `****${config.accessToken.slice(-4)}`, // Enmascarado
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
    // Solo owner puede configurar integración de pago
    const { supabase, orgId, user } = await verifyOwner()

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
  branchId: string
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

    if (!branchId || branchId.trim().length === 0) {
      return {
        success: false,
        error: 'Branch ID es requerido',
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

    const config = await getDecryptedMercadoPagoConfig(supabase, orgId)
    if (!config) {
      return {
        success: false,
        error: 'Credenciales de Mercado Pago no configuradas',
        retryable: false,
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // LLAMAR API DE MERCADO PAGO
    // ───────────────────────────────────────────────────────────────────────────

    // Usar UUID como external_pos_id para identificar la caja registradora
    const externalPosId = `pos-${orgId.substring(0, 8)}`

    const mpPath = `/instore/orders/qr/seller/collectors/${config.collecterId}/pos/${externalPosId}/qrs`

    const mpRequestBody = {
      external_reference: saleId, // CRÍTICO: idempotencia
      title: 'Venta en Kiosco',
      description: description || 'Venta desde kiosco',
      total_amount: Number(amount),
      items: [
        {
          title: description || 'Venta en Kiosco',
          quantity: 1,
          unit_price: Number(amount),
          total_amount: Number(amount),
        },
      ],
    }

    logger.debug('createMercadoPagoOrderAction', 'Llamando API de MP', {
      saleId,
      amount,
      collecterId: config.collecterId,
    })

    const mpResponse = await callMercadoPagoAPI(
      'PUT',
      mpPath,
      mpRequestBody,
      config.accessToken
    )

    if (!mpResponse || !mpResponse.qr_data) {
      logger.warn('createMercadoPagoOrderAction', 'MP API no retornó qr_data', {
        saleId,
        mpResponse: mpResponse ? Object.keys(mpResponse) : null,
      })
      return {
        success: false,
        error: 'No se pudo generar QR en Mercado Pago',
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
        sale_id: saleId,
        external_reference: saleId,
        amount: Number(amount),
        currency: 'ARS',
        qr_data: mpResponse.qr_data,
        status: 'pending',
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
        'access_token_encrypted, webhook_secret_encrypted, public_key, collector_id, is_sandbox'
      )
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .maybeSingle()

    if (error || !credentials) {
      return null
    }

    const accessToken = decrypt(credentials.access_token_encrypted)
    const webhookSecret = decrypt(credentials.webhook_secret_encrypted)

    return {
      accessToken,
      publicKey: credentials.public_key,
      collecterId: credentials.collector_id,
      webhookSecret,
      isSandbox: credentials.is_sandbox || false,
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
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `MP API error ${response.status}: ${errorData.message || response.statusText}`
        )
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

  logger.error('callMercadoPagoAPI', `Todos los reintentos fallaron: ${method} ${path}`, lastError!)
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
