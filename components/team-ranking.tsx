"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Trophy, Medal, Target, DollarSign, AlertCircle } from "lucide-react"

interface EmpleadoMetricas {
    id: string
    nombre: string
    avatar_url?: string
    xp: number
    ventas_total: number
    misiones_completadas: number
    diferencia_caja_acumulada: number
    turnos_cerrados: number
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

        // Schema V2: Obtener organization_id del usuario actual
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return setLoading(false)

        const { data: currentMembership } = await supabase
            .from('memberships')
            .select('organization_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()

        if (!currentMembership) return setLoading(false)

        // Schema V2: Traer empleados de la organización (memberships con role='employee')
        const { data: empleados } = await supabase
            .from('memberships')
            .select('user_id, display_name, xp')
            .eq('organization_id', currentMembership.organization_id)
            .eq('role', 'employee')
            .eq('is_active', true)

        if (!empleados) return setLoading(false)

        const metricas: EmpleadoMetricas[] = []

        // Calcular métricas para cada uno (Últimos 30 días)
        const fechaInicio = new Date()
        fechaInicio.setDate(fechaInicio.getDate() - 30)
        const fechaStr = fechaInicio.toISOString()

        for (const emp of empleados) {
            // Schema V2: Ventas desde cash_registers y sales
            const { data: turnosVentas } = await supabase
                .from('cash_registers')
                .select('id')
                .eq('opened_by', emp.user_id)
                .not('closed_at', 'is', null)
                .gte('opened_at', fechaStr)

            let totalVentas = 0
            if (turnosVentas && turnosVentas.length > 0) {
                const turnosIds = turnosVentas.map(t => t.id)
                // Schema V2: Sumar ventas de sale_items
                const { data: ventasData } = await supabase
                    .from('sales')
                    .select('total')
                    .in('cash_register_id', turnosIds)
                    .gte('created_at', fechaStr)

                if (ventasData) {
                    totalVentas = ventasData.reduce((sum, v) => sum + (Number(v.total) || 0), 0)
                }
            }

            // Schema V2: Misiones completadas desde employee_missions
            const { count: misiones } = await supabase
                .from('employee_missions')
                .select('*', { count: 'exact', head: true })
                .eq('employee_id', emp.user_id)
                .eq('status', 'completed')
                .gte('created_at', fechaStr)

            // Schema V2: Diferencia de caja desde cash_registers
            const { data: turnos } = await supabase
                .from('cash_registers')
                .select('opening_amount, closing_amount, variance')
                .eq('opened_by', emp.user_id)
                .not('closed_at', 'is', null)
                .gte('opened_at', fechaStr)

            let diffAcumulada = 0
            let countTurnos = 0

            if (turnos) {
                countTurnos = turnos.length
                turnos.forEach((t) => {
                    if (t.variance !== null && t.variance !== undefined) {
                        diffAcumulada += Number(t.variance) || 0
                    }
                })
            }

            metricas.push({
                id: emp.user_id,
                nombre: emp.display_name || 'Sin nombre',
                xp: emp.xp || 0,
                ventas_total: totalVentas,
                misiones_completadas: misiones || 0,
                diferencia_caja_acumulada: diffAcumulada,
                turnos_cerrados: countTurnos
            })
        }

        // Ordenar por XP
        setRanking(metricas.sort((a, b) => b.xp - a.xp))
        setLoading(false)
    }

    if (loading) return <div className="p-4 text-center">Cargando podio...</div>

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* EL GANADOR */}
            {ranking[0] && (
                <Card className="md:col-span-3 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white p-6 relative overflow-hidden border-0 shadow-xl">
                    <div className="absolute top-0 right-0 p-4 opacity-20">
                        <Trophy className="w-40 h-40 transform rotate-12" />
                    </div>
                    <div className="relative z-10 flex items-center gap-6">
                        <div className="relative">
                            <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                                <AvatarFallback className="text-2xl font-black text-orange-600 bg-white">
                                    {ranking[0].nombre.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                            <Badge className="absolute -bottom-2 -right-2 bg-yellow-300 text-yellow-900 border-2 border-white px-2">
                                TOP #1
                            </Badge>
                        </div>
                        <div>
                            <p className="text-yellow-100 font-bold uppercase tracking-widest text-xs">Empleado del Mes</p>
                            <h2 className="text-3xl font-black">{ranking[0].nombre}</h2>
                            <div className="flex gap-4 mt-2 text-sm font-medium">
                                <span className="flex items-center gap-1"><Target className="w-4 h-4"/> {ranking[0].xp} XP</span>
                                <span className="flex items-center gap-1"><DollarSign className="w-4 h-4"/> ${ranking[0].ventas_total.toLocaleString()} vend.</span>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* LISTA COMPLETA */}
            <div className="md:col-span-3 space-y-3">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                    <Medal className="h-5 w-5 text-indigo-600" /> Tabla de Posiciones
                </h3>
                {ranking.map((emp, index) => (
                    <Card key={emp.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <span className={`font-black text-lg w-6 text-center ${index === 0 ? "text-yellow-500" : index === 1 ? "text-gray-400" : index === 2 ? "text-amber-600" : "text-gray-300"}`}>
                                {index + 1}
                            </span>
                            <Avatar>
                                <AvatarFallback>{emp.nombre.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold">{emp.nombre}</p>
                                <div className="flex gap-2 text-xs text-muted-foreground">
                                    <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                                        <Target className="h-3 w-3" /> {emp.misiones_completadas} misiones
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="text-right">
                             {/* ALERTA DE CAJA */}
                             {emp.diferencia_caja_acumulada < -1000 ? (
                                 <div className="text-red-600 text-xs font-bold flex items-center justify-end gap-1 mb-1">
                                     <AlertCircle className="h-3 w-3" />
                                     Faltante: ${Math.abs(emp.diferencia_caja_acumulada)}
                                 </div>
                             ) : (
                                 <div className="text-emerald-600 text-xs font-bold flex items-center justify-end gap-1 mb-1">
                                     Caja OK
                                 </div>
                             )}
                             <p className="text-sm font-black text-gray-800">{emp.xp} XP</p>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    )
}
