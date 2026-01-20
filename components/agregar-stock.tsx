"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { CalendarIcon, PlusIcon, MinusIcon, PackagePlus, DollarSign, Loader2, AlertCircle } from "lucide-react"
import { format, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { processComplexStockEntry } from "@/lib/actions/inventory.actions" 

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface Producto {
  id: string
  nombre: string
}

interface AgregarStockProps {
  producto: Producto
  onStockAdded?: () => void 
  sucursalId: string 
}

export function AgregarStock({ producto, onStockAdded, sucursalId }: AgregarStockProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [cantidad, setCantidad] = useState(1)
  const [fechaVencimientoProd, setFechaVencimientoProd] = useState<Date | undefined>(undefined)
  
  const [proveedores, setProveedores] = useState<{id: string, nombre: string}[]>([])
  const [selectedProveedor, setSelectedProveedor] = useState<string>("")
  const [costoUnitario, setCostoUnitario] = useState<string>("")
  
  const [estadoPago, setEstadoPago] = useState<string>("pendiente") 
  const [fechaVencimientoPago, setFechaVencimientoPago] = useState<Date | undefined>(addDays(new Date(), 15))
  const [medioPago, setMedioPago] = useState<string>("efectivo") 

  useEffect(() => {
    if (open) {
        const fetchProveedores = async () => {
            const { data } = await supabase.from('proveedores').select('id, nombre').order('nombre')
            setProveedores(data || [])
        }
        fetchProveedores()
    }
  }, [open])

  const incrementar = () => setCantidad((prev) => prev + 1)
  const decrementar = () => setCantidad((prev) => (prev > 1 ? prev - 1 : 1))

  const handleGuardar = async () => {
    if (!sucursalId) return toast.error("Error: No se seleccionó sucursal")
    if (!fechaVencimientoProd) return toast.error("Falta fecha de vencimiento del producto")

    setLoading(true)

    try {
      // Llamada al Server Action refactorizado
      const result = await processComplexStockEntry({
        productoId: producto.id,
        sucursalId: sucursalId,
        cantidad: cantidad,
        fechaVencimiento: format(fechaVencimientoProd, 'yyyy-MM-dd'),
        costoUnitario: parseFloat(costoUnitario) || undefined,
        proveedorId: selectedProveedor || undefined,
        estadoPago: estadoPago as 'pendiente' | 'pagado',
        medioPago: medioPago as 'efectivo' | 'transferencia' | 'debito',
        fechaVencimientoPago: fechaVencimientoPago?.toISOString(),
      })

      if (!result.success) {
        throw new Error(result.error || 'Error al procesar la entrada de stock')
      }

      toast.success("Lote ingresado correctamente")
      setOpen(false)
      if (onStockAdded) onStockAdded()
    } catch (error: any) {
      toast.error("Error al guardar", { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full gap-2 bg-slate-900 text-white hover:bg-slate-800">
          <PackagePlus className="h-4 w-4" /> Ingresar Lote
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md bg-white max-h-[95vh] overflow-y-auto rounded-3xl border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-black text-xl uppercase tracking-tighter">Ingreso de Mercadería</DialogTitle>
          <p className="text-sm font-bold text-slate-400 uppercase">{producto.nombre}</p>
        </DialogHeader>
        
        <div className="flex flex-col gap-6 py-4">
          <div className="space-y-3">
            <Label className="text-center block text-[10px] uppercase font-black text-slate-500 tracking-widest">Cantidad a Ingresar</Label>
            <div className="flex items-center justify-center gap-6">
              <Button variant="outline" size="icon" onClick={decrementar} className="h-14 w-14 rounded-2xl border-2 hover:bg-slate-50 shadow-sm"><MinusIcon className="h-6 w-6" /></Button>
              <Input type="number" value={cantidad} onChange={(e) => setCantidad(parseInt(e.target.value) || 0)} className="h-20 w-32 text-center text-4xl font-black rounded-3xl border-2" />
              <Button variant="outline" size="icon" onClick={incrementar} className="h-14 w-14 rounded-2xl border-2 hover:bg-slate-50 shadow-sm"><PlusIcon className="h-6 w-6" /></Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Vencimiento del Alimento/Prod.</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("h-12 w-full justify-start text-left font-bold rounded-2xl border-2 shadow-sm", !fechaVencimientoProd && "text-slate-400")}>
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {fechaVencimientoProd ? format(fechaVencimientoProd, "dd 'de' MMMM, yyyy", { locale: es }) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl" align="start">
                <Calendar mode="single" selected={fechaVencimientoProd} onSelect={setFechaVencimientoProd} locale={es}/>
              </PopoverContent>
            </Popover>
          </div>

          <div className="p-5 bg-slate-50 rounded-[2rem] border-2 border-slate-100 space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white rounded-lg shadow-sm"><DollarSign className="h-4 w-4 text-emerald-600" /></div>
                <Label className="font-black text-xs uppercase tracking-tighter">Costos y Proveedor</Label>
            </div>
            
            <div className="grid gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="proveedor-select" className="text-[10px] font-black text-slate-400 uppercase">Seleccionar Proveedor</Label>
                    {/* ✅ ACCESIBILIDAD: id + title + aria-label */}
                    <select 
                        id="proveedor-select"
                        title="Proveedor"
                        aria-label="Seleccionar Proveedor"
                        className="w-full h-12 rounded-2xl border-2 bg-white px-4 text-sm font-bold focus:ring-2 focus:ring-slate-900 appearance-none"
                        value={selectedProveedor}
                        onChange={(e) => setSelectedProveedor(e.target.value)}
                    >
                        <option value="">-- No registrar compra (Solo stock) --</option>
                        {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-slate-400 uppercase">Costo Unitario</Label>
                        <div className="relative">
                            <Input type="number" placeholder="0" className="pl-10 h-12 rounded-2xl border-2 font-black text-lg" value={costoUnitario} onChange={(e) => setCostoUnitario(e.target.value)}/>
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                        </div>
                    </div>
                    
                    {selectedProveedor && (
                        <div className="space-y-1.5 animate-in fade-in">
                            <Label htmlFor="estado-pago-select" className="text-[10px] font-black text-slate-400 uppercase">Estado Pago</Label>
                            {/* ✅ ACCESIBILIDAD: id + title + aria-label */}
                            <select 
                                id="estado-pago-select"
                                title="Estado de Pago"
                                aria-label="Seleccionar Estado de Pago"
                                className="w-full h-12 rounded-2xl border-2 bg-white px-4 text-sm font-bold"
                                value={estadoPago}
                                onChange={(e) => setEstadoPago(e.target.value)}
                            >
                                <option value="pendiente">Cuenta Corriente (Deuda)</option>
                                <option value="pagado">Pagado en el momento</option>
                            </select>
                        </div>
                    )}
                </div>

                {selectedProveedor && estadoPago === 'pendiente' && (
                    <div className="space-y-1.5 animate-in slide-in-from-top-2">
                        <Label className="text-[10px] font-black text-orange-600 uppercase flex items-center gap-1">
                            <AlertCircle className="h-3 w-3"/> Pagar antes de:
                        </Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className="h-10 w-full justify-start text-[11px] font-bold rounded-xl border-orange-100 bg-orange-50 text-orange-700">
                                    <CalendarIcon className="mr-2 h-3 w-3" />
                                    {fechaVencimientoPago ? format(fechaVencimientoPago, "dd/MM/yyyy") : "Elegir fecha"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-2xl" align="start">
                                <Calendar mode="single" selected={fechaVencimientoPago} onSelect={setFechaVencimientoPago} locale={es}/>
                            </PopoverContent>
                        </Popover>
                    </div>
                )}

                {selectedProveedor && estadoPago === 'pagado' && (
                    <div className="space-y-1.5 animate-in slide-in-from-top-2">
                        <Label htmlFor="medio-pago-select" className="text-[10px] font-black text-slate-400 uppercase">Medio de Pago Utilizado</Label>
                        {/* ✅ ACCESIBILIDAD: id + title + aria-label */}
                        <select 
                            id="medio-pago-select"
                            title="Medio de Pago"
                            aria-label="Seleccionar Medio de Pago"
                            className="w-full h-12 rounded-2xl border-2 bg-white px-4 text-sm font-bold"
                            value={medioPago}
                            onChange={(e) => setMedioPago(e.target.value)}
                        >
                            <option value="efectivo">Efectivo (Baja de Caja Real)</option>
                            <option value="transferencia">Transferencia / QR</option>
                            <option value="debito">Tarjeta Débito</option>
                        </select>
                    </div>
                )}
            </div>
          </div>

          <Button onClick={handleGuardar} disabled={loading} size="lg" className="w-full h-16 font-black text-lg rounded-[1.5rem] shadow-xl mt-2 transition-all active:scale-95">
            {loading ? <Loader2 className="animate-spin h-6 w-6"/> : "REGISTRAR ENTRADA"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}