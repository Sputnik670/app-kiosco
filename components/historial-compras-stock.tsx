// components/historial-compras-stock.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Package, Search, Calendar, Filter, ArrowUpDown, Loader2,
  ArrowUp, ArrowDown, X, DollarSign, Hash, TrendingUp
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { format, parseISO, subDays } from "date-fns"
import { es } from "date-fns/locale"
import {
  getStockPurchaseHistoryAction,
  getProductListForFilterAction,
  type StockPurchaseRecord,
  type StockPurchaseFilters,
} from "@/lib/actions/inventory.actions"

export default function HistorialComprasStock() {
  const [records, setRecords] = useState<StockPurchaseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ totalRecords: 0, totalUnits: 0, totalInvested: 0 })

  // Filtros
  const [showFilters, setShowFilters] = useState(false)
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedProduct, setSelectedProduct] = useState("")
  const [minCost, setMinCost] = useState("")
  const [maxCost, setMaxCost] = useState("")
  const [sortBy, setSortBy] = useState<'date' | 'product' | 'cost' | 'quantity'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Productos para el dropdown
  const [products, setProducts] = useState<{ id: string; name: string; category: string | null }[]>([])

  // Detalle de un registro
  const [selectedRecord, setSelectedRecord] = useState<StockPurchaseRecord | null>(null)

  const fetchProducts = useCallback(async () => {
    const result = await getProductListForFilterAction()
    if (result.success) setProducts(result.products)
  }, [])

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    const filters: StockPurchaseFilters = {
      dateFrom,
      dateTo,
      productId: selectedProduct || undefined,
      minCost: minCost ? Number(minCost) : undefined,
      maxCost: maxCost ? Number(maxCost) : undefined,
      sortBy,
      sortOrder,
    }
    const result = await getStockPurchaseHistoryAction(filters)
    if (result.success) {
      setRecords(result.records)
      setSummary(result.summary)
    } else {
      toast.error("Error al cargar historial", { description: result.error })
    }
    setLoading(false)
  }, [dateFrom, dateTo, selectedProduct, minCost, maxCost, sortBy, sortOrder])

  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { fetchHistory() }, [fetchHistory])

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder(field === 'date' ? 'desc' : 'asc')
    }
  }

  const clearFilters = () => {
    setDateFrom(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
    setDateTo(format(new Date(), 'yyyy-MM-dd'))
    setSelectedProduct("")
    setMinCost("")
    setMaxCost("")
    setSortBy('date')
    setSortOrder('desc')
  }

  const hasActiveFilters = selectedProduct || minCost || maxCost

  const SortIcon = ({ field }: { field: typeof sortBy }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />
    return sortOrder === 'asc'
      ? <ArrowUp className="h-3 w-3 text-indigo-600" />
      : <ArrowDown className="h-3 w-3 text-indigo-600" />
  }

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600" /> Historial de Compras
            </h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              Todas las entradas de mercadería
            </p>
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filtros
            {hasActiveFilters && (
              <span className="ml-1 h-4 w-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-black">!</span>
            )}
          </Button>
        </div>

        {/* RESUMEN */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-indigo-50 rounded-lg p-2 text-center">
            <p className="text-[9px] font-bold uppercase text-indigo-400">Entradas</p>
            <p className="text-lg font-black text-indigo-700">{summary.totalRecords}</p>
          </div>
          <div className="bg-violet-50 rounded-lg p-2 text-center">
            <p className="text-[9px] font-bold uppercase text-violet-400">Unidades</p>
            <p className="text-lg font-black text-violet-700">{summary.totalUnits.toLocaleString('es-AR')}</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2 text-center">
            <p className="text-[9px] font-bold uppercase text-emerald-400">Invertido</p>
            <p className="text-sm font-black text-emerald-700">{formatMoney(summary.totalInvested)}</p>
          </div>
        </div>
      </div>

      {/* PANEL DE FILTROS */}
      {showFilters && (
        <Card className="p-4 border-indigo-200 bg-indigo-50/30">
          <div className="space-y-3">
            {/* Fecha */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] font-bold uppercase text-indigo-500">Desde</Label>
                <Input
                  type="date"
                  className="h-9 text-sm font-medium"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase text-indigo-500">Hasta</Label>
                <Input
                  type="date"
                  className="h-9 text-sm font-medium"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
            </div>

            {/* Producto */}
            <div>
              <Label className="text-[10px] font-bold uppercase text-indigo-500">Producto</Label>
              <select
                title="Filtrar por producto"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
              >
                <option value="">Todos los productos</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.category ? `(${p.category})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Rango de costo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] font-bold uppercase text-indigo-500">Costo mín ($)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  className="h-9 text-sm font-medium"
                  value={minCost}
                  onChange={e => setMinCost(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase text-indigo-500">Costo máx ($)</Label>
                <Input
                  type="number"
                  placeholder="999999"
                  className="h-9 text-sm font-medium"
                  value={maxCost}
                  onChange={e => setMaxCost(e.target.value)}
                />
              </div>
            </div>

            {/* Acciones filtro */}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="ghost" className="text-[10px] font-bold" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" /> Limpiar filtros
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* CABECERA DE ORDENAMIENTO */}
      <div className="grid grid-cols-4 gap-1 px-2">
        <button onClick={() => handleSort('date')} className="flex items-center gap-1 text-[9px] font-bold uppercase text-slate-400 hover:text-indigo-600 transition-colors">
          <Calendar className="h-3 w-3" /> Fecha <SortIcon field="date" />
        </button>
        <button onClick={() => handleSort('product')} className="flex items-center gap-1 text-[9px] font-bold uppercase text-slate-400 hover:text-indigo-600 transition-colors">
          <Package className="h-3 w-3" /> Producto <SortIcon field="product" />
        </button>
        <button onClick={() => handleSort('quantity')} className="flex items-center gap-1 text-[9px] font-bold uppercase text-slate-400 hover:text-indigo-600 transition-colors justify-end">
          <Hash className="h-3 w-3" /> Cant <SortIcon field="quantity" />
        </button>
        <button onClick={() => handleSort('cost')} className="flex items-center gap-1 text-[9px] font-bold uppercase text-slate-400 hover:text-indigo-600 transition-colors justify-end">
          <DollarSign className="h-3 w-3" /> Costo <SortIcon field="cost" />
        </button>
      </div>

      {/* LISTA DE REGISTROS */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>
      ) : records.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-medium text-muted-foreground">No hay registros para estos filtros</p>
          <p className="text-[10px] text-slate-400 mt-1">Probá ampliando el rango de fechas</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {records.map(record => (
            <Card
              key={record.id}
              className="p-3 hover:border-indigo-300 transition-all cursor-pointer shadow-sm"
              onClick={() => setSelectedRecord(record)}
            >
              <div className="grid grid-cols-4 gap-1 items-center">
                {/* Fecha */}
                <div>
                  <p className="text-[11px] font-bold">
                    {format(parseISO(record.date), 'dd/MM/yy', { locale: es })}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {format(parseISO(record.date), 'HH:mm')}
                  </p>
                </div>

                {/* Producto */}
                <div className="truncate">
                  <p className="text-[11px] font-bold truncate">{record.productName}</p>
                  {record.productCategory && (
                    <p className="text-[9px] text-indigo-500 font-medium">{record.productCategory}</p>
                  )}
                </div>

                {/* Cantidad */}
                <div className="text-right">
                  <p className="text-[11px] font-black text-violet-700">x{record.quantity}</p>
                </div>

                {/* Costo */}
                <div className="text-right">
                  <p className="text-[11px] font-bold text-emerald-700">{formatMoney(record.unitCost)}</p>
                  <p className="text-[9px] text-muted-foreground">{formatMoney(record.totalCost)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL DETALLE */}
      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" /> Detalle de Compra
            </DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 mt-2">
              <div className="bg-indigo-50 rounded-lg p-4">
                <h4 className="font-black text-lg">{selectedRecord.productName}</h4>
                {selectedRecord.productCategory && (
                  <span className="text-[10px] font-bold uppercase text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded-full">
                    {selectedRecord.productCategory}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border text-center">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Fecha</p>
                  <p className="text-sm font-black">
                    {format(parseISO(selectedRecord.date), 'dd/MM/yyyy', { locale: es })}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(parseISO(selectedRecord.date), 'HH:mm', { locale: es })} hs
                  </p>
                </div>
                <div className="p-3 bg-violet-50 rounded-lg border text-center">
                  <p className="text-[10px] uppercase font-bold text-violet-500">Cantidad</p>
                  <p className="text-xl font-black text-violet-700">{selectedRecord.quantity}</p>
                  <p className="text-[10px] text-violet-400">unidades</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 rounded-lg border text-center">
                  <p className="text-[10px] uppercase font-bold text-emerald-500">Costo Unitario</p>
                  <p className="text-sm font-black text-emerald-700">{formatMoney(selectedRecord.unitCost)}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border text-center">
                  <p className="text-[10px] uppercase font-bold text-emerald-500">Total Invertido</p>
                  <p className="text-sm font-black text-emerald-700">{formatMoney(selectedRecord.totalCost)}</p>
                </div>
              </div>

              {selectedRecord.supplierName && (
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Proveedor</p>
                  <p className="text-sm font-bold">{selectedRecord.supplierName}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
