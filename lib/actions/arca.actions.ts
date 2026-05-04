/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🧾 ARCA (ex-AFIP) SERVER ACTIONS — Facturacion Electronica
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para facturación electrónica ARCA.
 * OPCIONAL por organización — el dueño activa/desactiva en Ajustes.
 *
 * FLUJO:
 * 1. Dueño configura CUIT + certificado en Ajustes
 * 2. Dueño activa facturación
 * 3. Empleado completa venta → se genera factura automáticamente
 * 4. ARCA devuelve CAE → se guarda en arca_invoices
 *
 * TIPOS DE FACTURA:
 * - Monotributista → Factura C (CbteTipo=11)
 * - Responsable Inscripto → Factura A (1) o B (6)
 * - Exento → Factura C (11)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { verifyAuth, verifyOwner } from '@/lib/actions/auth-helpers'
import { logger } from '@/lib/logging'
import { requestCAEFromInvoiceData, CBTE_TIPO_MAP } from '@/lib/services/arca-cae'
import { generateInvoicePDF } from '@/lib/services/invoice-pdf'
import { randomBytes, createCipheriv, createDecipheriv, X509Certificate } from 'crypto'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

export interface ArcaConfig {
  cuit: string
  razonSocial: string
  puntoVenta: number
  tipoContribuyente: 'responsable_inscripto' | 'monotributista' | 'exento'
  tipoFacturaDefault: 'A' | 'B' | 'C'
  condicionIva: string
  domicilioFiscal: string | null
  isActive: boolean
  isSandbox: boolean
  hasCert: boolean
}

export interface ArcaInvoice {
  id: string
  saleId: string | null
  cae: string | null
  caeVencimiento: string | null
  cbteTipo: number
  cbteNumero: number | null
  puntoVenta: number
  impTotal: number
  impNeto: number
  impIva: number
  status: 'pending' | 'authorized' | 'rejected' | 'cancelled' | 'error'
  errorMessage: string | null
  fechaEmision: string
  receptorNombre: string | null
  receptorCuit: string | null
  createdAt: string
}

export interface GetArcaConfigResult {
  success: boolean
  config?: ArcaConfig
  isConfigured?: boolean
  error?: string
}

export interface SaveArcaConfigResult {
  success: boolean
  error?: string
}

export interface ToggleArcaResult {
  success: boolean
  error?: string
}

export interface SetArcaSandboxResult {
  success: boolean
  error?: string
}

export interface CreateInvoiceResult {
  success: boolean
  /** ARCA no estaba activo para la org → no se intentó facturar (no es error) */
  skipped?: boolean
  /** La venta ya tenía factura authorized → se devolvió la existente sin llamar a AFIP */
  alreadyInvoiced?: boolean
  cae?: string
  caeVencimiento?: string
  cbteNumero?: number
  invoiceId?: string
  error?: string
}

export interface DisconnectArcaResult {
  success: boolean
  error?: string
}

export interface GenerateInvoicePDFResult {
  success: boolean
  /** PDF como base64 (sin prefijo data:) — el cliente lo convierte a Blob */
  pdfBase64?: string
  /** Sugerencia de nombre de archivo, ej: Factura-C-0001-00000002.pdf */
  filename?: string
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

const FACTURA_DEFAULT_MAP: Record<string, string> = {
  monotributista: 'C',
  responsable_inscripto: 'B',
  exento: 'C',
}

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Obtener configuración ARCA de la organización
 */
export async function getArcaConfigAction(): Promise<GetArcaConfigResult> {
  try {
    const { supabase, orgId } = await verifyAuth()

    const { data: config, error } = await supabase
      .from('arca_config')
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle()

    if (error) {
      logger.error('getArcaConfigAction', 'Error consultando config', error)
      return { success: false, error: 'Error consultando configuración' }
    }

    if (!config) {
      return { success: true, isConfigured: false }
    }

    return {
      success: true,
      isConfigured: true,
      config: {
        cuit: maskCuit(config.cuit),
        razonSocial: config.razon_social,
        puntoVenta: config.punto_venta,
        tipoContribuyente: config.tipo_contribuyente,
        tipoFacturaDefault: config.tipo_factura_default,
        condicionIva: config.condicion_iva,
        domicilioFiscal: config.domicilio_fiscal,
        isActive: config.is_active || false,
        isSandbox: config.is_sandbox || false,
        hasCert: !!(config.cert_encrypted && config.key_encrypted),
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
 * Guardar o actualizar configuración ARCA
 */
export async function saveArcaConfigAction(data: {
  cuit: string
  razonSocial: string
  puntoVenta: number
  tipoContribuyente: string
  condicionIva: string
  domicilioFiscal?: string
  isSandbox?: boolean
}): Promise<SaveArcaConfigResult> {
  try {
    const { supabase, orgId, user } = await verifyOwner()

    const cuitClean = data.cuit.replace(/[-\s]/g, '')
    if (!/^\d{11}$/.test(cuitClean)) {
      return { success: false, error: 'El CUIT debe tener 11 dígitos' }
    }

    if (!data.razonSocial || data.razonSocial.trim().length < 2) {
      return { success: false, error: 'La razón social es requerida' }
    }

    if (!data.puntoVenta || data.puntoVenta < 1 || data.puntoVenta > 99999) {
      return { success: false, error: 'El punto de venta debe ser entre 1 y 99999' }
    }

    const tipoFacturaDefault = FACTURA_DEFAULT_MAP[data.tipoContribuyente] || 'C'

    logger.info('saveArcaConfigAction', 'Guardando config ARCA', {
      orgId,
      userId: user.id,
    })

    const { error } = await supabase
      .from('arca_config')
      .upsert(
        {
          organization_id: orgId,
          cuit: cuitClean,
          razon_social: data.razonSocial.trim(),
          punto_venta: data.puntoVenta,
          tipo_contribuyente: data.tipoContribuyente,
          tipo_factura_default: tipoFacturaDefault,
          condicion_iva: data.condicionIva,
          domicilio_fiscal: data.domicilioFiscal?.trim() || null,
          is_sandbox: data.isSandbox ?? true,
        },
        { onConflict: 'organization_id' }
      )
      .select('id')
      .single()

    if (error) {
      logger.error('saveArcaConfigAction', 'Error guardando config', error)
      return { success: false, error: 'No se pudo guardar la configuración' }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Subir certificado digital (encriptado)
 */
export async function uploadArcaCertificateAction(
  certPem: string,
  keyPem: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, orgId, user } = await verifyOwner()

    if (!certPem.includes('-----BEGIN') || !keyPem.includes('-----BEGIN')) {
      return { success: false, error: 'El certificado y la clave deben estar en formato PEM' }
    }

    const { data: existing } = await supabase
      .from('arca_config')
      .select('id')
      .eq('organization_id', orgId)
      .maybeSingle()

    if (!existing) {
      return { success: false, error: 'Primero guardá los datos fiscales' }
    }

    const encryptedCert = encrypt(certPem)
    const encryptedKey = encrypt(keyPem)

    logger.info('uploadArcaCertificateAction', 'Subiendo certificado ARCA', {
      orgId,
      userId: user.id,
    })

    const { error } = await supabase
      .from('arca_config')
      .update({ cert_encrypted: encryptedCert, key_encrypted: encryptedKey })
      .eq('organization_id', orgId)

    if (error) {
      logger.error('uploadArcaCertificateAction', 'Error guardando certificado', error)
      return { success: false, error: 'No se pudo guardar el certificado' }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Activar o desactivar facturación ARCA
 */
export async function toggleArcaActiveAction(active: boolean): Promise<ToggleArcaResult> {
  try {
    const { supabase, orgId, user } = await verifyOwner()

    if (active) {
      const { data: config } = await supabase
        .from('arca_config')
        .select('cuit, cert_encrypted, key_encrypted')
        .eq('organization_id', orgId)
        .maybeSingle()

      if (!config) {
        return { success: false, error: 'Primero configurá los datos fiscales' }
      }
      if (!config.cert_encrypted || !config.key_encrypted) {
        return { success: false, error: 'Necesitás subir el certificado digital antes de activar' }
      }
    }

    logger.info('toggleArcaActiveAction', `${active ? 'Activando' : 'Desactivando'} ARCA`, {
      orgId,
      userId: user.id,
    })

    const { error } = await supabase
      .from('arca_config')
      .update({ is_active: active })
      .eq('organization_id', orgId)

    if (error) {
      return { success: false, error: 'No se pudo actualizar el estado' }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Cambiar entre modo sandbox y producción.
 * Sandbox = pruebas contra wswhomo (los CAE no cuentan ante ARCA real).
 * Producción = wsfev1 real (los CAE son fiscales y cuentan en tu monotributo).
 */
export async function setArcaSandboxModeAction(
  isSandbox: boolean
): Promise<SetArcaSandboxResult> {
  try {
    const { supabase, orgId, user } = await verifyOwner()

    const { data: config } = await supabase
      .from('arca_config')
      .select('cert_encrypted, key_encrypted, is_active')
      .eq('organization_id', orgId)
      .maybeSingle()

    if (!config) {
      return { success: false, error: 'Primero configurá los datos fiscales' }
    }

    if (!isSandbox && (!config.cert_encrypted || !config.key_encrypted)) {
      return {
        success: false,
        error: 'Necesitás subir el certificado digital antes de pasar a producción',
      }
    }

    // ─── Guardrail: no permitir activar producción con cert de homologación ───
    // Bug del 3-may-2026: el toggle pasó a producción con un cert de homologación
    // cargado, WSAA producción respondió `cms.cert.untrusted` y la facturación
    // quedó rota silenciosamente (la venta se grababa, la factura fallaba).
    // Acá inspeccionamos el issuer del cert antes de actualizar.
    if (!isSandbox) {
      try {
        const certPem = decrypt(config.cert_encrypted!)
        const { isHomo, issuerCN } = isCertHomologation(certPem)
        if (isHomo) {
          logger.info(
            'setArcaSandboxModeAction',
            'Bloqueando paso a producción: cert es de homologación',
            { orgId, userId: user.id, issuerCN }
          )
          return {
            success: false,
            error:
              'El certificado cargado es de homologación (testing). Para activar producción necesitás generar un nuevo certificado en el portal de AFIP en modo PRODUCCIÓN y subirlo en Ajustes.',
          }
        }
      } catch (err) {
        logger.error(
          'setArcaSandboxModeAction',
          'Error inspeccionando issuer del cert',
          err instanceof Error ? err : new Error(String(err))
        )
        // No bloqueamos por error de inspección — dejamos que falle después con
        // mensaje más claro de WSAA si efectivamente el cert es inválido.
      }
    }

    logger.info('setArcaSandboxModeAction', `Cambiando a modo ${isSandbox ? 'sandbox' : 'producción'}`, {
      orgId,
      userId: user.id,
    })

    const { error } = await supabase
      .from('arca_config')
      .update({ is_sandbox: isSandbox })
      .eq('organization_id', orgId)

    if (error) {
      logger.error('setArcaSandboxModeAction', 'Error actualizando is_sandbox', error)
      return { success: false, error: 'No se pudo actualizar el modo' }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Crear factura electrónica para una venta
 * Si ARCA no está activo → retorna skipped=true (no es error)
 */
export async function createInvoiceAction(
  saleId: string,
  options?: {
    tipoFactura?: 'A' | 'B' | 'C'
    docTipo?: number
    docNro?: string
    receptorNombre?: string
    receptorCuit?: string
  }
): Promise<CreateInvoiceResult> {
  try {
    const { supabase, orgId } = await verifyAuth()

    const { data: arcaConfig } = await supabase
      .from('arca_config')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .maybeSingle()

    if (!arcaConfig) {
      return { success: true, skipped: true }
    }

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('id, total, created_at')
      .eq('id', saleId)
      .single()

    if (saleError || !sale) {
      return { success: false, error: 'Venta no encontrada' }
    }

    const total = Number(sale.total)
    if (total <= 0) {
      return { success: false, error: 'El monto debe ser mayor a cero' }
    }

    // ─── Idempotencia ───
    // Si esta venta ya tiene factura autorizada, devolver la existente.
    // No llamamos a AFIP ni desencriptamos credenciales — una venta = una factura.
    // Para corregir, hay que emitir nota de crédito (feature futura).
    const { data: existingInvoice } = await supabase
      .from('arca_invoices')
      .select('id, cae, cae_vencimiento, cbte_numero')
      .eq('sale_id', saleId)
      .eq('status', 'authorized')
      .maybeSingle()

    if (existingInvoice && existingInvoice.cae) {
      return {
        success: true,
        alreadyInvoiced: true,
        cae: existingInvoice.cae,
        caeVencimiento: existingInvoice.cae_vencimiento ?? '',
        cbteNumero: Number(existingInvoice.cbte_numero ?? 0),
        invoiceId: existingInvoice.id,
      }
    }

    const tipoFactura = options?.tipoFactura || arcaConfig.tipo_factura_default || 'C'
    const cbteTipo = CBTE_TIPO_MAP[tipoFactura as 'A' | 'B' | 'C'] || 11
    const docTipo = options?.docTipo || 99
    const docNro = options?.docNro || '0'

    // Calcular importes
    let impNeto = total
    let impIva = 0
    const impTotal = total
    let ivaDetalle: Array<{ Id: number; BaseImp: number; Importe: number }> | null = null

    if (tipoFactura === 'A' || tipoFactura === 'B') {
      impNeto = Math.round((total / 1.21) * 100) / 100
      impIva = Math.round((total - impNeto) * 100) / 100
      ivaDetalle = [{ Id: 5, BaseImp: impNeto, Importe: impIva }]
    }

    const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '')

    // Desencriptar certificado
    let certPem: string
    let keyPem: string
    try {
      certPem = decrypt(arcaConfig.cert_encrypted)
      keyPem = decrypt(arcaConfig.key_encrypted)
    } catch {
      return { success: false, error: 'Error desencriptando certificado' }
    }

    // Llamar a ARCA via la capa pura compartida (lib/services/arca-cae.ts)
    const caeResult = await requestCAEFromInvoiceData({
      cuit: arcaConfig.cuit,
      certPem,
      keyPem,
      isSandbox: arcaConfig.is_sandbox,
      puntoVenta: arcaConfig.punto_venta,
      cbteTipo,
      docTipo,
      docNro,
      fechaYYYYMMDD: fecha,
      impTotal,
      impNeto,
      impIva,
      ivaDetalle: ivaDetalle ?? undefined,
    })

    if (!caeResult.success || !caeResult.cae) {
      const errMsg = caeResult.error || 'Error desconocido al solicitar CAE'
      logger.error('createInvoiceAction', 'Error ARCA', new Error(errMsg))

      await supabase.from('arca_invoices').insert({
        organization_id: orgId,
        sale_id: saleId,
        cbte_tipo: cbteTipo,
        punto_venta: arcaConfig.punto_venta,
        concepto: 1,
        doc_tipo: docTipo,
        doc_nro: docNro,
        imp_total: impTotal,
        imp_neto: impNeto,
        imp_iva: impIva,
        status: 'error',
        error_message: errMsg.substring(0, 500),
        fecha_emision: new Date().toISOString().split('T')[0],
      })

      return { success: false, error: `Error de ARCA: ${errMsg}` }
    }

    const cae = caeResult.cae
    const caeVencimiento = caeResult.caeVencimiento ?? ''
    const cbteNumero = caeResult.cbteNumero ?? 0

    const { data: invoice, error: insertError } = await supabase
      .from('arca_invoices')
      .insert({
        organization_id: orgId,
        sale_id: saleId,
        cae,
        cae_vencimiento: caeVencimiento,
        cbte_tipo: cbteTipo,
        cbte_numero: cbteNumero,
        punto_venta: arcaConfig.punto_venta,
        concepto: 1,
        doc_tipo: docTipo,
        doc_nro: docNro,
        imp_total: impTotal,
        imp_neto: impNeto,
        imp_iva: impIva,
        iva_detalle: ivaDetalle,
        receptor_nombre: options?.receptorNombre || null,
        receptor_cuit: options?.receptorCuit || null,
        status: 'authorized',
        fecha_emision: new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single()

    if (insertError) {
      // Posible race con UNIQUE INDEX (arca_invoices_sale_authorized_unique):
      // otra request acaba de guardar la misma factura. Loggeamos pero
      // devolvemos success — AFIP ya emitió el CAE y el cliente lo recibe.
      logger.warn(
        'createInvoiceAction',
        'INSERT falló post-CAE (probable race con UNIQUE)',
        { saleId, cae, insertError }
      )
      return { success: true, cae, caeVencimiento, cbteNumero }
    }

    return { success: true, cae, caeVencimiento, cbteNumero, invoiceId: invoice.id }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Desconectar ARCA (eliminar configuración)
 */
export async function disconnectArcaAction(): Promise<DisconnectArcaResult> {
  try {
    const { supabase, orgId, user } = await verifyOwner()

    logger.info('disconnectArcaAction', 'Desconectando ARCA', { orgId, userId: user.id })

    const { error } = await supabase
      .from('arca_config')
      .delete()
      .eq('organization_id', orgId)

    if (error) {
      return { success: false, error: 'No se pudo eliminar la configuración' }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Generar PDF fiscal de una factura ARCA (per-venta automática).
 *
 * Lee la factura de `arca_invoices` por ID, valida ownership y estado,
 * trae los datos del emisor (`arca_config`) y los items de la venta
 * (`sale_items` + `products`), y genera el PDF con QR ARCA via la capa
 * pura `lib/services/invoice-pdf.ts`.
 *
 * Devuelve el PDF como base64 — el cliente lo convierte a Blob y lo descarga.
 *
 * Validaciones:
 * - Factura existe y pertenece a la org del usuario.
 * - Status='authorized' (no se generan PDFs de errores ni pendientes).
 * - CAE no es null.
 */
export async function generateArcaInvoicePDFAction(
  arcaInvoiceId: string
): Promise<GenerateInvoicePDFResult> {
  try {
    const { supabase, orgId } = await verifyAuth()

    // 1. Leer la factura ARCA con validación de ownership (RLS + check explícito)
    const { data: invoice, error: invoiceError } = await supabase
      .from('arca_invoices')
      .select('*')
      .eq('id', arcaInvoiceId)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (invoiceError) {
      logger.error('generateArcaInvoicePDFAction', 'Error leyendo factura', invoiceError)
      return { success: false, error: 'Error consultando la factura' }
    }
    if (!invoice) {
      return { success: false, error: 'Factura no encontrada' }
    }
    if (invoice.status !== 'authorized') {
      return {
        success: false,
        error: 'Solo se pueden descargar facturas autorizadas (con CAE válido)',
      }
    }
    if (!invoice.cae) {
      return { success: false, error: 'La factura no tiene CAE' }
    }

    // 2. Leer datos del emisor (arca_config)
    const { data: config, error: configError } = await supabase
      .from('arca_config')
      .select('cuit, razon_social, condicion_iva, domicilio_fiscal, punto_venta')
      .eq('organization_id', orgId)
      .maybeSingle()

    if (configError || !config) {
      return { success: false, error: 'Configuración fiscal no encontrada' }
    }

    // 3. Leer items de la venta (si la factura está vinculada a una venta)
    let items: Array<{
      nombre: string
      cantidad: number
      precioUnit: number
      subtotal: number
    }> = []

    if (invoice.sale_id) {
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select(`
          quantity,
          unit_price,
          subtotal,
          products(name)
        `)
        .eq('sale_id', invoice.sale_id)

      if (saleItems && saleItems.length > 0) {
        items = saleItems.map((it) => {
          // PostgREST puede devolver products como objeto o array según la inferencia.
          // Cast a unknown + check de runtime para cubrir ambos casos.
          const raw = it.products as unknown
          const product = Array.isArray(raw)
            ? (raw[0] as { name?: string } | undefined)
            : (raw as { name?: string } | null)
          return {
            nombre: product?.name || 'Producto',
            cantidad: Number(it.quantity),
            precioUnit: Number(it.unit_price),
            subtotal: Number(it.subtotal),
          }
        })
      }
    }

    // Fallback: si no hay items (factura sin venta o venta sin items registrados),
    // armar una línea genérica con el total. Esto evita un PDF en blanco.
    if (items.length === 0) {
      const total = Number(invoice.imp_total)
      items = [
        {
          nombre: 'Venta',
          cantidad: 1,
          precioUnit: total,
          subtotal: total,
        },
      ]
    }

    // 4. Mapear a GenerateInvoicePDFParams y generar el PDF
    // arca_invoices.fecha_emision viene como string YYYY-MM-DD (Postgres date)
    // arca_invoices.cae_vencimiento idem
    // arca_invoices.imp_* vienen como string (Postgres NUMERIC) → Number()
    const pdfBuffer = await generateInvoicePDF({
      cuit: config.cuit,
      razonSocial: config.razon_social,
      domicilioFiscal: config.domicilio_fiscal ?? null,
      condicionIva: config.condicion_iva,
      puntoVenta: invoice.punto_venta,
      cbteTipo: invoice.cbte_tipo,
      cbteNumero: Number(invoice.cbte_numero ?? 0),
      cae: invoice.cae,
      caeVencimiento: invoice.cae_vencimiento ?? '',
      fechaEmision: invoice.fecha_emision,
      impTotal: Number(invoice.imp_total),
      impNeto: Number(invoice.imp_neto),
      impIva: Number(invoice.imp_iva),
      items,
      receptor: invoice.receptor_nombre || (invoice.doc_tipo !== 99 && invoice.doc_nro !== '0')
        ? {
            docTipo: invoice.doc_tipo,
            docNro: invoice.doc_nro,
            nombre: invoice.receptor_nombre ?? undefined,
          }
        : undefined, // undefined → la capa pura defaultea a Consumidor Final
    })

    // 5. Construir filename según convención (Factura-{Letra}-{PtoVta}-{NroCmp}.pdf)
    const letra =
      invoice.cbte_tipo === 1 ? 'A' : invoice.cbte_tipo === 6 ? 'B' : invoice.cbte_tipo === 11 ? 'C' : 'X'
    const filename = `Factura-${letra}-${String(invoice.punto_venta).padStart(4, '0')}-${String(
      invoice.cbte_numero ?? 0
    ).padStart(8, '0')}.pdf`

    return {
      success: true,
      pdfBase64: pdfBuffer.toString('base64'),
      filename,
    }
  } catch (error) {
    logger.error(
      'generateArcaInvoicePDFAction',
      'Error generando PDF',
      error instanceof Error ? error : new Error(String(error))
    )
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// FUNCIONES INTERNAS
// ───────────────────────────────────────────────────────────────────────────────

function maskCuit(cuit: string): string {
  if (cuit.length !== 11) return cuit
  return `${cuit.substring(0, 2)}-*****${cuit.substring(8, 9)}-${cuit.substring(10)}`
}

function getEncryptionKey(): Buffer {
  const keyEnv = process.env.MP_ENCRYPTION_KEY
  if (!keyEnv) throw new Error('MP_ENCRYPTION_KEY no está configurada')
  if (!/^[0-9a-f]{64}$/i.test(keyEnv)) {
    throw new Error('MP_ENCRYPTION_KEY debe ser exactamente 64 caracteres hexadecimales')
  }
  return Buffer.from(keyEnv, 'hex')
}

function encrypt(text: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

function decrypt(encrypted: string): string {
  const key = getEncryptionKey()
  const parts = encrypted.split(':')
  if (parts.length !== 3) throw new Error('Formato de datos encriptados inválido')
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(parts[2], 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * Detecta si un certificado AFIP es de homologación (test) en vez de producción.
 * AFIP firma certs de homologación con CA "Computadores Test" o "AC AFIP TEST".
 * Si activamos producción con un cert de homologación, WSAA producción rechaza con
 * `cms.cert.untrusted` (bug del 3-may-2026 que motivó esta validación defensiva).
 *
 * Devuelve { isHomo, issuerCN } — issuerCN es informativo para el mensaje de error.
 * Si el cert no parsea (formato inválido), devuelve isHomo=false: dejamos que falle
 * después con un error más claro de WSAA en vez de bloquear acá.
 */
function isCertHomologation(certPem: string): { isHomo: boolean; issuerCN: string } {
  try {
    const cert = new X509Certificate(certPem)
    const issuer = cert.issuer.toLowerCase()
    // Patrones conocidos de homologación. Match laxo (substring) para tolerar
    // variaciones en el formato del DN (espacios, mayúsculas, atributos extra).
    const homoPatterns = ['computadores test', 'ac afip test', 'wsaahomo', 'homo']
    const isHomo = homoPatterns.some((p) => issuer.includes(p))
    return { isHomo, issuerCN: cert.issuer }
  } catch {
    return { isHomo: false, issuerCN: '' }
  }
}
