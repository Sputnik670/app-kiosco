"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Pencil, Clock, History, Trash2, Receipt } from "lucide-react"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { updateProductAction, deleteProductAction } from "@/lib/actions/product.actions"
import type { ProductoDashboard, HistorialPrecio, VentaJoin } from "@/types/dashboard.types"

interface DashboardModalsProps {
  // Editar producto
  editingProduct: ProductoDashboard | null
  onEditingProductChange: (product: ProductoDashboard | null) => void
  actionLoading: boolean
  onActionLoadingChange: (loading: boolean) => void
  onRefresh: () => void
  formatMoney: (amount: number | null) => string

  // Historial de precios
  showPriceHistoryModal: boolean
  onShowPriceHistoryChange: (show: boolean) => void
  historyData: HistorialPrecio[]

  // Lotes de stock
  managingStockId: string | null
  onManagingStockIdChange: (id: string | null) => void
  stockBatchList: { id: string; quantity: number; created_at: string; unit_cost: number | null }[]

  // Detalle de ventas
  showSalesDetail: boolean
  onShowSalesDetailChange: (show: boolean) => void
  ventasRecientes: VentaJoin[]
}

export function DashboardModals({
  editingProduct,
  onEditingProductChange,
  actionLoading,
  onActionLoadingChange,
  onRefresh,
  formatMoney,
  showPriceHistoryModal,
  onShowPriceHistoryChange,
  historyData,
  managingStockId,
  onManagingStockIdChange,
  stockBatchList,
  showSalesDetail,
  onShowSalesDetailChange,
  ventasRecientes,
}: DashboardModalsProps) {
  const handleUpdateProduct = async () => {
    if (!editingProduct) return
    onActionLoadingChange(true)
    try {
      const result = await updateProductAction(editingProduct.id, {
        nombre: editingProduct.nombre,
        precio_venta: editingProduct.precio_venta,
        costo: editingProduct.costo,
        categoria: editingProduct.categoria || "",
        emoji: editingProduct.emoji ?? undefined,
        codigo_barras: editingProduct.codigo_barras ?? undefined,
      })

      if (!result.success) {
        toast.error(result.error || "Error al actualizar producto")
        return
      }

      toast.success("Producto actualizado")
      onEditingProductChange(null)
      onRefresh()
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Error desconocido"
      toast.error(errorMessage)
    } finally {
      onActionLoadingChange(false)
    }
  }

  const handleDeleteProduct = async () => {
    if (!editingProduct) return
    if (confirm("¿Eliminar?")) {
      const result = await deleteProductAction(editingProduct.id)
      if (result.success) {
        toast.success("Producto eliminado")
        onRefresh()
        onEditingProductChange(null)
      } else {
        toast.error(result.error || "Error al eliminar producto")
      }
    }
  }

  const handleDeleteStockBatch = async (batchId: string) => {
    if (confirm("¿Eliminar lote?")) {
      await supabase.from("stock_batches").delete().eq("id", batchId)
      onRefresh()
      onManagingStockIdChange(null)
    }
  }

  return (
    <>
      {/* Modal: Editar Producto */}
      <Dialog open={!!editingProduct} onOpenChange={(o) => !o && onEditingProductChange(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Editar Catálogo
            </DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <Label className="text-[10px] font-black uppercase">Icono</Label>
                  <Input
                    value={editingProduct.emoji ?? ""}
                    onChange={(e) =>
                      onEditingProductChange({ ...editingProduct, emoji: e.target.value })
                    }
                    className="text-center text-3xl h-16 rounded-2xl bg-slate-50"
                  />
                </div>
                <div className="col-span-3">
                  <Label className="text-[10px] font-black uppercase">Nombre</Label>
                  <Input
                    value={editingProduct.nombre}
                    onChange={(e) =>
                      onEditingProductChange({ ...editingProduct, nombre: e.target.value })
                    }
                    className="h-16 font-bold rounded-2xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] font-black uppercase text-slate-400">Costo</Label>
                  <Input
                    type="number"
                    value={editingProduct.costo}
                    onChange={(e) =>
                      onEditingProductChange({
                        ...editingProduct,
                        costo: parseFloat(e.target.value),
                      })
                    }
                    className="rounded-xl h-12"
                  />
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase text-primary">Precio</Label>
                  <Input
                    type="number"
                    value={editingProduct.precio_venta}
                    onChange={(e) =>
                      onEditingProductChange({
                        ...editingProduct,
                        precio_venta: parseFloat(e.target.value),
                      })
                    }
                    className="border-primary/40 font-black h-12 rounded-xl text-lg"
                  />
                </div>
              </div>
              <Button
                onClick={handleUpdateProduct}
                disabled={actionLoading}
                className="w-full h-14 font-black text-lg rounded-2xl shadow-lg"
              >
                {actionLoading ? <Loader2 className="animate-spin" /> : "GUARDAR CAMBIOS"}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-red-500 text-[10px] font-black"
                onClick={handleDeleteProduct}
              >
                ELIMINAR PRODUCTO
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Historial de Precios */}
      <Dialog open={showPriceHistoryModal} onOpenChange={onShowPriceHistoryChange}>
        <DialogContent className="max-h-[80vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tighter flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Historial Precios
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {historyData.map((h, i) => (
              <div
                key={i}
                className="p-4 border-l-4 border-primary bg-slate-50 rounded-xl relative"
              >
                <div className="flex justify-between items-start mb-3">
                  <p className="font-black text-slate-900 text-xs uppercase">
                    {format(parseISO(h.created_at), "dd MMM yyyy")}
                  </p>
                  <p className="text-[9px] font-black text-slate-400">
                    {format(parseISO(h.created_at), "HH:mm")} HS
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[9px] font-black uppercase">Venta</p>
                    <p className="text-lg font-black text-primary">
                      {formatMoney(h.new_price)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase">Costo</p>
                    <p className="text-lg font-black text-slate-900">
                      {formatMoney(h.new_cost)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Lotes de Stock */}
      <Dialog open={!!managingStockId} onOpenChange={(o) => !o && onManagingStockIdChange(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase flex items-center gap-2">
              <History className="h-5 w-5 text-orange-500" /> Lotes Locales
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 mt-4">
            {stockBatchList.map((b) => (
              <div
                key={b.id}
                className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-orange-200"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm text-slate-800">{b.quantity} u.</span>
                      {b.unit_cost != null && (
                        <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                          {formatMoney(b.unit_cost)} c/u
                        </span>
                      )}
                    </div>
                    {b.unit_cost != null && (
                      <p className="text-xs font-bold text-slate-600">
                        Inversión: <span className="text-slate-900 font-black">{formatMoney(b.unit_cost * b.quantity)}</span>
                      </p>
                    )}
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {format(parseISO(b.created_at), "dd/MM/yy HH:mm")} hs
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-400 hover:bg-red-50 rounded-full shrink-0"
                    onClick={() => handleDeleteStockBatch(b.id)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Detalle de Ventas */}
      <Dialog open={showSalesDetail} onOpenChange={onShowSalesDetailChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col rounded-3xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
              <Receipt className="h-6 w-6 text-primary" /> Libro de Ventas
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-3 space-y-3 mt-6">
            {ventasRecientes.map((v) => (
              <div
                key={v.id}
                className="flex justify-between items-center p-4 bg-white border-2 rounded-2xl shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl bg-slate-100 w-12 h-12 flex items-center justify-center rounded-xl">
                    {v.productos?.emoji}
                  </span>
                  <div>
                    <p className="font-black uppercase text-slate-800 text-sm leading-none mb-1">
                      {v.productos?.nombre}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {format(parseISO(v.fecha_venta), "HH:mm")} hs •{" "}
                      {v.metodo_pago?.replace("_", " ")}
                    </p>
                    {v.notas && (
                      <p className="text-[10px] font-black text-indigo-600 mt-1 italic tracking-tighter">
                        {v.notas}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-emerald-600 text-lg leading-none mb-0.5">
                    {formatMoney(
                      (v.precio_venta_historico || v.productos?.precio_venta || 0) *
                        (v.cantidad || 1)
                    )}
                  </p>
                  <p className="text-[10px] font-black text-slate-400 uppercase">
                    {v.cantidad || 1} U.
                  </p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              className="w-full font-black text-[11px] h-12 rounded-2xl uppercase tracking-widest"
              onClick={() => onShowSalesDetailChange(false)}
            >
              Cerrar Auditoría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
