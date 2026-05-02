"use client"

import { lazy, Suspense } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Package, Smartphone, Loader2 } from "lucide-react"
import type { SalesTabProps } from "@/types/dashboard.types"

// Labels legibles para cada key de PaymentBreakdown — evita que `qr_static_mp`
// se renderice como "QR STATIC_MP" (con replace simple) o "MERCADOPAGO" en mayúsculas
// raro. Mantener en sync con los helpers paymentLabel de timeline.actions y
// tab-historial.
const PAYMENT_BREAKDOWN_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  wallet: 'Billetera',
  mercadopago: 'QR Mercado Pago',
  posnet_mp: 'Posnet MP',
  qr_static_mp: 'QR fijo',
  transfer_alias: 'Alias / CVU',
}

function paymentBreakdownLabel(key: string): string {
  return PAYMENT_BREAKDOWN_LABELS[key] || key.replace(/_/g, ' ')
}

// Dynamic import de Recharts (~250KB) — solo se carga cuando se renderiza el tab de ventas
const RechartsChart = lazy(() =>
  import("recharts").then((mod) => ({
    default: ({ chartData }: { chartData: Array<{ fecha: string; total: number }> }) => (
      <mod.ResponsiveContainer width="100%" height="100%">
        <mod.BarChart data={chartData}>
          <mod.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <mod.XAxis
            dataKey="fecha"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fontWeight: "bold" }}
          />
          <mod.Tooltip cursor={{ fill: "#f8fafc" }} />
          <mod.Bar dataKey="total" fill="oklch(0.6 0.2 250)" radius={[4, 4, 0, 0]} />
        </mod.BarChart>
      </mod.ResponsiveContainer>
    ),
  }))
)

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
  // Total general = productos + servicios
  const totalGeneral = totalVendido + totalServiciosVendido

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
                      <span className="text-slate-600">{paymentBreakdownLabel(k)}</span>
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
                      <span className="text-indigo-700">{paymentBreakdownLabel(k)}</span>
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
        <div className="h-[200px] w-full">
          <Suspense
            fallback={
              <div className="h-full flex items-center justify-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            }
          >
            <RechartsChart chartData={chartData} />
          </Suspense>
        </div>
      </Card>
    </div>
  )
}
