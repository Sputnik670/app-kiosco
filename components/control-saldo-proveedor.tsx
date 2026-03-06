"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Wallet, History, Receipt, Loader2, Settings2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import {
    getServiceProvidersAction,
    recordServicePurchaseAction,
    getServicePurchaseHistoryAction,
    updateProviderMarkupAction,
    type ServiceProvider,
    type ServicePurchaseRecord,
} from "@/lib/actions/provider.actions"

export default function ControlSaldoProveedor() {
    const [proveedores, setProveedores] = useState<ServiceProvider[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedProv, setSelectedProv] = useState<string | null>(null)

    // Formulario de compra de crédito
    const [montoCarga, setMontoCarga] = useState("")
    const [metodoPago, setMetodoPago] = useState("efectivo")
    const [nroFactura, setNroFactura] = useState("")
    const [notas, setNotas] = useState("")

    // Historial
    const [showHistory, setShowHistory] = useState(false)
    const [historial, setHistorial] = useState<ServicePurchaseRecord[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    // Config markup
    const [showMarkup, setShowMarkup] = useState(false)
    const [markupType, setMarkupType] = useState<'percentage' | 'fixed' | null>(null)
    const [markupValue, setMarkupValue] = useState("")

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

    const proveedorActivo = proveedores.find(p => p.id === selectedProv)

    // Cargar saldo con detalle
    const handleCargarSaldo = async () => {
        if (!selectedProv || !montoCarga) return

        const monto = parseFloat(montoCarga)
        if (isNaN(monto) || monto <= 0) {
            toast.error("Ingresa un monto válido")
            return
        }

        setLoading(true)
        try {
            const result = await recordServicePurchaseAction({
                providerId: selectedProv,
                amount: monto,
                paymentMethod: metodoPago,
                invoiceNumber: nroFactura || undefined,
                notes: notas || undefined,
            })

            if (!result.success) {
                throw new Error(result.error || 'Error al cargar saldo')
            }

            toast.success("Compra registrada", {
                description: `Nuevo saldo: $${result.nuevoSaldo?.toLocaleString()}`
            })
            setMontoCarga("")
            setNroFactura("")
            setNotas("")
            fetchProveedores()
        } catch (error: any) {
            toast.error("Error al cargar saldo", { description: error.message })
        } finally {
            setLoading(false)
        }
    }

    // Historial de compras
    const handleShowHistory = async () => {
        if (!selectedProv) return
        setShowHistory(true)
        setLoadingHistory(true)
        const result = await getServicePurchaseHistoryAction(selectedProv)
        if (result.success) {
            setHistorial(result.purchases)
        }
        setLoadingHistory(false)
    }

    // Config markup
    const handleOpenMarkup = () => {
        if (!proveedorActivo) return
        setMarkupType(proveedorActivo.markup_type)
        setMarkupValue(proveedorActivo.markup_value?.toString() || "")
        setShowMarkup(true)
    }

    const handleSaveMarkup = async () => {
        if (!selectedProv) return
        setLoading(true)
        const result = await updateProviderMarkupAction({
            providerId: selectedProv,
            markupType: markupType,
            markupValue: markupValue ? parseFloat(markupValue) : null,
        })
        if (result.success) {
            toast.success("Comisión actualizada")
            fetchProveedores()
            setShowMarkup(false)
        } else {
            toast.error("Error", { description: result.error })
        }
        setLoading(false)
    }

    const formatMoney = (n: number) => `$${n.toLocaleString('es-AR')}`

    return (
        <>
            <Card className="p-6 bg-slate-50 border-2 border-indigo-100">
                <h3 className="font-bold text-indigo-900 flex items-center gap-2 mb-4">
                    <Wallet className="h-5 w-5" /> Billeteras Virtuales (Saldo para revender)
                </h3>

                <div className="flex gap-4 flex-col md:flex-row">
                    {/* Lista de proveedores */}
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
                                <div className="font-bold text-sm">{p.name}</div>
                                <div className="text-xs opacity-80">
                                    Saldo: {formatMoney(p.balance || 0)}
                                </div>
                                {p.markup_type && (
                                    <div className="text-[9px] mt-1 opacity-70">
                                        Comisión: {p.markup_type === 'percentage' ? `${p.markup_value}%` : formatMoney(p.markup_value || 0)}
                                    </div>
                                )}
                            </button>
                        ))}
                        {proveedores.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                                Creá proveedores desde la tab Proveedores.
                            </p>
                        )}
                    </div>

                    {/* Panel del proveedor activo */}
                    {proveedorActivo && (
                        <div className="flex-1 bg-white p-4 rounded-lg border shadow-sm space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm text-muted-foreground">Saldo Disponible</p>
                                    <h2 className="text-3xl font-black text-indigo-600">
                                        {formatMoney(proveedorActivo.balance || 0)}
                                    </h2>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={handleOpenMarkup} title="Configurar comisión">
                                        <Settings2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={handleShowHistory} title="Historial de compras">
                                        <History className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Comisión actual */}
                            {proveedorActivo.markup_type && (
                                <div className="bg-indigo-50 rounded-lg p-2 text-center">
                                    <p className="text-[9px] text-indigo-500 font-bold uppercase">Comisión configurada</p>
                                    <p className="text-sm font-black text-indigo-700">
                                        {proveedorActivo.markup_type === 'percentage'
                                            ? `${proveedorActivo.markup_value}% por operación`
                                            : `${formatMoney(proveedorActivo.markup_value || 0)} fijo por operación`
                                        }
                                    </p>
                                </div>
                            )}

                            {/* Formulario de compra */}
                            <div className="space-y-3 border-t pt-3">
                                <label className="text-xs font-bold text-gray-700 uppercase">
                                    Registrar Compra de Crédito
                                </label>
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
                                    <select
                                        title="Método de pago"
                                        value={metodoPago}
                                        onChange={e => setMetodoPago(e.target.value)}
                                        className="h-10 rounded-md border border-input bg-background px-2 text-xs"
                                    >
                                        <option value="efectivo">Efectivo</option>
                                        <option value="transferencia">Transferencia</option>
                                        <option value="tarjeta">Tarjeta</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input
                                        placeholder="Nro. Factura (opcional)"
                                        value={nroFactura}
                                        onChange={e => setNroFactura(e.target.value)}
                                        className="text-xs"
                                    />
                                    <Input
                                        placeholder="Notas (opcional)"
                                        value={notas}
                                        onChange={e => setNotas(e.target.value)}
                                        className="text-xs"
                                    />
                                </div>
                                <Button
                                    onClick={handleCargarSaldo}
                                    disabled={loading || !montoCarga}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                                >
                                    {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                    Registrar Compra
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Modal: Historial de compras de crédito */}
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-indigo-500" /> Compras de Crédito
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 mt-4">
                        {loadingHistory ? (
                            <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6" /></div>
                        ) : historial.length === 0 ? (
                            <p className="text-center text-muted-foreground text-sm py-8">Sin compras registradas</p>
                        ) : historial.map(h => (
                            <div key={h.id} className="p-3 bg-slate-50 rounded-xl border space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="font-black text-sm">{formatMoney(h.amount)}</span>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {format(parseISO(h.created_at), "dd/MM/yy HH:mm")}
                                    </span>
                                </div>
                                <div className="flex gap-3 text-[10px] text-slate-500">
                                    <span className="uppercase font-bold">{h.payment_method || 'efectivo'}</span>
                                    {h.invoice_number && <span>Fact: {h.invoice_number}</span>}
                                    {h.notes && <span className="italic">{h.notes}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal: Configurar comisión */}
            <Dialog open={showMarkup} onOpenChange={setShowMarkup}>
                <DialogContent className="max-w-sm rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase flex items-center gap-2">
                            <Settings2 className="h-5 w-5 text-indigo-500" /> Comisión — {proveedorActivo?.name}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div>
                            <Label className="text-xs font-bold uppercase">Tipo de recargo</Label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setMarkupType('percentage')}
                                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                                        markupType === 'percentage' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
                                    }`}
                                >
                                    <span className="text-lg font-black">%</span>
                                    <p className="text-[10px] font-bold text-muted-foreground">Porcentaje</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMarkupType('fixed')}
                                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                                        markupType === 'fixed' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
                                    }`}
                                >
                                    <span className="text-lg font-black">$</span>
                                    <p className="text-[10px] font-bold text-muted-foreground">Monto fijo</p>
                                </button>
                            </div>
                        </div>
                        {markupType && (
                            <div>
                                <Label className="text-xs font-bold uppercase">
                                    {markupType === 'percentage' ? 'Porcentaje de recargo' : 'Monto fijo por operación'}
                                </Label>
                                <Input
                                    type="number"
                                    placeholder={markupType === 'percentage' ? 'Ej: 10' : 'Ej: 150'}
                                    value={markupValue}
                                    onChange={e => setMarkupValue(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSaveMarkup} disabled={loading} className="w-full">
                            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Guardar Comisión"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
