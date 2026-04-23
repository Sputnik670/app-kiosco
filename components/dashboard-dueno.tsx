"use client"

import { useState, useMemo, Suspense } from "react"
import dynamic from "next/dynamic"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Card } from "@/components/ui/card"
import { Calendar as CalendarIcon, QrCode, Loader2 } from "lucide-react"
import { es } from "date-fns/locale"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"

// Utilidades que se necesitan siempre (ligeras)
import { generarTicketPDF } from "@/lib/generar-ticket"

// Componentes de dashboard que se cargan siempre (header, hooks, modales)
import {
  DashboardHeader,
  DashboardModals,
  useDashboardState,
  useDashboardData,
} from "@/components/dashboard"

// ─── LAZY LOAD: Componentes pesados de cada tab ─────────────────────────────
// Solo se descargan cuando el usuario navega al tab correspondiente.
// Esto ahorra ~1MB+ de JS en la carga inicial del dashboard.

const TabLoadingFallback = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
  </div>
)

// Tab Stock
const CrearProducto = dynamic(() => import("@/components/crear-producto"), {
  loading: TabLoadingFallback,
})
const TabInventory = dynamic(
  () => import("@/components/dashboard/tab-inventory").then((m) => ({ default: m.TabInventory })),
  { loading: TabLoadingFallback }
)

// Tab Ventas
const TabSales = dynamic(
  () => import("@/components/dashboard/tab-sales").then((m) => ({ default: m.TabSales })),
  { loading: TabLoadingFallback }
)

// Tab Proveedores
const GestionProveedores = dynamic(() => import("@/components/gestion-proveedores"), {
  loading: TabLoadingFallback,
})
const ControlSaldoProveedor = dynamic(() => import("@/components/control-saldo-proveedor"), {
  loading: TabLoadingFallback,
})

// Tab Equipo
const TabSupervision = dynamic(
  () => import("@/components/dashboard/tab-supervision").then((m) => ({ default: m.TabSupervision })),
  { loading: TabLoadingFallback }
)
const TeamRanking = dynamic(() => import("@/components/team-ranking"), {
  loading: TabLoadingFallback,
})
const GestionIncidentes = dynamic(() => import("@/components/gestion-incidentes"), {
  loading: TabLoadingFallback,
})
const InvitarEmpleado = dynamic(
  () => import("@/components/invitar-empleado").then((m) => ({ default: m.InvitarEmpleado })),
  { loading: TabLoadingFallback }
)
const TarjetasQREmpleados = dynamic(() => import("@/components/tarjetas-qr-empleados"), {
  loading: TabLoadingFallback,
})
const QREmpleadoScanner = dynamic(() => import("@/components/qr-empleado-scanner"), {
  ssr: false,
})
const XpAnalytics = dynamic(() => import("@/components/xp-analytics"), {
  loading: TabLoadingFallback,
})
const AjusteManualXp = dynamic(() => import("@/components/ajuste-manual-xp"), {
  loading: TabLoadingFallback,
})
const ConfiguracionRendimiento = dynamic(() => import("@/components/configuracion-rendimiento"), {
  loading: TabLoadingFallback,
})

// Tab Historial (Timeline unificada)
const TabTimeline = dynamic(
  () => import("@/components/dashboard/tab-timeline").then((m) => ({ default: m.TabTimeline })),
  { loading: TabLoadingFallback }
)

// Tab Análisis
const TabFinance = dynamic(
  () => import("@/components/dashboard/tab-finance").then((m) => ({ default: m.TabFinance })),
  { loading: TabLoadingFallback }
)
const TabAlerts = dynamic(
  () => import("@/components/dashboard/tab-alerts").then((m) => ({ default: m.TabAlerts })),
  { loading: TabLoadingFallback }
)
const Reports = dynamic(
  () => import("@/components/reports").then((m) => ({ default: m.Reports })),
  { loading: TabLoadingFallback }
)

// Tab Ajustes
const ConfiguracionMercadoPago = dynamic(() => import("@/components/configuracion-mercadopago"), {
  loading: TabLoadingFallback,
})
const ConfiguracionArca = dynamic(() => import("@/components/configuracion-arca"), {
  loading: TabLoadingFallback,
})

import type { TurnoAudit } from "@/types/dashboard.types"

const UMBRAL_STOCK_BAJO = 5

interface DashboardDuenoProps {
  onBack: () => void
  sucursalId: string
}

export default function DashboardDueno({ onBack, sucursalId }: DashboardDuenoProps) {
  // Estado de sucursal seleccionada (puede cambiar)
  const [currentSucursalId, setCurrentSucursalId] = useState(sucursalId)

  // Scanner de fichaje por tarjeta QR de empleado (2026-04-23)
  const [fichajeScannerOpen, setFichajeScannerOpen] = useState(false)

  // Hooks refactorizados
  const { state, actions, dateRangeLabel } = useDashboardState()
  const { data, refetch, refetchContext } = useDashboardData(currentSucursalId, state.dateRange)

  // Utilidades
  const formatMoney = (amount: number | null) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount || 0)

  // Datos derivados: Productos + Servicios en el gráfico
  const chartData = useMemo(() => {
    const map: Record<string, number> = {}
    // Sumar ventas de productos
    data.ventasRecientes
      .slice()
      .reverse()
      .forEach((v) => {
        const k = format(parseISO(v.fecha_venta), "dd/MM")
        map[k] =
          (map[k] || 0) +
          (v.precio_venta_historico || v.productos?.precio_venta || 0) * (v.cantidad || 1)
      })
    // Sumar ventas de servicios virtuales
    data.ventasServicios.forEach((s) => {
      const k = format(parseISO(s.fecha_venta), "dd/MM")
      map[k] = (map[k] || 0) + s.total_cobrado
    })
    return Object.entries(map).map(([fecha, total]) => ({ fecha, total }))
  }, [data.ventasRecientes, data.ventasServicios])

  // Handlers
  const loadPriceHistory = async (pid: string) => {
    actions.setLoading(true)
    const { data: historyData } = await supabase
      .from("price_history")
      .select("*")
      .eq("product_id", pid)
      .order("created_at", { ascending: false })
    actions.setHistoryData(historyData || [])
    actions.setShowPriceHistoryModal(true)
    actions.setLoading(false)
  }

  const loadStockBatches = async (pid: string) => {
    actions.setManagingStockId(pid)
    const { data: batchData } = await supabase
      .from("stock_batches")
      .select("id, quantity, created_at, unit_cost")
      .eq("product_id", pid)
      .eq("branch_id", currentSucursalId)
      .order("created_at", { ascending: false })
    actions.setStockBatchList(batchData || [])
  }

  const handlePrintTurno = async (t: TurnoAudit) => {
    const vT = data.ventasRecientes.filter((v) => {
      const fV = parseISO(v.fecha_venta)
      const fA = parseISO(t.fecha_apertura)
      const fC = t.fecha_cierre ? parseISO(t.fecha_cierre) : new Date()
      return fV >= fA && fV <= fC
    })

    const totE = vT
      .filter((v) => v.metodo_pago === "efectivo")
      .reduce(
        (acc, curr) =>
          acc +
          (curr.precio_venta_historico || curr.productos?.precio_venta || 0) * (curr.cantidad || 1),
        0
      )
    const movimientosReales = t.movimientos_caja?.filter((m) => m.categoria !== "ventas") || []
    const gast = movimientosReales.filter((m) => m.tipo === "egreso").reduce((a, b) => a + b.monto, 0)
    const extra = movimientosReales.filter((m) => m.tipo === "ingreso").reduce((a, b) => a + b.monto, 0)
    const esp = t.monto_inicial + totE + extra - gast

    await generarTicketPDF({
      empleado: t.perfiles?.nombre || "Empleado",
      fechaApertura: format(parseISO(t.fecha_apertura), "dd/MM/yyyy HH:mm"),
      fechaCierre: t.fecha_cierre ? format(parseISO(t.fecha_cierre), "dd/MM/yyyy HH:mm") : null,
      montoInicial: t.monto_inicial,
      totalVentasEfectivo: totE,
      totalIngresos: extra,
      totalGastos: gast,
      cajaEsperada: esp,
      cajaReal: t.monto_final,
      diferencia: t.monto_final !== null ? t.monto_final - esp : null,
      gastos: movimientosReales.map((m) => ({
        descripcion: m.descripcion || "",
        monto: m.monto,
        tipo: m.tipo,
        categoria: m.categoria,
      })),
      sucursalNombre: data.sucursales.find(s => s.id === currentSucursalId)?.nombre,
    })
    toast.success("Ticket generado")
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header con tabs */}
      <DashboardHeader
        sucursales={data.sucursales}
        currentSucursalId={currentSucursalId}
        organizationId={data.organizationId}
        activeTab={state.activeTab}
        onSucursalChange={setCurrentSucursalId}
        onTabChange={actions.setActiveTab}
        onBack={onBack}
        onSucursalesUpdate={refetchContext}
        formatMoney={formatMoney}
      />

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Date Filter */}
        {["ventas", "equipo", "analisis"].includes(state.activeTab) && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start h-14 border-2 shadow-sm bg-white font-black text-slate-700"
              >
                <CalendarIcon className="mr-2 h-5 w-5 text-primary" />{" "}
                {dateRangeLabel.toUpperCase()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="range"
                selected={state.dateRange}
                onSelect={actions.setDateRange}
                locale={es}
              />
            </PopoverContent>
          </Popover>
        )}

        {/* Tab Content — 5 tabs consolidados */}

        {/* STOCK: Alta de Catálogo + Inventario */}
        {state.activeTab === "stock" && (
          <div className="space-y-6 animate-in fade-in">
            <CrearProducto
              sucursalId={currentSucursalId}
              onProductCreated={() => refetch()}
            />
            <TabInventory
              sucursalId={currentSucursalId}
              organizationId={data.organizationId}
              formatMoney={formatMoney}
              onRefresh={refetch}
              productos={data.productos}
              searchQuery={state.searchQuery}
              onSearchChange={actions.setSearchQuery}
              loading={state.loading || data.isLoading}
              umbralStockBajo={UMBRAL_STOCK_BAJO}
              onEditProduct={actions.setEditingProduct}
              onLoadPriceHistory={loadPriceHistory}
              onLoadStockBatches={loadStockBatches}
            />
          </div>
        )}

        {/* VENTAS: Caja y Ventas del día */}
        {state.activeTab === "ventas" && (
          <TabSales
            sucursalId={currentSucursalId}
            organizationId={data.organizationId}
            formatMoney={formatMoney}
            onRefresh={refetch}
            totalVendido={data.totalVendido}
            totalServiciosVendido={data.totalServiciosVendido}
            paymentBreakdown={data.paymentBreakdown}
            paymentBreakdownServicios={data.paymentBreakdownServicios}
            ventasRecientes={data.ventasRecientes}
            ventasServicios={data.ventasServicios}
            chartData={chartData}
            onShowSalesDetail={() => actions.setShowSalesDetail(true)}
          />
        )}

        {/* PROVEEDORES */}
        {state.activeTab === "proveedores" && (
          <div className="space-y-6 animate-in fade-in">
            <ControlSaldoProveedor />
            <GestionProveedores
              sucursalId={currentSucursalId}
              organizationId={data.organizationId}
            />
          </div>
        )}

        {/* CONTROL EMPLEADOS: Supervisión + Equipo + Fichaje */}
        {state.activeTab === "equipo" && (
          <div className="space-y-6 animate-in fade-in">
            <TabSupervision
              sucursalId={currentSucursalId}
              organizationId={data.organizationId}
              formatMoney={formatMoney}
              onRefresh={refetch}
              turnosAudit={data.turnosAudit}
              asistencias={data.asistencias}
              ventasRecientes={data.ventasRecientes}
              onPrintTurno={handlePrintTurno}
            />
            <Card className="p-5 border-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-800 uppercase flex items-center gap-2">
                  Control de Rendimiento
                </h3>
                <AjusteManualXp branchId={currentSucursalId} />
              </div>
              <XpAnalytics branchId={currentSucursalId} />
            </Card>
            <TeamRanking />
            <GestionIncidentes sucursalId={currentSucursalId} organizationId={data.organizationId} />
            <InvitarEmpleado />
            <ConfiguracionRendimiento
              branches={data.sucursales.map(s => ({ id: s.id, name: s.nombre }))}
            />
            <Card className="p-6 border-2">
              <h3 className="text-lg font-black text-slate-800 uppercase mb-4 flex items-center gap-2">
                <QrCode className="h-5 w-5 text-blue-600" /> Tarjetas QR de Fichaje
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Cada empleado tiene una tarjeta QR personal. Imprimila y entregala; luego
                escaneala desde este dispositivo para abrir o cerrar su turno.
              </p>
              <TarjetasQREmpleados onOpenScanner={() => setFichajeScannerOpen(true)} />
            </Card>
          </div>
        )}

        {/* HISTORIAL: Timeline unificada con todo el registro del negocio */}
        {state.activeTab === "historial" && (
          <TabTimeline formatMoney={formatMoney} />
        )}

        {/* AJUSTES: Configuración de integraciones */}
        {state.activeTab === "ajustes" && (
          <div className="space-y-6 animate-in fade-in">
            <ConfiguracionMercadoPago />
            <ConfiguracionArca />
          </div>
        )}

        {/* ANÁLISIS: BI + Alertas + Reportes */}
        {state.activeTab === "analisis" && (
          <div className="space-y-6 animate-in fade-in">
            <TabFinance
              sucursalId={currentSucursalId}
              organizationId={data.organizationId}
              formatMoney={formatMoney}
              onRefresh={refetch}
              biMetrics={data.biMetrics}
            />
            <TabAlerts
              sucursalId={currentSucursalId}
              organizationId={data.organizationId}
              formatMoney={formatMoney}
              onRefresh={refetch}
              capitalEnRiesgo={data.capitalEnRiesgo}
              productos={data.productos}
              umbralStockBajo={UMBRAL_STOCK_BAJO}
            />
            <Reports
              branchId={currentSucursalId}
              branchName={data.sucursales.find(s => s.id === currentSucursalId)?.nombre || "Sucursal"}
            />
          </div>
        )}
      </div>

      {/* Modales */}
      <DashboardModals
        editingProduct={state.editingProduct}
        onEditingProductChange={actions.setEditingProduct}
        actionLoading={state.actionLoading}
        onActionLoadingChange={actions.setActionLoading}
        onRefresh={refetch}
        formatMoney={formatMoney}
        showPriceHistoryModal={state.showPriceHistoryModal}
        onShowPriceHistoryChange={actions.setShowPriceHistoryModal}
        historyData={state.historyData}
        managingStockId={state.managingStockId}
        onManagingStockIdChange={actions.setManagingStockId}
        stockBatchList={state.stockBatchList}
        showSalesDetail={state.showSalesDetail}
        onShowSalesDetailChange={actions.setShowSalesDetail}
        ventasRecientes={data.ventasRecientes}
        ventasServicios={data.ventasServicios}
      />

      {/* Scanner de tarjeta QR de empleado para fichaje */}
      {fichajeScannerOpen && (
        <QREmpleadoScanner
          isOpen={fichajeScannerOpen}
          onClose={() => setFichajeScannerOpen(false)}
          branchId={currentSucursalId}
          showHoursOnExit={true}
        />
      )}
    </div>
  )
}
