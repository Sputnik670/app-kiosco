/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔐 MERCADO PAGO WEBHOOK SIGNATURE VERIFICATION
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Funciones puras (sin I/O ni side-effects) que parsean el header `x-signature`
 * de Mercado Pago y verifican el HMAC-SHA256.
 *
 * Extraidas de `app/api/mercadopago/webhook/route.ts` para poder testearlas
 * unitariamente sin levantar Next.js.
 *
 * Template oficial del manifest segun la doc de MP:
 *   `id:${dataId};request-id:${requestId};ts:${timestamp};`
 *
 * Donde:
 *   - dataId: viene del query param `data.id` (en webhooks reales) o del body
 *     (en el simulador del panel). Si es alfanumerico se manda en lowercase.
 *   - requestId: el header `x-request-id`.
 *   - timestamp: el `ts=` extraido del header `x-signature`. En SEGUNDOS Unix
 *     epoch (no milisegundos).
 *
 * Ref: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import crypto from 'crypto'

/**
 * Estructura del header `x-signature`.
 * Formato: `ts={ts},v1={signature}`
 */
export interface SignatureHeader {
  /** Timestamp Unix en SEGUNDOS (no ms). */
  ts: number
  /** Hash HMAC-SHA256 en hexadecimal lowercase. */
  v1: string
}

/**
 * Parsea el header `x-signature` de Mercado Pago.
 *
 * @returns null si el header esta mal formado o `ts` no es numerico.
 *
 * @example
 *   parseSignatureHeader('ts=1234567890,v1=abc123')
 *   → { ts: 1234567890, v1: 'abc123' }
 */
export function parseSignatureHeader(header: string): SignatureHeader | null {
  try {
    const parts = header.split(',')
    const tsMatch = parts.find(p => p.startsWith('ts='))
    const v1Match = parts.find(p => p.startsWith('v1='))

    if (!tsMatch || !v1Match) return null

    const ts = parseInt(tsMatch.substring(3), 10)
    const v1 = v1Match.substring(3)

    if (isNaN(ts)) return null
    if (!v1) return null

    return { ts, v1 }
  } catch {
    return null
  }
}

/**
 * Verifica una firma HMAC-SHA256 de Mercado Pago.
 *
 * Reconstruye el template oficial:
 *   `id:${dataId};request-id:${requestId};ts:${timestamp};`
 *
 * Computa HMAC-SHA256 con `webhookSecret` y lo compara contra `receivedV1`
 * usando `timingSafeEqual` para evitar timing attacks.
 *
 * IMPORTANTE: `dataId` debe venir ya normalizado (lowercase si es alfanumerico).
 * Esa normalizacion la hace el caller — esta funcion no lo modifica.
 *
 * @returns true si la firma es valida; false en cualquier otro caso.
 */
export function verifyMercadoPagoSignature(
  timestamp: number,
  requestId: string,
  dataId: string,
  webhookSecret: string,
  receivedV1: string
): boolean {
  try {
    const template = `id:${dataId};request-id:${requestId};ts:${timestamp};`

    const hmac = crypto.createHmac('sha256', webhookSecret)
    hmac.update(template)
    const computed = hmac.digest('hex')

    if (computed.length !== receivedV1.length) {
      return false
    }

    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(receivedV1, 'hex')
    )
  } catch {
    return false
  }
}

/**
 * Helper de uso en tests/debugging: devuelve el template que esta funcion
 * esta firmando. Util para comparar contra lo que MP firmo cuando hay
 * mismatch (loggear template en webhook vs computar manual con curl).
 */
export function buildSignatureTemplate(
  timestamp: number,
  requestId: string,
  dataId: string
): string {
  return `id:${dataId};request-id:${requestId};ts:${timestamp};`
}
