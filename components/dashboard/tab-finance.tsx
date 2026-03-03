"use client"

import { Card } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import type { FinanceTabProps } from "@/types/dashboard.types"

export function TabFinance({ biMetrics, formatMoney }: FinanceTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 bg-emerald-50 border-2 border-emerald-200">
          <p className="text-[10px] font-black text-emerald-600 uppercase mb-2">
            Utilidad Neta Est.
          </p>
          <h3 className="text-3xl font-black text-emerald-900">
            {formatMoney(biMetrics.net)}
          </h3>
          <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 w-fit px-2 py-0.5 rounded">
            <TrendingUp className="h-3 w-3" /> ROI: {biMetrics.margin.toFixed(1)}%
          </div>
        </Card>

        <Card className="p-5 bg-blue-50 border-2 border-blue-200">
          <p className="text-[10px] font-black text-blue-600 uppercase mb-2">
            Ventas Rastreables
          </p>
          <h3 className="text-3xl font-black text-blue-900">
            {formatMoney(biMetrics.traceable)}
          </h3>
        </Card>

        <Card className="p-5 bg-slate-100 border-2 border-slate-300">
          <p className="text-[10px] font-black text-slate-500 uppercase mb-2">
            Ventas Efectivo
          </p>
          <h3 className="text-3xl font-black text-slate-700">
            {formatMoney(biMetrics.cash)}
          </h3>
        </Card>
      </div>
    </div>
  )
}
