"use client"

import { Card } from "@/components/ui/card"
import HappyHour from "@/components/happy-hour"
import type { AlertsTabProps } from "@/types/dashboard.types"

export function TabAlerts({
  capitalEnRiesgo,
  productos,
  umbralStockBajo,
  formatMoney,
  onRefresh,
}: AlertsTabProps) {
  const productosStockBajo = productos.filter(
    p => (p.stock_disponible || 0) <= umbralStockBajo && p.categoria !== "Servicios"
  )

  return (
    <div className="space-y-6 animate-in fade-in">
      <HappyHour criticos={capitalEnRiesgo.criticos} onDiscountApplied={onRefresh} />

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 border-2 border-orange-200 bg-orange-50/50 shadow-sm">
          <p className="text-[11px] font-black text-orange-600 uppercase mb-2">
            Riesgo Vencimiento
          </p>
          <h3 className="text-3xl font-black text-slate-800">
            {formatMoney(capitalEnRiesgo.capital)}
          </h3>
          <p className="text-[10px] font-bold text-orange-400 uppercase mt-2">
            {capitalEnRiesgo.unidades} UNIDADES CRÍTICAS
          </p>
        </Card>

        <Card className="p-5 border-2 border-red-200 bg-red-50/50 shadow-sm">
          <p className="text-[11px] font-black text-red-600 uppercase mb-2">
            Stock Insuficiente
          </p>
          <h3 className="text-3xl font-black text-slate-800">
            {productosStockBajo.length}
          </h3>
          <p className="text-[10px] font-bold text-red-400 uppercase mt-2">
            PRODUCTOS CRÍTICOS
          </p>
        </Card>
      </div>
    </div>
  )
}
