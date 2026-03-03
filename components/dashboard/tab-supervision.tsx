"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ChevronDown, ShoppingBag, Printer, ArrowDownRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import AsignarMision from "@/components/asignar-mision"
import RegistrarMovimiento from "@/components/registrar-movimientos"
import type { SupervisionTabProps, SupervisionTab } from "@/types/dashboard.types"

export function TabSupervision({
  turnosAudit,
  asistencias,
  ventasRecientes,
  sucursalId,
  formatMoney,
  onRefresh,
  onPrintTurno,
}: SupervisionTabProps) {
  const [supervisionTab, setSupervisionTab] = useState<SupervisionTab>("cajas")
  const [expandedTurnoId, setExpandedTurnoId] = useState<string | null>(null)
  const [expandedAsistenciaId, setExpandedAsistenciaId] = useState<string | null>(null)

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Toggle tabs */}
      <div className="flex bg-white p-1.5 rounded-2xl w-full max-w-sm mx-auto shadow-md border-2">
        <button
          onClick={() => setSupervisionTab("cajas")}
          className={cn(
            "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            supervisionTab === "cajas"
              ? "bg-slate-900 text-white shadow-lg"
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          Cierres de Caja
        </button>
        <button
          onClick={() => setSupervisionTab("asistencia")}
          className={cn(
            "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            supervisionTab === "asistencia"
              ? "bg-slate-900 text-white shadow-lg"
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          Asistencia
        </button>
      </div>

      {supervisionTab === "cajas" ? (
        <div className="space-y-4">
          {turnosAudit.map(t => {
            const isOpen = !t.fecha_cierre
            const isExpanded = expandedTurnoId === t.id
            const totalGastosTurno =
              t.movimientos_caja
                ?.filter(m => m.tipo === "egreso" && m.categoria !== "ventas")
                .reduce((acc, m) => acc + m.monto, 0) || 0

            return (
              <Card
                key={t.id}
                className={cn(
                  "border-2 overflow-hidden transition-all rounded-2xl",
                  isOpen ? "border-blue-400" : "border-slate-200"
                )}
              >
                <div
                  className="p-5 flex justify-between items-center bg-white cursor-pointer"
                  onClick={() => setExpandedTurnoId(isExpanded ? null : t.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center font-black text-white text-lg">
                      {t.perfiles?.nombre?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-black text-sm text-slate-800 uppercase tracking-tight">
                        {t.perfiles?.nombre || "Empleado"}
                      </p>
                      <p className="text-[11px] font-bold text-slate-400">
                        {format(parseISO(t.fecha_apertura), "dd MMM • HH:mm")} hs
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {totalGastosTurno > 0 && (
                      <Badge
                        variant="outline"
                        className="text-red-600 border-red-200 bg-red-50 text-[9px] font-black"
                      >
                        -{formatMoney(totalGastosTurno)}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-slate-400 hover:text-primary"
                      onClick={e => {
                        e.stopPropagation()
                        onPrintTurno(t)
                      }}
                    >
                      <Printer className="h-5 w-5" />
                    </Button>
                    {isOpen ? (
                      <Badge className="bg-blue-600 animate-pulse text-[9px] h-4">
                        EN CURSO
                      </Badge>
                    ) : (
                      <ChevronDown
                        className={cn(
                          "h-5 w-5 text-slate-300 transition-transform",
                          isExpanded && "rotate-180"
                        )}
                      />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-6 bg-slate-50 border-t-2 border-dashed space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white rounded-2xl border shadow-sm text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">
                          Efectivo Final
                        </p>
                        <p className="text-2xl font-black text-slate-900">
                          {t.monto_final ? formatMoney(t.monto_final) : "---"}
                        </p>
                      </div>
                      <div className="p-4 bg-white rounded-2xl border shadow-sm text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">
                          Misiones
                        </p>
                        <p className="text-2xl font-black text-slate-900">
                          {t.misiones?.filter(m => m.es_completada).length} / {t.misiones?.length}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ShoppingBag className="h-3 w-3" /> Detalle de Productos Vendidos
                      </h4>
                      {ventasRecientes.filter(v => v.caja_diaria_id === t.id).length > 0 ? (
                        <div className="space-y-2">
                          {ventasRecientes
                            .filter(v => v.caja_diaria_id === t.id)
                            .map(v => (
                              <div
                                key={v.id}
                                className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{v.productos?.emoji}</span>
                                  <p className="text-[10px] font-black text-slate-700 uppercase">
                                    {v.productos?.nombre}
                                  </p>
                                  <Badge variant="outline" className="text-[9px] py-0 h-4">
                                    {v.cantidad}u
                                  </Badge>
                                </div>
                                <p className="text-[11px] font-mono font-bold text-slate-600">
                                  {formatMoney(
                                    (v.precio_venta_historico || v.productos?.precio_venta || 0) *
                                      v.cantidad
                                  )}
                                </p>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-[10px] italic text-slate-400 text-center py-2">
                          Sin ventas registradas en este turno
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ArrowDownRight className="h-3 w-3" /> Otros Movimientos (Manuales)
                      </h4>
                      {t.movimientos_caja?.filter(m => m.categoria !== "ventas").length > 0 ? (
                        <div className="space-y-2">
                          {t.movimientos_caja
                            .filter(m => m.categoria !== "ventas")
                            .map(m => (
                              <div
                                key={m.id}
                                className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200"
                              >
                                <div>
                                  <p className="text-[11px] font-black text-slate-800 uppercase">
                                    {m.descripcion}
                                  </p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">
                                    {m.categoria} • {format(parseISO(m.created_at), "HH:mm")} hs
                                  </p>
                                </div>
                                <span
                                  className={cn(
                                    "font-black text-sm",
                                    m.tipo === "egreso" ? "text-red-600" : "text-emerald-600"
                                  )}
                                >
                                  {m.tipo === "egreso" ? "-" : "+"}
                                  {formatMoney(m.monto)}
                                </span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-[10px] italic text-slate-400 text-center py-2">
                          Sin movimientos manuales en este turno
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {isOpen && (
                        <AsignarMision
                          turnoId={t.id}
                          empleadoId={t.empleado_id}
                          sucursalId={sucursalId}
                          onMisionCreated={onRefresh}
                        />
                      )}
                      <div className="bg-white p-4 rounded-2xl border shadow-sm">
                        <h4 className="text-[10px] font-black text-slate-900 uppercase mb-4">
                          Ajuste de Caja (Dueño)
                        </h4>
                        <RegistrarMovimiento cajaId={t.id} onMovimientoRegistrado={onRefresh} />
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {asistencias.map(asist => {
            const hEntrada = parseISO(asist.entrada)
            const hSalida = asist.salida ? parseISO(asist.salida) : null
            const isExpanded = expandedAsistenciaId === asist.id

            const duracionMs = hSalida ? hSalida.getTime() - hEntrada.getTime() : null
            const duracionHoras = duracionMs
              ? Math.floor(duracionMs / (1000 * 60 * 60))
              : null
            const duracionMinutos = duracionMs
              ? Math.floor((duracionMs % (1000 * 60 * 60)) / (1000 * 60))
              : null

            return (
              <Card
                key={asist.id}
                className={cn(
                  "border-2 overflow-hidden transition-all rounded-2xl",
                  !asist.salida ? "border-emerald-400" : "border-slate-200"
                )}
              >
                <div
                  className="p-5 flex justify-between items-center bg-white cursor-pointer"
                  onClick={() => setExpandedAsistenciaId(isExpanded ? null : asist.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-white text-lg",
                        asist.salida
                          ? "bg-slate-400 shadow-inner"
                          : "bg-emerald-500 animate-pulse shadow-lg shadow-emerald-200"
                      )}
                    >
                      {asist.perfiles?.nombre?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-black text-sm uppercase text-slate-800 leading-none mb-1">
                        {asist.perfiles?.nombre}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 tracking-tighter uppercase">
                        {format(hEntrada, "dd MMMM yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!asist.salida && (
                      <Badge className="bg-emerald-600 animate-pulse text-[9px] h-4">
                        ACTIVO
                      </Badge>
                    )}
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 text-slate-300 transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-6 bg-slate-50 border-t-2 border-dashed space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white rounded-2xl border shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">
                          Entrada
                        </p>
                        <p className="text-2xl font-black text-emerald-600">
                          {format(hEntrada, "HH:mm")}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold mt-1">
                          {format(hEntrada, "dd/MM/yyyy")}
                        </p>
                      </div>
                      <div className="p-4 bg-white rounded-2xl border shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">
                          Salida
                        </p>
                        {hSalida ? (
                          <>
                            <p className="text-2xl font-black text-red-600">
                              {format(hSalida, "HH:mm")}
                            </p>
                            <p className="text-[9px] text-slate-400 font-bold mt-1">
                              {format(hSalida, "dd/MM/yyyy")}
                            </p>
                          </>
                        ) : (
                          <p className="text-2xl font-black text-slate-300">---</p>
                        )}
                      </div>
                    </div>
                    {duracionHoras !== null && duracionMinutos !== null && (
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-100">
                        <p className="text-[10px] font-black text-blue-600 uppercase mb-2 text-center">
                          Duración Total
                        </p>
                        <p className="text-3xl font-black text-center text-blue-900">
                          {duracionHoras}h {duracionMinutos}m
                        </p>
                      </div>
                    )}
                    <div className="text-center">
                      <Badge
                        variant={asist.salida ? "outline" : "default"}
                        className={cn(
                          "font-mono font-bold border-2 text-sm px-4 py-2",
                          !asist.salida &&
                            "bg-emerald-100 text-emerald-700 border-emerald-300 shadow-sm"
                        )}
                      >
                        {asist.salida ? "Jornada Finalizada" : "EN CURSO"}
                      </Badge>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
