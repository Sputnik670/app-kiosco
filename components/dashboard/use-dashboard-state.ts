"use client"

import { useState, useMemo, useEffect } from "react"
import { DateRange } from "react-day-picker"
import { startOfDay, endOfDay, subDays, format } from "date-fns"
import { es } from "date-fns/locale"
import type {
  DashboardTab,
  ProductoDashboard,
  HistorialPrecio,
} from "@/types/dashboard.types"

// ─── Persistencia del tab activo ──────────────────────────────────────────────
// Guardamos el tab activo en sessionStorage para que, si por cualquier motivo
// el componente se re-monta (cambio de pestaña del navegador, refresh del
// service worker, etc.), no perdamos la vista donde estaba trabajando el usuario.
// sessionStorage (no localStorage) porque si cierra el tab del navegador
// queremos volver al default "ventas" en la próxima sesión.
const TAB_STORAGE_KEY = "kiosco:dashboard:activeTab"

const VALID_TABS: DashboardTab[] = [
  "stock",
  "ventas",
  "proveedores",
  "equipo",
  "historial",
  "analisis",
  "ajustes",
]

function getInitialTab(): DashboardTab {
  if (typeof window === "undefined") return "ventas"
  try {
    const stored = window.sessionStorage.getItem(TAB_STORAGE_KEY)
    if (stored && VALID_TABS.includes(stored as DashboardTab)) {
      return stored as DashboardTab
    }
  } catch {
    // sessionStorage puede fallar en modo privado en algunos browsers
  }
  return "ventas"
}

export interface DashboardState {
  // UI
  activeTab: DashboardTab
  searchQuery: string
  dateRange: DateRange | undefined
  loading: boolean
  actionLoading: boolean

  // Modales
  editingProduct: ProductoDashboard | null
  managingStockId: string | null
  stockBatchList: { id: string; quantity: number; created_at: string; unit_cost: number | null }[]
  showSalesDetail: boolean
  showPriceHistoryModal: boolean
  historyData: HistorialPrecio[]
}

export interface DashboardActions {
  setActiveTab: (tab: DashboardTab) => void
  setSearchQuery: (query: string) => void
  setDateRange: (range: DateRange | undefined) => void
  setLoading: (loading: boolean) => void
  setActionLoading: (loading: boolean) => void

  // Modales
  setEditingProduct: (product: ProductoDashboard | null) => void
  setManagingStockId: (id: string | null) => void
  setStockBatchList: (list: { id: string; quantity: number; created_at: string; unit_cost: number | null }[]) => void
  setShowSalesDetail: (show: boolean) => void
  setShowPriceHistoryModal: (show: boolean) => void
  setHistoryData: (data: HistorialPrecio[]) => void

  // Helpers
  closeAllModals: () => void
}

const defaultDateRange: DateRange = {
  from: startOfDay(subDays(new Date(), 7)),
  to: endOfDay(new Date()),
}

export function useDashboardState() {
  // UI State — activeTab se inicializa desde sessionStorage si existe
  const [activeTab, setActiveTab] = useState<DashboardTab>(getInitialTab)
  const [searchQuery, setSearchQuery] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultDateRange)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Modal State
  const [editingProduct, setEditingProduct] = useState<ProductoDashboard | null>(null)
  const [managingStockId, setManagingStockId] = useState<string | null>(null)
  const [stockBatchList, setStockBatchList] = useState<{ id: string; quantity: number; created_at: string; unit_cost: number | null }[]>([])
  const [showSalesDetail, setShowSalesDetail] = useState(false)
  const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false)
  const [historyData, setHistoryData] = useState<HistorialPrecio[]>([])

  // Persistir cambios del tab activo en sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.sessionStorage.setItem(TAB_STORAGE_KEY, activeTab)
    } catch {
      // Ignorar errores de sessionStorage (modo privado, quota, etc.)
    }
  }, [activeTab])

  // Computed
  const dateRangeLabel = useMemo(() => {
    if (!dateRange?.from) return "Filtro de Fecha"
    const from = format(dateRange.from, "dd/MM", { locale: es })
    if (!dateRange.to || format(dateRange.from, "yyyy-MM-dd") === format(dateRange.to, "yyyy-MM-dd")) {
      return `Día: ${from}`
    }
    return `${from} - ${format(dateRange.to, "dd/MM", { locale: es })}`
  }, [dateRange])

  // Actions
  const closeAllModals = () => {
    setEditingProduct(null)
    setManagingStockId(null)
    setShowSalesDetail(false)
    setShowPriceHistoryModal(false)
  }

  const state: DashboardState = {
    activeTab,
    searchQuery,
    dateRange,
    loading,
    actionLoading,
    editingProduct,
    managingStockId,
    stockBatchList,
    showSalesDetail,
    showPriceHistoryModal,
    historyData,
  }

  const actions: DashboardActions = {
    setActiveTab,
    setSearchQuery,
    setDateRange,
    setLoading,
    setActionLoading,
    setEditingProduct,
    setManagingStockId,
    setStockBatchList,
    setShowSalesDetail,
    setShowPriceHistoryModal,
    setHistoryData,
    closeAllModals,
  }

  return { state, actions, dateRangeLabel }
}
