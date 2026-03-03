"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  Calendar as CalendarIcon,
  Package,
  DollarSign,
  AlertTriangle,
  Receipt,
} from "lucide-react"
import { DateRange } from "react-day-picker"
import { format, subDays, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"

import {
  getSalesReportAction,
  getCashRegisterReportAction,
  getStockReportAction,
  getExpiringProductsReportAction,
  getCashRegistersListAction,
} from "@/lib/actions/reports.actions"
import {
  generateSalesReportPDF,
  generateCashRegisterReportPDF,
  generateStockReportPDF,
  generateExpiringProductsReportPDF,
} from "@/lib/services/pdf-generator"
import {
  generateSalesReportExcel,
  generateCashRegisterReportExcel,
  generateStockReportExcel,
  generateExpiringProductsReportExcel,
} from "@/lib/services/excel-generator"

type ReportType = "sales" | "cash" | "stock" | "expiring"
type ExportFormat = "pdf" | "excel"

interface ReportsProps {
  branchId: string
  branchName: string
}

const REPORT_TYPES = [
  {
    id: "sales" as const,
    label: "Ventas",
    description: "Listado de ventas por período con totales por método de pago",
    icon: DollarSign,
    needsDateRange: true,
    needsCashRegister: false,
  },
  {
    id: "cash" as const,
    label: "Caja Diaria",
    description: "Detalle de un turno de caja con movimientos y arqueo",
    icon: Receipt,
    needsDateRange: true,
    needsCashRegister: true,
  },
  {
    id: "stock" as const,
    label: "Stock Actual",
    description: "Inventario completo con valorización",
    icon: Package,
    needsDateRange: false,
    needsCashRegister: false,
  },
  {
    id: "expiring" as const,
    label: "Por Vencer",
    description: "Productos próximos a vencer (15 días)",
    icon: AlertTriangle,
    needsDateRange: false,
    needsCashRegister: false,
  },
]

export function Reports({ branchId, branchName }: ReportsProps) {
  const [selectedReport, setSelectedReport] = useState<ReportType>("sales")
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf")
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(subDays(new Date(), 7)),
    to: endOfDay(new Date()),
  })
  const [cashRegisters, setCashRegisters] = useState<
    { id: string; date: string; employeeName: string | null; isClosed: boolean }[]
  >([])
  const [selectedCashRegister, setSelectedCashRegister] = useState<string>("")
  const [loadingCashRegisters, setLoadingCashRegisters] = useState(false)

  const currentReportConfig = REPORT_TYPES.find((r) => r.id === selectedReport)!

  const handleReportTypeChange = async (type: ReportType) => {
    setSelectedReport(type)
    setSelectedCashRegister("")

    // Si necesita caja, cargar lista de cajas
    if (type === "cash" && dateRange?.from && dateRange?.to) {
      await loadCashRegisters()
    }
  }

  const loadCashRegisters = async () => {
    if (!dateRange?.from || !dateRange?.to) return

    setLoadingCashRegisters(true)
    try {
      const result = await getCashRegistersListAction(
        branchId,
        dateRange.from.toISOString(),
        dateRange.to.toISOString()
      )
      if (result.success) {
        setCashRegisters(result.data)
        if (result.data.length > 0) {
          setSelectedCashRegister(result.data[0].id)
        }
      }
    } finally {
      setLoadingCashRegisters(false)
    }
  }

  const handleDateRangeChange = async (range: DateRange | undefined) => {
    setDateRange(range)
    if (selectedReport === "cash" && range?.from && range?.to) {
      setLoadingCashRegisters(true)
      try {
        const result = await getCashRegistersListAction(
          branchId,
          range.from.toISOString(),
          range.to.toISOString()
        )
        if (result.success) {
          setCashRegisters(result.data)
          setSelectedCashRegister(result.data[0]?.id || "")
        }
      } finally {
        setLoadingCashRegisters(false)
      }
    }
  }

  const handleGenerate = async () => {
    setLoading(true)
    try {
      switch (selectedReport) {
        case "sales": {
          if (!dateRange?.from || !dateRange?.to) {
            toast.error("Selecciona un rango de fechas")
            return
          }
          const result = await getSalesReportAction(
            branchId,
            dateRange.from.toISOString(),
            dateRange.to.toISOString()
          )
          if (!result.success) {
            toast.error(result.error)
            return
          }
          if (exportFormat === "pdf") {
            await generateSalesReportPDF(result.data, branchName)
          } else {
            await generateSalesReportExcel(result.data, branchName)
          }
          break
        }

        case "cash": {
          if (!selectedCashRegister) {
            toast.error("Selecciona una caja")
            return
          }
          const result = await getCashRegisterReportAction(selectedCashRegister)
          if (!result.success) {
            toast.error(result.error)
            return
          }
          if (exportFormat === "pdf") {
            await generateCashRegisterReportPDF(result.data, branchName)
          } else {
            await generateCashRegisterReportExcel(result.data, branchName)
          }
          break
        }

        case "stock": {
          const result = await getStockReportAction(branchId)
          if (!result.success) {
            toast.error(result.error)
            return
          }
          if (exportFormat === "pdf") {
            await generateStockReportPDF(result.data, branchName)
          } else {
            await generateStockReportExcel(result.data, branchName)
          }
          break
        }

        case "expiring": {
          const result = await getExpiringProductsReportAction(branchId, 15)
          if (!result.success) {
            toast.error(result.error)
            return
          }
          if (exportFormat === "pdf") {
            await generateExpiringProductsReportPDF(result.data, branchName)
          } else {
            await generateExpiringProductsReportExcel(result.data, branchName)
          }
          break
        }
      }

      toast.success(`Reporte ${exportFormat.toUpperCase()} generado correctamente`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al generar reporte")
    } finally {
      setLoading(false)
    }
  }

  const dateRangeLabel = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, "dd/MM", { locale: es })} - ${format(dateRange.to, "dd/MM", { locale: es })}`
      : format(dateRange.from, "dd/MM", { locale: es })
    : "Seleccionar fechas"

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-6 w-6 text-blue-600" />
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
            Reportes
          </h2>
          <p className="text-xs text-slate-500">Exporta datos en PDF o Excel</p>
        </div>
      </div>

      {/* Selector de tipo de reporte */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {REPORT_TYPES.map((report) => (
          <Card
            key={report.id}
            className={`p-4 cursor-pointer transition-all border-2 ${
              selectedReport === report.id
                ? "border-blue-500 bg-blue-50"
                : "border-slate-100 hover:border-slate-200"
            }`}
            onClick={() => handleReportTypeChange(report.id)}
          >
            <div className="flex flex-col items-center text-center gap-2">
              <report.icon
                className={`h-8 w-8 ${
                  selectedReport === report.id ? "text-blue-600" : "text-slate-400"
                }`}
              />
              <span
                className={`font-bold text-sm ${
                  selectedReport === report.id ? "text-blue-600" : "text-slate-700"
                }`}
              >
                {report.label}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Descripción del reporte */}
      <Card className="p-4 bg-slate-50 border-dashed">
        <p className="text-sm text-slate-600">{currentReportConfig.description}</p>
      </Card>

      {/* Opciones según tipo de reporte */}
      <div className="space-y-4">
        {/* Selector de fechas */}
        {currentReportConfig.needsDateRange && (
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase text-slate-500">
              Período
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 border-2 font-bold"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-blue-600" />
                  {dateRangeLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={handleDateRangeChange}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Selector de caja */}
        {currentReportConfig.needsCashRegister && (
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase text-slate-500">
              Caja / Turno
            </Label>
            <Select
              value={selectedCashRegister}
              onValueChange={setSelectedCashRegister}
              disabled={loadingCashRegisters || cashRegisters.length === 0}
            >
              <SelectTrigger className="h-12 border-2 font-bold">
                <SelectValue
                  placeholder={
                    loadingCashRegisters
                      ? "Cargando..."
                      : cashRegisters.length === 0
                        ? "No hay cajas en el período"
                        : "Seleccionar caja"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {cashRegisters.map((cr) => (
                  <SelectItem key={cr.id} value={cr.id}>
                    {format(new Date(cr.date), "dd/MM/yyyy", { locale: es })} -{" "}
                    {cr.employeeName || "Sin asignar"}{" "}
                    {cr.isClosed ? "(Cerrada)" : "(Abierta)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Formato de exportación */}
        <div className="space-y-2">
          <Label className="text-xs font-black uppercase text-slate-500">
            Formato
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={exportFormat === "pdf" ? "default" : "outline"}
              className={`h-14 font-bold ${
                exportFormat === "pdf" ? "bg-red-600 hover:bg-red-700" : ""
              }`}
              onClick={() => setExportFormat("pdf")}
            >
              <FileText className="mr-2 h-5 w-5" />
              PDF
            </Button>
            <Button
              variant={exportFormat === "excel" ? "default" : "outline"}
              className={`h-14 font-bold ${
                exportFormat === "excel" ? "bg-green-600 hover:bg-green-700" : ""
              }`}
              onClick={() => setExportFormat("excel")}
            >
              <FileSpreadsheet className="mr-2 h-5 w-5" />
              Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Botón de generar */}
      <Button
        className="w-full h-16 text-lg font-black rounded-2xl bg-blue-600 hover:bg-blue-700"
        onClick={handleGenerate}
        disabled={
          loading ||
          (currentReportConfig.needsDateRange && (!dateRange?.from || !dateRange?.to)) ||
          (currentReportConfig.needsCashRegister && !selectedCashRegister)
        }
      >
        {loading ? (
          <Loader2 className="animate-spin h-6 w-6" />
        ) : (
          <>
            <Download className="mr-2 h-6 w-6" />
            GENERAR REPORTE
          </>
        )}
      </Button>
    </div>
  )
}
