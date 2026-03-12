// components/gestion-proveedores.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Users, Plus, Phone, Mail, ChevronRight, DollarSign, Loader2,
  ShoppingBag, Receipt, Globe, MapPin, Trash2, AlertTriangle
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
  updateProviderMarkupAction,
  deleteProviderAction,
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
    esGlobal: true, // Controla si sucursal_id será null o sucursalId
    markup_type: "" as "" | "percentage" | "fixed",
    markup_value: "",
  })

  // Eliminación de proveedor
  const [confirmDelete, setConfirmDelete] = useState<Provider | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Edición de markup en proveedor existente
  const [editingMarkup, setEditingMarkup] = useState<string | null>(null)
  const [markupForm, setMarkupForm] = useState({ type: "" as "" | "percentage" | "fixed", value: "" })
  const [savingMarkup, setSavingMarkup] = useState(false)

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

    const dataToSend = {
      ...formData,
      markup_type: formData.markup_type || null,
      markup_value: formData.markup_value ? parseFloat(formData.markup_value) : null,
    }

    const result = await createProviderAction(dataToSend as any, sucursalId)

    if (result.success) {
      toast.success(formData.esGlobal ? "Proveedor Global añadido" : "Proveedor Local añadido")
      setShowAddModal(false)
      setFormData({ nombre: "", rubro: "", contacto_nombre: "", telefono: "", email: "", condicion_pago: "contado", esGlobal: true, markup_type: "", markup_value: "" })
      fetchProveedores()
    } else {
      toast.error("Error al guardar", { description: result.error })
    }

    setLoading(false)
  }

  async function handleSaveMarkup(providerId: string) {
    setSavingMarkup(true)
    const result = await updateProviderMarkupAction({
      providerId,
      markupType: markupForm.type || null,
      markupValue: markupForm.value ? parseFloat(markupForm.value) : null,
    })
    if (result.success) {
      toast.success("Comisión actualizada")
      setEditingMarkup(null)
      fetchProveedores()
    } else {
      toast.error("Error", { description: result.error })
    }
    setSavingMarkup(false)
  }

  async function handleDeleteProveedor() {
    if (!confirmDelete) return
    setDeleting(true)

    const result = await deleteProviderAction(confirmDelete.id)

    if (result.success) {
      toast.success(`${confirmDelete.name} eliminado correctamente`)
      setConfirmDelete(null)
      setSelectedProveedor(null)
      fetchProveedores()
    } else {
      toast.error("Error al eliminar", { description: result.error })
    }

    setDeleting(false)
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
                            <DollarSign className="h-3 w-3" />
                            {p.markup_type === 'percentage' ? `+${p.markup_value}%` : p.markup_type === 'fixed' ? `+$${p.markup_value}` : 'Sin comisión'}
                        </div>
                    </div>

                    {/* Edición rápida de markup */}
                    <div className="mt-3 pt-3 border-t border-dashed">
                      {editingMarkup === p.id ? (
                        <div className="flex gap-2 items-end" onClick={e => e.stopPropagation()}>
                          <select
                            title="Tipo de comisión"
                            className="h-8 rounded-md border bg-background px-2 text-[11px] font-bold"
                            value={markupForm.type}
                            onChange={e => setMarkupForm({ ...markupForm, type: e.target.value as any })}
                          >
                            <option value="">Sin comisión</option>
                            <option value="percentage">% Porcentaje</option>
                            <option value="fixed">$ Fijo</option>
                          </select>
                          {markupForm.type && (
                            <Input
                              type="number"
                              placeholder={markupForm.type === 'percentage' ? 'Ej: 10' : 'Ej: 50'}
                              className="h-8 w-20 text-[11px] font-bold"
                              value={markupForm.value}
                              onClick={e => e.stopPropagation()}
                              onChange={e => setMarkupForm({ ...markupForm, value: e.target.value })}
                            />
                          )}
                          <Button
                            size="sm"
                            className="h-8 text-[10px] font-black"
                            disabled={savingMarkup}
                            onClick={e => { e.stopPropagation(); handleSaveMarkup(p.id) }}
                          >
                            {savingMarkup ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-[10px]"
                            onClick={e => { e.stopPropagation(); setEditingMarkup(null) }}
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <button
                            className="text-[10px] font-bold text-primary uppercase hover:underline"
                            onClick={e => {
                              e.stopPropagation()
                              setEditingMarkup(p.id)
                              setMarkupForm({
                                type: p.markup_type || "",
                                value: p.markup_value?.toString() || "",
                              })
                            }}
                          >
                            <Receipt className="h-3 w-3 inline mr-1" />
                            {p.markup_type ? 'Editar comisión' : 'Configurar comisión'}
                          </button>
                          <button
                            className="text-[10px] font-bold text-red-400 uppercase hover:text-red-600 transition-colors"
                            onClick={e => {
                              e.stopPropagation()
                              setConfirmDelete(p)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
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

                <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 text-[10px] font-bold uppercase"
                      onClick={() => {
                        if (selectedProveedor) setConfirmDelete(selectedProveedor)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar proveedor
                    </Button>
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

      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" /> Eliminar Proveedor
                </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                    ¿Estás seguro de que querés eliminar a <span className="font-bold text-foreground">{confirmDelete?.name}</span>?
                </p>
                {confirmDelete?.balance && Number(confirmDelete.balance) > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-amber-700 font-medium">
                            Este proveedor tiene saldo disponible de {formatMoney(Number(confirmDelete.balance))}. Al eliminarlo, ese saldo se perderá.
                        </p>
                    </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                    El historial de compras y ventas asociadas se mantendrá para tus reportes.
                </p>
            </div>
            <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                    Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDeleteProveedor} disabled={deleting} className="font-bold">
                    {deleting ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <Trash2 className="h-4 w-4 mr-2"/>}
                    Sí, eliminar
                </Button>
            </DialogFooter>
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

                {/* Comisión / Markup */}
                <div className="bg-indigo-50 p-3 rounded-lg border-2 border-indigo-100">
                    <Label className="text-xs font-black uppercase text-indigo-600 mb-3 block">Comisión por Reventa</Label>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-[10px] font-bold uppercase text-indigo-400">Tipo</Label>
                            <select
                                title="Tipo de comisión"
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-bold"
                                value={formData.markup_type}
                                onChange={e => setFormData({...formData, markup_type: e.target.value as any})}
                            >
                                <option value="">Sin comisión</option>
                                <option value="percentage">% Porcentaje</option>
                                <option value="fixed">$ Monto Fijo</option>
                            </select>
                        </div>
                        {formData.markup_type && (
                            <div>
                                <Label className="text-[10px] font-bold uppercase text-indigo-400">
                                    {formData.markup_type === 'percentage' ? 'Porcentaje (%)' : 'Monto ($)'}
                                </Label>
                                <Input
                                    type="number"
                                    placeholder={formData.markup_type === 'percentage' ? 'Ej: 10' : 'Ej: 50'}
                                    className="h-10 font-bold"
                                    value={formData.markup_value}
                                    onChange={e => setFormData({...formData, markup_value: e.target.value})}
                                />
                            </div>
                        )}
                    </div>
                    <p className="text-[9px] text-indigo-400 mt-2">Se aplica automáticamente al precio que cobra el empleado</p>
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