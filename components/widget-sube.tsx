"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Bus } from "lucide-react"
import { toast } from "sonner"
import { getServiceProviderBalanceAction, processVirtualRechargeAction, type ServiceProvider } from "@/lib/actions/service.actions"

interface WidgetSubeProps {
    turnoId: string
    sucursalId: string
    onVentaRegistrada: () => void
}

export default function WidgetSube({ turnoId, sucursalId, onVentaRegistrada }: WidgetSubeProps) {
    const [monto, setMonto] = useState("")
    const [loading, setLoading] = useState(false)
    const [proveedorSube, setProveedorSube] = useState<ServiceProvider | null>(null)

    useEffect(() => {
        const fetchProveedorSube = async () => {
            const result = await getServiceProviderBalanceAction('SUBE')
            if (result.success && result.provider) {
                setProveedorSube(result.provider)
            }
        }
        fetchProveedorSube()
    }, [])

    // Comisión dinámica desde config del proveedor
    const comision = useMemo(() => {
        if (!proveedorSube || !monto) return 0
        const montoNum = parseFloat(monto) || 0
        if (proveedorSube.markup_type === 'percentage' && proveedorSube.markup_value) {
            return Math.round(montoNum * proveedorSube.markup_value / 100)
        }
        if (proveedorSube.markup_type === 'fixed' && proveedorSube.markup_value) {
            return proveedorSube.markup_value
        }
        return 0
    }, [monto, proveedorSube])

    const totalCobrar = (parseFloat(monto) || 0) + comision

    const handleCargar = async () => {
        if (!monto || !proveedorSube) return
        setLoading(true)

        try {
            const montoCarga = parseFloat(monto)

            const result = await processVirtualRechargeAction({
                turnoId,
                sucursalId,
                proveedorId: proveedorSube.id,
                tipoServicio: 'SUBE',
                montoCarga,
                comision,
                totalCobrado: totalCobrar,
                metodoPago: 'efectivo',
            })

            if (!result.success) {
                toast.error("Error al procesar recarga", { description: result.error })
                return
            }

            if (result.newBalance !== undefined) {
                setProveedorSube(prev => prev ? { ...prev, balance: result.newBalance! } : null)
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

    const markupLabel = proveedorSube?.markup_type === 'percentage'
        ? `+${proveedorSube.markup_value}%`
        : proveedorSube?.markup_type === 'fixed'
        ? `+$${proveedorSube.markup_value}`
        : null

    return (
        <Card className="p-4 bg-blue-600 text-white shadow-lg border-2 border-blue-500 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-white/20 rounded-full"><Bus className="h-6 w-6 text-white" /></div>
                    <div>
                        <h3 className="font-bold text-lg leading-none">Carga SUBE</h3>
                        <p className="text-[10px] text-blue-200">Transporte</p>
                    </div>
                </div>
                {markupLabel && (
                    <span className="text-[9px] font-bold bg-white/20 px-2 py-1 rounded-full">{markupLabel}</span>
                )}
            </div>

            {proveedorSube && (
                <div className="bg-blue-700/50 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-blue-200 font-bold uppercase">Saldo SUBE</p>
                    <p className="text-xl font-black">${proveedorSube.balance.toLocaleString()}</p>
                </div>
            )}

            <div>
                <Input
                    type="number"
                    className="bg-white text-black font-bold h-12 text-lg"
                    placeholder="Monto de la carga"
                    value={monto}
                    onChange={e => setMonto(e.target.value)}
                />
                {comision > 0 && monto && (
                    <p className="text-[10px] text-blue-200 mt-1 text-center">
                        Carga: ${(parseFloat(monto) || 0).toLocaleString()} + Comisión: ${comision.toLocaleString()}
                    </p>
                )}
            </div>

            <Button
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-blue-900 font-black h-12"
                onClick={handleCargar}
                disabled={loading || !monto}
            >
                {loading ? <Loader2 className="animate-spin" /> : `COBRAR $${totalCobrar.toLocaleString()}`}
            </Button>
        </Card>
    )
}
