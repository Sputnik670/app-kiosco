import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// Auxiliar para formatear moneda en el PDF
const formatPDFMoney = (val: number) => 
  new Intl.NumberFormat('es-AR', { 
    style: 'currency', 
    currency: 'ARS', 
    maximumFractionDigits: 0 
  }).format(val)

// ==========================================
// 1. TICKET DE CIERRE DE CAJA (Reporte A4)
// ==========================================

interface DatosReporte {
  empleado: string
  fechaApertura: string
  fechaCierre: string | null
  montoInicial: number
  totalVentasEfectivo: number // Lo que entró por ventas en cash
  totalIngresos: number       // Entradas manuales
  totalGastos: number         // Salidas manuales
  cajaEsperada: number        // El cálculo teórico
  cajaReal: number | null     // Lo que el empleado contó
  diferencia: number | null   // Sobrante o faltante
  gastos: { descripcion: string; monto: number; tipo?: string; categoria?: string }[]
}

export const generarTicketPDF = (datos: DatosReporte) => {
  const doc = new jsPDF()

  // Encabezado
  doc.setFontSize(22)
  doc.setFont("helvetica", "bold")
  doc.text("Kiosco 24hs", 105, 20, { align: "center" })
  
  doc.setFontSize(12)
  doc.setFont("helvetica", "normal")
  doc.text("Reporte de Auditoría de Caja", 105, 30, { align: "center" })
  doc.line(20, 35, 190, 35)

  // Info General
  doc.setFontSize(10)
  doc.text(`AUDITOR: ${datos.empleado.toUpperCase()}`, 20, 45)
  doc.text(`APERTURA: ${datos.fechaApertura}`, 20, 50)
  doc.text(`CIERRE: ${datos.fechaCierre || 'TURNO EN CURSO'}`, 20, 55)

  // Tabla de Resumen Financiero (Matemática de Caja)
  autoTable(doc, {
    startY: 65,
    head: [['CONCEPTO', 'VALOR']],
    body: [
      ['(+) CAJA INICIAL', formatPDFMoney(datos.montoInicial)],
      ['(+) VENTAS EFECTIVO', formatPDFMoney(datos.totalVentasEfectivo)],
      ['(+) INGRESOS MANUALES', formatPDFMoney(datos.totalIngresos)],
      ['(-) GASTOS / RETIROS', `-${formatPDFMoney(datos.totalGastos)}`],
      ['(=) TOTAL ESPERADO EN CAJA', formatPDFMoney(datos.cajaEsperada)],
      ['(X) CAJA DECLARADA (REAL)', datos.cajaReal ? formatPDFMoney(datos.cajaReal) : '---'],
      ['(Δ) DIFERENCIA', datos.diferencia !== null ? formatPDFMoney(datos.diferencia) : '---'],
    ],
    theme: 'grid',
    styles: { fontStyle: 'bold' },
    headStyles: { fillColor: [15, 23, 42] }, // Slate 900
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: function (data) {
        if (data.row.index === 4) { // Fila de Esperado
            data.cell.styles.fillColor = [241, 245, 249];
        }
        if (data.row.index === 6 && datos.diferencia !== null) { // Fila Diferencia
            if (datos.diferencia < 0) data.cell.styles.textColor = [220, 38, 38];
            if (datos.diferencia > 0) data.cell.styles.textColor = [22, 163, 74];
        }
    }
  })

  // Detalle de Movimientos Manuales (Audit Trail)
  if (datos.gastos.length > 0) {
    // @ts-expect-error jspdf-autotable adds lastAutoTable property
    const finalY = doc.lastAutoTable.finalY + 15
    doc.setFont("helvetica", "bold")
    doc.text("DETALLE DE MOVIMIENTOS MANUALES:", 20, finalY)
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [['HORA/CAT', 'DESCRIPCIÓN', 'MONTO']],
      body: datos.gastos.map(g => [
        g.categoria?.toUpperCase() || 'AJUSTE',
        g.descripcion,
        formatPDFMoney(g.monto)
      ]),
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105] }, // Slate 600
      columnStyles: { 2: { halign: 'right' } },
    })
  }

  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(8)
  doc.setFont("helvetica", "italic")
  doc.text("Documento oficial de auditoría - Kiosco 24hs Cloud System", 105, pageHeight - 10, { align: "center" })

  const nombreArchivo = `Cierre_${datos.empleado}_${datos.fechaApertura.replace(/[\/\s:]/g, '-')}.pdf`
  doc.save(nombreArchivo)
}

// ==========================================
// 2. TICKET DE VENTA (Térmico 80mm)
// ==========================================

interface ItemVenta {
  cantidad: number
  producto: string
  precioUnitario: number
  subtotal: number
}

interface DatosVenta {
  organizacion: string
  fecha: string
  items: ItemVenta[]
  total: number
  metodoPago: string
  vendedor?: string
}

export const generarTicketVenta = (datos: DatosVenta) => {
  const alturaBase = 100 
  const alturaTicket = alturaBase + (datos.items.length * 7)
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, alturaTicket] 
  })

  doc.setFont("Courier", "normal")
  let y = 10 

  doc.setFontSize(14)
  doc.setFont("Courier", "bold")
  doc.text(datos.organizacion.toUpperCase(), 40, y, { align: "center" }) 
  
  y += 5
  doc.setFontSize(8)
  doc.setFont("Courier", "normal")
  doc.text("--------------------------------", 40, y, { align: "center" })
  
  y += 5
  doc.text(`FECHA: ${datos.fecha}`, 5, y)
  y += 4
  if(datos.vendedor) {
      doc.text(`VEND: ${datos.vendedor.toUpperCase()}`, 5, y)
      y += 4
  }
  
  y += 2
  doc.text("--------------------------------", 40, y, { align: "center" })
  y += 5

  doc.setFont("Courier", "bold")
  doc.text("CANT", 5, y)
  doc.text("PRODUCTO", 20, y)
  doc.text("TOTAL", 75, y, { align: "right" })
  y += 4

  doc.setFont("Courier", "normal")
  datos.items.forEach((item) => {
    const nombre = item.producto.length > 18 
      ? item.producto.substring(0, 18) + ".." 
      : item.producto
    
    doc.text(item.cantidad.toString(), 5, y)
    doc.text(nombre, 20, y)
    doc.text(formatPDFMoney(item.subtotal), 75, y, { align: "right" })
    y += 5
  })

  y += 2
  doc.text("--------------------------------", 40, y, { align: "center" })
  y += 5

  doc.setFontSize(14)
  doc.setFont("Courier", "bold")
  doc.text(`TOTAL: ${formatPDFMoney(datos.total)}`, 75, y, { align: "right" })
  
  y += 6
  doc.setFontSize(9)
  doc.setFont("Courier", "normal")
  doc.text(`PAGO: ${datos.metodoPago.toUpperCase()}`, 75, y, { align: "right" })

  y += 10
  doc.setFontSize(8)
  doc.text("¡GRACIAS POR SU COMPRA!", 40, y, { align: "center" })
  y += 4
  doc.text("Kiosco 24hs", 40, y, { align: "center" })

  const nombreArchivo = `Ticket_${datos.fecha.replace(/[\/\s:]/g, '-')}.pdf`
  doc.save(nombreArchivo)
}