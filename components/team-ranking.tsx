"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Trophy, Medal, TrendingDown, Target, DollarSign, AlertCircle } from "lucide-react"

interface EmpleadoMetricas {
    id: string
    nombre: string
    avatar_url?: string
    xp: number
    ventas_total: number
    misiones_completadas: number
    diferencia_caja_acumulada: number // Cuánto dinero le faltó/sobró en total
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
        
        // 1. Traer empleados
        const { data: empleados } = await supabase.from('perfiles').select('id, nombre, xp').eq('rol', 'empleado')
        
        if (!empleados) return setLoading(false)

        const metricas: EmpleadoMetricas[] = []

        // 2. Calcular métricas para cada uno (Últimos 30 días para que sea relevante)
        const fechaInicio = new Date()
        fechaInicio.setDate(fechaInicio.getDate() - 30)
        const fechaStr = fechaInicio.toISOString()

        for (const emp of empleados) {
            // A. Ventas - Calcular monto total vendido por este empleado
            // Primero obtenemos los turnos del empleado
            const { data: turnosVentas } = await supabase
                .from('caja_diaria')
                .select('id')
                .eq('empleado_id', emp.id)
                .not('fecha_cierre', 'is', null)
                .gte('fecha_apertura', fechaStr)
            
            let totalVentas = 0
            if (turnosVentas && turnosVentas.length > 0) {
                // Obtenemos las ventas de esos turnos
                const turnosIds = turnosVentas.map(t => t.id)
                const { data: ventasData } = await supabase
                    .from('stock')
                    .select('precio_venta_historico, cantidad')
                    .eq('estado', 'vendido')
                    .in('caja_diaria_id', turnosIds)
                    .gte('fecha_venta', fechaStr)
                
                // Calcular total de ventas
                if (ventasData) {
                    totalVentas = ventasData.reduce((sum: number, v: any) => {
                        const precio = Number(v.precio_venta_historico) || 0
                        const cantidad = Number(v.cantidad) || 1
                        return sum + (precio * cantidad)
                    }, 0)
                }
            }
            
            // B. Misiones
            const { count: misiones } = await supabase
                .from('misiones')
                .select('*', { count: 'exact', head: true })
                .eq('empleado_id', emp.id)
                .eq('es_completada', true)
                .gte('created_at', fechaStr)

            // C. Diferencia de Caja (CRÍTICO)
            const { data: turnos } = await supabase
                .from('caja_diaria')
                .select('monto_inicial, monto_final, diferencia, movimientos_caja(monto, tipo)')
                .eq('empleado_id', emp.id)
                .not('fecha_cierre', 'is', null)
                .gte('fecha_apertura', fechaStr)

            let diffAcumulada = 0
            let countTurnos = 0

            if (turnos) {
                countTurnos = turnos.length
                turnos.forEach((t: any) => {
                    // Usar la diferencia calculada si existe, sino calcularla
                    if (t.diferencia !== null && t.diferencia !== undefined) {
                        diffAcumulada += Number(t.diferencia) || 0
                    } else if (t.monto_final !== null && t.monto_inicial !== null) {
                        // Calcular diferencia manualmente si no está calculada
                        const gastos = t.movimientos_caja
                            ?.filter((m: any) => m.tipo === 'egreso')
                            .reduce((sum: number, m: any) => sum + m.monto, 0) || 0
                        
                        const ingresos = t.movimientos_caja
                            ?.filter((m: any) => m.tipo === 'ingreso')
                            .reduce((sum: number, m: any) => sum + m.monto, 0) || 0
                        
                        // Diferencia = monto_final - (monto_inicial + ingresos - gastos)
                        const esperado = Number(t.monto_inicial) + ingresos - gastos
                        const diferencia = Number(t.monto_final) - esperado
                        diffAcumulada += diferencia
                    }
                })
            }

            metricas.push({
                id: emp.id,
                nombre: emp.nombre || 'Sin nombre',
                xp: emp.xp || 0,
                ventas_total: totalVentas, // ✅ Datos reales
                misiones_completadas: misiones || 0,
                diferencia_caja_acumulada: diffAcumulada, // ✅ Datos reales
                turnos_cerrados: countTurnos
            })
        }

        // Ordenar por XP (o por ventas, según prefieras)
        setRanking(metricas.sort((a, b) => b.xp - a.xp))
        setLoading(false)
    }

    if (loading) return <div className="p-4 text-center">Cargando podio...</div>

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* EL GANADOR (Centro arriba en móvil, primero en desktop) */}
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