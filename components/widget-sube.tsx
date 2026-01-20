"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Bus } from "lucide-react"
import { toast } from "sonner"
import { getServiceProviderBalanceAction, processVirtualRechargeAction, type ServiceProvider } from "@/lib/actions/service.actions"

type MetodoPago = 'efectivo' | 'billetera_virtual'

interface WidgetSubeProps {
    turnoId: string
    sucursalId: string
    onVentaRegistrada: () => void
}

export default function WidgetSube({ turnoId, sucursalId, onVentaRegistrada }: WidgetSubeProps) {
    const [monto, setMonto] = useState("")
    const [costoServicio, setCostoServicio] = useState("50")
    const [loading, setLoading] = useState(false)
    const [proveedorSube, setProveedorSube] = useState<ServiceProvider | null>(null)
    const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo')

    useEffect(() => {
        const fetchProveedorSube = async () => {
            const result = await getServiceProviderBalanceAction('SUBE')
            if (result.success && result.provider) {
                setProveedorSube(result.provider)
            }
        }
        fetchProveedorSube()
    }, [])

    const handleCargar = async () => {
        if (!monto || !proveedorSube) return

        setLoading(true)

        try {
            const montoCarga = parseFloat(monto)
            const comision = parseFloat(costoServicio) || 0
            const totalCobrar = montoCarga + comision

            const result = await processVirtualRechargeAction({
                turnoId,
                sucursalId,
                proveedorId: proveedorSube.id,
                tipoServicio: 'SUBE',
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
                setProveedorSube(prev => prev ? { ...prev, saldo_actual: result.newBalance! } : null)
            }

            setMonto("")
            toast.success("Carga SUBE exitosa", { description: result.message })
            onVentaRegistrada()

        } catch (error: any) {
            toast.error("Error", { description: error.message })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="p-4 bg-blue-600 text-white shadow-lg border-2 border-blue-500 flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <div className="p-2 bg-white/20 rounded-full"><Bus className="h-6 w-6 text-white" /></div>
                <div><h3 className="font-bold text-lg leading-none">Carga SUBE</h3><p className="text-[10px] text-blue-200">Transporte</p></div>
            </div>

            {proveedorSube && (
                <div className="bg-blue-700/50 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-blue-200 font-bold uppercase">Saldo SUBE</p>
                    <p className="text-xl font-black">${proveedorSube.saldo_actual.toLocaleString()}</p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-2">
                <Input type="number" className="bg-white text-black font-bold h-10" placeholder="Monto" value={monto} onChange={e => setMonto(e.target.value)} />
                <Input type="number" className="bg-white/90 text-slate-600 h-10" value={costoServicio} onChange={e => setCostoServicio(e.target.value)} />
            </div>

            <Button className="w-full bg-yellow-400 hover:bg-yellow-500 text-blue-900 font-black h-12" onClick={handleCargar} disabled={loading || !monto}>
                {loading ? <Loader2 className="animate-spin" /> : `COBRAR $${((parseFloat(monto) || 0) + (parseFloat(costoServicio) || 0)).toLocaleString()}`}
            </Button>
        </Card>
    )
}