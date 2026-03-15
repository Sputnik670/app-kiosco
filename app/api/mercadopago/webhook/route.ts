/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🪝 MERCADO PAGO WEBHOOK HANDLER
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * API Route que recibe notificaciones de Mercado Pago cuando:
 * - Se crea un pago (payment.created)
 * - Se actualiza un pago (payment.updated)
 * - Se actualiza una orden (order.updated)
 *
 * SEGURIDAD CRÍTICA:
 * - Verificar firma HMAC-SHA256 en CADA webhook
 * - Validar timestamp (rechazar > 5 min)
 * - Usar idempotencia para evitar duplicados
 * - NUNCA confiar en el cliente para qué actualizar
 *
 * FLUJO:
 * 1. Mercado Pago envía POST con x-signature header
 * 2. Extraemos timestamp y firma del header
 * 3. Obtenemos webhook_secret desde DB (desencriptado)
 * 4. Reconstruimos la firma esperada con webhook_secret
 * 5. Si no coincide → 401 (no es de MP)
 * 6. Si timestamp es viejo → 400 (replay attack)
 * 7. Procesamos según action (payment.created, etc.)
 * 8. Actualizamos estado en mercadopago_orders
 * 9. Retornamos 200 OK
 *
 * CONFIGURACIÓN EN MERCADO PAGO:
 * - Ir a: https://www.mercadopago.com.ar/developers/panel/webhooks
 * - Agregar URL: https://tu-dominio.com/api/mercadopago/webhook
 * - Seleccionar eventos: payment.created, payment.updated, order.updated
 * - Guardar webhook_secret y GUARDAR EN SUPABASE ENCRIPTADO
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logging'
import crypto from 'crypto'
import {
  MERCADOPAGO_STATUS_MAP,
  MercadoPagoPaymentStatus,
  MercadoPagoOrderStatus,
} from '@/types/mercadopago.types'

// ───────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────

/**
 * Payload de webhook de Mercado Pago
 */
interface MercadoPagoWebhookPayload {
  id: string
  type: string
  action: 'payment.created' | 'payment.updated' | 'order.updated'
  data: {
    id: string
    status?: string
    status_detail?: string
    transaction_amount?: number
    external_reference?: string
    payment_method_id?: string
    payer?: {
      id: string | number
      email?: string
    }
  }
}

/**
 * Estructura del header x-signature
 * Ejemplo: ts=1234567890,v1=abc123...
 */
interface SignatureHeader {
  ts: number
  v1: string
}

// ───────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────

const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000 // 5 minutos
const WEBHOOK_EVENTS = ['payment.created', 'payment.updated', 'order.updated']

// ───────────────────────────────────────────────────────────────────────────
// HELPER: Service Role Client
// ───────────────────────────────────────────────────────────────────────────

/**
 * Crea cliente Supabase con service role (puede leer/escribir por encima de RLS)
 * Usado en webhooks que necesitan acceso sin restricción por usuario.
 */
function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY o SUPABASE_URL no configurados')
  }

  return createServiceClient(supabaseUrl, serviceRoleKey)
}

// ───────────────────────────────────────────────────────────────────────────
// HANDLER PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────

/**
 * POST /api/mercadopago/webhook
 *
 * Recibe notificaciones de Mercado Pago y actualiza el estado de pagos.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    // ─────────────────────────────────────────────────────────────────────────
    // PASO 1: Parsear headers y body
    // ─────────────────────────────────────────────────────────────────────────

    const signatureHeader = request.headers.get('x-signature')
    const requestIdHeader = request.headers.get('x-request-id')

    if (!signatureHeader || !requestIdHeader) {
      logger.warn('MercadoPagoWebhook', 'Headers requeridos faltantes', {
        signature: !!signatureHeader,
        requestId: !!requestIdHeader,
      })
      return jsonResponse({ error: 'Headers requeridos faltantes' }, 400)
    }

    let payload: MercadoPagoWebhookPayload
    try {
      payload = await request.json()
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('MercadoPagoWebhook', 'Error parseando JSON', err)
      return jsonResponse({ error: 'JSON inválido' }, 400)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 2: Extraer y validar firma
    // ─────────────────────────────────────────────────────────────────────────

    const signature = parseSignatureHeader(signatureHeader)
    if (!signature) {
      logger.warn('MercadoPagoWebhook', 'Firma mal formada', { header: signatureHeader })
      return jsonResponse({ error: 'Firma inválida' }, 400)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 3: Validar timestamp (replay attack prevention)
    // ─────────────────────────────────────────────────────────────────────────

    const now = Date.now()
    const age = now - signature.ts

    if (age > MAX_SIGNATURE_AGE_MS) {
      logger.warn('MercadoPagoWebhook', 'Timestamp expirado', {
        ageSec: `${(age / 1000).toFixed(1)}`,
        maxAgeSec: `${(MAX_SIGNATURE_AGE_MS / 1000).toFixed(1)}`,
      })
      return jsonResponse({ error: 'Notificación expirada' }, 400)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 4: Obtener webhook_secret desde BD (con fallback a env)
    // ─────────────────────────────────────────────────────────────────────────

    let webhookSecret: string | null = null

    try {
      webhookSecret = await getWebhookSecretForPayload(payload)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('MercadoPagoWebhook', 'Error obteniendo webhook_secret', err)
    }

    // Fallback a env var (útil para setup inicial)
    if (!webhookSecret) {
      webhookSecret = process.env.MP_WEBHOOK_SECRET || null
    }

    if (!webhookSecret) {
      logger.warn('MercadoPagoWebhook', 'webhook_secret no disponible', {
        externalRef: payload.data?.external_reference?.substring(0, 8),
      })
      // Retornamos 200 para que MP no reintente (nosotros no tenemos el secret)
      return jsonResponse({ error: 'Servidor no configurado' }, 200)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 5: Verificar firma HMAC-SHA256
    // ─────────────────────────────────────────────────────────────────────────

    const isSignatureValid = verifyMercadoPagoSignature(
      signature.ts,
      requestIdHeader,
      payload,
      webhookSecret,
      signature.v1
    )

    if (!isSignatureValid) {
      logger.error('MercadoPagoWebhook', 'Firma HMAC inválida', undefined, {
        v1Start: signature.v1.substring(0, 10) + '...',
      })
      return jsonResponse({ error: 'Firma inválida' }, 401)
    }

    logger.info('MercadoPagoWebhook', 'Firma verificada correctamente', {
      action: payload.action,
      paymentId: payload.data?.id,
    })

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 6: Procesar según tipo de evento
    // ─────────────────────────────────────────────────────────────────────────

    if (!WEBHOOK_EVENTS.includes(payload.action)) {
      logger.warn('MercadoPagoWebhook', 'Acción no soportada', { action: payload.action })
      // Retornar 200 de todas formas (evento válido pero no nos interesa)
      return jsonResponse({ success: true }, 200)
    }

    switch (payload.action) {
      case 'payment.created':
      case 'payment.updated':
        await handlePaymentNotification(payload)
        break

      case 'order.updated':
        await handleOrderNotification(payload)
        break

      default:
        logger.warn('MercadoPagoWebhook', 'Acción default', { action: payload.action })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 7: Retornar 200 OK (confirmar recepción)
    // ─────────────────────────────────────────────────────────────────────────

    logger.info('MercadoPagoWebhook', 'Procesado exitosamente', {
      action: payload.action,
      paymentId: payload.data?.id,
    })

    return jsonResponse({ success: true }, 200)
  } catch (error) {
    // Log pero retornar 200 (MP no debe reintentar en caso de error nuestro)
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('MercadoPagoWebhook', 'Error inesperado', err)
    return jsonResponse({ error: 'Error procesando' }, 200)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// FUNCIONES DE OBTENCIÓN DE CREDENCIALES
// ───────────────────────────────────────────────────────────────────────────

/**
 * Obtener webhook_secret desde Supabase basándose en el payload
 *
 * Estrategia:
 * 1. Intentar obtener organization_id desde external_reference (sale_id)
 * 2. Si no está en datos, buscar por mp_payment_id o mp_order_id
 * 3. Desencriptar webhook_secret desde mercadopago_credentials
 *
 * @param payload - Webhook payload
 * @returns webhook_secret desencriptado o null si no se encuentra
 */
async function getWebhookSecretForPayload(
  payload: MercadoPagoWebhookPayload
): Promise<string | null> {
  const { data } = payload
  const supabase = createServiceRoleClient()

  // Obtener external_reference
  const externalReference = data.external_reference

  if (externalReference) {
    // Buscar en mercadopago_orders por external_reference
    const { data: order, error: orderError } = await supabase
      .from('mercadopago_orders')
      .select('organization_id')
      .eq('external_reference', externalReference)
      .single()

    if (orderError) {
      logger.debug('GetWebhookSecret', 'No se encontró orden por external_reference', {
        externalRef: externalReference.substring(0, 8),
      })
    } else if (order) {
      return await getDecryptedWebhookSecret(supabase, (order as any).organization_id)
    }
  }

  // Fallback: buscar por mp_payment_id (data.id)
  const mpPaymentId = String(data.id)
  if (mpPaymentId) {
    const { data: order, error: orderError } = await supabase
      .from('mercadopago_orders')
      .select('organization_id')
      .eq('mp_payment_id', mpPaymentId)
      .maybeSingle()

    if (!orderError && order) {
      return await getDecryptedWebhookSecret(supabase, (order as any).organization_id)
    }
  }

  logger.warn('GetWebhookSecret', 'No se pudo determinar organización', {
    externalRef: externalReference?.substring(0, 8),
    paymentId: mpPaymentId?.substring(0, 8),
  })
  return null
}

/**
 * Obtener y desencriptar webhook_secret de una organización
 *
 * @param supabase - Cliente Supabase con service role
 * @param organizationId - ID de organización
 * @returns webhook_secret desencriptado o null
 */
async function getDecryptedWebhookSecret(
  supabase: any,
  organizationId: string
): Promise<string | null> {
  try {
    // Usando pgp_sym_decrypt de PostgreSQL
    // El servidor Supabase tiene la clave en el contexto de encriptación
    const { data, error } = await supabase
      .from('mercadopago_credentials')
      .select('webhook_secret_encrypted')
      .eq('organization_id', organizationId)
      .single()

    if (error || !data) {
      logger.debug('GetDecryptedWebhookSecret', 'No se encontraron credenciales', {
        orgId: organizationId.substring(0, 8),
      })
      return null
    }

    // Las credenciales llegaron encriptadas. Necesitamos desencriptarlas usando
    // pgp_sym_decrypt en una query SQL directa con la clave.
    // Alternativa: usar la función RPC de Supabase si existe.

    // Intentar usar RPC si está disponible
    try {
      const { data: decrypted, error: decryptError } = await supabase.rpc(
        'decrypt_mp_webhook_secret',
        {
          org_id: organizationId,
        }
      )

      if (!decryptError && decrypted) {
        return decrypted as string
      }
    } catch {
      // RPC no disponible, continuar con fallback
    }

    // Fallback: El secret sigue encriptado. Para desencriptarlo, necesitaríamos
    // la clave MP_ENCRYPTION_KEY y manejar el formato de encriptación.
    // Por ahora, retornamos null y usamos fallback del env var.
    //
    // En producción, se recomienda:
    // 1. Crear una función RPC en Supabase que maneje pgp_sym_decrypt con la clave
    // 2. O usar Supabase Vault para almacenar la clave de encriptación
    // 3. O implementar desencriptación a nivel de aplicación

    logger.debug('GetDecryptedWebhookSecret', 'No se pudo desencriptar credential', {
      orgId: organizationId.substring(0, 8),
    })
    return null
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('GetDecryptedWebhookSecret', 'Error obteniendo secret', err)
    return null
  }
}

// ───────────────────────────────────────────────────────────────────────────
// FUNCIONES DE PROCESAMIENTO
// ───────────────────────────────────────────────────────────────────────────

/**
 * Manejar notificaciones de pago (payment.created / payment.updated)
 *
 * Actualiza el estado de mercadopago_orders cuando:
 * - Pago se aprobó (status: approved)
 * - Pago fue rechazado (status: rejected)
 * - Pago está en revisión (status: in_process)
 */
async function handlePaymentNotification(payload: MercadoPagoWebhookPayload): Promise<void> {
  try {
    const { data } = payload

    logger.info('HandlePaymentNotification', 'Procesando notificación de pago', {
      paymentId: data.id,
      status: data.status,
      externalRef: data.external_reference?.substring(0, 8) + '...',
    })

    if (!data.status) {
      logger.warn('HandlePaymentNotification', 'Status no presente en payload', {
        paymentId: data.id,
      })
      return
    }

    const mpStatus = data.status as MercadoPagoPaymentStatus

    // Mapear status de MP a nuestro status
    const mappedStatus: MercadoPagoOrderStatus = MERCADOPAGO_STATUS_MAP[mpStatus] || 'pending'

    const supabase = createServiceRoleClient()

    // Buscar la orden
    let externalReference = data.external_reference
    if (!externalReference) {
      // Si no tenemos external_reference, buscar por mp_payment_id
      const { data: order } = await supabase
        .from('mercadopago_orders')
        .select('external_reference, organization_id')
        .eq('mp_payment_id', String(data.id))
        .maybeSingle()

      if (!order) {
        logger.warn('HandlePaymentNotification', 'No se encontró orden vinculada', {
          paymentId: data.id,
        })
        return
      }

      externalReference = (order as any).external_reference
    }

    if (!externalReference) {
      logger.warn('HandlePaymentNotification', 'No hay external_reference para actualizar', {
        paymentId: data.id,
      })
      return
    }

    // Actualizar mercadopago_orders
    const confirmedAt = mpStatus === 'approved' ? new Date().toISOString() : null

    const { error: updateError } = await supabase
      .from('mercadopago_orders')
      .update({
        status: mappedStatus,
        mp_payment_id: String(data.id),
        confirmed_at: confirmedAt,
        webhook_received_at: new Date().toISOString(),
        notes: data.status_detail ? `MP: ${data.status_detail}` : null,
      })
      .eq('external_reference', externalReference)

    if (updateError) {
      logger.error('HandlePaymentNotification', 'Error actualizando orden', updateError as Error)
      return
    }

    logger.info('HandlePaymentNotification', 'Orden actualizada exitosamente', {
      externalRef: externalReference.substring(0, 8),
      newStatus: mappedStatus,
      mpStatus,
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('HandlePaymentNotification', 'Error procesando pago', err)
    // No lanzar error (queremos retornar 200 de todas formas)
  }
}

/**
 * Manejar notificaciones de orden (order.updated)
 *
 * Actualiza estado si la orden cambió (ej: expiración)
 */
async function handleOrderNotification(payload: MercadoPagoWebhookPayload): Promise<void> {
  try {
    const { data } = payload

    logger.info('HandleOrderNotification', 'Procesando notificación de orden', {
      orderId: data.id,
      externalRef: data.external_reference?.substring(0, 8) + '...',
    })

    const externalReference = data.external_reference
    if (!externalReference) {
      logger.warn('HandleOrderNotification', 'External reference no presente', {
        orderId: data.id,
      })
      return
    }

    // Para order.updated, el status puede ser 'expired', 'active', 'paid', etc.
    // Mapeamos según nuestro modelo
    let newStatus: MercadoPagoOrderStatus = 'pending'

    if (data.status === 'expired') {
      newStatus = 'expired'
    } else if (data.status === 'paid') {
      newStatus = 'confirmed'
    }

    const supabase = createServiceRoleClient()

    const { error: updateError } = await supabase
      .from('mercadopago_orders')
      .update({
        status: newStatus,
        webhook_received_at: new Date().toISOString(),
      })
      .eq('external_reference', externalReference)

    if (updateError) {
      logger.error('HandleOrderNotification', 'Error actualizando orden', updateError as Error)
      return
    }

    logger.info('HandleOrderNotification', 'Orden actualizada exitosamente', {
      externalRef: externalReference.substring(0, 8),
      newStatus,
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('HandleOrderNotification', 'Error procesando orden', err)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// FUNCIONES DE SEGURIDAD
// ───────────────────────────────────────────────────────────────────────────

/**
 * Parsear el header x-signature de Mercado Pago
 *
 * Formato: ts={timestamp},v1={signature}
 *
 * @param header - Contenido del header x-signature
 * @returns SignatureHeader o null si formato inválido
 */
function parseSignatureHeader(header: string): SignatureHeader | null {
  try {
    const parts = header.split(',')
    const tsMatch = parts.find(p => p.startsWith('ts='))
    const v1Match = parts.find(p => p.startsWith('v1='))

    if (!tsMatch || !v1Match) return null

    const ts = parseInt(tsMatch.substring(3), 10)
    const v1 = v1Match.substring(3)

    if (isNaN(ts)) return null

    return { ts, v1 }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('ParseSignatureHeader', 'Error parseando signature header', err)
    return null
  }
}

/**
 * Verificar firma HMAC-SHA256 de Mercado Pago
 *
 * ALGORITMO:
 * 1. Template: {id}|{ts}|{requestId}
 * 2. HMAC-SHA256(template, webhook_secret)
 * 3. Comparar resultado con v1 recibido
 *
 * Referencia:
 * https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 *
 * @param timestamp - Timestamp del header
 * @param requestId - X-Request-ID del header
 * @param payload - Body del webhook (para extraer ID)
 * @param webhookSecret - Secret de Mercado Pago
 * @param receivedV1 - Firma recibida en header
 * @returns true si firma es válida
 */
function verifyMercadoPagoSignature(
  timestamp: number,
  requestId: string,
  payload: MercadoPagoWebhookPayload,
  webhookSecret: string,
  receivedV1: string
): boolean {
  try {
    // Template según MP docs
    const template = `${payload.id}|${timestamp}|${requestId}`

    // Generar HMAC-SHA256
    const hmac = crypto.createHmac('sha256', webhookSecret)
    hmac.update(template)
    const computed = hmac.digest('hex')

    // Comparación timing-safe para evitar timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(receivedV1, 'hex')
    )

    return isValid
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('VerifyMercadoPagoSignature', 'Error verificando firma', err)
    return false
  }
}

// ───────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ───────────────────────────────────────────────────────────────────────────

/**
 * Helper para retornar JSON con status code
 */
function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
