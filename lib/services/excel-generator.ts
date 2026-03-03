/**
 * Generador de reportes Excel para App-Kiosco
 * Usa xlsx para crear archivos Excel
 */

// xlsx is loaded dynamically inside each function to avoid adding ~400KB to the initial bundle
import type {
  SalesReportData,
  CashRegisterReportData,
  StockReportData,
  ExpiringProductsReportData,
} from "@/lib/actions/reports.actions"

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

function downloadExcel(XLSX: typeof import("xlsx"), workbook: import("xlsx").WorkBook, filename: string) {
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// ============================================================================
// REPORTE DE VENTAS
// ============================================================================

export async function generateSalesReportExcel(data: SalesReportData, branchName: string): Promise<void> {
  const XLSX = await import("xlsx")
  const workbook = XLSX.utils.book_new()

  // Hoja de resumen
  const summaryData = [
    ["REPORTE DE VENTAS"],
    ["Sucursal:", branchName],
    ["Período:", `${formatDate(data.period.from)} - ${formatDate(data.period.to)}`],
    ["Generado:", new Date().toLocaleString("es-AR")],
    [],
    ["RESUMEN"],
    ["Total de Ventas", data.summary.totalSales],
    ["Monto Total", data.summary.totalAmount],
    [],
    ["DESGLOSE POR MÉTODO DE PAGO"],
    ["Método", "Cantidad", "Monto"],
    ...Object.entries(data.summary.byPaymentMethod).map(([method, info]) => [
      method,
      info.count,
      info.amount,
    ]),
  ]

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen")

  // Hoja de detalle
  const detailHeaders = ["ID", "Fecha", "Hora", "Items", "Método de Pago", "Empleado", "Total"]
  const detailData = data.sales.map((s) => [
    s.id,
    formatDate(s.date),
    new Date(s.date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    s.itemCount,
    s.paymentMethod,
    s.employeeName || "N/A",
    s.total,
  ])

  const detailSheet = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailData])
  XLSX.utils.book_append_sheet(workbook, detailSheet, "Detalle Ventas")

  downloadExcel(XLSX, workbook, `ventas_${formatDate(data.period.from)}_${formatDate(data.period.to)}.xlsx`)
}

// ============================================================================
// REPORTE DE CAJA
// ============================================================================

export async function generateCashRegisterReportExcel(
  data: CashRegisterReportData,
  branchName: string
): Promise<void> {
  const XLSX = await import("xlsx")
  const workbook = XLSX.utils.book_new()

  // Hoja principal
  const mainData = [
    ["REPORTE DE CAJA"],
    ["Sucursal:", branchName],
    ["Fecha:", formatDate(data.register.date)],
    ["Generado:", new Date().toLocaleString("es-AR")],
    [],
    ["INFORMACIÓN DEL TURNO"],
    ["Empleado:", data.register.employeeName || "N/A"],
    ["Apertura:", formatDateTime(data.register.openedAt)],
    ["Cierre:", data.register.closedAt ? formatDateTime(data.register.closedAt) : "En curso"],
    ["Monto Inicial:", data.register.openingAmount],
    [],
    ["VENTAS DEL TURNO"],
    ["Total Ventas:", data.sales.total],
    ["Efectivo:", data.sales.cash],
    ["Tarjeta:", data.sales.card],
    ["Otros:", data.sales.other],
    [],
    ["ARQUEO DE CAJA"],
    ["Caja Esperada:", data.summary.expectedAmount],
    [
      "Caja Real:",
      data.summary.actualAmount !== null ? data.summary.actualAmount : "Pendiente",
    ],
    ["Diferencia:", data.summary.variance !== null ? data.summary.variance : "N/A"],
  ]

  const mainSheet = XLSX.utils.aoa_to_sheet(mainData)
  XLSX.utils.book_append_sheet(workbook, mainSheet, "Resumen")

  // Hoja de movimientos
  if (data.movements.length > 0) {
    const movHeaders = ["Hora", "Tipo", "Categoría", "Descripción", "Monto"]
    const movData = data.movements.map((m) => [
      new Date(m.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      m.type,
      m.category,
      m.description || "-",
      m.type === "egreso" ? -m.amount : m.amount,
    ])

    const movSheet = XLSX.utils.aoa_to_sheet([movHeaders, ...movData])
    XLSX.utils.book_append_sheet(workbook, movSheet, "Movimientos")
  }

  downloadExcel(XLSX, workbook, `caja_${formatDate(data.register.date)}.xlsx`)
}

// ============================================================================
// REPORTE DE STOCK
// ============================================================================

export async function generateStockReportExcel(data: StockReportData, branchName: string): Promise<void> {
  const XLSX = await import("xlsx")
  const workbook = XLSX.utils.book_new()

  // Hoja de resumen
  const summaryData = [
    ["REPORTE DE STOCK"],
    ["Sucursal:", branchName],
    ["Fecha:", formatDate(new Date().toISOString())],
    ["Generado:", new Date().toLocaleString("es-AR")],
    [],
    ["RESUMEN DE INVENTARIO"],
    ["Total de Productos:", data.summary.totalProducts],
    ["Unidades en Stock:", data.summary.totalUnits],
    ["Valor del Inventario (Costo):", data.summary.totalStockValue],
    ["Valor Potencial (Venta):", data.summary.totalPotentialRevenue],
  ]

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen")

  // Hoja de detalle
  const detailHeaders = [
    "ID",
    "Producto",
    "Categoría",
    "Código de Barras",
    "Stock",
    "Costo Unitario",
    "Precio Venta",
    "Valor Stock",
    "Valor Potencial",
  ]
  const detailData = data.products.map((p) => [
    p.id,
    p.name,
    p.category || "-",
    p.barcode || "-",
    p.stock,
    p.cost,
    p.salePrice,
    p.stockValue,
    p.potentialRevenue,
  ])

  const detailSheet = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailData])
  XLSX.utils.book_append_sheet(workbook, detailSheet, "Productos")

  downloadExcel(XLSX, workbook, `stock_${formatDate(new Date().toISOString())}.xlsx`)
}

// ============================================================================
// REPORTE DE PRODUCTOS POR VENCER
// ============================================================================

export async function generateExpiringProductsReportExcel(
  data: ExpiringProductsReportData,
  branchName: string
): Promise<void> {
  const XLSX = await import("xlsx")
  const workbook = XLSX.utils.book_new()

  // Hoja de resumen
  const summaryData = [
    ["PRODUCTOS POR VENCER"],
    ["Sucursal:", branchName],
    ["Fecha:", formatDate(new Date().toISOString())],
    ["Generado:", new Date().toLocaleString("es-AR")],
    [],
    ["RESUMEN DE RIESGO"],
    ["Total de Lotes:", data.summary.totalBatches],
    ["Unidades en Riesgo:", data.summary.totalUnits],
    ["Capital en Riesgo:", data.summary.totalValueAtRisk],
  ]

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen")

  // Hoja de detalle
  const detailHeaders = [
    "Producto",
    "ID Lote",
    "Cantidad",
    "Fecha Vencimiento",
    "Días Restantes",
    "Costo Unitario",
    "Valor en Riesgo",
  ]
  const detailData = data.products.map((p) => [
    p.productName,
    p.batchId,
    p.quantity,
    formatDate(p.expirationDate),
    p.daysUntilExpiry <= 0 ? "VENCIDO" : p.daysUntilExpiry,
    p.cost,
    p.valueAtRisk,
  ])

  const detailSheet = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailData])
  XLSX.utils.book_append_sheet(workbook, detailSheet, "Productos")

  downloadExcel(XLSX, workbook, `productos_por_vencer_${formatDate(new Date().toISOString())}.xlsx`)
}
