/**
 * ============================================================================
 * TIPOS DE FACTURACIÓN ELECTRÓNICA
 * ============================================================================
 *
 * Tipos TypeScript para el sistema de facturación retroactiva y opcional.
 * Soporta facturas A, B, C según normativa ARCA/AFIP.
 *
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// ENUMS Y CONSTANTES
// ----------------------------------------------------------------------------

/**
 * Tipos de factura según ARCA/AFIP
 */
export type InvoiceType = 'A' | 'B' | 'C'

/**
 * Estado de la factura
 */
export type InvoiceStatus = 'draft' | 'issued' | 'cancelled'

/**
 * Condición fiscal del cliente
 * RI = Responsable Inscripto
 * MONO = Monotributista
 * CF = Consumidor Final
 * EX = Exento
 */
export type CustomerTaxStatus = 'RI' | 'MONO' | 'CF' | 'EX'

/**
 * Ambiente de ARCA
 */
export type ArcaEnvironment = 'testing' | 'production'

// ----------------------------------------------------------------------------
// CONFIGURACIÓN FISCAL
// ----------------------------------------------------------------------------

/**
 * Configuración fiscal de la organización
 * Almacenada en organizations.fiscal_config (JSONB)
 */
export interface FiscalConfig {
  cuit: string
  tax_status: 'RI' | 'MONO'
  business_name: string
  business_address?: string
  point_of_sale: number
  arca_environment: ArcaEnvironment
  enabled: boolean
}

// ----------------------------------------------------------------------------
// FACTURAS
// ----------------------------------------------------------------------------

/**
 * Factura completa desde la base de datos
 */
export interface Invoice {
  id: string
  organization_id: string
  branch_id: string

  // Datos del comprobante
  invoice_type: InvoiceType
  invoice_number: number
  point_of_sale: number

  // Datos del cliente
  customer_cuit: string | null
  customer_name: string | null
  customer_tax_status: CustomerTaxStatus | null
  customer_address: string | null

  // Totales
  subtotal: number
  tax_amount: number
  total: number

  // ARCA
  cae: string | null
  cae_expiry: string | null
  is_mock: boolean

  // Estado
  status: InvoiceStatus
  issued_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  created_by: string | null
  created_at: string
}

/**
 * Datos para crear una nueva factura
 */
export interface CreateInvoiceData {
  branch_id: string
  invoice_type: InvoiceType
  sale_ids: string[]

  // Datos del cliente (opcionales para CF)
  customer_cuit?: string
  customer_name?: string
  customer_tax_status?: CustomerTaxStatus
  customer_address?: string
}

/**
 * Preview de factura antes de emitir
 */
export interface InvoicePreview {
  invoice_type: InvoiceType
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  sales_count: number
  items_count: number
}

// ----------------------------------------------------------------------------
// VENTAS SIN FACTURAR
// ----------------------------------------------------------------------------

/**
 * Venta sin facturar (para el selector)
 */
export interface UninvoicedSale {
  id: string
  organization_id: string
  branch_id: string
  cash_register_id: string
  total: number
  payment_method: string
  created_at: string
  notes: string | null
  item_count: number
  items_preview: SaleItemPreview[] | null
}

/**
 * Preview de item de venta
 */
export interface SaleItemPreview {
  product_name: string
  quantity: number
  unit_price: number
}

// ----------------------------------------------------------------------------
// RESULTADOS DE ACTIONS
// ----------------------------------------------------------------------------

/**
 * Resultado de obtener ventas sin facturar
 */
export interface GetUninvoicedSalesResult {
  success: boolean
  sales: UninvoicedSale[]
  error?: string
}

/**
 * Resultado de crear borrador de factura
 */
export interface CreateInvoiceDraftResult {
  success: boolean
  invoice?: Invoice
  preview?: InvoicePreview
  error?: string
}

/**
 * Resultado de emitir factura
 */
export interface IssueInvoiceResult {
  success: boolean
  invoice?: Invoice
  cae?: string
  cae_expiry?: string
  error?: string
}

/**
 * Resultado de obtener facturas
 */
export interface GetInvoicesResult {
  success: boolean
  invoices: InvoiceWithSales[]
  error?: string
}

/**
 * Factura con ventas incluidas
 */
export interface InvoiceWithSales extends Invoice {
  sales: {
    id: string
    total: number
    created_at: string
  }[]
}

/**
 * Resultado de anular factura
 */
export interface CancelInvoiceResult {
  success: boolean
  error?: string
}

/**
 * Resultado de obtener configuración fiscal
 */
export interface GetFiscalConfigResult {
  success: boolean
  config: FiscalConfig | null
  error?: string
}

/**
 * Resultado de guardar configuración fiscal
 */
export interface SaveFiscalConfigResult {
  success: boolean
  error?: string
}

// ----------------------------------------------------------------------------
// ARCA SERVICE
// ----------------------------------------------------------------------------

/**
 * Datos para solicitar CAE
 */
export interface CAERequest {
  invoice_type: InvoiceType
  point_of_sale: number
  invoice_number: number
  date: string
  customer_cuit?: string
  customer_tax_status: CustomerTaxStatus
  items: {
    description: string
    quantity: number
    unit_price: number
    subtotal: number
  }[]
  subtotal: number
  tax_amount: number
  total: number
}

/**
 * Respuesta de ARCA (o mock)
 */
export interface CAEResponse {
  success: boolean
  cae?: string
  cae_expiry?: string
  error?: string
  observations?: string[]
}

// ----------------------------------------------------------------------------
// FILTROS Y PAGINACIÓN
// ----------------------------------------------------------------------------

/**
 * Filtros para obtener ventas sin facturar
 */
export interface UninvoicedSalesFilters {
  branch_id: string
  date_from?: string
  date_to?: string
  payment_method?: string
  min_amount?: number
  max_amount?: number
}

/**
 * Filtros para obtener facturas
 */
export interface InvoicesFilters {
  branch_id?: string
  status?: InvoiceStatus
  invoice_type?: InvoiceType
  date_from?: string
  date_to?: string
  customer_cuit?: string
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

/**
 * Formatea CUIT para mostrar (XX-XXXXXXXX-X)
 */
export function formatCuit(cuit: string): string {
  const clean = cuit.replace(/\D/g, '')
  if (clean.length !== 11) return cuit
  return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`
}

/**
 * Valida formato de CUIT
 */
export function isValidCuit(cuit: string): boolean {
  const clean = cuit.replace(/\D/g, '')
  if (clean.length !== 11) return false

  // Verificación de dígito verificador (módulo 11)
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean[i]) * mult[i]
  }
  const mod = sum % 11
  const verifier = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod
  return verifier === parseInt(clean[10])
}

/**
 * Determina tipo de factura según condición del emisor y receptor
 */
export function determineInvoiceType(
  emisorTaxStatus: 'RI' | 'MONO',
  receptorTaxStatus: CustomerTaxStatus
): InvoiceType {
  if (emisorTaxStatus === 'MONO') {
    return 'C' // Monotributista siempre emite C
  }

  // Responsable Inscripto
  switch (receptorTaxStatus) {
    case 'RI':
      return 'A' // RI a RI = Factura A
    case 'MONO':
    case 'CF':
    case 'EX':
    default:
      return 'B' // RI a otros = Factura B
  }
}

/**
 * Calcula IVA según tipo de factura
 */
export function calculateTax(
  subtotal: number,
  invoiceType: InvoiceType
): { taxRate: number; taxAmount: number; total: number } {
  // Factura A: IVA discriminado (21%)
  // Factura B/C: IVA incluido en precio (no se discrimina)
  if (invoiceType === 'A') {
    const taxRate = 0.21
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100
    return {
      taxRate,
      taxAmount,
      total: subtotal + taxAmount,
    }
  }

  // B y C: precio final ya incluye IVA
  return {
    taxRate: 0,
    taxAmount: 0,
    total: subtotal,
  }
}
