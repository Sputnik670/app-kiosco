"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp, AlertTriangle, PackageX, ShoppingCart, Clock, Trash2 } from "lucide-react"
import HappyHour from "@/components/happy-hour"
import type { AlertsTabProps, CriticalItem } from "@/types/dashboard.types"
import { format, parseISO } from "date-fns"

export function TabAlerts({
  capitalEnRiesgo,
  productos,
  umbralStockBajo,
  formatMoney,
  onRefresh,
}: AlertsTabProps) {
  const [showStockDetail, setShowStockDetail] = useState(false)
  const [showExpiryDetail, setShowExpiryDetail] = useState(false)

  // Separar por vencer (futuro) de ya vencidos (pasado)
  const porVencer = capitalEnRiesgo.criticos.filter(c => {
    const days = Math.ceil((new Date(c.fechaVenc).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return days >= 0
  })
  const yaVencidos = capitalEnRiesgo.criticos.filter(c => {
    const days = Math.ceil((new Date(c.fechaVenc).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return days < 0
  })

  const capitalPorVencer = porVencer.reduce((sum, c) => sum + c.monto, 0)
  const unidadesPorVencer = porVencer.reduce((sum, c) => sum + c.cantidad, 0)
  const capitalVencido = yaVencidos.reduce((sum, c) => sum + c.monto, 0)
  const unidadesVencidas = yaVencidos.reduce((sum, c) => sum + c.cantidad, 0)

  // Productos con stock bajo
  const productosStockBajo = productos.filter(
    p => (p.stock_disponible || 0) <= umbralStockBajo && p.categoria !== "Servicios"
  ).sort((a, b) => (a.stock_disponible || 0) - (b.stock_disponible || 0))

  return (
    <div className="space-y-4 animate-in fade-in">
      <HappyHour criticos={capitalEnRiesgo.criticos} onDiscountApplied={onRefresh} />

      {/* Card: Por Vencer (accionable) */}
      <Card
        className="border-2 border-orange-200 bg-orange-50/50 shadow-sm cursor-pointer"
        onClick={() => setShowExpiryDetail(!showExpiryDetail)}
      >
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-orange-500" />
                <p className="text-[11px] font-black text-orange-600 uppercase">
                  Por Vencer
                </p>
              </div>
              <h3 className="text-3xl font-black text-slate-800">
                {formatMoney(capitalPorVencer)}
              </h3>
              <p className="text-[10px] font-bold text-orange-400 uppercase mt-1">
                {unidadesPorVencer} unidades en los próx. 10 días
              </p>
            </div>
            {porVencer.length > 0 && (
              showExpiryDetail ? <ChevronUp className="h-5 w-5 text-orange-400" /> : <ChevronDown className="h-5 w-5 text-orange-400" />
            )}
          </div>
        </div>

        {showExpiryDetail && porVencer.length > 0 && (
          <div className="border-t border-orange-200 px-4 pb-4 pt-3 space-y-2">
            {porVencer.map((item) => {
              const days = Math.ceil((new Date(item.fechaVenc).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              return (
                <div key={item.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{item.emoji || '📦'}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800 leading-tight">{item.nombre}</p>
                      <p className="text-[10px] text-orange-600">
                        {item.cantidad} u. · vence {format(parseISO(item.fechaVenc), 'dd/MM')}
                      </p>
                    </div>
                  </div>
                  <Badge className={`text-[9px] font-black ${days <= 3 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                    {days === 0 ? 'HOY' : `${days}d`}
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Card: Ya vencidos (pendientes de merma) */}
      {yaVencidos.length > 0 && (
        <Card className="border-2 border-red-200 bg-red-50/50 shadow-sm">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Trash2 className="h-4 w-4 text-red-500" />
              <p className="text-[11px] font-black text-red-600 uppercase">
                Ya Vencidos — pendientes de merma
              </p>
            </div>
            <h3 className="text-2xl font-black text-slate-800">
              {unidadesVencidas} unidades · {formatMoney(capitalVencido)}
            </h3>
            <p className="text-[10px] text-red-400 mt-1">
              Estos productos ya vencieron. El empleado puede mermarlos desde su panel.
              Se ocultan automáticamente después de 30 días.
            </p>
          </div>
          <div className="border-t border-red-200 px-4 pb-4 pt-3 space-y-2">
            {yaVencidos.map((item) => {
              const days = Math.abs(Math.ceil((new Date(item.fechaVenc).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
              return (
                <div key={item.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{item.emoji || '📦'}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-700 leading-tight">{item.nombre}</p>
                      <p className="text-[10px] text-red-500">
                        {item.cantidad} u. · {formatMoney(item.monto)}
                      </p>
                    </div>
                  </div>
                  <Badge className="text-[9px] font-black bg-red-100 text-red-700 border-red-200">
                    hace {days}d
                  </Badge>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Card: Stock Insuficiente (expandible con detalle) */}
      <Card
        className="border-2 border-amber-200 bg-amber-50/50 shadow-sm cursor-pointer"
        onClick={() => setShowStockDetail(!showStockDetail)}
      >
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <PackageX className="h-4 w-4 text-amber-600" />
                <p className="text-[11px] font-black text-amber-700 uppercase">
                  Stock Insuficiente
                </p>
              </div>
              <h3 className="text-3xl font-black text-slate-800">
                {productosStockBajo.length}
              </h3>
              <p className="text-[10px] font-bold text-amber-500 uppercase mt-1">
                {productosStockBajo.length === 0
                  ? 'Todo el stock está en niveles normales'
                  : 'Productos que necesitan reposición'}
              </p>
            </div>
            {productosStockBajo.length > 0 && (
              showStockDetail ? <ChevronUp className="h-5 w-5 text-amber-400" /> : <ChevronDown className="h-5 w-5 text-amber-400" />
            )}
          </div>
        </div>

        {showStockDetail && productosStockBajo.length > 0 && (
          <div className="border-t border-amber-200 px-4 pb-4 pt-3 space-y-2">
            {productosStockBajo.map((p) => {
              const stock = p.stock_disponible || 0
              const sinStock = stock === 0
              return (
                <div key={p.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{p.emoji || '📦'}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800 leading-tight">{p.nombre}</p>
                      <p className="text-[10px] text-slate-500">{p.categoria || 'Sin categoría'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${sinStock ? 'text-red-600' : 'text-amber-600'}`}>
                      {stock} / {umbralStockBajo}
                    </p>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">
                      {sinStock ? 'AGOTADO' : 'BAJO'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
