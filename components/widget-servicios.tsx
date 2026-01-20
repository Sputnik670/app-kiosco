"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Smartphone, Zap, Tv, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getServiceProviderBalanceAction, processServiceRechargeAction, type ServiceProvider } from "@/lib/actions/service.actions"

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
    const [costoServicio, setCostoServicio] = useState("50")
    const [metodoPago, setMetodoPago] = useState<'efectivo' | 'billetera_virtual'>('efectivo')
    const [loading, setLoading] = useState(false)
    const [proveedorServicios, setProveedorServicios] = useState<ServiceProvider | null>(null)

    useEffect(() => {
        const fetchProveedor = async () => {
            const result = await getServiceProviderBalanceAction('servicios')
            if (result.success && result.provider) {
                setProveedorServicios(result.provider)
            }
        }
        fetchProveedor()
    }, [])

    const handleCargar = async () => {
        if (!monto || !proveedorServicios) return
        setLoading(true)

        try {
            const montoCarga = parseFloat(monto)
            const comision = parseFloat(costoServicio) || 0
            const totalCobrar = montoCarga + comision
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

            // Actualizar saldo local
            if (result.newBalance !== undefined) {
                setProveedorServicios(prev => prev ? { ...prev, saldo_actual: result.newBalance! } : null)
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

        return (
            <Card className="p-4 bg-indigo-600 text-white shadow-lg border-2 border-indigo-500 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-white/20 rounded-full"><Smartphone className="h-6 w-6 text-white" /></div>
                    <div><h3 className="font-bold text-lg leading-none">Cargas Virtuales</h3></div>
                </div>

                <select 
                    title="Seleccionar Operadora o Servicio" 
                    value={servicioId} 
                    onChange={(e) => setServicioId(e.target.value)} 
                    className="w-full h-10 rounded-md bg-indigo-700 text-white font-medium px-3 text-sm focus:outline-none"
                >
                    {SERVICIOS.map(s => (<option key={s.id} value={s.id}>{s.nombre}</option>))}
                </select>

                <div className="grid grid-cols-2 gap-2">
                    <Input type="number" className="bg-white text-black font-bold h-10" placeholder="Monto" value={monto} onChange={e => setMonto(e.target.value)} />
                    <Input type="number" className="bg-white/90 text-slate-600 h-10" value={costoServicio} onChange={e => setCostoServicio(e.target.value)} />
                </div>

                <Button className="w-full bg-yellow-400 hover:bg-yellow-500 text-indigo-900 font-black h-12" onClick={handleCargar} disabled={loading || !monto}>
                    {loading ? <Loader2 className="animate-spin" /> : `COBRAR $${((parseFloat(monto) || 0) + (parseFloat(costoServicio) || 0)).toLocaleString()}`}
                </Button>
            </Card>
        )
    }