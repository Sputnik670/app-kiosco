/**
 * ============================================================================
 * INVOICE PDF — Capa pura para generar PDF fiscal con QR ARCA
 * ============================================================================
 *
 * Función reusable que recibe los datos de un comprobante autorizado (ya con
 * CAE) y genera un PDF en formato ticket térmico 80mm con el QR ARCA al pie
 * según RG 4291/2018.
 *
 * NO toca DB. NO es 'use server'. Invocable solo desde server actions que ya
 * validaron auth + ownership + leyeron datos de DB.
 *
 * Consumida por:
 * - arca.actions.ts:generateArcaInvoicePDFAction (per-venta automática)
 * - invoicing.actions.ts:generateLegacyInvoicePDFAction (retroactiva)
 *
 * Stack:
 * - jsPDF 3.x — generación de PDF (lazy import, ~300KB).
 * - qrcode (npm, NO confundir con qrcode.react) — generación server-side de QR.
 *   errorCorrectionLevel:'H' + width:400 para que sea legible en térmicas.
 *
 * Spec oficial QR ARCA: https://www.afip.gob.ar/fe/qr/documentos/QRespecificaciones.pdf
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// TIPOS
// ----------------------------------------------------------------------------

export interface InvoicePDFItem {
  nombre: string
  cantidad: number
  precioUnit: number
  subtotal: number
}

export interface InvoicePDFReceptor {
  /** 80=CUIT, 86=CUIL, 96=DNI, 99=Consumidor Final */
  docTipo: number
  /** Número del documento (string para evitar pérdida de precisión en CUITs largos) */
  docNro: string
  nombre?: string
}

export interface GenerateInvoicePDFParams {
  // Datos del emisor (de arca_config + organizations)
  cuit: string
  razonSocial: string
  domicilioFiscal: string | null
  /** Texto canónico AFIP: 'Monotributo' | 'IVA Responsable Inscripto' | 'IVA Exento' | 'Responsable No Inscripto' */
  condicionIva: string
  puntoVenta: number

  // Datos del comprobante (de arca_invoices o invoices)
  /** Código AFIP del tipo de comprobante: 1=A, 6=B, 11=C */
  cbteTipo: number
  cbteNumero: number
  cae: string
  /** Fecha de vencimiento del CAE — formato YYYY-MM-DD */
  caeVencimiento: string
  /** Fecha de emisión — formato YYYY-MM-DD */
  fechaEmision: string
  impTotal: number
  impNeto: number
  impIva: number

  // Items
  items: InvoicePDFItem[]

  /** Por defecto Consumidor Final (docTipo=99, docNro='0') */
  receptor?: InvoicePDFReceptor
}

// ----------------------------------------------------------------------------
// CONSTANTES
// ----------------------------------------------------------------------------

const TIPO_NAMES: Record<number, { letra: string; nombre: string }> = {
  1: { letra: 'A', nombre: 'Factura A' },
  6: { letra: 'B', nombre: 'Factura B' },
  11: { letra: 'C', nombre: 'Factura C' },
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function formatMoney(val: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

/** YYYY-MM-DD → DD/MM/YYYY (formato visible para humanos en Argentina) */
function formatDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length < 10) return yyyymmdd || ''
  const [y, m, d] = yyyymmdd.substring(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// ----------------------------------------------------------------------------
// QR ARCA (RG 4291/2018)
// ----------------------------------------------------------------------------

/**
 * Construye la URL del QR ARCA según spec RG 4291/2018.
 *
 * El QR codifica: https://www.afip.gob.ar/fe/qr/?p=<JSON_BASE64>
 *
 * Donde JSON_BASE64 es base64 estándar de un objeto JSON con campos canónicos
 * AFIP. Notas críticas:
 * - cuit, nroDocRec, codAut son NUMÉRICOS (no string), aunque vengan de DB como string.
 * - tipoCodAut: 'E' para CAE (CAEA usa 'A' — no aplica acá, no emitimos CAEA).
 * - moneda: 'PES' siempre para Argentina; ctz: 1.
 * - tipoDocRec=99 + nroDocRec=0 para Consumidor Final.
 *
 * Spec: https://www.afip.gob.ar/fe/qr/documentos/QRespecificaciones.pdf
 */
export function buildArcaQRPayload(params: {
  fechaEmision: string
  cuit: string
  ptoVta: number
  cbteTipo: number
  cbteNumero: number
  importe: number
  docTipo: number
  docNro: string
  cae: string
}): string {
  const data = {
    ver: 1,
    fecha: params.fechaEmision.substring(0, 10), // garantizar YYYY-MM-DD
    cuit: Number(params.cuit),
    ptoVta: params.ptoVta,
    tipoCmp: params.cbteTipo,
    nroCmp: params.cbteNumero,
    importe: Number(params.importe),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: params.docTipo,
    nroDocRec: Number(params.docNro || '0'),
    tipoCodAut: 'E',
    codAut: Number(params.cae),
  }
  const json = JSON.stringify(data)
  // Base64 estándar (alfabeto +/=, no URL-safe — la spec usa estándar)
  const base64 = Buffer.from(json, 'utf-8').toString('base64')
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`
}

// ----------------------------------------------------------------------------
// GENERACIÓN DEL PDF
// ----------------------------------------------------------------------------

/**
 * Genera el PDF de la factura en formato ticket térmico 80mm con QR ARCA al pie.
 * Devuelve Buffer (no escribe archivo). El consumidor (server action) lo manda
 * como base64 al cliente.
 */
export async function generateInvoicePDF(params: GenerateInvoicePDFParams): Promise<Buffer> {
  const { jsPDF } = await import('jspdf')
  const QRCode = (await import('qrcode')).default

  const tipoInfo = TIPO_NAMES[params.cbteTipo] || { letra: '?', nombre: 'Comprobante' }
  const isFacturaAB = params.cbteTipo === 1 || params.cbteTipo === 6
  const receptor: InvoicePDFReceptor =
    params.receptor && params.receptor.docTipo
      ? params.receptor
      : { docTipo: 99, docNro: '0' }

  // Calcular alto del ticket dinámicamente.
  // Layout aprox: header 35mm + emisor 22mm + receptor 12mm + items_header 5mm
  // + items (5mm c/u) + totales (10mm + 8mm IVA si A/B) + CAE 12mm + QR 38mm + footer 6mm
  const baseAltura = 35 + 22 + 12 + 5 + 10 + 12 + 38 + 6
  const alturaItems = params.items.length * 5
  const alturaIva = isFacturaAB ? 8 : 0
  const alturaTotal = baseAltura + alturaItems + alturaIva

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, alturaTotal],
  })

  const W = 80
  const CENTER = W / 2
  const LEFT = 5
  const RIGHT = 75
  let y = 6

  // ────────────────────────────────────────────────────────────────────────
  // HEADER — Letra A/B/C en cuadrito + nombre del comprobante + número
  // ────────────────────────────────────────────────────────────────────────
  doc.setLineWidth(0.6)
  doc.rect(CENTER - 7, y, 14, 14)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(tipoInfo.letra, CENTER, y + 11, { align: 'center' })

  y += 18
  doc.setFontSize(11)
  doc.text(tipoInfo.nombre.toUpperCase(), CENTER, y, { align: 'center' })

  y += 5
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `${String(params.puntoVenta).padStart(4, '0')}-${String(params.cbteNumero).padStart(8, '0')}`,
    CENTER,
    y,
    { align: 'center' }
  )

  y += 4
  doc.setFontSize(7)
  doc.text(`Fecha: ${formatDate(params.fechaEmision)}`, CENTER, y, { align: 'center' })

  y += 3
  doc.setLineWidth(0.2)
  doc.line(LEFT, y, RIGHT, y)
  y += 4

  // ────────────────────────────────────────────────────────────────────────
  // EMISOR
  // ────────────────────────────────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(params.razonSocial.toUpperCase(), CENTER, y, { align: 'center', maxWidth: 70 })

  y += 4
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(`CUIT: ${params.cuit}`, CENTER, y, { align: 'center' })

  if (params.domicilioFiscal) {
    y += 3
    doc.text(params.domicilioFiscal, CENTER, y, { align: 'center', maxWidth: 70 })
  }

  y += 3
  doc.text(`Cond. IVA: ${params.condicionIva}`, CENTER, y, { align: 'center', maxWidth: 70 })

  y += 4
  doc.line(LEFT, y, RIGHT, y)
  y += 4

  // ────────────────────────────────────────────────────────────────────────
  // RECEPTOR
  // ────────────────────────────────────────────────────────────────────────
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('RECEPTOR', LEFT, y)
  y += 3
  doc.setFont('helvetica', 'normal')
  doc.text(receptor.nombre || 'Consumidor Final', LEFT, y, { maxWidth: 70 })
  if (receptor.docTipo !== 99) {
    y += 3
    const docLabel =
      receptor.docTipo === 80 ? 'CUIT' : receptor.docTipo === 96 ? 'DNI' : 'Doc'
    doc.text(`${docLabel}: ${receptor.docNro}`, LEFT, y)
  }

  y += 4
  doc.line(LEFT, y, RIGHT, y)
  y += 4

  // ────────────────────────────────────────────────────────────────────────
  // ITEMS
  // ────────────────────────────────────────────────────────────────────────
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('Cant', LEFT, y)
  doc.text('Producto', LEFT + 8, y)
  doc.text('Total', RIGHT, y, { align: 'right' })
  y += 3
  doc.setFont('helvetica', 'normal')

  for (const item of params.items) {
    const nombreCorto = item.nombre.length > 22 ? item.nombre.substring(0, 22) + '..' : item.nombre
    doc.text(String(item.cantidad), LEFT, y)
    doc.text(nombreCorto, LEFT + 8, y)
    doc.text(formatMoney(item.subtotal), RIGHT, y, { align: 'right' })
    y += 4
  }

  y += 1
  doc.line(LEFT, y, RIGHT, y)
  y += 4

  // ────────────────────────────────────────────────────────────────────────
  // TOTALES
  // ────────────────────────────────────────────────────────────────────────
  if (isFacturaAB) {
    doc.setFontSize(8)
    doc.text('Subtotal:', LEFT, y)
    doc.text(formatMoney(params.impNeto), RIGHT, y, { align: 'right' })
    y += 4
    doc.text('IVA 21%:', LEFT, y)
    doc.text(formatMoney(params.impIva), RIGHT, y, { align: 'right' })
    y += 4
  }

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL:', LEFT, y)
  doc.text(formatMoney(params.impTotal), RIGHT, y, { align: 'right' })
  y += 6

  // ────────────────────────────────────────────────────────────────────────
  // CAE + VENCIMIENTO + QR ARCA (al pie, mandatorio por RG 4291/2018)
  // ────────────────────────────────────────────────────────────────────────
  doc.setLineWidth(0.5)
  doc.line(LEFT, y, RIGHT, y)
  y += 4

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(`CAE: ${params.cae}`, LEFT, y)
  y += 3
  doc.text(`Vto. CAE: ${formatDate(params.caeVencimiento)}`, LEFT, y)
  y += 4

  // Generación del QR ARCA
  const qrUrl = buildArcaQRPayload({
    fechaEmision: params.fechaEmision,
    cuit: params.cuit,
    ptoVta: params.puntoVenta,
    cbteTipo: params.cbteTipo,
    cbteNumero: params.cbteNumero,
    importe: params.impTotal,
    docTipo: receptor.docTipo,
    docNro: receptor.docNro,
    cae: params.cae,
  })
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    errorCorrectionLevel: 'H', // High — clave para impresoras térmicas de baja resolución
    width: 400, // resolución del PNG (jsPDF lo escala al tamaño de addImage)
    margin: 1,
  })

  // QR de 35mm cuadrado, centrado
  const qrSize = 35
  const qrX = CENTER - qrSize / 2
  doc.addImage(qrDataUrl, 'PNG', qrX, y, qrSize, qrSize)
  y += qrSize + 3

  doc.setFontSize(6)
  doc.setFont('helvetica', 'italic')
  doc.text('Comprobante autorizado por ARCA', CENTER, y, { align: 'center' })

  // Output como Buffer (Node) — el consumidor lo serializa a base64 para enviarlo al cliente
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}
