/**
 * ============================================================================
 * ARCA CAE — Capa pura de comunicación con AFIP/ARCA
 * ============================================================================
 *
 * Función reusable que toma datos de un comprobante ya construido y solicita
 * el CAE al webservice WSFEv1 de ARCA (vía @afipsdk/afip.js). NO toca DB.
 *
 * Consumida por:
 * - arca.actions.ts:createInvoiceAction (facturación por venta individual)
 * - invoicing.actions.ts:issueInvoiceAction (facturación retroactiva agrupada)
 *
 * Reemplaza al ArcaServiceMock anterior (lib/services/arca.service.ts) que
 * generaba CAE sintéticos y nunca se conectaba a AFIP.
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
 * Centraliza la única llamada al SDK @afipsdk/afip.js de toda la app.
 *
 * NUMERACIÓN: el SDK consulta internamente FECompUltimoAutorizado y suma 1.
 * No hace falta llevar contador local — AFIP es la fuente de verdad.
 *
 * RETRY: 3 reintentos con backoff (300ms, 1s, 3s) solo en errores transitorios
 * (timeouts, 5xx, network). Errores de validación (CUIT mal, importe negativo)
 * no se reintentan para evitar emisiones duplicadas.
 */
export async function requestCAEFromInvoiceData(
  params: RequestCAEParams
): Promise<RequestCAEResult> {
  try {
    if (params.impTotal <= 0) {
      return { success: false, error: 'El total debe ser mayor a 0' }
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Afip = (await import('@afipsdk/afip.js')).default

    const afip = new Afip({
      CUIT: Number(params.cuit),
      cert: params.certPem,
      key: params.keyPem,
      production: !params.isSandbox,
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
      ...(params.ivaDetalle ? { Iva: params.ivaDetalle } : {}),
    }

    const result = await callAfipWithRetry(() =>
      afip.ElectronicBilling.createNextVoucher(voucherData)
    )

    return {
      success: true,
      cae: result.CAE,
      caeVencimiento: result.CAEFchVto,
      cbteNumero: Number(result.voucher_number ?? 0),
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return { success: false, error: errMsg }
  }
}
