"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Trophy, Medal, Target, ShoppingCart, AlertCircle, Zap } from "lucide-react"

interface EmpleadoMetricas {
    id: string
    nombre: string
    xp: number
    ventas_total: number
    ventas_cantidad: number
    misiones_completadas: number
    misiones_total: number
    diferencia_caja_acumulada: number
    turnos_cerrados: number
    incidentes_abiertos: number
}

export default function TeamRanking() {
    const [ranking, setRanking] = useState<EmpleadoMetricas[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        calcularRanking()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const calcularRanking = async () => {
        setLoading(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return setLoading(false)

        const { data: currentMembership } = await supabase
            .from('memberships')
            .select('organization_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()

        if (!currentMembership) return setLoading(false)

        const { data: empleados } = await supabase
            .from('memberships')
            .select('user_id, display_name, xp')
            .eq('organization_id', currentMembership.organization_id)
            .eq('role', 'employee')
            .eq('is_active', true)

        if (!empleados) return setLoading(false)

        const metricas: EmpleadoMetricas[] = []

        // Últimos 30 días
        const fechaInicio = new Date()
        fechaInicio.setDate(fechaInicio.getDate() - 30)
        const fechaStr = fechaInicio.toISOString()

        for (const emp of empleados) {
            // Turnos de caja cerrados
            const { data: turnosData } = await supabase
                .from('cash_registers')
                .select('id, variance')
                .eq('opened_by', emp.user_id)
                .not('closed_at', 'is', null)
                .gte('opened_at', fechaStr)

            const turnosIds = (turnosData || []).map(t => t.id)
            const countTurnos = turnosData?.length || 0

            // Diferencia de caja acumulada
            let diffAcumulada = 0
            ;(turnosData || []).forEach(t => {
                if (t.variance !== null && t.variance !== undefined) {
                    diffAcumulada += Number(t.variance) || 0
                }
            })

            // Ventas: total en $ y cantidad de ventas
            let totalVentas = 0
            let cantidadVentas = 0
            if (turnosIds.length > 0) {
                const { data: ventasData } = await supabase
                    .from('sales')
                    .select('total')
                    .in('cash_register_id', turnosIds)
                    .gte('created_at', fechaStr)

                if (ventasData) {
                    totalVentas = ventasData.reduce((sum, v) => sum + (Number(v.total) || 0), 0)
                    cantidadVentas = ventasData.length
                }

                // Sumar ventas de servicios también
                const { data: svcData } = await supabase
                    .from('service_sales')
                    .select('total_collected')
                    .in('cash_register_id', turnosIds)
                    .gte('created_at', fechaStr)

                if (svcData) {
                    totalVentas += svcData.reduce((sum, v) => sum + (Number(v.total_collected) || 0), 0)
                    cantidadVentas += svcData.length
                }
            }

            // Misiones: completadas / total (tabla real: missions)
            const { data: missionsData } = await supabase
                .from('missions')
                .select('is_completed')
                .eq('user_id', emp.user_id)
                .gte('created_at', fechaStr)

            const misiones_total = missionsData?.length || 0
            const misiones_completadas = (missionsData || []).filter(m => m.is_completed).length

            // Incidentes abiertos
            const { count: incidentes } = await supabase
                .from('incidents')
                .select('*', { count: 'exact', head: true })
                .eq('employee_id', emp.user_id)
                .in('status', ['open', 'justified'])

            metricas.push({
                id: emp.user_id,
                nombre: emp.display_name || 'Sin nombre',
                xp: emp.xp || 0,
                ventas_total: totalVentas,
                ventas_cantidad: cantidadVentas,
                misiones_completadas,
                misiones_total,
                diferencia_caja_acumulada: diffAcumulada,
                turnos_cerrados: countTurnos,
                incidentes_abiertos: incidentes || 0,
            })
        }

        setRanking(metricas.sort((a, b) => b.xp - a.xp))
        setLoading(false)
    }

    if (loading) return <div className="p-4 text-center text-sm text-slate-400">Cargando podio...</div>
    if (ranking.length === 0) return null

    return (
        <div className="space-y-4">
            {/* EL GANADOR */}
            {ranking[0] && (
                <Card className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white p-6 relative overflow-hidden border-0 shadow-xl">
                    <div className="absolute top-0 right-0 p-4 opacity-20">
                        <Trophy className="w-32 h-32 transform rotate-12" />
                    </div>
                    <div className="relative z-10 flex items-center gap-5">
                        <div className="relative">
                            <Avatar className="w-20 h-20 border-4 border-white shadow-lg">
                                <AvatarFallback className="text-2xl font-black text-orange-600 bg-white">
                                    {ranking[0].nombre.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                            <Badge className="absolute -bottom-2 -right-2 bg-yellow-300 text-yellow-900 border-2 border-white px-2 text-[9px] font-black">
                                #1
                            </Badge>
                        </div>
                        <div>
                            <p className="text-yellow-100 font-bold uppercase tracking-widest text-[9px]">Empleado del Mes</p>
                            <h2 className="text-2xl font-black">{ranking[0].nombre}</h2>
                            <div className="flex gap-3 mt-2 text-xs font-bold">
                                <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5"/> {ranking[0].xp} XP</span>
                                <span className="flex items-center gap-1"><ShoppingCart className="w-3.5 h-3.5"/> {ranking[0].ventas_cantidad} ventas</span>
                                <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5"/> {ranking[0].misiones_completadas} misiones</span>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* LISTA COMPLETA */}
            <div className="space-y-3">
                <h3 className="font-black text-slate-700 flex items-center gap-2 text-sm uppercase">
                    <Medal className="h-5 w-5 text-indigo-600" /> Tabla de Posiciones
                </h3>
                {ranking.map((emp, index) => (
                    <Card key={emp.id} className="p-4 flex items-center justify-between border-2">
                        <div className="flex items-center gap-3">
                            <span className={`font-black text-lg w-6 text-center ${index === 0 ? "text-yellow-500" : index === 1 ? "text-gray-400" : index === 2 ? "text-amber-600" : "text-gray-300"}`}>
                                {index + 1}
                            </span>
                            <Avatar className="h-10 w-10">
                                <AvatarFallback className="font-bold text-sm">{emp.nombre.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold text-sm">{emp.nombre}</p>
                                <div className="flex gap-1.5 mt-0.5 flex-wrap">
                                    <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                                        {emp.misiones_completadas}/{emp.misiones_total} misiones
                                    </span>
                                    <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                                        {emp.ventas_cantidad} ventas
                                    </span>
                                    {emp.incidentes_abiertos > 0 && (
                                        <span className="text-[9px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                                            {emp.incidentes_abiertos} pendientes
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="text-right">
                            {emp.diferencia_caja_acumulada < -500 ? (
                                <div className="text-red-600 text-[10px] font-bold flex items-center justify-end gap-1 mb-0.5">
                                    <AlertCircle className="h-3 w-3" />
                                    ${Math.abs(emp.diferencia_caja_acumulada).toLocaleString()}
                                </div>
                            ) : (
                                <div className="text-emerald-600 text-[10px] font-bold mb-0.5">
                                    Caja OK
                                </div>
                            )}
                            <p className="text-sm font-black text-slate-800">{emp.xp} XP</p>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    )
}
