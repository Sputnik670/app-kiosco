"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { getOwnerStatsAction, getInventoryCriticalAction, type BusinessMetrics } from "@/lib/actions/dashboard.actions"
import { DateRange } from "react-day-picker"
import type {
  MetricaStock,
  ProductoDashboard,
  VentaJoin,
  VentaServicio,
  PaymentBreakdown,
  TurnoAudit,
  AsistenciaRecord,
} from "@/types/dashboard.types"

export interface DashboardData {
  // Contexto
  organizationId: string
  sucursales: { id: string; nombre: string }[]

  // Datos
  productos: ProductoDashboard[]
  capitalEnRiesgo: MetricaStock
  ventasRecientes: VentaJoin[]
  totalVendido: number
  paymentBreakdown: PaymentBreakdown
  ventasServicios: VentaServicio[]
  totalServiciosVendido: number
  paymentBreakdownServicios: PaymentBreakdown
  turnosAudit: TurnoAudit[]
  asistencias: AsistenciaRecord[]
  biMetrics: BusinessMetrics

  // Estado
  isLoading: boolean
}

const emptyPaymentBreakdown: PaymentBreakdown = {
  cash: 0,
  card: 0,
  transfer: 0,
  wallet: 0,
}

const emptyMetrics: BusinessMetrics = {
  gross: 0,
  net: 0,
  margin: 0,
  traceable: 0,
  cash: 0,
  ROI: 0,
}

export function useDashboardData(
  sucursalId: string,
  dateRange: DateRange | undefined
) {
  // Contexto
  const [organizationId, setOrganizationId] = useState("")
  const [sucursales, setSucursales] = useState<{ id: string; nombre: string }[]>([])

  // Datos
  const [productos, setProductos] = useState<ProductoDashboard[]>([])
  const [capitalEnRiesgo, setCapitalEnRiesgo] = useState<MetricaStock>({
    capital: 0,
    unidades: 0,
    criticos: [],
  })
  const [ventasRecientes, setVentasRecientes] = useState<VentaJoin[]>([])
  const [totalVendido, setTotalVendido] = useState(0)
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown>(emptyPaymentBreakdown)
  const [ventasServicios, setVentasServicios] = useState<VentaServicio[]>([])
  const [totalServiciosVendido, setTotalServiciosVendido] = useState(0)
  const [paymentBreakdownServicios, setPaymentBreakdownServicios] = useState<PaymentBreakdown>(emptyPaymentBreakdown)
  const [turnosAudit, setTurnosAudit] = useState<TurnoAudit[]>([])
  const [asistencias, setAsistencias] = useState<AsistenciaRecord[]>([])
  const [biMetrics, setBiMetrics] = useState<BusinessMetrics>(emptyMetrics)
  const [isLoading, setIsLoading] = useState(false)

  // Fetch contexto de organización
  const fetchContext = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()

    if (!membership?.organization_id) return
    setOrganizationId(membership.organization_id)

    const { data } = await supabase
      .from("branches")
      .select("id, name")
      .eq("organization_id", membership.organization_id)
      .eq("is_active", true)
      .order("created_at")

    if (data) {
      setSucursales(data.map((b) => ({ id: b.id, nombre: b.name })))
    }
  }, [])

  // Fetch datos principales
  const fetchData = useCallback(async () => {
    if (!sucursalId || !organizationId) return

    setIsLoading(true)

    try {
      // Estadísticas financieras
      const statsResult = await getOwnerStatsAction(
        sucursalId,
        dateRange?.from?.toISOString() || "",
        dateRange?.to?.toISOString() || ""
      )

      if (statsResult.success) {
        setTotalVendido(statsResult.totalSold)
        setPaymentBreakdown(statsResult.paymentBreakdown)
        setBiMetrics(statsResult.businessMetrics)
      }

      // Inventario crítico
      const inventoryResult = await getInventoryCriticalAction(sucursalId)
      if (inventoryResult.success) {
        setCapitalEnRiesgo({
          capital: inventoryResult.expiringItems.totalValue,
          unidades: inventoryResult.expiringItems.totalUnits,
          criticos: inventoryResult.expiringItems.items.map((item) => ({
            id: item.id,
            producto_id: item.productId,
            nombre: item.productName,
            emoji: item.emoji,
            fechaVenc: item.expirationDate,
            cantidad: item.quantity,
            monto: item.valueAtRisk,
          })),
        })
      }

      // Productos con stock
      const { data: productsData } = await supabase
        .from("v_products_with_stock")
        .select("*")
        .eq("branch_id", sucursalId)
        .eq("is_active", true)

      if (productsData) {
        const fusion = productsData.map((p) => ({
          id: p.id || "",
          nombre: p.name || "",
          categoria: p.category || null,
          precio_venta: Number(p.sale_price) || 0,
          costo: Number(p.cost) || 0,
          emoji: p.emoji || null,
          codigo_barras: p.barcode || null,
          stock_disponible: Number(p.stock_available) || 0,
        }))
        setProductos(fusion)
      }

      // Ventas recientes
      let salesQuery = supabase
        .from("sales")
        .select(
          "id, total, payment_method, created_at, notes, sale_items(quantity, unit_price, products(name, emoji))"
        )
        .eq("branch_id", sucursalId)

      if (dateRange?.from) {
        salesQuery = salesQuery.gte("created_at", dateRange.from.toISOString())
      }
      if (dateRange?.to) {
        salesQuery = salesQuery.lte("created_at", dateRange.to.toISOString())
      }

      const { data: salesData } = await salesQuery
        .order("created_at", { ascending: false })
        .limit(50)

      if (salesData) {
        const ventasRecientesMaped = salesData.map((s) => {
          const items = s.sale_items as unknown as Array<{
            quantity: number
            unit_price: number
            products: { name: string; emoji?: string } | null
          }> | null
          const firstItem = items && items.length > 0 ? items[0] : null
          return {
            id: s.id,
            fecha_venta: s.created_at,
            metodo_pago: s.payment_method,
            cantidad: items
              ? items.reduce((sum, item) => sum + (item.quantity || 0), 0)
              : 0,
            productos: firstItem?.products
              ? {
                  nombre: firstItem.products.name,
                  precio_venta: firstItem.unit_price || 0,
                  emoji: firstItem.products.emoji || "📦",
                }
              : null,
            notas: s.notes,
          }
        })
        setVentasRecientes(ventasRecientesMaped as VentaJoin[])
      }

      // Servicios (vacío por ahora)
      setVentasServicios([])
      setTotalServiciosVendido(0)
      setPaymentBreakdownServicios(emptyPaymentBreakdown)

      // Turnos/Cajas
      let cashQuery = supabase
        .from("cash_registers")
        .select(
          "id, date, opening_amount, closing_amount, is_open, opened_at, closed_at, opened_by, memberships(display_name), cash_movements(*), missions(*)"
        )
        .eq("branch_id", sucursalId)

      if (dateRange?.from) {
        cashQuery = cashQuery.gte("date", dateRange.from.toISOString().split("T")[0])
      }
      if (dateRange?.to) {
        cashQuery = cashQuery.lte("date", dateRange.to.toISOString().split("T")[0])
      }

      const { data: cashData } = await cashQuery.order("date", { ascending: false })

      if (cashData) {
        const turnosMaped = cashData.map((c) => ({
          id: c.id,
          fecha_apertura: c.opened_at || c.date,
          fecha_cierre: c.closed_at || null,
          monto_inicial: c.opening_amount || 0,
          monto_final: c.closing_amount || null,
          empleado_id: c.opened_by || "",
          sucursal_id: sucursalId,
          perfiles: c.memberships
            ? { nombre: (c.memberships as unknown as { display_name: string }).display_name }
            : null,
          misiones: Array.isArray(c.missions)
            ? c.missions.map((m) => ({
                id: m.id,
                descripcion: m.description || "",
                es_completada: m.is_completed || false,
                puntos: m.points || 0,
              }))
            : [],
          movimientos_caja: Array.isArray(c.cash_movements)
            ? c.cash_movements.map((m) => ({
                id: m.id,
                tipo: m.type as "ingreso" | "egreso",
                monto: m.amount || 0,
                categoria: m.category || "",
                descripcion: m.description || null,
                created_at: m.created_at,
              }))
            : [],
        }))
        setTurnosAudit(turnosMaped as TurnoAudit[])
      }

      // Asistencias
      let attQuery = supabase
        .from("attendance")
        .select("id, check_in, check_out, user_id, branch_id, memberships(display_name)")
        .eq("branch_id", sucursalId)

      if (dateRange?.from) {
        attQuery = attQuery.gte("check_in", dateRange.from.toISOString())
      }
      if (dateRange?.to) {
        attQuery = attQuery.lte("check_in", dateRange.to.toISOString())
      }

      const { data: attData } = await attQuery
        .order("check_in", { ascending: false })
        .limit(50)

      if (attData) {
        const asistenciasMaped = attData.map((a) => ({
          id: a.id,
          entrada: a.check_in,
          salida: a.check_out || null,
          empleado_id: a.user_id,
          perfiles: a.memberships
            ? { nombre: (a.memberships as unknown as { display_name: string }).display_name }
            : null,
          sucursal_id: a.branch_id,
        }))
        setAsistencias(asistenciasMaped as AsistenciaRecord[])
      }
    } finally {
      setIsLoading(false)
    }
  }, [sucursalId, organizationId, dateRange])

  // Efectos
  useEffect(() => {
    fetchContext()
  }, [fetchContext])

  useEffect(() => {
    if (organizationId) {
      fetchData()
    }
  }, [fetchData, organizationId])

  const data: DashboardData = {
    organizationId,
    sucursales,
    productos,
    capitalEnRiesgo,
    ventasRecientes,
    totalVendido,
    paymentBreakdown,
    ventasServicios,
    totalServiciosVendido,
    paymentBreakdownServicios,
    turnosAudit,
    asistencias,
    biMetrics,
    isLoading,
  }

  return {
    data,
    refetch: fetchData,
    refetchContext: fetchContext,
  }
}
