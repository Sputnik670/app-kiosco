"use client"

import { useState, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Card } from "@/components/ui/card"
import { Calendar as CalendarIcon, QrCode } from "lucide-react"
import { es } from "date-fns/locale"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"

// Componentes existentes
import CrearProducto from "@/components/crear-producto"
import GestionProveedores from "@/components/gestion-proveedores"
import ControlSaldoProveedor from "@/components/control-saldo-proveedor"
import { InvitarEmpleado } from "@/components/invitar-empleado"
import { generarTicketPDF } from "@/lib/generar-ticket"
import TeamRanking from "@/components/team-ranking"
import GenerarQRFichaje from "@/components/generar-qr-fichaje"
import { Reports } from "@/components/reports"

// Componentes de dashboard refactorizados
import {
  TabAlerts,
  TabInventory,
  TabSales,
  TabFinance,
  TabSupervision,
  DashboardHeader,
  DashboardModals,
  useDashboardState,
  useDashboardData,
} from "@/components/dashboard"

import type { TurnoAudit } from "@/types/dashboard.types"

const UMBRAL_STOCK_BAJO = 5

interface DashboardDuenoProps {
  onBack: () => void
  sucursalId: string
}

export default function DashboardDueno({ onBack, sucursalId }: DashboardDuenoProps) {
  // Estado de sucursal seleccionada (puede cambiar)
  const [currentSucursalId, setCurrentSucursalId] = useState(sucursalId)

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

  // Datos derivados
  const chartData = useMemo(() => {
    const map: Record<string, number> = {}
    data.ventasRecientes
      .slice()
      .reverse()
      .forEach((v) => {
        const k = format(parseISO(v.fecha_venta), "dd/MM")
        map[k] =
          (map[k] || 0) +
          (v.precio_venta_historico || v.productos?.precio_venta || 0) * (v.cantidad || 1)
      })
    return Object.entries(map).map(([fecha, total]) => ({ fecha, total }))
  }, [data.ventasRecientes])

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
            <TeamRanking />
            <InvitarEmpleado />
            <Card className="p-6 border-2">
              <h3 className="text-lg font-black text-slate-800 uppercase mb-4 flex items-center gap-2">
                <QrCode className="h-5 w-5 text-blue-600" /> Generar QR de Fichaje
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Genera códigos QR para que tus empleados puedan fichar entrada y salida
                escaneando el código del local.
              </p>
              <GenerarQRFichaje />
            </Card>
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
      />
    </div>
  )
}
