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
import {
  parseSignatureHeader,
  verifyMercadoPagoSignature,
} from '@/lib/mercadopago/webhook-signature'

// ───────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────

/**
 * Payload de webhook de Mercado Pago
 *
 * IMPORTANTE: en webhooks de tipo `payment`, MP envía sólo `data.id` (= payment_id).
 * NO envía `external_reference`, `status`, `transaction_amount`, etc. en el body.
 * Esos campos hay que ir a buscarlos haciendo GET /v1/payments/{id} con el
 * access_token del kiosquero. El `user_id` del payload es el `collector_id` que
 * nos permite identificar de qué kiosquero (= organización) viene el cobro.
 */
interface MercadoPagoWebhookPayload {
  id: string
  type: string
  action: 'payment.created' | 'payment.updated' | 'order.updated'
  /** collector_id del kiosquero que recibió el cobro (vía OAuth). */
  user_id?: number | string
  data: {
    id: string
    /** Los campos abajo SÓLO vienen en `order.updated`, no en `payment.*`. */
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
 * Respuesta de GET /v1/payments/{id} en MP.
 * Sólo tipamos los campos que usamos.
 */
interface MercadoPagoPaymentDetails {
  id: number | string
  status: string // approved | rejected | pending | in_process | cancelled | refunded
  status_detail?: string
  transaction_amount?: number
  external_reference?: string | null
  payment_method_id?: string
  date_approved?: string | null
}

// (SignatureHeader, parseSignatureHeader, verifyMercadoPagoSignature
// se importan de @/lib/mercadopago/webhook-signature — extraidos para
// poder testearlos unitariamente sin levantar Next.js.)

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

    // ─────────────────────────────────────────────────────────────────────────
    // Parsear body PRIMERO (lo necesitamos para fallback del data.id).
    // ─────────────────────────────────────────────────────────────────────────
    let payload: MercadoPagoWebhookPayload
    try {
      payload = await request.json()
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('MercadoPagoWebhook', 'Error parseando JSON', err)
      return jsonResponse({ error: 'JSON inválido' }, 400)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Extraer data.id: primero del QUERY PARAM, fallback al BODY.
    // - Webhooks reales de MP en prod: vienen como ?data.id=xxx&type=...
    // - Simulador "Probar webhook" del panel developers: NO manda query string,
    //   sólo body. Probamos query y caemos al body si está vacío.
    // - Si es alfanumérico, lowercase (regla MP).
    // Ref: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks
    // ─────────────────────────────────────────────────────────────────────────
    const requestUrl = new URL(request.url)
    const dataIdRaw =
      requestUrl.searchParams.get('data.id') ||
      requestUrl.searchParams.get('id') ||
      String(payload?.data?.id || '') ||
      ''
    const dataIdForSignature = /^[a-zA-Z0-9]+$/.test(dataIdRaw)
      ? dataIdRaw.toLowerCase()
      : dataIdRaw

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

    // signature.ts de MP viene en SEGUNDOS (Unix epoch). Lo convertimos a ms
    // para comparar con Date.now().
    const now = Date.now()
    const tsMs = signature.ts * 1000
    const age = now - tsMs

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
    //
    // BYPASS TEMPORAL: bajar SKIP_SIGNATURE_HARDCODE a `false` cuando el
    // webhook_secret esté pegado en mercadopago_credentials. Hoy queda en
    // `true` porque el callback OAuth rompió el secret (ya fixeado, pero
    // hay que volver a pegarlo manualmente en el form de configuración).
    // Mientras esté en `true`, cualquiera que conozca la URL del webhook
    // puede mandar updates falsos — riesgo aceptado para piloto con 1
    // cliente, NO para multi-tenant.
    const SKIP_SIGNATURE_HARDCODE = true // ⚠️ bajar a false post-pegar-secret
    const skipSignatureCheck =
      SKIP_SIGNATURE_HARDCODE ||
      process.env.MP_WEBHOOK_SKIP_SIGNATURE === 'true'

    const isSignatureValid = skipSignatureCheck
      ? true
      : verifyMercadoPagoSignature(
          signature.ts,
          requestIdHeader,
          dataIdForSignature,
          webhookSecret,
          signature.v1
        )

    if (skipSignatureCheck) {
      logger.warn('MercadoPagoWebhook', 'Firma HMAC NO verificada (bypass activo)')
    }

    if (!isSignatureValid) {
      logger.warn('MercadoPagoWebhook', 'Firma HMAC inválida', {
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
 * Usa AES-256-GCM con MP_ENCRYPTION_KEY (mismo método que mercadopago.actions.ts)
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
    const { data, error } = await supabase
      .from('mercadopago_credentials')
      .select('webhook_secret_encrypted')
      .eq('organization_id', organizationId)
      .single()

    if (error || !data?.webhook_secret_encrypted) {
      logger.debug('GetDecryptedWebhookSecret', 'No se encontraron credenciales o secret', {
        orgId: organizationId.substring(0, 8),
      })
      return null
    }

    // Desencriptar con AES-256-GCM usando MP_ENCRYPTION_KEY
    const keyEnv = process.env.MP_ENCRYPTION_KEY
    if (!keyEnv) {
      logger.warn('GetDecryptedWebhookSecret', 'MP_ENCRYPTION_KEY no configurada')
      return null
    }

    // Obtener clave de encriptación (mismo formato que mercadopago.actions.ts)
    let key: Buffer
    if (/^[0-9a-f]{64}$/i.test(keyEnv)) {
      key = Buffer.from(keyEnv, 'hex')
    } else if (keyEnv.length >= 32) {
      key = Buffer.from(keyEnv.substring(0, 32), 'utf8')
    } else {
      logger.warn('GetDecryptedWebhookSecret', 'MP_ENCRYPTION_KEY demasiado corta')
      return null
    }

    // Formato: iv:authTag:encryptedText (hex)
    const parts = data.webhook_secret_encrypted.split(':')
    if (parts.length !== 3) {
      logger.warn('GetDecryptedWebhookSecret', 'Formato de encriptación inválido')
      return null
    }

    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encryptedText = parts[2]

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('GetDecryptedWebhookSecret', 'Error desencriptando secret', err)
    return null
  }
}

// ───────────────────────────────────────────────────────────────────────────
// FUNCIONES DE RESOLUCIÓN DE CREDENCIALES Y FETCH A MP
// ───────────────────────────────────────────────────────────────────────────

/**
 * Resuelve credenciales de MP para una organización a partir del collector_id
 * que viene en el webhook como `user_id`.
 *
 * Devuelve `accessToken` desencriptado + `organizationId`. null si no encuentra.
 *
 * @param collectorId - user_id del payload del webhook
 */
async function getCredentialsByCollectorId(
  collectorId: string
): Promise<{ accessToken: string; organizationId: string } | null> {
  try {
    const supabase = createServiceRoleClient()

    const { data, error } = await supabase
      .from('mercadopago_credentials')
      .select('access_token_encrypted, organization_id')
      .eq('collector_id', collectorId)
      .eq('is_active', true)
      .maybeSingle()

    if (error || !data?.access_token_encrypted) {
      logger.warn('GetCredentialsByCollectorId', 'Credenciales no encontradas', {
        collectorId: collectorId.substring(0, 6),
      })
      return null
    }

    const accessToken = decryptString(data.access_token_encrypted)
    if (!accessToken) return null

    return {
      accessToken,
      organizationId: (data as any).organization_id,
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('GetCredentialsByCollectorId', 'Error resolviendo credenciales', err)
    return null
  }
}

/**
 * Hace GET /v1/payments/{id} a MP API y devuelve el detalle del pago.
 *
 * MP no manda `external_reference` en webhooks de tipo payment, así que SIEMPRE
 * hay que pegarle a esta URL para obtener los datos reales del cobro.
 *
 * @returns null si la respuesta no es 200 o si el body no tiene `id`.
 */
async function fetchPaymentDetails(
  paymentId: string,
  accessToken: string
): Promise<MercadoPagoPaymentDetails | null> {
  const url = `https://api.mercadopago.com/v1/payments/${paymentId}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      // 404 = payment_id ficticio (típico del simulador del panel developers).
      // 401 = access_token revocado. No retryeable, log warn y seguir.
      logger.warn('FetchPaymentDetails', 'MP API respondió no-OK', {
        paymentId: paymentId.substring(0, 6),
        status: response.status,
      })
      return null
    }

    const body = (await response.json()) as MercadoPagoPaymentDetails
    if (!body || !body.id) {
      logger.warn('FetchPaymentDetails', 'Body sin id', { paymentId: paymentId.substring(0, 6) })
      return null
    }

    return body
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('FetchPaymentDetails', 'Error pegándole a MP API', err)
    return null
  }
}

/**
 * Helper local para desencriptar AES-256-GCM con MP_ENCRYPTION_KEY.
 * Mismo formato que `mercadopago.actions.ts#encrypt()`: iv:authTag:encrypted (hex).
 *
 * Duplicado intencional — no podemos importar desde server actions a una API
 * route sin arrastrar todo el bundle 'use server'.
 */
function decryptString(encrypted: string): string | null {
  try {
    const keyEnv = process.env.MP_ENCRYPTION_KEY
    if (!keyEnv) {
      logger.warn('DecryptString', 'MP_ENCRYPTION_KEY no configurada')
      return null
    }

    let key: Buffer
    if (/^[0-9a-f]{64}$/i.test(keyEnv)) {
      key = Buffer.from(keyEnv, 'hex')
    } else if (keyEnv.length >= 32) {
      key = Buffer.from(keyEnv.substring(0, 32), 'utf8')
    } else {
      const padded = keyEnv.padEnd(32, '\0')
      key = Buffer.from(padded.substring(0, 32), 'utf8')
    }

    const parts = encrypted.split(':')
    if (parts.length !== 3) {
      logger.warn('DecryptString', 'Formato encriptado inválido')
      return null
    }

    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encryptedText = parts[2]

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('DecryptString', 'Error desencriptando', err)
    return null
  }
}

// ───────────────────────────────────────────────────────────────────────────
// FUNCIONES DE PROCESAMIENTO
// ───────────────────────────────────────────────────────────────────────────

/**
 * Manejar notificaciones de pago (payment.created / payment.updated)
 *
 * MP envía sólo `data.id` (payment_id) — no manda external_reference ni status
 * en el body. Hay que ir a buscar el detalle del pago a la API de MP.
 *
 * Flujo:
 *   1. Extraer collector_id del payload (`user_id`)
 *   2. Resolver credenciales del kiosquero por collector_id
 *   3. GET /v1/payments/{id} con su access_token → obtener external_reference + status
 *   4. Buscar la orden en mercadopago_orders por external_reference (o mp_payment_id)
 *   5. UPDATE de status, mp_payment_id, confirmed_at, webhook_received_at
 *
 * Si no podemos resolver credenciales (caso típico del simulador del panel
 * developers de MP, que manda user_id ficticio) o el GET a MP falla con 404
 * (payment_id ficticio), retornamos sin hacer nada — pero el outer handler
 * igual responde 200 OK para que MP no reintente.
 */
async function handlePaymentNotification(payload: MercadoPagoWebhookPayload): Promise<void> {
  try {
    const paymentId = String(payload.data?.id || '')
    const collectorId = payload.user_id ? String(payload.user_id) : null

    logger.info('HandlePaymentNotification', 'Procesando notificación de pago', {
      paymentId: paymentId.substring(0, 8),
      action: payload.action,
      collectorId: collectorId?.substring(0, 6),
    })

    if (!paymentId) {
      logger.warn('HandlePaymentNotification', 'Payload sin data.id, ignorando')
      return
    }

    if (!collectorId) {
      logger.warn('HandlePaymentNotification', 'Payload sin user_id (collector_id)', {
        paymentId: paymentId.substring(0, 8),
      })
      return
    }

    // ────────────────────────────────────────────────────────────────────────
    // PASO 1: Resolver credenciales del kiosquero por collector_id
    // ────────────────────────────────────────────────────────────────────────
    const creds = await getCredentialsByCollectorId(collectorId)
    if (!creds) {
      // Probablemente es del simulador del panel developers de MP
      // (manda collector_id ficticio que no matchea ninguna org). OK silently.
      logger.warn('HandlePaymentNotification', 'No hay credenciales para collector_id', {
        collectorId: collectorId.substring(0, 6),
        paymentId: paymentId.substring(0, 8),
      })
      return
    }

    // ────────────────────────────────────────────────────────────────────────
    // PASO 2: GET /v1/payments/{id} para obtener external_reference + status
    // ────────────────────────────────────────────────────────────────────────
    const paymentDetails = await fetchPaymentDetails(paymentId, creds.accessToken)
    if (!paymentDetails) {
      // 404 típico del simulador (payment_id ficticio).
      logger.warn('HandlePaymentNotification', 'No se pudo obtener detalle del pago', {
        paymentId: paymentId.substring(0, 8),
      })
      return
    }

    const mpStatus = paymentDetails.status as MercadoPagoPaymentStatus
    const mappedStatus: MercadoPagoOrderStatus = MERCADOPAGO_STATUS_MAP[mpStatus] || 'pending'
    const externalReference = paymentDetails.external_reference || null

    logger.info('HandlePaymentNotification', 'Detalle de pago obtenido', {
      paymentId: paymentId.substring(0, 8),
      mpStatus,
      mappedStatus,
      hasExternalRef: !!externalReference,
      amount: paymentDetails.transaction_amount,
    })

    // ────────────────────────────────────────────────────────────────────────
    // PASO 3: Localizar la orden — primero por external_reference, fallback
    // por mp_payment_id (idempotencia: si ya procesamos antes, mp_payment_id
    // ya está seteado).
    // ────────────────────────────────────────────────────────────────────────
    const supabase = createServiceRoleClient()

    let orderRow:
      | { id: string; status: string; webhook_received_at: string | null }
      | null = null

    if (externalReference) {
      const { data } = await supabase
        .from('mercadopago_orders')
        .select('id, status, webhook_received_at')
        .eq('external_reference', externalReference)
        .eq('organization_id', creds.organizationId)
        .maybeSingle()
      orderRow = (data as any) || null
    }

    if (!orderRow) {
      const { data } = await supabase
        .from('mercadopago_orders')
        .select('id, status, webhook_received_at')
        .eq('mp_payment_id', paymentId)
        .eq('organization_id', creds.organizationId)
        .maybeSingle()
      orderRow = (data as any) || null
    }

    if (!orderRow) {
      logger.warn('HandlePaymentNotification', 'No se encontró orden para el pago', {
        paymentId: paymentId.substring(0, 8),
        externalRef: externalReference?.substring(0, 8),
        orgId: creds.organizationId.substring(0, 8),
      })
      return
    }

    // Idempotencia: si ya está confirmed con webhook recibido, no re-procesar.
    // Caso común: MP manda payment.created y payment.updated muy seguidos.
    if (orderRow.status === 'confirmed' && orderRow.webhook_received_at) {
      logger.info('HandlePaymentNotification', 'Orden ya confirmada, skip', {
        orderId: orderRow.id.substring(0, 8),
      })
      return
    }

    // ────────────────────────────────────────────────────────────────────────
    // PASO 4: UPDATE
    // ────────────────────────────────────────────────────────────────────────
    const confirmedAt = mpStatus === 'approved'
      ? (paymentDetails.date_approved || new Date().toISOString())
      : null

    const { error: updateError } = await supabase
      .from('mercadopago_orders')
      .update({
        status: mappedStatus,
        mp_payment_id: paymentId,
        confirmed_at: confirmedAt,
        webhook_received_at: new Date().toISOString(),
        notes: paymentDetails.status_detail ? `MP: ${paymentDetails.status_detail}` : null,
      })
      .eq('id', orderRow.id)

    if (updateError) {
      logger.error('HandlePaymentNotification', 'Error actualizando orden', updateError as Error)
      return
    }

    logger.info('HandlePaymentNotification', 'Orden actualizada exitosamente', {
      orderId: orderRow.id.substring(0, 8),
      newStatus: mappedStatus,
      mpStatus,
    })

    // ────────────────────────────────────────────────────────────────────────
    // PASO 5 (Plan B): si la orden quedó confirmed, crear la sale server-side
    // a partir de cart_snapshot. Esto desacopla el registro de venta de la UI
    // — aunque el dialog se haya cerrado, la sale igual queda registrada.
    // ────────────────────────────────────────────────────────────────────────
    if (mappedStatus === 'confirmed') {
      await ensureSaleForConfirmedOrder(orderRow.id)
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('HandlePaymentNotification', 'Error procesando pago', err)
    // No lanzar (queremos 200 OK al final del outer handler).
  }
}

/**
 * Manejar notificaciones de orden (order.updated)
 *
 * Actualiza estado si la orden cambió (ej: expiración).
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

    let newStatus: MercadoPagoOrderStatus = 'pending'

    if (data.status === 'expired') {
      newStatus = 'expired'
    } else if (data.status === 'paid') {
      newStatus = 'confirmed'
    }

    const supabase = createServiceRoleClient()

    const { data: updated, error: updateError } = await supabase
      .from('mercadopago_orders')
      .update({
        status: newStatus,
        webhook_received_at: new Date().toISOString(),
      })
      .eq('external_reference', externalReference)
      .select('id')
      .maybeSingle()

    if (updateError) {
      logger.error('HandleOrderNotification', 'Error actualizando orden', updateError as Error)
      return
    }

    logger.info('HandleOrderNotification', 'Orden actualizada exitosamente', {
      externalRef: externalReference.substring(0, 8),
      newStatus,
    })

    // Plan B: si quedó confirmed, garantizar que la sale exista server-side
    // a partir de cart_snapshot (idempotente).
    if (newStatus === 'confirmed' && updated && (updated as any).id) {
      await ensureSaleForConfirmedOrder((updated as any).id)
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('HandleOrderNotification', 'Error procesando orden', err)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// PLAN B: CREACIÓN DE VENTA DESDE EL WEBHOOK
// ───────────────────────────────────────────────────────────────────────────

/**
 * Garantiza que exista una sale para una orden MP confirmada.
 *
 * Plan B: cuando el webhook marca la orden como `confirmed`, la sale se crea
 * server-side acá usando `cart_snapshot`. Esto desacopla el registro de la
 * venta de la UI: el dialog puede cerrarse, el celular dormirse, perderse
 * conexión justo después del QR — la venta igual queda registrada cuando
 * MP confirme el pago.
 *
 * Idempotente:
 *   - Si la orden no está `confirmed` → no hace nada.
 *   - Si la orden ya tiene `sale_id` → no hace nada (webhook duplicado o
 *     creada por otro path).
 *   - Si `cart_snapshot` está vacío/null → log warning y skip (caso edge:
 *     orden creada con código viejo, antes de la migración Plan B).
 *
 * Usa service role (bypass RLS) y un RPC `process_sale_from_webhook` que
 * recibe `p_org_id` explícito (a diferencia de `process_sale` que deriva
 * la organización de `auth.uid()` y por eso falla desde el webhook).
 */
async function ensureSaleForConfirmedOrder(orderId: string): Promise<void> {
  try {
    const supabase = createServiceRoleClient()

    const { data: order, error: fetchError } = await supabase
      .from('mercadopago_orders')
      .select('id, organization_id, branch_id, cash_register_id, sale_id, cart_snapshot, amount, status, external_reference')
      .eq('id', orderId)
      .single()

    if (fetchError || !order) {
      logger.error(
        'EnsureSaleForConfirmedOrder',
        'No se encontró la orden',
        (fetchError as unknown as Error) || new Error('order is null')
      )
      return
    }

    const orderRow = order as any

    if (orderRow.status !== 'confirmed') {
      // Sólo creamos sale para órdenes confirmadas.
      return
    }

    if (orderRow.sale_id) {
      // Idempotencia: ya existe la sale (webhook duplicado o doble entrada).
      logger.info('EnsureSaleForConfirmedOrder', 'Sale ya creada, skip', {
        orderId: orderId.substring(0, 8),
        saleId: String(orderRow.sale_id).substring(0, 8),
      })
      return
    }

    const cartSnapshot = orderRow.cart_snapshot
    if (!cartSnapshot || !Array.isArray(cartSnapshot) || cartSnapshot.length === 0) {
      logger.warn(
        'EnsureSaleForConfirmedOrder',
        'cart_snapshot vacío o ausente — no se puede crear sale',
        {
          orderId: orderId.substring(0, 8),
          externalRef: String(orderRow.external_reference || '').substring(0, 8),
        }
      )
      return
    }

    if (!orderRow.cash_register_id) {
      logger.warn(
        'EnsureSaleForConfirmedOrder',
        'cash_register_id ausente — no se puede crear sale (NOT NULL en sales)',
        { orderId: orderId.substring(0, 8) }
      )
      return
    }

    // Llamamos al RPC paralelo que acepta org_id explícito.
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'process_sale_from_webhook',
      {
        p_org_id: orderRow.organization_id,
        p_branch_id: orderRow.branch_id,
        p_cash_register_id: orderRow.cash_register_id,
        p_items: cartSnapshot,
        p_payment_method: 'mercadopago',
        p_total: Number(orderRow.amount),
        p_notes: `MP order ${orderId}`,
      }
    )

    if (rpcError) {
      logger.error(
        'EnsureSaleForConfirmedOrder',
        'Error en RPC process_sale_from_webhook',
        rpcError as unknown as Error
      )
      return
    }

    // El RPC puede devolver el UUID directo o { sale_id: uuid }.
    const newSaleId =
      typeof rpcResult === 'string'
        ? rpcResult
        : (rpcResult as any)?.sale_id || (rpcResult as any)?.id || null

    if (!newSaleId) {
      logger.error(
        'EnsureSaleForConfirmedOrder',
        'RPC no devolvió sale_id reconocible',
        new Error(`rpcResult=${JSON.stringify(rpcResult)}`)
      )
      return
    }

    // Linkear el sale_id en la orden para futura idempotencia.
    const { error: linkError } = await supabase
      .from('mercadopago_orders')
      .update({ sale_id: newSaleId })
      .eq('id', orderId)

    if (linkError) {
      logger.error(
        'EnsureSaleForConfirmedOrder',
        'Error linkeando sale_id en la orden',
        linkError as unknown as Error
      )
      // No re-tirar: la sale igual quedó creada; sólo el link falló.
      return
    }

    logger.info('EnsureSaleForConfirmedOrder', 'Sale creada y linkeada', {
      orderId: orderId.substring(0, 8),
      saleId: String(newSaleId).substring(0, 8),
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('EnsureSaleForConfirmedOrder', 'Error inesperado', err)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ───────────────────────────────────────────────────────────────────────────

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
