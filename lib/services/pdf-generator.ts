/**
 * Generador de reportes PDF para App-Kiosco
 * Usa jsPDF + jspdf-autotable para crear PDFs con tablas
 */

// jsPDF and jspdf-autotable are loaded dynamically inside each function
// to avoid adding ~300KB to the initial bundle (lazy load on demand)
import type { jsPDF } from "jspdf"
import type {
  SalesReportData,
  CashRegisterReportData,
  StockReportData,
  ExpiringProductsReportData,
} from "@/lib/actions/reports.actions"

// Configuración común
const COLORS = {
  primary: [15, 23, 42] as [number, number, number], // slate-900
  secondary: [100, 116, 139] as [number, number, number], // slate-500
  accent: [37, 99, 235] as [number, number, number], // blue-600
  success: [22, 163, 74] as [number, number, number], // green-600
  danger: [220, 38, 38] as [number, number, number], // red-600
  warning: [217, 119, 6] as [number, number, number], // amber-600
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFontSize(20)
  doc.setTextColor(...COLORS.primary)
  doc.text(title, 14, 20)

  if (subtitle) {
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.secondary)
    doc.text(subtitle, 14, 28)
  }

  doc.setFontSize(8)
  doc.setTextColor(...COLORS.secondary)
  doc.text(`Generado: ${new Date().toLocaleString("es-AR")}`, 14, 35)

  // Línea separadora
  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.5)
  doc.line(14, 38, 196, 38)
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.secondary)
    doc.text(
      `Página ${i} de ${pageCount} | App-Kiosco`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    )
  }
}

// ============================================================================
// REPORTE DE VENTAS
// ============================================================================

export async function generateSalesReportPDF(data: SalesReportData, branchName: string): Promise<void> {
  const { jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")
  const doc = new jsPDF()

  addHeader(
    doc,
    "REPORTE DE VENTAS",
    `${branchName} | ${formatDate(data.period.from)} - ${formatDate(data.period.to)}`
  )

  // Resumen
  doc.setFontSize(12)
  doc.setTextColor(...COLORS.primary)
  doc.text("Resumen", 14, 48)

  autoTable(doc, {
    startY: 52,
    head: [["Métrica", "Valor"]],
    body: [
      ["Total de Ventas", data.summary.totalSales.toString()],
      ["Monto Total", formatMoney(data.summary.totalAmount)],
      ...Object.entries(data.summary.byPaymentMethod).map(([method, info]) => [
        `${method.charAt(0).toUpperCase() + method.slice(1)}`,
        `${info.count} ventas - ${formatMoney(info.amount)}`,
      ]),
    ],
    theme: "striped",
    headStyles: { fillColor: COLORS.primary },
    margin: { left: 14, right: 14 },
  })

  // Detalle de ventas
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  doc.setFontSize(12)
  doc.setTextColor(...COLORS.primary)
  doc.text("Detalle de Ventas", 14, finalY + 15)

  autoTable(doc, {
    startY: finalY + 20,
    head: [["Fecha", "Hora", "Items", "Método", "Total"]],
    body: data.sales.map((s) => [
      formatDate(s.date),
      new Date(s.date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      s.itemCount.toString(),
      s.paymentMethod,
      formatMoney(s.total),
    ]),
    theme: "striped",
    headStyles: { fillColor: COLORS.primary },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9 },
  })

  addFooter(doc)
  doc.save(`ventas_${formatDate(data.period.from)}_${formatDate(data.period.to)}.pdf`)
}

// ============================================================================
// REPORTE DE CAJA
// ============================================================================

export async function generateCashRegisterReportPDF(
  data: CashRegisterReportData,
  branchName: string
): Promise<void> {
  const { jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")
  const doc = new jsPDF()

  addHeader(doc, "REPORTE DE CAJA", `${branchName} | ${formatDate(data.register.date)}`)

  // Info de la caja
  doc.setFontSize(12)
  doc.setTextColor(...COLORS.primary)
  doc.text("Información del Turno", 14, 48)

  autoTable(doc, {
    startY: 52,
    body: [
      ["Empleado", data.register.employeeName || "N/A"],
      ["Apertura", formatDateTime(data.register.openedAt)],
      ["Cierre", data.register.closedAt ? formatDateTime(data.register.closedAt) : "En curso"],
      ["Monto Inicial", formatMoney(data.register.openingAmount)],
    ],
    theme: "plain",
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
    },
    margin: { left: 14, right: 14 },
  })

  let currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // Ventas
  doc.setFontSize(12)
  doc.text("Ventas del Turno", 14, currentY)

  autoTable(doc, {
    startY: currentY + 5,
    body: [
      ["Total Ventas", formatMoney(data.sales.total)],
      ["Efectivo", formatMoney(data.sales.cash)],
      ["Tarjeta", formatMoney(data.sales.card)],
      ["Otros", formatMoney(data.sales.other)],
    ],
    theme: "striped",
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
    },
    margin: { left: 14, right: 14 },
  })

  currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // Movimientos
  if (data.movements.length > 0) {
    doc.text("Movimientos de Caja", 14, currentY)

    autoTable(doc, {
      startY: currentY + 5,
      head: [["Hora", "Tipo", "Categoría", "Descripción", "Monto"]],
      body: data.movements.map((m) => [
        new Date(m.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        m.type === "ingreso" ? "+" : "-",
        m.category,
        m.description || "-",
        formatMoney(m.type === "egreso" ? -m.amount : m.amount),
      ]),
      theme: "striped",
      headStyles: { fillColor: COLORS.primary },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9 },
    })

    currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  // Resumen final
  doc.setFontSize(12)
  doc.text("Arqueo de Caja", 14, currentY)

  const varianceColor =
    data.summary.variance !== null
      ? data.summary.variance >= 0
        ? COLORS.success
        : COLORS.danger
      : COLORS.secondary

  autoTable(doc, {
    startY: currentY + 5,
    body: [
      ["Caja Esperada", formatMoney(data.summary.expectedAmount)],
      ["Caja Real", data.summary.actualAmount !== null ? formatMoney(data.summary.actualAmount) : "Pendiente"],
      ["Diferencia", data.summary.variance !== null ? formatMoney(data.summary.variance) : "N/A"],
    ],
    theme: "plain",
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
    },
    didParseCell: (hookData) => {
      if (hookData.row.index === 2 && hookData.column.index === 1) {
        hookData.cell.styles.textColor = varianceColor
        hookData.cell.styles.fontStyle = "bold"
      }
    },
    margin: { left: 14, right: 14 },
  })

  addFooter(doc)
  doc.save(`caja_${formatDate(data.register.date)}.pdf`)
}

// ============================================================================
// REPORTE DE STOCK
// ============================================================================

export async function generateStockReportPDF(data: StockReportData, branchName: string): Promise<void> {
  const { jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")
  const doc = new jsPDF()

  addHeader(doc, "REPORTE DE STOCK", `${branchName} | ${formatDate(new Date().toISOString())}`)

  // Resumen
  doc.setFontSize(12)
  doc.setTextColor(...COLORS.primary)
  doc.text("Resumen de Inventario", 14, 48)

  autoTable(doc, {
    startY: 52,
    body: [
      ["Total de Productos", data.summary.totalProducts.toString()],
      ["Unidades en Stock", data.summary.totalUnits.toString()],
      ["Valor del Inventario (Costo)", formatMoney(data.summary.totalStockValue)],
      ["Valor Potencial (Venta)", formatMoney(data.summary.totalPotentialRevenue)],
    ],
    theme: "striped",
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60 },
    },
    margin: { left: 14, right: 14 },
  })

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  // Detalle de productos
  doc.setFontSize(12)
  doc.text("Detalle de Productos", 14, finalY + 15)

  autoTable(doc, {
    startY: finalY + 20,
    head: [["Producto", "Categoría", "Stock", "Costo", "Precio", "Valor"]],
    body: data.products.map((p) => [
      p.name,
      p.category || "-",
      p.stock.toString(),
      formatMoney(p.cost),
      formatMoney(p.salePrice),
      formatMoney(p.stockValue),
    ]),
    theme: "striped",
    headStyles: { fillColor: COLORS.primary },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 50 },
    },
  })

  addFooter(doc)
  doc.save(`stock_${formatDate(new Date().toISOString())}.pdf`)
}

// ============================================================================
// REPORTE DE PRODUCTOS POR VENCER
// ============================================================================

export async function generateExpiringProductsReportPDF(
  data: ExpiringProductsReportData,
  branchName: string
): Promise<void> {
  const { jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")
  const doc = new jsPDF()

  addHeader(doc, "PRODUCTOS POR VENCER", `${branchName} | ${formatDate(new Date().toISOString())}`)

  // Resumen
  doc.setFontSize(12)
  doc.setTextColor(...COLORS.primary)
  doc.text("Resumen de Riesgo", 14, 48)

  autoTable(doc, {
    startY: 52,
    body: [
      ["Total de Lotes", data.summary.totalBatches.toString()],
      ["Unidades en Riesgo", data.summary.totalUnits.toString()],
      ["Capital en Riesgo", formatMoney(data.summary.totalValueAtRisk)],
    ],
    theme: "striped",
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
    },
    headStyles: { fillColor: COLORS.warning },
    margin: { left: 14, right: 14 },
  })

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  // Detalle
  doc.setFontSize(12)
  doc.text("Detalle de Productos", 14, finalY + 15)

  autoTable(doc, {
    startY: finalY + 20,
    head: [["Producto", "Cantidad", "Vencimiento", "Días", "Valor en Riesgo"]],
    body: data.products.map((p) => [
      p.productName,
      p.quantity.toString(),
      formatDate(p.expirationDate),
      p.daysUntilExpiry <= 0 ? "VENCIDO" : `${p.daysUntilExpiry} días`,
      formatMoney(p.valueAtRisk),
    ]),
    theme: "striped",
    headStyles: { fillColor: COLORS.warning },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9 },
    didParseCell: (hookData) => {
      if (hookData.column.index === 3 && hookData.section === "body") {
        const days = data.products[hookData.row.index]?.daysUntilExpiry
        if (days !== undefined && days <= 0) {
          hookData.cell.styles.textColor = COLORS.danger
          hookData.cell.styles.fontStyle = "bold"
        } else if (days !== undefined && days <= 3) {
          hookData.cell.styles.textColor = COLORS.warning
        }
      }
    },
  })

  addFooter(doc)
  doc.save(`productos_por_vencer_${formatDate(new Date().toISOString())}.pdf`)
}
