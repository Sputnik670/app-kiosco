/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 💳 TIPOS DE MERCADO PAGO
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Definiciones de tipos TypeScript para la integración con Mercado Pago QR.
 * Cubre: configuración, órdenes, pagos, webhooks.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ───────────────────────────────────────────────────────────────────────────────
// CREDENCIALES Y CONFIGURACIÓN
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Configuración de Mercado Pago para una organización
 * Se almacena encriptada en tabla mercadopago_credentials
 */
export interface MercadoPagoCredentials {
  id: string
  organization_id: string
  access_token: string // Encriptado en BD
  public_key: string
  collector_id: string // user_id de MP
  webhook_secret: string // Encriptado en BD
  is_sandbox: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Configuración desencriptada (solo en servidor)
 * Nunca exponerla al cliente
 */
export interface MercadoPagoConfigDecrypted {
  accessToken: string
  publicKey: string
  collecterId: string
  webhookSecret: string
  isSandbox: boolean
}

// ───────────────────────────────────────────────────────────────────────────────
// ÓRDENES Y PAGOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Estados posibles de una orden de pago QR
 */
export type MercadoPagoOrderStatus =
  | 'pending' // QR generado, esperando pago
  | 'confirmed' // Pago confirmado (webhook recibido)
  | 'completed' // Dinero acreditado (reconciliación)
  | 'failed' // Pago rechazado
  | 'expired' // QR expiró sin pagar
  | 'cancelled' // Usuario canceló

/**
 * Orden de pago QR en Supabase (tabla mercadopago_orders)
 */
export interface MercadoPagoOrder {
  id: string
  organization_id: string
  sale_id: string // Vinculación con tabla sales
  external_reference: string // sale_id (usado por MP para idempotencia)
  amount: number // En ARS
  currency: string // "ARS"
  qr_data: string // EMVCo string para generar imagen
  qr_image_url: string | null // URL del QR en Storage (opcional)
  status: MercadoPagoOrderStatus
  mp_payment_id: string | null // ID del pago en MP (una vez confirmado)
  mp_transaction_id: string | null // ID de transacción en MP
  created_at: string
  expires_at: string // QR expira en 30 min
  confirmed_at: string | null // Cuándo se confirmó el pago
  webhook_received_at: string | null // Cuándo llegó el webhook
  notes: string | null
}

/**
 * Estados de pago en Mercado Pago
 * Map a nuestros estados internos
 */
export type MercadoPagoPaymentStatus =
  | 'approved'
  | 'rejected'
  | 'in_process'
  | 'in_mediation'
  | 'cancelled'
  | 'refunded'
  | 'charged_back'

export const MERCADOPAGO_STATUS_MAP: Record<MercadoPagoPaymentStatus, MercadoPagoOrderStatus> = {
  approved: 'confirmed',
  rejected: 'failed',
  in_process: 'pending',
  in_mediation: 'pending',
  cancelled: 'cancelled',
  refunded: 'failed',
  charged_back: 'failed',
}

// ───────────────────────────────────────────────────────────────────────────────
// RESPUESTAS DE API
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Respuesta de crear orden QR en Mercado Pago API
 */
export interface MercadoPagoCreateOrderResponse {
  qr_id: string
  qr_data: string // EMVCo string
  status: 'active' | 'expired'
  created_at: string
  external_reference?: string
  total_amount?: number
}

/**
 * Respuesta de obtener estado de orden en MP API
 */
export interface MercadoPagoGetOrderResponse {
  external_reference: string
  total_amount: number
  status: 'active' | 'expired' | 'paid'
  qr_data: string
  created_at: string
  external_pos_id?: string
}

/**
 * Información de usuario en MP (de /users/me)
 */
export interface MercadoPagoUserInfo {
  id: string | number
  email: string
  nickname: string
  first_name: string
  last_name: string
  phone: {
    area_code: string | null
    number: string | null
  }
  identification: {
    type: string
    number: string
  }
  status: string
  public_key?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// WEBHOOKS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Tipos de eventos de webhook en Mercado Pago
 */
export type MercadoPagoWebhookAction =
  | 'payment.created'
  | 'payment.updated'
  | 'payment.completed'
  | 'order.updated'
  | 'test_event'

/**
 * Payload completo de webhook de Mercado Pago
 */
export interface MercadoPagoWebhookPayload {
  id: string
  type: 'payment' | 'order' | 'merchant_order'
  action: MercadoPagoWebhookAction
  api_version: string
  created_at?: string
  timestamp?: number
  live_mode?: boolean
  data: {
    id: string | number
    object?: any
    status?: MercadoPagoPaymentStatus
    status_detail?: string
    transaction_amount?: number
    transaction_details?: {
      total_paid_amount?: number
      net_received_amount?: number
      overpaid_amount?: number
      external_resource_url?: string
    }
    currency_id?: string
    external_reference?: string // CRÍTICO: vinculación con nuestra sale_id
    payment_method_id?: string
    payer?: {
      id: string | number
      email?: string
      first_name?: string
      last_name?: string
      identification?: {
        type?: string
        number?: string
      }
    }
    date_created?: string
    date_approved?: string
    date_last_updated?: string
    money_release_date?: string
  }
}

/**
 * Información extraída de un webhook de pago
 * (version normalizada para procesamiento interno)
 */
export interface ParsedPaymentNotification {
  mpPaymentId: string | number
  status: MercadoPagoPaymentStatus
  amount: number
  externalReference: string // sale_id
  payerId: string | number | null
  payerEmail: string | null
  dateApproved: string | null
  transactionDetails?: {
    totalPaid: number
    netReceived: number
    overpaid: number
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// ERRORES
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Error específico de Mercado Pago
 */
export interface MercadoPagoError {
  status: number
  message: string
  code: string
  cause?: Array<{
    code: string
    description: string
  }>
}

/**
 * Códigos de error comunes de MP
 */
export const MERCADOPAGO_ERROR_CODES = {
  AUTHENTICATION_REQUIRED: 'authentication_required',
  INVALID_REQUEST_DATA: 'invalid_request_data',
  NOT_FOUND: 'not_found',
  RESOURCE_NOT_FOUND: 'resource_not_found',
  INVALID_TOKEN: 'invalid_token',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  RATE_LIMIT_EXCEEDED: 'too_many_requests',
  INTERNAL_SERVER_ERROR: 'internal_error',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  TIMEOUT: 'timeout',
} as const

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

/**
 * URL base de API de Mercado Pago
 * Igual para sandbox y producción
 */
export const MERCADOPAGO_API_BASE_URL = 'https://api.mercadopago.com'

/**
 * Timeout para requests a MP API (ms)
 */
export const MERCADOPAGO_REQUEST_TIMEOUT = 10000 // 10 segundos

/**
 * Tiempo de expiración de QR (minutos)
 * Después de este tiempo, el QR no se puede escanear
 */
export const MERCADOPAGO_QR_EXPIRY_MINUTES = 30

/**
 * Tiempo máximo que espera la UI por confirmación de pago (ms)
 * Después de esto, muestra opción de reintentar
 */
export const MERCADOPAGO_PAYMENT_CONFIRMATION_TIMEOUT = 5 * 60 * 1000 // 5 minutos

/**
 * Edad máxima permitida de un webhook (ms)
 * Webhooks más antiguos se rechazan (replay attack prevention)
 */
export const MERCADOPAGO_WEBHOOK_MAX_AGE = 5 * 60 * 1000 // 5 minutos

/**
 * Reintentos automáticos para requests fallidos
 */
export const MERCADOPAGO_MAX_RETRIES = 3
export const MERCADOPAGO_RETRY_BACKOFF_MS = 1000 // exponencial: 1s, 2s, 4s

// ───────────────────────────────────────────────────────────────────────────────
// COMISIONES Y COSTOS (Información de contexto)
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Rango de comisiones que cobra MP en Argentina (2026)
 * Varía por provincia según Ingresos Brutos
 * Ver: https://www.mercadopago.com.ar/ayuda/cuanto-cuesta-recibir-pagos-con-QR_3605
 */
export interface MercadoPagoCommissionRange {
  minPercentage: number // 0.8%
  maxPercentage: number // 6.29%
  note: string
}

export const MERCADOPAGO_COMMISSION_2026: MercadoPagoCommissionRange = {
  minPercentage: 0.8,
  maxPercentage: 6.29,
  note: 'Varía por provincia según Ingresos Brutos. Ver dashboard de MP para comisión exacta.',
}

/**
 * Tiempos de acreditación de dinero en MP
 */
export const MERCADOPAGO_SETTLEMENT_TIMES = {
  instant: {
    label: 'Inmediato',
    hours: 0,
    available: false, // Requiere account verificada
  },
  same_day: {
    label: 'Mismo día',
    hours: 0,
    available: true,
  },
  next_day: {
    label: 'Próximo día',
    hours: 24,
    available: true,
  },
} as const
