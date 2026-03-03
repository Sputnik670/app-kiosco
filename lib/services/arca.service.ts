/**
 * ============================================================================
 * ARCA SERVICE - Integración con AFIP/ARCA (Facturación Electrónica)
 * ============================================================================
 *
 * Servicio para comunicación con el webservice de ARCA (ex AFIP).
 * FASE ACTUAL: MOCK - Simula respuestas para desarrollo.
 *
 * Cuando se tenga certificado real, implementar:
 * 1. Autenticación WSAA (obtener token y sign)
 * 2. Llamadas a WSFEv1 (facturación electrónica)
 *
 * ============================================================================
 */

import type {
  CAERequest,
  CAEResponse,
  InvoiceType,
  ArcaEnvironment,
} from '@/types/invoicing.types'

// ----------------------------------------------------------------------------
// CONFIGURACIÓN
// ----------------------------------------------------------------------------

interface ArcaServiceConfig {
  cuit: string
  environment: ArcaEnvironment
  certificate?: string
  privateKey?: string
}

// ----------------------------------------------------------------------------
// MOCK SERVICE (Fase de desarrollo)
// ----------------------------------------------------------------------------

class ArcaServiceMock {
  private config: ArcaServiceConfig | null = null
  private lastInvoiceNumbers: Map<string, number> = new Map()

  /**
   * Configura el servicio con credenciales
   */
  configure(config: ArcaServiceConfig): void {
    this.config = config
    console.log(`[ARCA MOCK] Configurado para CUIT ${config.cuit} en ambiente ${config.environment}`)
  }

  /**
   * Simula autenticación con ARCA
   */
  async authenticate(): Promise<{ success: boolean; token?: string; error?: string }> {
    if (!this.config) {
      return { success: false, error: 'Servicio no configurado' }
    }

    // Simular delay de red
    await this.simulateDelay(500)

    console.log('[ARCA MOCK] Autenticación exitosa')
    return {
      success: true,
      token: `mock-token-${Date.now()}`,
    }
  }

  /**
   * Obtiene el último número de comprobante para un punto de venta
   */
  async getLastInvoiceNumber(
    pointOfSale: number,
    invoiceType: InvoiceType
  ): Promise<{ success: boolean; number?: number; error?: string }> {
    if (!this.config) {
      return { success: false, error: 'Servicio no configurado' }
    }

    await this.simulateDelay(300)

    const key = `${pointOfSale}-${invoiceType}`
    const lastNumber = this.lastInvoiceNumbers.get(key) || 0

    console.log(`[ARCA MOCK] Último número para PV ${pointOfSale} tipo ${invoiceType}: ${lastNumber}`)
    return { success: true, number: lastNumber }
  }

  /**
   * Solicita CAE para una factura
   * En producción, esto llama a WSFEv1.FECAESolicitar
   */
  async requestCAE(request: CAERequest): Promise<CAEResponse> {
    if (!this.config) {
      return { success: false, error: 'Servicio no configurado' }
    }

    // Validaciones básicas
    if (request.total <= 0) {
      return { success: false, error: 'El total debe ser mayor a 0' }
    }

    if (request.invoice_type === 'A' && !request.customer_cuit) {
      return { success: false, error: 'Factura A requiere CUIT del cliente' }
    }

    await this.simulateDelay(800)

    // Generar CAE mock (14 dígitos)
    const cae = this.generateMockCAE()

    // Fecha de vencimiento: 10 días desde hoy
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + 10)
    const caeExpiry = expiry.toISOString().split('T')[0]

    // Actualizar último número
    const key = `${request.point_of_sale}-${request.invoice_type}`
    this.lastInvoiceNumbers.set(key, request.invoice_number)

    console.log(`[ARCA MOCK] CAE generado: ${cae} (vence: ${caeExpiry})`)
    console.log(`[ARCA MOCK] Factura ${request.invoice_type} #${request.invoice_number} por $${request.total}`)

    return {
      success: true,
      cae,
      cae_expiry: caeExpiry,
      observations: ['[MOCK] Este CAE es simulado y no es válido fiscalmente'],
    }
  }

  /**
   * Consulta estado de un comprobante por CAE
   */
  async checkInvoiceStatus(cae: string): Promise<{
    success: boolean
    status?: 'approved' | 'rejected' | 'pending'
    error?: string
  }> {
    await this.simulateDelay(400)

    // En mock, todos los CAE están aprobados
    console.log(`[ARCA MOCK] Consulta estado de CAE ${cae}: aprobado`)
    return { success: true, status: 'approved' }
  }

  /**
   * Genera un CAE mock con formato válido (14 dígitos)
   */
  private generateMockCAE(): string {
    // Prefijo 7 indica mock, seguido de timestamp
    const timestamp = Date.now().toString().slice(-12)
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0')
    return `7${timestamp}${random}`.slice(0, 14)
  }

  /**
   * Simula delay de red
   */
  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Verifica si el servicio está en modo mock
   */
  isMock(): boolean {
    return true
  }
}

// ----------------------------------------------------------------------------
// SINGLETON EXPORT
// ----------------------------------------------------------------------------

// En el futuro, se puede cambiar a ArcaServiceReal cuando tengamos certificados
export const arcaService = new ArcaServiceMock()

// ----------------------------------------------------------------------------
// HELPERS PARA FACTURACIÓN
// ----------------------------------------------------------------------------

/**
 * Códigos de tipo de comprobante según AFIP
 */
export const INVOICE_TYPE_CODES: Record<InvoiceType, number> = {
  A: 1,   // Factura A
  B: 6,   // Factura B
  C: 11,  // Factura C
}

/**
 * Códigos de concepto según AFIP
 */
export const CONCEPT_CODES = {
  PRODUCTOS: 1,
  SERVICIOS: 2,
  PRODUCTOS_Y_SERVICIOS: 3,
}

/**
 * Alícuotas de IVA según AFIP
 */
export const IVA_RATES = {
  NO_GRAVADO: { code: 1, rate: 0 },
  EXENTO: { code: 2, rate: 0 },
  IVA_0: { code: 3, rate: 0 },
  IVA_10_5: { code: 4, rate: 0.105 },
  IVA_21: { code: 5, rate: 0.21 },
  IVA_27: { code: 6, rate: 0.27 },
  IVA_5: { code: 8, rate: 0.05 },
  IVA_2_5: { code: 9, rate: 0.025 },
}

/**
 * Tipos de documento según AFIP
 */
export const DOC_TYPES = {
  CUIT: 80,
  CUIL: 86,
  CDI: 87,
  LE: 89,
  LC: 90,
  CI_EXTRANJERA: 91,
  EN_TRAMITE: 92,
  ACTA_NACIMIENTO: 93,
  PASAPORTE: 94,
  CI_BS_AS_RNP: 95,
  DNI: 96,
  SIN_IDENTIFICAR: 99,
}
