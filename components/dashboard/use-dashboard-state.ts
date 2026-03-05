"use client"

import { useState, useMemo } from "react"
import { DateRange } from "react-day-picker"
import { startOfDay, endOfDay, subDays, format } from "date-fns"
import { es } from "date-fns/locale"
import type {
  DashboardTab,
  ProductoDashboard,
  HistorialPrecio,
} from "@/types/dashboard.types"

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
  // UI State
  const [activeTab, setActiveTab] = useState<DashboardTab>("ventas")
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
