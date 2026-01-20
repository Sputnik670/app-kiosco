"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Wallet, History } from "lucide-react"
import { toast } from "sonner"
import { getServiceProvidersAction, rechargeBalanceAction, type ServiceProvider } from "@/lib/actions/provider.actions"

export default function ControlSaldoProveedor() {
    const [proveedores, setProveedores] = useState<ServiceProvider[]>([])
    const [loading, setLoading] = useState(false)
    const [montoCarga, setMontoCarga] = useState("")
    const [selectedProv, setSelectedProv] = useState<string | null>(null)

    const fetchProveedores = async () => {
        const result = await getServiceProvidersAction()

        if (result.success) {
            setProveedores(result.providers)
            if (!selectedProv && result.providers.length > 0) {
                setSelectedProv(result.providers[0].id)
            }
        } else {
            toast.error("Error al cargar proveedores", { description: result.error })
        }
    }

    useEffect(() => { fetchProveedores() }, [])

    const handleCargarSaldo = async () => {
        if (!selectedProv || !montoCarga) return

        const monto = parseFloat(montoCarga)
        if (isNaN(monto) || monto <= 0) {
            toast.error("Ingresa un monto válido")
            return
        }

        setLoading(true)
        try {
            const result = await rechargeBalanceAction(selectedProv, monto)

            if (!result.success) {
                throw new Error(result.error || 'Error al cargar saldo')
            }

            toast.success("Saldo actualizado correctamente", {
                description: `Nuevo saldo: $${result.nuevoSaldo?.toLocaleString()}`
            })
            setMontoCarga("")
            fetchProveedores()
        } catch (error: any) {
            console.error(error)
            toast.error("Error al cargar saldo", { description: error.message })
        } finally {
            setLoading(false)
        }
    }

    const proveedorActivo = proveedores.find(p => p.id === selectedProv)

    return (
        <Card className="p-6 bg-slate-50 border-2 border-indigo-100">
            <h3 className="font-bold text-indigo-900 flex items-center gap-2 mb-4">
                <Wallet className="h-5 w-5" /> Billeteras Virtuales (Saldo para revender)
            </h3>

            <div className="flex gap-4 flex-col md:flex-row">
                <div className="w-full md:w-1/3 space-y-2">
                    {proveedores.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setSelectedProv(p.id)}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${
                                selectedProv === p.id 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-indigo-50'
                            }`}
                        >
                            <div className="font-bold text-sm">{p.nombre}</div>
                            <div className="text-xs opacity-80">Saldo: ${p.saldo_actual?.toLocaleString() || '0'}</div>
                        </button>
                    ))}
                    {proveedores.length === 0 && <p className="text-xs text-muted-foreground">Crea proveedores con rubro &quot;Servicios&quot;.</p>}
                </div>

                {proveedorActivo && (
                    <div className="flex-1 bg-white p-4 rounded-lg border shadow-sm">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-sm text-muted-foreground">Saldo Disponible</p>
                                <h2 className="text-3xl font-black text-indigo-600">
                                    ${proveedorActivo.saldo_actual?.toLocaleString() || '0'}
                                </h2>
                            </div>
                            <Button variant="ghost" size="icon"><History className="h-4 w-4" /></Button>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-700">Cargar Saldo (Compra)</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                    <Input 
                                        type="number" 
                                        className="pl-6" 
                                        placeholder="Monto..." 
                                        value={montoCarga}
                                        onChange={e => setMontoCarga(e.target.value)}
                                    />
                                </div>
                                <Button onClick={handleCargarSaldo} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                                    <Plus className="h-4 w-4 mr-2" /> Cargar
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    )
}