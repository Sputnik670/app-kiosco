"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Smartphone, Zap, Tv, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getServiceProviderBalanceAction, processServiceRechargeAction, type ServiceProvider } from "@/lib/actions/service.actions"

const METODOS_PAGO = [
    { id: 'efectivo' as const, label: '💵 Efectivo' },
    { id: 'tarjeta' as const, label: '💳 Tarjeta' },
    { id: 'billetera_virtual' as const, label: '📱 Billetera' },
]

const SERVICIOS = [
    { id: 'claro', nombre: 'Claro', icon: Smartphone },
    { id: 'movistar', nombre: 'Movistar', icon: Smartphone },
    { id: 'personal', nombre: 'Personal', icon: Smartphone },
    { id: 'tuenti', nombre: 'Tuenti', icon: Smartphone },
    { id: 'directv', nombre: 'DirecTV', icon: Tv },
    { id: 'flow', nombre: 'Flow', icon: Tv },
    { id: 'edenor', nombre: 'Edenor', icon: Zap },
    { id: 'edesur', nombre: 'Edesur', icon: Zap },
]

export default function WidgetServicios({ turnoId, sucursalId, onVentaRegistrada }: { turnoId: string, sucursalId: string, onVentaRegistrada: () => void }) {
    const [servicioId, setServicioId] = useState<string>(SERVICIOS[0].id)
    const [monto, setMonto] = useState("")
    const [loading, setLoading] = useState(false)
    const [metodoPago, setMetodoPago] = useState<'efectivo' | 'tarjeta' | 'billetera_virtual'>('efectivo')
    const [proveedorServicios, setProveedorServicios] = useState<ServiceProvider | null>(null)

    useEffect(() => {
        const fetchProveedor = async () => {
            try {
                // Buscar proveedor que coincida con el servicio seleccionado
                const nombreServicio = SERVICIOS.find(s => s.id === servicioId)?.nombre || servicioId
                const result = await getServiceProviderBalanceAction(nombreServicio)
                if (result.success && result.provider) {
                    setProveedorServicios(result.provider)
                } else {
                    console.error('[Servicios] Error cargando proveedor para', servicioId, ':', result.error)
                    setProveedorServicios(null)
                    toast.error("Error cargando proveedor", {
                        description: result.error || "No se encontró proveedor para este servicio",
                        duration: 5000,
                    })
                }
            } catch (err: any) {
                console.error('[Servicios] Excepción:', err)
                setProveedorServicios(null)
                toast.error("Error cargando proveedor", {
                    description: err.message || "Error de conexión",
                    duration: 5000,
                })
            }
        }
        fetchProveedor()
    }, [servicioId])

    // Calcular comisión dinámica según config del proveedor
    // DECIMAL de Supabase puede llegar como string — siempre castear con Number()
    const comision = useMemo(() => {
        if (!proveedorServicios || !monto) return 0
        const montoNum = parseFloat(monto) || 0
        const markupVal = Number(proveedorServicios.markup_value) || 0
        if (proveedorServicios.markup_type === 'percentage' && markupVal > 0) {
            return Math.round(montoNum * markupVal / 100)
        }
        if (proveedorServicios.markup_type === 'fixed' && markupVal > 0) {
            return markupVal
        }
        return 0 // Sin comisión configurada
    }, [monto, proveedorServicios])

    const totalCobrar = (parseFloat(monto) || 0) + comision

    const handleCargar = async () => {
        if (!monto || !proveedorServicios) return
        setLoading(true)

        try {
            const montoCarga = parseFloat(monto)
            const nombreServicio = SERVICIOS.find(s => s.id === servicioId)?.nombre || "Servicio"

            const result = await processServiceRechargeAction({
                turnoId,
                sucursalId,
                proveedorId: proveedorServicios.id,
                tipoServicio: nombreServicio,
                montoCarga,
                comision,
                totalCobrado: totalCobrar,
                metodoPago,
            })

            if (!result.success) {
                toast.error("Error al procesar recarga", { description: result.error })
                return
            }

            if (result.newBalance !== undefined) {
                setProveedorServicios(prev => prev ? { ...prev, balance: result.newBalance! } : null)
            }

            setMonto("")
            toast.success("Recarga exitosa", { description: result.message })
            onVentaRegistrada()
        } catch (error: any) {
            toast.error("Error", { description: error.message })
        } finally {
            setLoading(false)
        }
    }

    const markupLabel = proveedorServicios?.markup_type === 'percentage'
        ? `+${proveedorServicios.markup_value}%`
        : proveedorServicios?.markup_type === 'fixed'
        ? `+$${proveedorServicios.markup_value}`
        : 'Sin comisión'

    return (
        <Card className="p-4 bg-indigo-600 text-white shadow-lg border-2 border-indigo-500 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-white/20 rounded-full"><Smartphone className="h-6 w-6 text-white" /></div>
                    <div><h3 className="font-bold text-lg leading-none">Cargas Virtuales</h3></div>
                </div>
                <span className="text-[9px] font-bold bg-white/20 px-2 py-1 rounded-full">{markupLabel}</span>
            </div>

            <select
                title="Seleccionar Operadora o Servicio"
                value={servicioId}
                onChange={(e) => setServicioId(e.target.value)}
                className="w-full h-10 rounded-md bg-indigo-700 text-white font-medium px-3 text-sm focus:outline-none"
            >
                {SERVICIOS.map(s => (<option key={s.id} value={s.id}>{s.nombre}</option>))}
            </select>

            <div>
                <Input
                    type="number"
                    className="bg-white text-black font-bold h-12 text-lg"
                    placeholder="Monto de la carga"
                    value={monto}
                    onChange={e => setMonto(e.target.value)}
                />
                {comision > 0 && monto && (
                    <div className="bg-indigo-700/50 rounded-lg p-2 mt-2 space-y-1">
                        <div className="flex justify-between text-[10px] text-indigo-200">
                            <span>Carga</span>
                            <span>${(parseFloat(monto) || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-yellow-300 font-black">
                            <span>RECARGO</span>
                            <span>+ ${comision.toLocaleString()}</span>
                        </div>
                        <div className="border-t border-indigo-400/30 pt-1 flex justify-between text-[11px] text-white font-black">
                            <span>TOTAL A COBRAR</span>
                            <span>${totalCobrar.toLocaleString()}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Método de pago */}
            <div className="flex gap-1.5">
                {METODOS_PAGO.map(m => (
                    <button
                        key={m.id}
                        type="button"
                        onClick={() => setMetodoPago(m.id)}
                        className={`flex-1 text-[9px] font-black py-2 rounded-lg transition-all ${
                            metodoPago === m.id
                                ? 'bg-white text-indigo-700 shadow-md'
                                : 'bg-indigo-700/40 text-indigo-200 hover:bg-indigo-700/60'
                        }`}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            <Button
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-indigo-900 font-black h-12"
                onClick={handleCargar}
                disabled={loading || !monto || !proveedorServicios}
            >
                {loading ? <Loader2 className="animate-spin" /> : `COBRAR $${totalCobrar.toLocaleString()}`}
            </Button>
        </Card>
    )
}
