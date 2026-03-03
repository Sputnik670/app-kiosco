"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Package, Smartphone } from "lucide-react"
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import type { SalesTabProps } from "@/types/dashboard.types"

export function TabSales({
  totalVendido,
  totalServiciosVendido,
  paymentBreakdown,
  paymentBreakdownServicios,
  ventasRecientes,
  ventasServicios,
  chartData,
  formatMoney,
  onShowSalesDetail,
}: SalesTabProps) {
  // totalVendido ya incluye productos + servicios desde vista unificada
  const totalGeneral = totalVendido

  return (
    <div className="space-y-4">
      {/* Card Principal: Total General (productos + servicios) */}
      <Card className="p-8 bg-gradient-to-br from-blue-600 to-indigo-800 text-white border-0 shadow-xl relative overflow-hidden">
        <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1">
          Facturación Total Sucursal
        </p>
        <h2 className="text-5xl font-black">{formatMoney(totalGeneral)}</h2>
        <div className="flex justify-between items-center mt-6 gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 rounded-xl px-3 py-1.5">
              <p className="text-[9px] text-blue-200 uppercase font-bold">Productos</p>
              <p className="text-lg font-black">{formatMoney(totalVendido)}</p>
            </div>
            <div className="bg-indigo-700/50 rounded-xl px-3 py-1.5">
              <p className="text-[9px] text-indigo-200 uppercase font-bold">Servicios</p>
              <p className="text-lg font-black">{formatMoney(totalServiciosVendido)}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="font-black text-[10px]"
            onClick={onShowSalesDetail}
          >
            AUDITAR
          </Button>
        </div>
      </Card>

      {/* Sección: Productos Físicos */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-slate-600" />
          <h3 className="text-sm font-black text-slate-700 uppercase">Productos Físicos</h3>
          <Badge variant="outline" className="text-[9px]">
            {ventasRecientes.length} ventas
          </Badge>
        </div>
        <Card className="p-5 border-2 shadow-sm">
          <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">
            Ingresos por Método de Pago
          </h4>
          <div className="space-y-3">
            {Object.entries(paymentBreakdown).map(
              ([k, v]) =>
                v > 0 && (
                  <div key={k}>
                    <div className="flex justify-between text-xs font-black mb-1 uppercase">
                      <span className="text-slate-600">{k.replace("_", " ")}</span>
                      <span className="font-mono">{formatMoney(v)}</span>
                    </div>
                    <Progress value={(v / totalVendido) * 100} className="h-1.5 bg-slate-100" />
                  </div>
                )
            )}
          </div>
        </Card>
      </div>

      {/* Sección: Servicios Virtuales */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-black text-indigo-700 uppercase">Servicios Virtuales</h3>
          <Badge variant="outline" className="text-[9px] border-indigo-300 text-indigo-700">
            {ventasServicios.length} cargas
          </Badge>
        </div>
        <Card className="p-5 border-2 border-indigo-100 bg-indigo-50/30 shadow-sm">
          <h4 className="text-[10px] font-black uppercase text-indigo-600 mb-4 tracking-widest">
            Ingresos por Método de Pago
          </h4>
          <div className="space-y-3">
            {Object.entries(paymentBreakdownServicios).map(
              ([k, v]) =>
                v > 0 && (
                  <div key={k}>
                    <div className="flex justify-between text-xs font-black mb-1 uppercase">
                      <span className="text-indigo-700">{k.replace("_", " ")}</span>
                      <span className="font-mono text-indigo-900">{formatMoney(v)}</span>
                    </div>
                    <Progress
                      value={(v / totalServiciosVendido) * 100}
                      className="h-1.5 bg-indigo-100"
                    />
                  </div>
                )
            )}
            {totalServiciosVendido === 0 && (
              <p className="text-xs text-indigo-400 italic text-center py-2">
                Sin ventas de servicios en este período
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Gráfico de evolución */}
      <Card className="p-5 border-2 shadow-sm">
        <h3 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest">
          Evolución Diaria
        </h3>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="fecha"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: "bold" }}
              />
              <Tooltip cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="total" fill="oklch(0.6 0.2 250)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
