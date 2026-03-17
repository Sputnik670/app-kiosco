"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Smartphone, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getServiceProvidersListAction, processVirtualRechargeAction, type ServiceProvider } from "@/lib/actions/service.actions"

const METODOS_PAGO = [
    { id: 'efectivo' as const, label: '💵 Efectivo' },
    { id: 'tarjeta' as const, label: '💳 Tarjeta' },
    { id: 'billetera_virtual' as const, label: '📱 Billetera' },
]

export default function WidgetServicios({ turnoId, sucursalId, onVentaRegistrada }: { turnoId: string, sucursalId: string, onVentaRegistrada: () => void }) {
    const [monto, setMonto] = useState("")
    const [loading, setLoading] = useState(false)
    const [loadingProveedores, setLoadingProveedores] = useState(true)
    const [metodoPago, setMetodoPago] = useState<'efectivo' | 'tarjeta' | 'billetera_virtual'>('efectivo')
    const [proveedores, setProveedores] = useState<ServiceProvider[]>([])
    const [selectedId, setSelectedId] = useState<string>("")

    // Proveedor seleccionado actualmente
    const proveedorActual = useMemo(
        () => proveedores.find(p => p.id === selectedId) || null,
        [proveedores, selectedId]
    )

    // Cargar todos los proveedores de servicios (no SUBE) al montar
    useEffect(() => {
        let cancelled = false
        const fetchProveedores = async (retries = 2) => {
            try {
                const result = await getServiceProvidersListAction()
                if (cancelled) return
                if (result.success && result.providers.length > 0) {
                    setProveedores(result.providers)
                    setSelectedId(result.providers[0].id)
                } else {
                    console.warn('[Servicios] Sin proveedores:', result.error)
                    setProveedores([])
                }
            } catch (err: any) {
                if (cancelled) return
                if (retries > 0) {
                    console.warn(`[Servicios] Reintentando... (${retries} intentos restantes)`)
                    await new Promise(r => setTimeout(r, 1500))
                    return fetchProveedores(retries - 1)
                }
                console.error('[Servicios] Error tras reintentos:', err)
                toast.error("Error cargando proveedores", {
                    description: "Error de conexión. Recargá la página.",
                    duration: 5000,
                })
            } finally {
                if (!cancelled) setLoadingProveedores(false)
            }
        }
        fetchProveedores()
        return () => { cancelled = true }
    }, [])

    // Comisión dinámica según config del proveedor seleccionado
    // DECIMAL de Supabase puede llegar como string — siempre castear con Number()
    const comision = useMemo(() => {
        if (!proveedorActual || !monto) return 0
        const montoNum = parseFloat(monto) || 0
        const markupVal = Number(proveedorActual.markup_value) || 0
        if (proveedorActual.markup_type === 'percentage' && markupVal > 0) {
            return Math.round(montoNum * markupVal / 100)
        }
        if (proveedorActual.markup_type === 'fixed' && markupVal > 0) {
            return markupVal
        }
        return 0
    }, [monto, proveedorActual])

    const totalCobrar = (parseFloat(monto) || 0) + comision

    const handleCargar = async () => {
        if (!monto || !proveedorActual) return
        setLoading(true)

        try {
            const montoCarga = parseFloat(monto)

            const result = await processVirtualRechargeAction({
                turnoId,
                sucursalId,
                proveedorId: proveedorActual.id,
                tipoServicio: proveedorActual.name,
                montoCarga,
                comision,
                totalCobrado: totalCobrar,
                metodoPago,
            })

            if (!result.success) {
                toast.error("Error al procesar recarga", { description: result.error })
                return
            }

            // Actualizar saldo local del proveedor
            if (result.newBalance !== undefined) {
                setProveedores(prev =>
                    prev.map(p => p.id === proveedorActual.id
                        ? { ...p, balance: result.newBalance! }
                        : p
                    )
                )
            }

            setMonto("")
            toast.success("Recarga exitosa", { description: result.message })
            onVentaRegistrada()
        } catch (error: any) {
            console.error('[Servicios] Excepción al procesar recarga:', error)
            toast.error("Error al procesar recarga", {
                description: error?.message || "Error de conexión, intentá de nuevo",
                duration: 5000,
            })
        } finally {
            setLoading(false)
        }
    }

    const markupLabel = proveedorActual?.markup_type === 'percentage'
        ? `+${Number(proveedorActual.markup_value)}%`
        : proveedorActual?.markup_type === 'fixed'
        ? `+$${Number(proveedorActual.markup_value)}`
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

            {loadingProveedores ? (
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-200" />
                    <span className="ml-2 text-sm text-indigo-200">Cargando proveedores...</span>
                </div>
            ) : proveedores.length === 0 ? (
                <div className="bg-indigo-700/50 rounded-lg p-3 text-center">
                    <p className="text-sm text-indigo-200">No hay proveedores de servicios.</p>
                    <p className="text-[10px] text-indigo-300 mt-1">Crealos en la sección de Proveedores.</p>
                </div>
            ) : (
                <>
                    {proveedorActual && (
                        <div className="bg-indigo-700/50 rounded-lg p-2 text-center">
                            <p className="text-[9px] text-indigo-200 font-bold uppercase">Saldo {proveedorActual.name}</p>
                            <p className="text-xl font-black">${Number(proveedorActual.balance).toLocaleString('es-AR')}</p>
                        </div>
                    )}

                    <select
                        title="Seleccionar proveedor de servicios"
                        value={selectedId}
                        onChange={(e) => setSelectedId(e.target.value)}
                        className="w-full h-10 rounded-md bg-indigo-700 text-white font-medium px-3 text-sm focus:outline-none"
                    >
                        {proveedores.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
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
                        disabled={loading || !monto || !proveedorActual}
                    >
                        {loading ? <Loader2 className="animate-spin" /> : `COBRAR $${totalCobrar.toLocaleString()}`}
                    </Button>
                </>
            )}
        </Card>
    )
}
