// components/gestion-vencimientos.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { format, parseISO, differenceInDays } from "date-fns"
import { getExpiringStockAction, processStockLossAction } from "@/lib/actions/inventory.actions"

interface GestionVencimientosProps {
    turnoId: string
    empleadoId: string
    onAccionRealizada?: () => void
    sucursalId: string
}

export default function GestionVencimientos({ turnoId, empleadoId, onAccionRealizada, sucursalId }: GestionVencimientosProps) {
    const [loading, setLoading] = useState(true)
    const [productosVencidos, setProductosVencidos] = useState<any[]>([])
    const [procesandoId, setProcesandoId] = useState<string | null>(null)

    const fetchVencimientos = useCallback(async () => {
        try {
            const result = await getExpiringStockAction(sucursalId)

            if (!result.success) {
                toast.error("Error al cargar vencimientos", { description: result.error })
                return
            }

            setProductosVencidos(result.data || [])
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar vencimientos")
        } finally {
            setLoading(false)
        }
    }, [sucursalId])

    useEffect(() => {
        fetchVencimientos()
    }, [fetchVencimientos])

    const handleMermar = async (stockId: string, nombreProducto: string) => {
        if (!confirm(`¿Confirmar que el producto ${nombreProducto} se descarta por vencimiento/daño?`)) return

        setProcesandoId(stockId)
        try {
            const result = await processStockLossAction(stockId, turnoId, empleadoId)

            if (!result.success) {
                toast.error("Error", { description: result.error })
                return
            }

            if (result.misionCompletada) {
                toast.success("¡Misión Completada! 🎯", { description: "Has gestionado todos los vencimientos." })
            } else {
                toast.success("Producto Mermado", { description: "Inventario actualizado." })
            }

            setProductosVencidos(prev => prev.filter(p => p.id !== stockId))
            if (onAccionRealizada) onAccionRealizada()

        } catch (error: any) {
            toast.error("Error", { description: error.message })
        } finally {
            setProcesandoId(null)
        }
    }

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>

    if (productosVencidos.length === 0) {
        return (
            <Card className="p-8 text-center bg-emerald-50 border-emerald-100 border-2 border-dashed">
                <div className="bg-white p-4 rounded-full w-fit mx-auto mb-4 shadow-sm">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="font-bold text-emerald-800 text-lg">Todo en Orden</h3>
                <p className="text-sm text-emerald-600 mt-2">No hay productos próximos a vencer en los siguientes 10 días.</p>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2 px-1">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <h3 className="font-bold text-lg">Riesgo de Vencimiento ({productosVencidos.length})</h3>
            </div>

            <div className="grid gap-3">
                {productosVencidos.map((item) => {
                    const diasRestantes = differenceInDays(parseISO(item.fecha_vencimiento), new Date())
                    const esCritico = diasRestantes <= 3

                    return (
                        <Card key={item.id} className={`p-4 flex items-center justify-between border-l-4 ${esCritico ? 'border-l-red-500 bg-red-50/50' : 'border-l-orange-400 bg-white'}`}>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{item.productos?.emoji || '📦'}</span>
                                <div>
                                    <h4 className="font-bold text-sm leading-tight">{item.productos?.nombre}</h4>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Vence: <span className="font-medium text-foreground">{format(parseISO(item.fecha_vencimiento), 'dd/MM/yyyy')}</span>
                                    </p>
                                    <Badge variant="outline" className={`mt-1 text-[10px] h-5 ${esCritico ? 'text-red-600 border-red-200 bg-red-50' : 'text-orange-600 border-orange-200 bg-orange-50'}`}>
                                        {diasRestantes < 0 ? `Vencido hace ${Math.abs(diasRestantes)} días` : `Quedan ${diasRestantes} días`}
                                    </Badge>
                                </div>
                            </div>

                            <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 text-xs shadow-sm"
                                disabled={!!procesandoId}
                                onClick={() => handleMermar(item.id, item.productos?.nombre)}
                            >
                                {procesandoId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                                Mermar
                            </Button>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
