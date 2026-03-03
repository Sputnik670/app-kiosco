"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, Pencil, History, ChevronRight } from "lucide-react"
import { AgregarStock } from "@/components/agregar-stock"
import { cn } from "@/lib/utils"
import type { InventoryTabProps } from "@/types/dashboard.types"

export function TabInventory({
  productos,
  searchQuery,
  onSearchChange,
  loading,
  sucursalId,
  umbralStockBajo,
  formatMoney,
  onRefresh,
  onEditProduct,
  onLoadPriceHistory,
  onLoadStockBatches,
}: InventoryTabProps) {
  const inventarioFiltrado = productos.filter(
    p =>
      p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.codigo_barras?.includes(searchQuery)
  )

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <Input
          placeholder="FILTRAR STOCK LOCAL..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-12 h-16 text-sm font-bold shadow-inner border-2 rounded-2xl"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin h-12 w-12 text-primary" />
        </div>
      ) : (
        <div className="grid gap-4">
          {inventarioFiltrado.map(item => (
            <Card
              key={item.id}
              className="p-5 border-2 shadow-sm hover:border-primary/40 rounded-2xl group"
            >
              <div className="flex justify-between items-start mb-5">
                <div className="flex gap-4">
                  <div className="text-4xl bg-slate-100 p-3 rounded-2xl">
                    {item.emoji}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 uppercase text-sm">
                      {item.nombre}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-black uppercase mt-1">
                      {item.categoria}
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <Badge className="bg-slate-900 text-white text-[11px] font-black px-3 shadow-md">
                        ${item.precio_venta}
                      </Badge>
                      <button
                        onClick={() => onLoadPriceHistory(item.id)}
                        className="text-[10px] font-black text-primary uppercase"
                      >
                        <History className="h-3 w-3 inline mr-1" /> Historial
                      </button>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      "text-3xl font-black tabular-nums",
                      item.stock_disponible! <= umbralStockBajo
                        ? "text-red-500"
                        : "text-emerald-500"
                    )}
                  >
                    {item.stock_disponible}
                  </p>
                  <button
                    onClick={() => onLoadStockBatches(item.id)}
                    className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 justify-end font-bold"
                  >
                    Lotes <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <AgregarStock
                  producto={item}
                  sucursalId={sucursalId}
                  onStockAdded={onRefresh}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-xl shrink-0"
                  onClick={() => onEditProduct(item)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
