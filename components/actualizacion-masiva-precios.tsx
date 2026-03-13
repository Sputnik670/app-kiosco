"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DollarSign,
  Plus,
  Percent,
  Loader2,
  AlertTriangle,
  Eye,
  Check,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  getProductFilterOptionsAction,
  previewMassivePriceUpdateAction,
  updateMassivePricesAction,
  type ProductFilterOptions,
  type MassivePriceUpdatePreviewParams,
  type ProductPricePreview,
} from "@/lib/actions/product.actions"

export default function ActualizacionMasivaPrecios() {
  // ───────────────────────────────────────────────────────────────────────────
  // STATE: Formulario
  // ───────────────────────────────────────────────────────────────────────────

  const [filterType, setFilterType] = useState<"all" | "category" | "brand">("all")
  const [filterValue, setFilterValue] = useState("")
  const [updateType, setUpdateType] = useState<"sale_price" | "cost" | "both">("sale_price")
  const [adjustmentType, setAdjustmentType] = useState<"percentage" | "fixed">("percentage")
  const [adjustmentValue, setAdjustmentValue] = useState("")

  // ───────────────────────────────────────────────────────────────────────────
  // STATE: Opciones y Preview
  // ───────────────────────────────────────────────────────────────────────────

  const [filterOptions, setFilterOptions] = useState<ProductFilterOptions | null>(null)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [previewData, setPreviewData] = useState<ProductPricePreview[] | null>(null)
  const [totalAffected, setTotalAffected] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // ───────────────────────────────────────────────────────────────────────────
  // STATE: Confirmación y Aplicación
  // ───────────────────────────────────────────────────────────────────────────

  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [applying, setApplying] = useState(false)

  // ───────────────────────────────────────────────────────────────────────────
  // EFECTOS: Cargar opciones de filtro
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true)
      const result = await getProductFilterOptionsAction()

      if (result.success && result.options) {
        setFilterOptions(result.options)
      } else {
        toast.error("Error al cargar opciones", { description: result.error })
      }

      setLoadingOptions(false)
    }

    loadOptions()
  }, [])

  // ───────────────────────────────────────────────────────────────────────────
  // HANDLERS: Preview
  // ───────────────────────────────────────────────────────────────────────────

  const handlePreview = useCallback(async () => {
    // Validaciones
    if (!adjustmentValue || isNaN(Number(adjustmentValue))) {
      return toast.error("Ingresá un valor de ajuste válido")
    }

    if (filterType !== "all" && !filterValue) {
      return toast.error(`Seleccioná una ${filterType === "category" ? "categoría" : "marca"}`)
    }

    setLoadingPreview(true)
    const params: MassivePriceUpdatePreviewParams = {
      filterType,
      filterValue: filterType === "all" ? undefined : filterValue,
      updateType,
      adjustmentType,
      adjustmentValue: Number(adjustmentValue),
    }

    const result = await previewMassivePriceUpdateAction(params)

    if (result.success) {
      setPreviewData(result.examples || [])
      setTotalAffected(result.totalAffected || 0)
      setShowPreview(true)

      if ((result.totalAffected || 0) === 0) {
        toast.info("No hay productos que coincidan con los filtros")
      } else {
        toast.success(`${result.totalAffected} producto(s) serán afectados`)
      }
    } else {
      toast.error("Error en preview", { description: result.error })
    }

    setLoadingPreview(false)
  }, [filterType, filterValue, adjustmentValue, updateType, adjustmentType])

  // ───────────────────────────────────────────────────────────────────────────
  // HANDLERS: Aplicar actualización
  // ───────────────────────────────────────────────────────────────────────────

  const handleApplyUpdate = useCallback(async () => {
    if (!adjustmentValue || isNaN(Number(adjustmentValue))) {
      return toast.error("Ingresá un valor de ajuste válido")
    }

    setApplying(true)
    const params = {
      filterType,
      filterValue: filterType === "all" ? undefined : filterValue,
      updateType,
      adjustmentType,
      adjustmentValue: Number(adjustmentValue),
    }

    const result = await updateMassivePricesAction(params)

    if (result.success) {
      toast.success(`${result.updatedCount} producto(s) actualizados`, {
        description: `${result.historyRecordsCreated} registro(s) agregado(s) al historial`,
      })
      setShowConfirmDialog(false)
      setShowPreview(false)
      setAdjustmentValue("")
      setPreviewData(null)
    } else {
      toast.error("Error al aplicar actualización", { description: result.error })
    }

    setApplying(false)
  }, [filterType, filterValue, updateType, adjustmentType, adjustmentValue])

  // ───────────────────────────────────────────────────────────────────────────
  // HELPERS: Formatear valores
  // ───────────────────────────────────────────────────────────────────────────

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount)

  const formatChange = (old: number, newVal: number, type: "sale_price" | "cost" | "both") => {
    if (type === "cost") {
      const diff = newVal - old
      return diff >= 0 ? `+$${diff.toFixed(2)}` : `-$${Math.abs(diff).toFixed(2)}`
    }
    const pctChange = ((newVal - old) / (old || 1)) * 100
    return pctChange >= 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────────────

  if (loadingOptions) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-gradient-to-r from-indigo-50 to-violet-50 p-4 rounded-xl border border-indigo-200 shadow-sm">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-600" /> Actualización Masiva de Precios
          </h3>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            Ajusta precios en lote con filtros inteligentes
          </p>
        </div>
      </div>

      {/* FORMULARIO */}
      <Card className="p-6 border-indigo-100 shadow-sm">
        <div className="space-y-5">
          {/* ROW 1: Tipo de Filtro */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-indigo-600">Filtro de Productos</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setFilterType("all")
                  setFilterValue("")
                }}
                className={cn(
                  "p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                  filterType === "all"
                    ? "bg-indigo-50 border-indigo-500 shadow-sm"
                    : "bg-white border-slate-200 hover:border-indigo-200"
                )}
              >
                <span className="text-xl">📦</span>
                <span className="text-[10px] font-bold">Todos</span>
              </button>
              <button
                onClick={() => setFilterType("category")}
                className={cn(
                  "p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                  filterType === "category"
                    ? "bg-indigo-50 border-indigo-500 shadow-sm"
                    : "bg-white border-slate-200 hover:border-indigo-200"
                )}
              >
                <span className="text-xl">🏷️</span>
                <span className="text-[10px] font-bold">Categoría</span>
              </button>
              <button
                onClick={() => setFilterType("brand")}
                className={cn(
                  "p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                  filterType === "brand"
                    ? "bg-indigo-50 border-indigo-500 shadow-sm"
                    : "bg-white border-slate-200 hover:border-indigo-200"
                )}
              >
                <span className="text-xl">🎨</span>
                <span className="text-[10px] font-bold">Marca</span>
              </button>
            </div>
          </div>

          {/* ROW 2: Selector de Categoría/Marca */}
          {filterType !== "all" && (
            <div>
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                {filterType === "category" ? "Seleccioná una Categoría" : "Seleccioná una Marca"}
              </Label>
              <select
                title={filterType === "category" ? "Categoría" : "Marca"}
                className="w-full h-10 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
              >
                <option value="">-- Seleccionar --</option>
                {(filterType === "category" ? filterOptions?.categories : filterOptions?.brands)?.map(
                  opt => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  )
                )}
              </select>
            </div>
          )}

          {/* ROW 3: Qué actualizar */}
          <div>
            <Label className="text-xs font-bold uppercase text-indigo-600 mb-2 block">
              Qué Actualizar
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setUpdateType("sale_price")}
                className={cn(
                  "p-3 rounded-lg border-2 transition-all text-[10px] font-bold",
                  updateType === "sale_price"
                    ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                    : "bg-slate-50 border-slate-200 text-muted-foreground"
                )}
              >
                💰 Precio Venta
              </button>
              <button
                onClick={() => setUpdateType("cost")}
                className={cn(
                  "p-3 rounded-lg border-2 transition-all text-[10px] font-bold",
                  updateType === "cost"
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "bg-slate-50 border-slate-200 text-muted-foreground"
                )}
              >
                📌 Costo
              </button>
              <button
                onClick={() => setUpdateType("both")}
                className={cn(
                  "p-3 rounded-lg border-2 transition-all text-[10px] font-bold",
                  updateType === "both"
                    ? "bg-purple-50 border-purple-500 text-purple-700"
                    : "bg-slate-50 border-slate-200 text-muted-foreground"
                )}
              >
                🔄 Ambos
              </button>
            </div>
          </div>

          {/* ROW 4: Tipo de Ajuste */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold uppercase text-muted-foreground mb-2 block">
                Tipo de Ajuste
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAdjustmentType("percentage")}
                  className={cn(
                    "p-2 rounded-lg border-2 transition-all flex items-center justify-center gap-1",
                    adjustmentType === "percentage"
                      ? "bg-indigo-100 border-indigo-500"
                      : "bg-slate-50 border-slate-200"
                  )}
                >
                  <Percent className="h-4 w-4" />
                  <span className="text-[10px] font-bold">%</span>
                </button>
                <button
                  onClick={() => setAdjustmentType("fixed")}
                  className={cn(
                    "p-2 rounded-lg border-2 transition-all flex items-center justify-center gap-1",
                    adjustmentType === "fixed"
                      ? "bg-indigo-100 border-indigo-500"
                      : "bg-slate-50 border-slate-200"
                  )}
                >
                  <DollarSign className="h-4 w-4" />
                  <span className="text-[10px] font-bold">$</span>
                </button>
              </div>
            </div>

            {/* ROW 5: Valor de Ajuste */}
            <div>
              <Label className="text-xs font-bold uppercase text-muted-foreground mb-2 block">
                {adjustmentType === "percentage" ? "Porcentaje" : "Monto"}
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder={adjustmentType === "percentage" ? "Ej: 10 o -5" : "Ej: 50 o -25"}
                  className="font-bold text-center"
                  value={adjustmentValue}
                  onChange={e => setAdjustmentValue(e.target.value)}
                />
                <span className="flex items-center px-3 py-2 bg-slate-100 rounded-lg font-bold text-sm text-slate-600">
                  {adjustmentType === "percentage" ? "%" : "$"}
                </span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">
                Positivo = aumento | Negativo = descuento
              </p>
            </div>
          </div>

          {/* ROW 6: Botones de Acción */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handlePreview}
              disabled={loadingPreview || !adjustmentValue}
              variant="outline"
              className="flex-1 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            >
              {loadingPreview ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              Vista Previa
            </Button>
            <Button
              onClick={() => {
                if (!adjustmentValue) {
                  return toast.error("Ingresá un valor de ajuste")
                }
                setShowConfirmDialog(true)
              }}
              disabled={!adjustmentValue}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Aplicar Cambios
            </Button>
          </div>
        </div>
      </Card>

      {/* DIALOG: Preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-indigo-600" />
              Vista Previa de Cambios
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {totalAffected} producto(s) serán afectados
            </p>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {previewData && previewData.length > 0 ? (
              <>
                {previewData.map(product => (
                  <div
                    key={product.id}
                    className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm">{product.name}</h4>
                        <p className="text-[11px] text-muted-foreground">
                          {product.category}
                          {product.brand && ` • ${product.brand}`}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                      {(updateType === "sale_price" || updateType === "both") && (
                        <div className="bg-white p-2 rounded border border-emerald-100">
                          <p className="text-muted-foreground mb-1">Precio Venta</p>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">
                              {formatMoney(product.oldSalePrice)}
                            </span>
                            <span className="text-emerald-600 font-bold">
                              {formatChange(product.oldSalePrice, product.newSalePrice, "sale_price")}
                            </span>
                            <span className="text-slate-400">→</span>
                            <span className="font-bold">{formatMoney(product.newSalePrice)}</span>
                          </div>
                        </div>
                      )}

                      {(updateType === "cost" || updateType === "both") && (
                        <div className="bg-white p-2 rounded border border-blue-100">
                          <p className="text-muted-foreground mb-1">Costo</p>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{formatMoney(product.oldCost)}</span>
                            <span className="text-blue-600 font-bold">
                              {formatChange(product.oldCost, product.newCost, "cost")}
                            </span>
                            <span className="text-slate-400">→</span>
                            <span className="font-bold">{formatMoney(product.newCost)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {totalAffected > 5 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px]">
                    <p className="text-amber-700 font-medium">
                      Se muestran 5 ejemplos de {totalAffected} producto(s) total
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">No hay productos que actualizar</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreview(false)}
            >
              Cerrar
            </Button>
            {previewData && previewData.length > 0 && (
              <Button
                onClick={() => {
                  setShowPreview(false)
                  setShowConfirmDialog(true)
                }}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Continuar con la Actualización
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Confirmación */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Actualización
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-amber-900">
                Esta acción actualizará <span className="font-bold">{totalAffected || "?"}</span> producto(s)
              </p>
              <ul className="text-[11px] text-amber-700 space-y-1 ml-3">
                <li>
                  • <span className="font-bold">Filtro:</span> {filterType === "all" ? "Todos" : filterValue || "---"}
                </li>
                <li>
                  • <span className="font-bold">Actualizar:</span> {updateType === "sale_price" ? "Precio Venta" : updateType === "cost" ? "Costo" : "Ambos"}
                </li>
                <li>
                  • <span className="font-bold">Ajuste:</span> {adjustmentValue} {adjustmentType === "percentage" ? "%" : "$"}
                </li>
              </ul>
            </div>

            <p className="text-[10px] text-muted-foreground">
              Se registrará cada cambio en el historial de precios para auditoría.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={applying}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleApplyUpdate}
              disabled={applying}
              className="bg-indigo-600 hover:bg-indigo-700 font-bold"
            >
              {applying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Sí, Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
