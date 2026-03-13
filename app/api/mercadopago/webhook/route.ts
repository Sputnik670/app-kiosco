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
 * 3. Reconstruimos la firma esperada con nuestro webhook_secret
 * 4. Si no coincide → 401 (no es de MP)
 * 5. Si timestamp es viejo → 400 (replay attack)
 * 6. Procesamos según action (payment.created, etc.)
 * 7. Actualizamos estado en mercadopago_orders
 * 8. Retornamos 200 OK
 *
 * CONFIGURACIÓN EN MERCADO PAGO:
 * - Ir a: https://www.mercadopago.com.ar/developers/panel/webhooks
 * - Agregar URL: https://tu-dominio.com/api/mercadopago/webhook
 * - Seleccionar eventos: payment.created, payment.updated, order.updated
 * - Guardar webhook_secret y GUARDAR EN SUPABASE ENCRIPTADO
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logging'
import crypto from 'crypto'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

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

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000 // 5 minutos
const WEBHOOK_EVENTS = ['payment.created', 'payment.updated', 'order.updated']

// ───────────────────────────────────────────────────────────────────────────────
// HANDLER PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────

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
    // PASO 4: Verificar firma HMAC-SHA256
    // ─────────────────────────────────────────────────────────────────────────

    // TODO: Obtener webhook_secret de Supabase (desencriptado)
    // Para implementación completa:
    // 1. Obtener organization_id desde payload (si está disponible)
    // 2. O buscar por external_reference → sale_id → sales → organization_id
    // 3. Luego: SELECT webhook_secret FROM mercadopago_credentials WHERE org_id = X
    // 4. Desencriptar webhook_secret
    // 5. Verificar firma

    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET
    if (!webhookSecret) {
      logger.error('MercadoPagoWebhook', 'webhook_secret no configurado en env')
      // Nota: Retornamos 200 para que MP no reintente (nosotros no tenemos el secret)
      return jsonResponse({ error: 'Servidor no configurado' }, 200)
    }

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
    // PASO 5: Procesar según tipo de evento
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
    // PASO 6: Retornar 200 OK (confirmar recepción)
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

// ───────────────────────────────────────────────────────────────────────────────
// FUNCIONES DE PROCESAMIENTO
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Manejar notificaciones de pago (payment.created / payment.updated)
 *
 * Actualiza el estado de mercadopago_orders cuando:
 * - Pago se aprobó (status: approved)
 * - Pago fue rechazado (status: rejected)
 * - Pago está en revisión (status: in_process)
 *
 * TODO: Implementación completa
 */
async function handlePaymentNotification(payload: MercadoPagoWebhookPayload): Promise<void> {
  try {
    const { data } = payload

    logger.info('HandlePaymentNotification', 'Procesando notificación de pago', {
      paymentId: data.id,
      status: data.status,
      externalRef: data.external_reference?.substring(0, 8) + '...',
    })

    // TODO: Implementar
    // 1. Validar que external_reference (sale_id) existe
    // 2. Buscar mercadopago_orders por external_reference
    // 3. Obtener webhook_secret de mercadopago_credentials
    // 4. Actualizar status según data.status:
    //    - approved → confirmed
    //    - rejected → failed
    //    - in_process → pending
    // 5. Guardar mp_payment_id y timestamp de confirmación
    // 6. Log completo para auditoría
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
 *
 * TODO: Implementación
 */
async function handleOrderNotification(payload: MercadoPagoWebhookPayload): Promise<void> {
  try {
    const { data } = payload

    logger.info('HandleOrderNotification', 'Procesando notificación de orden', {
      orderId: data.id,
      externalRef: data.external_reference?.substring(0, 8) + '...',
    })

    // TODO: Implementar
    // 1. Buscar mercadopago_orders por external_reference
    // 2. Actualizar estado según necesario
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('HandleOrderNotification', 'Error procesando orden', err)
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// FUNCIONES DE SEGURIDAD
// ───────────────────────────────────────────────────────────────────────────────

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
 * 1. Template: {id}|{ts}|{v1}
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
    // Nota: puede variar, revisar docs si falla
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

// ───────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ───────────────────────────────────────────────────────────────────────────────

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
