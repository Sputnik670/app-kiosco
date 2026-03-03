// components/gestion-proveedores.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Users, Plus, Phone, Mail, ChevronRight, DollarSign, Loader2,
  ShoppingBag, Receipt, Globe, MapPin
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import {
  getProvidersAction,
  createProviderAction,
  getProviderPurchaseHistoryAction,
  type Provider,
  type Purchase
} from "@/lib/actions/provider.actions"

interface GestionProveedoresProps {
    sucursalId: string | null // Sucursal que el dueño tiene seleccionada
    organizationId: string
}

export default function GestionProveedores({ sucursalId, organizationId }: GestionProveedoresProps) {
  const [proveedores, setProveedores] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedProveedor, setSelectedProveedor] = useState<Provider | null>(null)
  const [historialCompras, setHistorialCompras] = useState<Purchase[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Formulario nuevo proveedor
  const [formData, setFormData] = useState({
    nombre: "", rubro: "", contacto_nombre: "", 
    telefono: "", email: "", condicion_pago: "contado",
    esGlobal: true // Controla si sucursal_id será null o sucursalId
  })

  const fetchProveedores = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)

    const result = await getProvidersAction(organizationId, sucursalId)

    if (result.success) {
      setProveedores(result.providers)
    } else {
      toast.error("Error al cargar proveedores", { description: result.error })
    }

    setLoading(false)
  }, [organizationId, sucursalId])

  useEffect(() => { fetchProveedores() }, [fetchProveedores])

  const handleSelectProveedor = async (prov: Provider) => {
      setSelectedProveedor(prov)
      setLoadingHistory(true)

      const result = await getProviderPurchaseHistoryAction(prov.id)

      if (result.success) {
        setHistorialCompras(result.purchases)
      } else {
        toast.error("Error al cargar historial", { description: result.error })
      }

      setLoadingHistory(false)
  }

  async function handleAddProveedor() {
    if (!formData.nombre) return toast.error("El nombre es obligatorio")

    setLoading(true)

    const result = await createProviderAction(formData, sucursalId)

    if (result.success) {
      toast.success(formData.esGlobal ? "Proveedor Global añadido" : "Proveedor Local añadido")
      setShowAddModal(false)
      setFormData({ nombre: "", rubro: "", contacto_nombre: "", telefono: "", email: "", condicion_pago: "contado", esGlobal: true })
      fetchProveedores()
    } else {
      toast.error("Error al guardar", { description: result.error })
    }

    setLoading(false)
  }

  const formatMoney = (amount: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount)

  return (
    <div className="space-y-4">
      
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Directorio de Proveedores
            </h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                {sucursalId ? "Mostrando: Globales + Sucursal Actual" : "Mostrando: Solo Globales"}
            </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} size="sm" className="rounded-full">
            <Plus className="h-4 w-4 mr-1" /> Nuevo
        </Button>
      </div>

      {/* LISTA */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {proveedores.map(p => (
                <Card 
                    key={p.id} 
                    onClick={() => handleSelectProveedor(p)}
                    className="p-4 hover:border-primary/50 transition-all cursor-pointer shadow-sm group relative overflow-hidden"
                >
                    {/* Badge de Alcance */}
                    <div className={cn(
                        "absolute top-0 right-0 px-2 py-0.5 text-[8px] font-bold uppercase rounded-bl-lg",
                        "bg-blue-100 text-blue-700"
                    )}>
                        Global (Cadena)
                    </div>

                    <div className="flex gap-3">
                        <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold group-hover:bg-primary group-hover:text-white transition-colors">
                            {p.name.charAt(0)}
                        </div>
                        <div>
                            <h4 className="font-bold text-sm leading-tight group-hover:text-primary">{p.name}</h4>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase mt-0.5">{''}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-dashed">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Phone className="h-3 w-3" /> {p.phone || '---'}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-600">
                            <DollarSign className="h-3 w-3" /> {''}
                        </div>
                    </div>
                </Card>
            ))}
        </div>
      )}

      {/* MODAL DETALLE */}
      <Dialog open={!!selectedProveedor} onOpenChange={(open) => !open && setSelectedProveedor(null)}>
        <DialogContent className="max-w-lg">
            <DialogHeader className="border-b pb-4">
                <DialogTitle className="flex items-center gap-2 text-xl">
                    {selectedProveedor?.name}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full"><Globe className="h-3 w-3"/> DISPONIBLE EN TODA LA CADENA</span>
                </div>
            </DialogHeader>

            <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg border">
                        <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Compras Realizadas</p>
                        <p className="text-xl font-black">{historialCompras.length}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border">
                        <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Condición</p>
                        <p className="text-sm font-bold uppercase">{''}</p>
                    </div>
                </div>

                <div className="max-h-[300px] overflow-y-auto pr-2">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3">Últimos Pedidos</h4>
                    {loadingHistory ? <Loader2 className="animate-spin h-5 w-5 mx-auto"/> : historialCompras.map(compra => (
                        <div key={compra.id} className="flex justify-between items-center p-2 mb-2 bg-white border rounded shadow-sm text-xs">
                            <span className="font-medium">{compra.date ? format(parseISO(compra.date), 'dd/MM/yy') : 'N/A'}</span>
                            <span className="font-bold">{formatMoney(compra.total)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </DialogContent>
      </Dialog>

      {/* MODAL AGREGAR */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Registrar Proveedor</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
                
                {/* 🎯 LOGÍSTICA DE ALCANCE */}
                <div className="bg-slate-50 p-3 rounded-lg border-2 border-primary/10">
                    <Label className="text-xs font-black uppercase mb-3 block">Alcance del Proveedor</Label>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            type="button"
                            onClick={() => setFormData({...formData, esGlobal: true})}
                            className={cn("flex flex-col items-center p-3 rounded-md border-2 transition-all", 
                                formData.esGlobal ? "bg-white border-primary shadow-sm" : "bg-transparent border-transparent grayscale opacity-60")}
                        >
                            <Globe className="h-5 w-5 mb-1 text-blue-600" />
                            <span className="text-[10px] font-bold">Toda la Cadena</span>
                        </button>
                        <button 
                            type="button"
                            disabled={!sucursalId}
                            onClick={() => setFormData({...formData, esGlobal: false})}
                            className={cn("flex flex-col items-center p-3 rounded-md border-2 transition-all", 
                                !formData.esGlobal ? "bg-white border-amber-500 shadow-sm" : "bg-transparent border-transparent grayscale opacity-60")}
                        >
                            <MapPin className="h-5 w-5 mb-1 text-amber-600" />
                            <span className="text-[10px] font-bold">Solo este Local</span>
                        </button>
                    </div>
                </div>

                <div>
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Nombre / Razón Social</Label>
                    <Input placeholder="Ej: Arcor" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Rubro</Label>
                        <Input placeholder="Golosinas" value={formData.rubro} onChange={e => setFormData({...formData, rubro: e.target.value})} />
                    </div>
                    <div>
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Condición Pago</Label>
                        <select 
                            title="Condición de Pago"
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={formData.condicion_pago} 
                            onChange={e => setFormData({...formData, condicion_pago: e.target.value})}
                        >
                            <option value="contado">Contado</option>
                            <option value="7 dias">Cta. Cte. (7d)</option>
                            <option value="15 dias">Cta. Cte. (15d)</option>
                            <option value="30 dias">Cta. Cte. (30d)</option>
                        </select>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Teléfono</Label>
                        <Input placeholder="11..." value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                    </div>
                    <div>
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Email</Label>
                        <Input placeholder="prov@mail.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleAddProveedor} disabled={loading} className="w-full font-bold">
                    {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <Plus className="h-4 w-4 mr-2"/>}
                    Confirmar Alta
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}