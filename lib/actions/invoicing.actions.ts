// @ts-nocheck — Tablas invoices/invoice_sales pendientes de agregar a database.types.ts
/**
 * ============================================================================
 * INVOICING SERVER ACTIONS
 * ============================================================================
 *
 * Server Actions para el sistema de facturación retroactiva y opcional.
 * Permite al dueño seleccionar ventas pasadas y agruparlas en facturas.
 *
 * FLUJO:
 * 1. getUninvoicedSalesAction() - Obtener ventas sin facturar
 * 2. createInvoiceDraftAction() - Crear borrador agrupando ventas
 * 3. issueInvoiceAction() - Emitir factura (obtener CAE)
 * 4. getInvoicesAction() - Ver historial de facturas
 *
 * MIGRADO: 2026-01-29 - Sistema de facturación retroactiva
 *
 * ============================================================================
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import { verifyAuth, verifyOwner } from '@/lib/actions/auth-helpers'
import { arcaService } from '@/lib/services/arca.service'

// ============================================================================
// HELPERS DE SEGURIDAD
// ============================================================================

/**
 * Verifica si el usuario actual tiene rol de owner
 * Las operaciones de facturación son exclusivas del dueño
 */
async function verifyOwnerAccess(): Promise<{
  authorized: boolean
  error?: string
  supabase?: Awaited<ReturnType<typeof createClient>>
  orgId?: string
}> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { authorized: false, error: "No autenticado" }
  }

  // Verificar rol del usuario - solo owner puede facturar
  const { data: isOwner } = await supabase.rpc('is_owner')

  if (!isOwner) {
    return { authorized: false, error: "Solo el dueño puede gestionar facturación" }
  }

  const { data: orgId } = await supabase.rpc('get_my_org_id')
  if (!orgId) {
    return { authorized: false, error: "No se encontró organización" }
  }

  return { authorized: true, supabase, orgId }
}
import {
  type GetUninvoicedSalesResult,
  type CreateInvoiceDraftResult,
  type IssueInvoiceResult,
  type GetInvoicesResult,
  type CancelInvoiceResult,
  type GetFiscalConfigResult,
  type SaveFiscalConfigResult,
  type UninvoicedSalesFilters,
  type InvoicesFilters,
  type FiscalConfig,
  type CreateInvoiceData,
  type InvoiceType,
  type CustomerTaxStatus,
  calculateTax,
  determineInvoiceType,
} from '@/types/invoicing.types'
import { format, subDays } from 'date-fns'
import { resolveJoin } from '@/types/supabase-joins'

// ----------------------------------------------------------------------------
// CONFIGURACIÓN FISCAL
// ----------------------------------------------------------------------------

/**
 * Obtiene la configuración fiscal de la organización
 */
export async function getFiscalConfigAction(): Promise<GetFiscalConfigResult> {
  try {
    const { supabase, orgId } = await verifyOwner()

    const { data: org, error } = await supabase
      .from('organizations')
      .select('fiscal_config' as any)
      .eq('id', orgId)
      .single()

    if (error) {
      return { success: false, config: null, error: error.message }
    }

    return {
      success: true,
      config: (org as any)?.fiscal_config as FiscalConfig | null,
    }
  } catch (error) {
    return {
      success: false,
      config: null,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Guarda la configuración fiscal de la organización
 */
export async function saveFiscalConfigAction(
  config: FiscalConfig
): Promise<SaveFiscalConfigResult> {
  try {
    const { supabase, orgId } = await verifyOwner()

    const { error } = await supabase
      .from('organizations')
      .update({ fiscal_config: config } as any)
      .eq('id', orgId)

    if (error) {
      return { success: false, error: error.message }
    }

    // Configurar el servicio ARCA
    arcaService.configure({
      cuit: config.cuit,
      environment: config.arca_environment,
    })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ----------------------------------------------------------------------------
// VENTAS SIN FACTURAR
// ----------------------------------------------------------------------------

/**
 * Obtiene ventas que no han sido facturadas
 * Para mostrar en el selector del dueño
 */
export async function getUninvoicedSalesAction(
  filters: UninvoicedSalesFilters
): Promise<GetUninvoicedSalesResult> {
  try {
    // Verificar que el usuario es owner
    const access = await verifyOwnerAccess()
    if (!access.authorized || !access.supabase || !access.orgId) {
      return { success: false, sales: [], error: access.error || 'Sin permisos' }
    }
    const supabase = access.supabase
    const orgId = access.orgId

    // Fechas por defecto: últimos 30 días
    const dateFrom = filters.date_from || format(subDays(new Date(), 30), 'yyyy-MM-dd')
    const dateTo = filters.date_to || format(new Date(), 'yyyy-MM-dd')

    // Query base: ventas que NO están en invoice_sales
    let query = supabase
      .from('sales')
      .select(`
        id,
        organization_id,
        branch_id,
        cash_register_id,
        total,
        payment_method,
        created_at,
        notes,
        sale_items(
          quantity,
          unit_price,
          products(name)
        )
      `)
      .eq('organization_id', orgId)
      .eq('branch_id', filters.branch_id)
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`)
      .order('created_at', { ascending: false })

    // Filtros opcionales
    if (filters.payment_method) {
      query = query.eq('payment_method', filters.payment_method)
    }
    if (filters.min_amount) {
      query = query.gte('total', filters.min_amount)
    }
    if (filters.max_amount) {
      query = query.lte('total', filters.max_amount)
    }

    const { data: allSales, error: salesError } = await query

    if (salesError) {
      return { success: false, sales: [], error: salesError.message }
    }

    // Obtener IDs de ventas ya facturadas
    const { data: invoicedSales } = await supabase
      .from('invoice_sales' as any)
      .select('sale_id')

    const invoicedIds = new Set(((invoicedSales || []) as any[]).map(s => s.sale_id))

    // Filtrar ventas no facturadas y mapear al tipo esperado
    const uninvoicedSales = (allSales || [])
      .filter(s => !invoicedIds.has(s.id))
      .map(s => {
        const saleItems = s.sale_items

        return {
          id: s.id,
          organization_id: s.organization_id,
          branch_id: s.branch_id,
          cash_register_id: s.cash_register_id,
          total: Number(s.total),
          payment_method: s.payment_method || 'cash',
          created_at: s.created_at,
          notes: s.notes,
          item_count: saleItems?.length || 0,
          items_preview: saleItems?.map(item => ({
            product_name: resolveJoin<{ name: string }>(item.products)?.name || 'Producto',
            quantity: item.quantity,
            unit_price: Number(item.unit_price),
          })) || null,
        }
      })

    return { success: true, sales: uninvoicedSales }
  } catch (error) {
    return {
      success: false,
      sales: [],
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ----------------------------------------------------------------------------
// CREAR Y EMITIR FACTURAS
// ----------------------------------------------------------------------------

/**
 * Crea un borrador de factura agrupando ventas seleccionadas
 */
export async function createInvoiceDraftAction(
  data: CreateInvoiceData
): Promise<CreateInvoiceDraftResult> {
  try {
    // Validaciones
    if (!data.sale_ids || data.sale_ids.length === 0) {
      return { success: false, error: 'Debe seleccionar al menos una venta' }
    }

    // Verificar que el usuario es owner
    const access = await verifyOwnerAccess()
    if (!access.authorized || !access.supabase || !access.orgId) {
      return { success: false, error: access.error || 'Sin permisos' }
    }
    const supabase = access.supabase
    const orgId = access.orgId

    // Obtener configuración fiscal
    const { data: org } = await supabase
      .from('organizations')
      .select('fiscal_config' as any)
      .eq('id', orgId)
      .single()

    const fiscalConfig = (org as any)?.fiscal_config as FiscalConfig | null
    if (!fiscalConfig?.enabled) {
      return { success: false, error: 'La facturación no está configurada' }
    }

    // Verificar que las ventas no estén ya facturadas
    const { data: existingInvoices } = await supabase
      .from('invoice_sales' as any)
      .select('sale_id')
      .in('sale_id', data.sale_ids)

    if (existingInvoices && (existingInvoices as any[]).length > 0) {
      return { success: false, error: 'Algunas ventas ya están facturadas' }
    }

    // Obtener totales de las ventas
    const { data: sales } = await supabase
      .from('sales')
      .select('id, total')
      .in('id', data.sale_ids)

    if (!sales || sales.length === 0) {
      return { success: false, error: 'No se encontraron las ventas seleccionadas' }
    }

    const subtotal = sales.reduce((sum, s) => sum + Number(s.total), 0)

    // Determinar tipo de factura
    const customerTaxStatus: CustomerTaxStatus = data.customer_tax_status || 'CF'
    const invoiceType = data.invoice_type || determineInvoiceType(
      fiscalConfig.tax_status,
      customerTaxStatus
    )

    // Calcular impuestos
    const { taxAmount, total } = calculateTax(subtotal, invoiceType)

    // Obtener siguiente número de factura
    const { data: nextNumber } = await supabase.rpc('get_next_invoice_number', {
      p_org_id: orgId,
      p_point_of_sale: fiscalConfig.point_of_sale,
      p_invoice_type: invoiceType,
    })

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()

    // Crear borrador de factura
    const { data: invoice, error: insertError } = await supabase
      .from('invoices' as any)
      .insert({
        organization_id: orgId,
        branch_id: data.branch_id,
        invoice_type: invoiceType,
        invoice_number: nextNumber || 1,
        point_of_sale: fiscalConfig.point_of_sale,
        customer_cuit: data.customer_cuit || null,
        customer_name: data.customer_name || null,
        customer_tax_status: customerTaxStatus,
        customer_address: data.customer_address || null,
        subtotal,
        tax_amount: taxAmount,
        total,
        status: 'draft',
        is_mock: arcaService.isMock(),
        created_by: user?.id || null,
      })
      .select()
      .single()

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    // Vincular ventas a la factura
    const invoiceSales = data.sale_ids.map(saleId => ({
      invoice_id: invoice.id,
      sale_id: saleId,
    }))

    const { error: linkError } = await supabase
      .from('invoice_sales' as any)
      .insert(invoiceSales)

    if (linkError) {
      // Rollback: eliminar factura si falla el link
      await supabase.from('invoices' as any).delete().eq('id', invoice.id)
      return { success: false, error: linkError.message }
    }

    return {
      success: true,
      invoice: {
        ...invoice,
        subtotal: Number(invoice.subtotal),
        tax_amount: Number(invoice.tax_amount),
        total: Number(invoice.total),
      },
      preview: {
        invoice_type: invoiceType,
        subtotal,
        tax_rate: invoiceType === 'A' ? 0.21 : 0,
        tax_amount: taxAmount,
        total,
        sales_count: data.sale_ids.length,
        items_count: 0, // Se puede calcular si se necesita
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Emite una factura (obtiene CAE de ARCA)
 */
export async function issueInvoiceAction(
  invoiceId: string
): Promise<IssueInvoiceResult> {
  try {
    // Verificar que el usuario es owner
    const access = await verifyOwnerAccess()
    if (!access.authorized || !access.supabase) {
      return { success: false, error: access.error || 'Sin permisos' }
    }
    const supabase = access.supabase

    // Obtener factura
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices' as any)
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (fetchError || !invoice) {
      return { success: false, error: 'Factura no encontrada' }
    }

    if (invoice.status !== 'draft') {
      return { success: false, error: 'La factura ya fue emitida o anulada' }
    }

    // Obtener configuración fiscal
    const { data: org } = await supabase
      .from('organizations')
      .select('fiscal_config' as any)
      .eq('id', invoice.organization_id)
      .single()

    const fiscalConfig = (org as any)?.fiscal_config as FiscalConfig | null
    if (!fiscalConfig) {
      return { success: false, error: 'Configuración fiscal no encontrada' }
    }

    // Configurar servicio ARCA
    arcaService.configure({
      cuit: fiscalConfig.cuit,
      environment: fiscalConfig.arca_environment,
    })

    // Obtener items de las ventas vinculadas
    const { data: invoiceSales } = await supabase
      .from('invoice_sales' as any)
      .select('sale_id')
      .eq('invoice_id', invoiceId)

    const saleIds = ((invoiceSales || []) as any[]).map(s => s.sale_id)

    const { data: saleItems } = await supabase
      .from('sale_items')
      .select(`
        quantity,
        unit_price,
        subtotal,
        products(name)
      `)
      .in('sale_id', saleIds)

    // Preparar items para ARCA
    const items = (saleItems || []).map(item => {
      const product = resolveJoin<{ name: string }>(item.products)
      return {
        description: product?.name || 'Producto',
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        subtotal: Number(item.subtotal),
      }
    })

    // Solicitar CAE
    const caeResponse = await arcaService.requestCAE({
      invoice_type: invoice.invoice_type as InvoiceType,
      point_of_sale: invoice.point_of_sale,
      invoice_number: invoice.invoice_number,
      date: format(new Date(), 'yyyy-MM-dd'),
      customer_cuit: invoice.customer_cuit || undefined,
      customer_tax_status: (invoice.customer_tax_status as CustomerTaxStatus) || 'CF',
      items,
      subtotal: Number(invoice.subtotal),
      tax_amount: Number(invoice.tax_amount),
      total: Number(invoice.total),
    })

    if (!caeResponse.success || !caeResponse.cae) {
      return { success: false, error: caeResponse.error || 'Error al obtener CAE' }
    }

    // Actualizar factura con CAE
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices' as any)
      .update({
        cae: caeResponse.cae,
        cae_expiry: caeResponse.cae_expiry,
        status: 'issued',
        issued_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .select()
      .single()

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return {
      success: true,
      invoice: {
        ...updatedInvoice,
        subtotal: Number(updatedInvoice.subtotal),
        tax_amount: Number(updatedInvoice.tax_amount),
        total: Number(updatedInvoice.total),
      },
      cae: caeResponse.cae,
      cae_expiry: caeResponse.cae_expiry,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ----------------------------------------------------------------------------
// CONSULTAR FACTURAS
// ----------------------------------------------------------------------------

/**
 * Obtiene facturas emitidas con filtros
 */
export async function getInvoicesAction(
  filters: InvoicesFilters
): Promise<GetInvoicesResult> {
  try {
    const { supabase, orgId } = await verifyAuth()

    let query = supabase
      .from('invoices' as any)
      .select(`
        *,
        invoice_sales(
          sale_id,
          sales(id, total, created_at)
        )
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    // Aplicar filtros
    if (filters.branch_id) {
      query = query.eq('branch_id', filters.branch_id)
    }
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.invoice_type) {
      query = query.eq('invoice_type', filters.invoice_type)
    }
    if (filters.date_from) {
      query = query.gte('created_at', `${filters.date_from}T00:00:00`)
    }
    if (filters.date_to) {
      query = query.lte('created_at', `${filters.date_to}T23:59:59`)
    }
    if (filters.customer_cuit) {
      query = query.eq('customer_cuit', filters.customer_cuit)
    }

    const { data, error } = await query

    if (error) {
      return { success: false, invoices: [], error: error.message }
    }

    // Mapear al formato esperado
    const invoices = (data || []).map((inv: any) => ({
      ...inv,
      subtotal: Number(inv.subtotal),
      tax_amount: Number(inv.tax_amount),
      total: Number(inv.total),
      sales: (inv.invoice_sales as { sales: { id: string; total: number; created_at: string } }[])?.map((is: any) => ({
        id: is.sales.id,
        total: Number(is.sales.total),
        created_at: is.sales.created_at,
      })) || [],
    }))

    return { success: true, invoices }
  } catch (error) {
    return {
      success: false,
      invoices: [],
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Obtiene una factura por ID con todos sus detalles
 */
export async function getInvoiceDetailAction(invoiceId: string): Promise<{
  success: boolean
  invoice?: {
    id: string
    invoice_type: string
    invoice_number: number
    point_of_sale: number
    customer_name: string | null
    customer_cuit: string | null
    subtotal: number
    tax_amount: number
    total: number
    cae: string | null
    cae_expiry: string | null
    status: string
    issued_at: string | null
    created_at: string
    items: {
      product_name: string
      quantity: number
      unit_price: number
      subtotal: number
    }[]
  }
  error?: string
}> {
  try {
    const { supabase, orgId } = await verifyAuth()

    // Obtener factura
    const { data: invoice, error: invError } = await supabase
      .from('invoices' as any)
      .select('*')
      .eq('id', invoiceId)
      .eq('organization_id', orgId)
      .single()

    if (invError || !invoice) {
      return { success: false, error: 'Factura no encontrada' }
    }

    // Obtener items de las ventas vinculadas
    const { data: invoiceSales } = await supabase
      .from('invoice_sales' as any)
      .select('sale_id')
      .eq('invoice_id', invoiceId)

    const saleIds = ((invoiceSales || []) as any[]).map(s => s.sale_id)

    const { data: saleItems } = await supabase
      .from('sale_items')
      .select(`
        quantity,
        unit_price,
        subtotal,
        products(name)
      `)
      .in('sale_id', saleIds)

    const items = (saleItems || []).map(item => {
      const product = resolveJoin<{ name: string }>(item.products)
      return {
        product_name: product?.name || 'Producto',
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        subtotal: Number(item.subtotal),
      }
    })

    return {
      success: true,
      invoice: {
        id: invoice.id,
        invoice_type: invoice.invoice_type,
        invoice_number: invoice.invoice_number,
        point_of_sale: invoice.point_of_sale,
        customer_name: invoice.customer_name,
        customer_cuit: invoice.customer_cuit,
        subtotal: Number(invoice.subtotal),
        tax_amount: Number(invoice.tax_amount),
        total: Number(invoice.total),
        cae: invoice.cae,
        cae_expiry: invoice.cae_expiry,
        status: invoice.status,
        issued_at: invoice.issued_at,
        created_at: invoice.created_at,
        items,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ----------------------------------------------------------------------------
// ANULAR FACTURA
// ----------------------------------------------------------------------------

/**
 * Anula una factura emitida
 * Nota: En producción real, esto debería generar una nota de crédito en ARCA
 */
export async function cancelInvoiceAction(
  invoiceId: string,
  reason: string
): Promise<CancelInvoiceResult> {
  try {
    // Verificar que el usuario es owner
    const access = await verifyOwnerAccess()
    if (!access.authorized || !access.supabase) {
      return { success: false, error: access.error || 'Sin permisos' }
    }
    const supabase = access.supabase

    // Verificar que la factura existe y está emitida
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices' as any)
      .select('status')
      .eq('id', invoiceId)
      .single()

    if (fetchError || !invoice) {
      return { success: false, error: 'Factura no encontrada' }
    }

    if (invoice.status === 'cancelled') {
      return { success: false, error: 'La factura ya está anulada' }
    }

    if (invoice.status !== 'issued') {
      // Si es borrador, simplemente eliminar
      await supabase.from('invoice_sales' as any).delete().eq('invoice_id', invoiceId)
      await supabase.from('invoices' as any).delete().eq('id', invoiceId)
      return { success: true }
    }

    // Si está emitida, marcar como anulada (no eliminar por auditoría)
    const { error: updateError } = await supabase
      .from('invoices' as any)
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq('id', invoiceId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Liberar las ventas para que puedan facturarse de nuevo
    await supabase
      .from('invoice_sales' as any)
      .delete()
      .eq('invoice_id', invoiceId)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
