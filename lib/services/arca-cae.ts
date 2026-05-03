/**
 * ============================================================================
 * ARCA CAE — Capa pura de comunicación con AFIP/ARCA
 * ============================================================================
 *
 * Función reusable que toma datos de un comprobante ya construido y solicita
 * el CAE al webservice WSFEv1 de ARCA (vía @arcasdk/core, SOAP DIRECTO a AFIP).
 * NO toca DB.
 *
 * Consumida por:
 * - arca.actions.ts:createInvoiceAction (facturación por venta individual)
 * - invoicing.actions.ts:issueInvoiceAction (facturación retroactiva agrupada)
 *
 * HISTORIA: este archivo fue migrado de @afipsdk/afip.js a @arcasdk/core
 * el 3-may-2026 cuando descubrimos que @afipsdk/afip.js NO era SOAP directo
 * — era un wrapper a app.afipsdk.com (proxy de terceros pago). @arcasdk/core
 * habla SOAP nativo contra wsaa.afip.gov.ar / servicios1.afip.gov.ar (prod)
 * y wsaahomo.afip.gov.ar / wswhomo.afip.gov.ar (homologación).
 *
 * NOTA: NO es 'use server' — es una función helper invocable solo desde
 * server actions (que ya validan auth + ownership + leen credenciales de DB).
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// CONSTANTES AFIP
// ----------------------------------------------------------------------------

/** Códigos AFIP de tipo de comprobante */
export const CBTE_TIPO_MAP: Record<'A' | 'B' | 'C', number> = {
  A: 1,
  B: 6,
  C: 11,
}

/** Códigos AFIP de tipo de documento receptor */
export const DOC_TYPES = {
  CUIT: 80,
  CUIL: 86,
  DNI: 96,
  SIN_IDENTIFICAR: 99,
} as const

/** Códigos AFIP de alícuota IVA */
export const IVA_RATES = {
  NO_GRAVADO: { code: 1, rate: 0 },
  EXENTO: { code: 2, rate: 0 },
  IVA_0: { code: 3, rate: 0 },
  IVA_10_5: { code: 4, rate: 0.105 },
  IVA_21: { code: 5, rate: 0.21 },
  IVA_27: { code: 6, rate: 0.27 },
} as const

/**
 * Códigos AFIP de Condición IVA del Receptor (RG 5616/2024 — obligatorio).
 * Para kiosco la abrumadora mayoría de las ventas son a CONSUMIDOR_FINAL (5).
 */
export const COND_IVA_RECEPTOR = {
  RESPONSABLE_INSCRIPTO: 1,
  EXENTO: 4,
  CONSUMIDOR_FINAL: 5,
  MONOTRIBUTO: 6,
  NO_CATEGORIZADO: 7,
  PROVEEDOR_DEL_EXTERIOR: 8,
  CLIENTE_DEL_EXTERIOR: 9,
  IVA_LIBERADO: 10,
} as const

// ----------------------------------------------------------------------------
// TIPOS
// ----------------------------------------------------------------------------

export interface RequestCAEParams {
  /** Credenciales fiscales */
  cuit: string
  certPem: string
  keyPem: string
  isSandbox: boolean

  /** Datos del comprobante */
  puntoVenta: number
  cbteTipo: number          // 1 = A, 6 = B, 11 = C (ver CBTE_TIPO_MAP)
  concepto?: number         // 1 = Productos (default), 2 = Servicios, 3 = Mixto
  docTipo?: number          // 99 = consumidor final sin id (default), 80 = CUIT, etc.
  docNro?: string           // '0' para consumidor final
  fechaYYYYMMDD: string     // formato AFIP: '20260502'

  /** Importes */
  impTotal: number
  impNeto: number
  impIva: number
  impOpEx?: number          // operaciones exentas
  impTotConc?: number       // operaciones no gravadas
  ivaDetalle?: Array<{ Id: number; BaseImp: number; Importe: number }>

  /**
   * Condición IVA del receptor (RG 5616/2024 — required por AFIP desde fines 2024).
   * Default: 5 (Consumidor Final) — el caso típico del kiosco.
   * Ver constantes en COND_IVA_RECEPTOR.
   */
  condicionIvaReceptor?: number
}

export interface RequestCAEResult {
  success: boolean
  cae?: string
  caeVencimiento?: string   // YYYYMMDD desde AFIP
  cbteNumero?: number
  error?: string
}

// ----------------------------------------------------------------------------
// RETRY CONFIG
// ----------------------------------------------------------------------------

/** Delays entre reintentos en ms. La cantidad de elementos define el máximo de reintentos. */
const RETRY_DELAYS_MS = [300, 1000, 3000]

/**
 * Heurística para distinguir errores transitorios (vale la pena reintentar)
 * de errores fatales (validación, datos malos — reintentar es inútil y puede
 * causar duplicados si AFIP ya emitió).
 */
function isTransientAfipError(msg: string): boolean {
  const lower = msg.toLowerCase()
  // Errores de red TCP
  if (lower.includes('econnreset')) return true
  if (lower.includes('etimedout')) return true
  if (lower.includes('enotfound')) return true
  if (lower.includes('econnrefused')) return true
  if (lower.includes('socket hang up')) return true
  if (lower.includes('network')) return true
  // Errores HTTP transitorios típicos del WS de AFIP/ARCA
  if (lower.includes('503')) return true
  if (lower.includes('502')) return true
  if (lower.includes('504')) return true
  if (lower.includes('timeout')) return true
  if (lower.includes('service unavailable')) return true
  if (lower.includes('gateway')) return true
  if (lower.includes('temporar')) return true // "temporarily", "temporariamente"
  // Mensaje típico de AFIP cuando el WS está caído
  if (lower.includes('no disponible')) return true
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Llama a una función async con retry exponencial.
 * Solo reintenta si isTransientAfipError() devuelve true.
 *
 * RIESGO CONOCIDO: si AFIP procesó la primera request pero no nos llegó la
 * respuesta (network glitch del lado de respuesta), un retry hace que AFIP
 * emita un SEGUNDO comprobante con el número siguiente. Mitigación parcial:
 * UNIQUE INDEX en arca_invoices(sale_id) WHERE status='authorized' bloquea
 * el INSERT del segundo CAE de nuestro lado. T14c (parked) cubre el recovery
 * cuando esto pasa.
 */
async function callAfipWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const errMsg = err instanceof Error ? err.message : String(err)
      const transient = isTransientAfipError(errMsg)
      const isLastAttempt = i === RETRY_DELAYS_MS.length

      if (!transient || isLastAttempt) {
        throw err
      }
      await sleep(RETRY_DELAYS_MS[i])
    }
  }
  // Inalcanzable, pero TypeScript lo exige
  throw lastError
}

// ----------------------------------------------------------------------------
// FUNCIÓN PRINCIPAL
// ----------------------------------------------------------------------------

/**
 * Solicita CAE a ARCA para un comprobante ya armado.
 * Centraliza la única llamada al SDK @arcasdk/core de toda la app.
 *
 * NUMERACIÓN: el SDK consulta internamente FECompUltimoAutorizado y suma 1
 * (método createNextVoucher / createNextInvoice). No hace falta llevar
 * contador local — AFIP es la fuente de verdad.
 *
 * RETRY: 3 reintentos con backoff (300ms, 1s, 3s) solo en errores transitorios
 * (timeouts, 5xx, network). Errores de validación (CUIT mal, importe negativo)
 * no se reintentan para evitar emisiones duplicadas.
 *
 * useHttpsAgent: true es REQUERIDO en Vercel/Node.js — sin esto los WS legacy
 * de AFIP rechazan el handshake TLS. Solo poner false en edge runtimes
 * (Cloudflare Workers, Deno Deploy, etc.).
 */
export async function requestCAEFromInvoiceData(
  params: RequestCAEParams
): Promise<RequestCAEResult> {
  try {
    if (params.impTotal <= 0) {
      return { success: false, error: 'El total debe ser mayor a 0' }
    }

    const { Arca } = await import('@arcasdk/core')

    const arca = new Arca({
      cuit: Number(params.cuit),
      cert: params.certPem,
      key: params.keyPem,
      production: !params.isSandbox,
      useHttpsAgent: true,
      // useSoap12 default true — OK
      // ticketPath: el SDK por default usa path.resolve(__dirname, "..", "..", "storage", "auth", "tickets")
      // que en Vercel serverless con turbopack se bundlea a "/ROOT/..." (read-only) y rompe con
      // ENOENT mkdir. Vercel solo permite escritura en /tmp (efímero per-lambda-instance).
      // Cache de TA dura 12hs típicas — funciona dentro de una lambda warm, los cold starts
      // van a chocar con `coe.alreadyAuthenticated` hasta que el TA expire en WSAA.
      // Solución correcta a futuro: storage adapter custom contra Supabase (T16-B Task #8 parked).
      ticketPath: '/tmp/arca-tickets',
    })

    const voucherData = {
      CantReg: 1,
      PtoVta: params.puntoVenta,
      CbteTipo: params.cbteTipo,
      Concepto: params.concepto ?? 1,
      DocTipo: params.docTipo ?? 99,
      DocNro: Number(params.docNro ?? '0') || 0,
      CbteFch: params.fechaYYYYMMDD,
      ImpTotal: params.impTotal,
      ImpTotConc: params.impTotConc ?? 0,
      ImpNeto: params.impNeto,
      ImpOpEx: params.impOpEx ?? 0,
      ImpIVA: params.impIva,
      ImpTrib: 0,
      MonId: 'PES',
      MonCotiz: 1,
      CondicionIVAReceptorId:
        params.condicionIvaReceptor ?? COND_IVA_RECEPTOR.CONSUMIDOR_FINAL,
      ...(params.ivaDetalle ? { Iva: params.ivaDetalle } : {}),
    }

    const result = await callAfipWithRetry(() =>
      arca.electronicBillingService.createNextInvoice(voucherData)
    )

    // Extraer número de comprobante del response SOAP de AFIP.
    // Shape: result.response.FeDetResp.FECAEDetResponse[0].CbteDesde
    // Tolerante a forma alternativa (FECAEDetResponse no array).
    let cbteNumero = 0
    try {
      const resp = (result as { response?: unknown }).response as
        | {
            FeDetResp?: {
              FECAEDetResponse?:
                | Array<{ CbteDesde?: number | string }>
                | { CbteDesde?: number | string }
            }
          }
        | undefined
      const det = resp?.FeDetResp?.FECAEDetResponse
      const detItem = Array.isArray(det) ? det[0] : det
      if (detItem?.CbteDesde !== undefined) {
        cbteNumero = Number(detItem.CbteDesde) || 0
      }
    } catch {
      // Si falla la extracción, dejamos cbteNumero=0 — el CAE igual sirve.
    }

    return {
      success: true,
      cae: result.cae,
      caeVencimiento: result.caeFchVto,
      cbteNumero,
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return { success: false, error: errMsg }
  }
}
