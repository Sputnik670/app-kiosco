"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Zap, Target, CheckCheck, AlertTriangle, ClipboardCheck } from "lucide-react"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { triggerConfetti } from "@/components/confetti-trigger"
import { Badge } from "@/components/ui/badge"
import {
  getEmployeeMissionsAction,
  completeManualMissionAction,
  processMermasMissionAction,
  type MissionData as Mission
} from "@/lib/actions/missions.actions"
import { getCriticalStockAction, type CriticalStock } from "@/lib/actions/inventory.actions"
import { supabase } from "@/lib/supabase"

// Mapea una fila cruda de la tabla missions (payload de Realtime) al shape
// MissionData que usa la UI (nombres en español, camelCase legacy).
function mapRealtimeRowToMission(row: any): Mission {
    return {
        id: row.id,
        tipo: row.type,
        descripcion: row.description || '',
        objetivo_unidades: row.target_value,
        unidades_completadas: row.current_value,
        es_completada: row.is_completed,
        puntos: row.points,
        caja_diaria_id: row.cash_register_id,
        created_at: row.created_at,
    }
}

// Replica la misma lógica de filtrado que hace getEmployeeMissionsAction:
// una misión aparece si es del turno actual, O si es global (sin turno) y
// no está completada.
function missionBelongsToCurrentView(m: Mission, turnoId: string): boolean {
    if (m.caja_diaria_id === turnoId) return true
    if (!m.caja_diaria_id && !m.es_completada) return true
    return false
}

interface MisionesEmpleadoProps {
    turnoId: string
    empleadoId: string
    sucursalId: string
    onMisionesUpdated: () => void
}

export default function MisionesEmpleado({ turnoId, empleadoId, sucursalId, onMisionesUpdated }: MisionesEmpleadoProps) {
    const [misiones, setMisiones] = useState<Mission[]>([])
    const [loading, setLoading] = useState(true)
    const [procesando, setProcesando] = useState(false)
    const [showMermarModal, setShowMermarModal] = useState(false)
    const [stockParaMermar, setStockParaMermar] = useState<CriticalStock[]>([])
    const [misionVencimiento, setMisionVencimiento] = useState<Mission | null>(null)

    const fetchMisiones = useCallback(async () => {
        setLoading(true)
        try {
            const result = await getEmployeeMissionsAction(empleadoId, turnoId)

            if (!result.success) {
                toast.error("Error cargando tareas", { description: result.error })
                return
            }

            setMisiones(result.misiones)
            setMisionVencimiento(result.misiones.find(m => m.tipo === 'vencimiento') || null)

        } catch (error) {
            toast.error("Error cargando tareas")
        } finally {
            setLoading(false)
        }
    }, [turnoId, empleadoId])

    const handleOpenMermarModal = async () => {
        if (!misionVencimiento) return
        setProcesando(true)
        try {
            const result = await getCriticalStockAction(sucursalId)

            if (!result.success) {
                toast.error("Error al buscar stock", { description: result.error })
                return
            }

            setStockParaMermar(result.stock)
            setShowMermarModal(true)
        } catch (error: any) {
            toast.error("Error al buscar stock")
        } finally {
            setProcesando(false)
        }
    }

    const handleCompletarManual = async (mision: Mission) => {
        setProcesando(true)
        try {
            const result = await completeManualMissionAction(mision.id, turnoId, empleadoId)

            if (!result.success) {
                toast.error("Error al completar", { description: result.error })
                return
            }

            triggerConfetti()
            toast.success(`Misión Cumplida (+${result.xpGanado} XP)`)
            fetchMisiones()
            onMisionesUpdated()
        } catch (error: any) {
            toast.error("Error al completar")
        } finally {
            setProcesando(false)
        }
    }

    const handleMermarStock = async () => {
        if (stockParaMermar.length === 0 || !misionVencimiento) return
        setProcesando(true)
        setShowMermarModal(false)
        try {
            const stockIds = stockParaMermar.map(item => item.id)

            const result = await processMermasMissionAction(
                stockIds,
                misionVencimiento.id,
                turnoId,
                empleadoId
            )

            if (!result.success) {
                toast.error("Error al procesar mermas", { description: result.error })
                return
            }

            if (result.misionCompletada) {
                triggerConfetti()
                toast.success(`¡Misión Completada! (+${result.xpGanado} XP)`)
            } else {
                toast.success("Mermas registradas")
            }

            fetchMisiones()
            onMisionesUpdated()
        } catch (error) {
            toast.error("Error al procesar mermas")
        } finally {
            setProcesando(false)
        }
    }

    useEffect(() => {
        if (turnoId && empleadoId) fetchMisiones()
    }, [turnoId, empleadoId, fetchMisiones])

    // ─── Suscripción Realtime ────────────────────────────────────────────
    // Escucha cambios en missions para este empleado. Cubre:
    //   • El dueño asigna una misión nueva → el empleado la ve aparecer.
    //   • El dueño la elimina → desaparece en vivo.
    //   • El progreso de la misión actualiza (ej. mermas cargadas desde
    //     otro dispositivo del mismo empleado).
    // El filter server-side (user_id) es lo único que Realtime soporta acá;
    // el match por turno se hace en el handler con missionBelongsToCurrentView.
    useEffect(() => {
        if (!empleadoId || !turnoId) return

        const channel = supabase
            .channel(`missions:employee:${empleadoId}:turno:${turnoId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "missions",
                    filter: `user_id=eq.${empleadoId}`,
                },
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        const incoming = mapRealtimeRowToMission(payload.new)
                        if (!missionBelongsToCurrentView(incoming, turnoId)) return
                        setMisiones((prev) =>
                            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
                        )
                        if (incoming.tipo === 'vencimiento') {
                            setMisionVencimiento(incoming)
                        }
                    } else if (payload.eventType === "UPDATE") {
                        const updated = mapRealtimeRowToMission(payload.new)
                        setMisiones((prev) => {
                            const existsInList = prev.some((m) => m.id === updated.id)
                            const shouldShow = missionBelongsToCurrentView(updated, turnoId)
                            if (existsInList && !shouldShow) {
                                // Cambió de turno o se completó una global → remover
                                return prev.filter((m) => m.id !== updated.id)
                            }
                            if (existsInList) {
                                return prev.map((m) => (m.id === updated.id ? updated : m))
                            }
                            if (shouldShow) {
                                return [...prev, updated]
                            }
                            return prev
                        })
                        if (updated.tipo === 'vencimiento') {
                            setMisionVencimiento(
                                missionBelongsToCurrentView(updated, turnoId) ? updated : null
                            )
                        }
                    } else if (payload.eventType === "DELETE") {
                        const oldId = (payload.old as any)?.id
                        if (oldId) {
                            setMisiones((prev) => prev.filter((m) => m.id !== oldId))
                            setMisionVencimiento((prev) => (prev?.id === oldId ? null : prev))
                        }
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [empleadoId, turnoId])

    const getMissionStatus = (m: Mission) => {
        if (m.es_completada) return { label: "Completada", color: "text-emerald-600", icon: CheckCheck, bg: "bg-emerald-50 border-emerald-200" }
        if (m.tipo === 'vencimiento' && m.unidades_completadas > 0) return { label: "En Progreso", color: "text-orange-600", icon: Target, bg: "bg-orange-50 border-orange-200" }
        if (m.tipo === 'arqueo_cierre') return { label: "Meta de Cierre", color: "text-blue-600", icon: Zap, bg: "bg-white" }
        return { label: "Tarea Activa", color: "text-indigo-600", icon: ClipboardCheck, bg: "bg-white" }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 text-slate-800">
                    <Target className="h-6 w-6 text-blue-500" /> Hoja de Ruta
                </h2>
                <Badge variant="outline" className="font-bold text-[10px] border-2 uppercase">{misiones.length} Tareas</Badge>
            </div>

            <div className="grid gap-4">
                {misiones.length === 0 ? (
                    <Card className="p-10 text-center border-dashed border-2 bg-slate-50">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin misiones para este turno</p>
                    </Card>
                ) : (
                    misiones.map((m) => {
                        const status = getMissionStatus(m)
                        const Icon = status.icon
                        const porcentaje = Math.min((m.unidades_completadas / m.objetivo_unidades) * 100, 100)

                        return (
                            <Card key={m.id} className={cn("p-5 border-2 rounded-[1.5rem] transition-all shadow-sm", status.bg)}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className={cn("p-3 rounded-2xl bg-white shadow-sm", status.color)}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-black text-sm text-slate-800 uppercase leading-tight">{m.descripcion}</p>
                                            <p className={cn("text-[10px] font-black uppercase mt-1 tracking-widest", status.color)}>
                                                {status.label} {!m.caja_diaria_id && "• Global"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-black text-blue-600">+{m.puntos} <span className="text-[10px] text-slate-400">XP</span></div>
                                    </div>
                                </div>

                                {!m.es_completada && (
                                    <div className="mt-5 pt-4 border-t border-slate-100">
                                        {m.tipo === 'vencimiento' ? (
                                            <div className="space-y-3">
                                                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                                                    <span>Progreso</span>
                                                    <span>{m.unidades_completadas} / {m.objetivo_unidades} U.</span>
                                                </div>
                                                <Progress value={porcentaje} className="h-2 bg-slate-100" />
                                                <Button onClick={handleOpenMermarModal} disabled={procesando} className="w-full bg-orange-500 hover:bg-orange-600 font-black text-[10px] uppercase h-10 rounded-xl shadow-lg shadow-orange-100">
                                                    {procesando ? <Loader2 className="animate-spin h-4 w-4" /> : "Ejecutar Retiro de Stock"}
                                                </Button>
                                            </div>
                                        ) : m.tipo === 'manual' ? (
                                            <Button onClick={() => handleCompletarManual(m)} disabled={procesando} className="w-full bg-blue-600 hover:bg-blue-700 font-black text-[10px] uppercase h-10 rounded-xl shadow-lg shadow-blue-100">
                                                Confirmar Acción Realizada
                                            </Button>
                                        ) : null}
                                    </div>
                                )}
                            </Card>
                        )
                    })
                )}
            </div>

            {/* Modal de Mermas */}
            <Dialog open={showMermarModal} onOpenChange={setShowMermarModal}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] p-8 border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-orange-600 font-black uppercase tracking-tighter">
                            <AlertTriangle className="h-6 w-6" /> Retiro de Mercadería
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-orange-50 p-4 rounded-2xl border-2 border-orange-100 leading-relaxed">
                            Confirma que vas a retirar estas unidades del mostrador para evitar ventas de productos vencidos en <span className="text-orange-700 underline">este local</span>.
                        </p>

                        <div className="max-h-60 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                            {stockParaMermar.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-white border-2 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{item.emoji_producto}</span>
                                        <div className="flex flex-col">
                                            <span className="font-black text-xs uppercase text-slate-700">{item.nombre_producto}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{item.cantidad} u. en este lote</span>
                                        </div>
                                    </div>
                                    <Badge className="bg-red-100 text-red-600 border-0 font-black text-[9px]">VENCE: {format(parseISO(item.fecha_vencimiento), 'dd/MM')}</Badge>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        {/* El botón muestra UNIDADES (suma de quantity) + LOTES (length) para
                            que el total matchee el objetivo de la misión, que está expresado
                                       en unidades. */}
                        <Button onClick={handleMermarStock} disabled={procesando} className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl">
                            {procesando ? (
                                <Loader2 className="animate-spin h-5 w-5" />
                            ) : (
                                (() => {
                                    const totalUnidades = stockParaMermar.reduce((acc, b) => acc + (Number(b.cantidad) || 0), 0)
                                    const lotesLabel = stockParaMermar.length === 1 ? 'LOTE' : 'LOTES'
                                    const unidadesLabel = totalUnidades === 1 ? 'UNIDAD' : 'UNIDADES'
                                    return `CONFIRMAR RETIRO DE ${totalUnidades} ${unidadesLabel} (${stockParaMermar.length} ${lotesLabel})`
                                })()
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
