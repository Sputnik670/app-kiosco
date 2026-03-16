/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🧾 ARCA (ex-AFIP) SERVER ACTIONS — Facturación Electrónica
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
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

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

export interface CreateInvoiceResult {
  success: boolean
  skipped?: boolean
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

const CBTE_TIPO_MAP: Record<string, number> = {
  A: 1,
  B: 6,
  C: 11,
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
          is_sandbox: true,
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

    const tipoFactura = options?.tipoFactura || arcaConfig.tipo_factura_default || 'C'
    const cbteTipo = CBTE_TIPO_MAP[tipoFactura] || 11
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

    // Llamar a ARCA
    let cae: string
    let caeVencimiento: string
    let cbteNumero: number

    try {
      const Afip = (await import('@afipsdk/afip.js')).default

      const afip = new Afip({
        CUIT: arcaConfig.cuit,
        cert: certPem,
        key: keyPem,
        production: !arcaConfig.is_sandbox,
      })

      const voucherData = {
        CantReg: 1,
        PtoVta: arcaConfig.punto_venta,
        CbteTipo: cbteTipo,
        Concepto: 1,
        DocTipo: docTipo,
        DocNro: docNro,
        CbteFch: fecha,
        ImpTotal: impTotal,
        ImpTotConc: 0,
        ImpNeto: impNeto,
        ImpOpEx: 0,
        ImpIVA: impIva,
        ImpTrib: 0,
        MonId: 'PES',
        MonCotiz: 1,
        ...(ivaDetalle ? { Iva: ivaDetalle } : {}),
      }

      const result = await afip.ElectronicBilling.createNextVoucher(voucherData)
      cae = result.CAE
      caeVencimiento = result.CAEFchVto
      cbteNumero = Number(result.voucher_number ?? 0)
    } catch (afipError) {
      const errMsg = afipError instanceof Error ? afipError.message : String(afipError)
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
