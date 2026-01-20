"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, ShoppingCart, Plus, Minus, Loader2, ScanBarcode, ReceiptText, X, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { generarTicketVenta } from "@/lib/generar-ticket"
import { searchProductsAction, confirmVentaAction } from "@/lib/actions/ventas.actions"
// 1. Importamos la librería robusta
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"

interface Producto {
  id: string
  nombre: string
  precio: number
  stock: number
  codigo_barras?: string
}

interface ItemVenta extends Producto {
  cantidad: number
}

interface CajaVentasProps {
  turnoId: string
  empleadoNombre: string
  sucursalId: string 
  onVentaCompletada?: () => void 
}

// --- COMPONENTE SCANNER (Sin cambios, lógica original) ---
function BarcodeScannerVentas({ onResult, onClose }: { onResult: (code: string) => void, onClose: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  
  const scannerId = "reader-ventas"

  useEffect(() => {
    const initTimer = setTimeout(async () => {
      try {
        if (!document.getElementById(scannerId)) {
          throw new Error("El contenedor de video no está listo.")
        }

        const html5QrCode = new Html5Qrcode(scannerId)
        scannerRef.current = html5QrCode

        const config = {
          fps: 20,
          qrbox: { width: 280, height: 200 }, 
          aspectRatio: 1.0,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E
          ]
        }

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if (navigator.vibrate) navigator.vibrate(100)
            onResult(decodedText)
          },
          () => { 
            // Error silencioso de frame
          }
        )
        setLoading(false)
      } catch (err: any) {
        console.error("Error crítico scanner ventas:", err)
        setError("No se pudo iniciar la cámara. Verifica los permisos.")
        setLoading(false)
      }
    }, 500)

    return () => {
      clearTimeout(initTimer)
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error)
        scannerRef.current.clear()
      }
    }
  }, [onResult])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center bg-black min-h-[400px] p-6 text-white text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="font-bold">Error de cámara</p>
        <p className="text-sm text-slate-400">{error}</p>
        <Button onClick={onClose} variant="destructive" className="w-full">Cerrar</Button>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col items-center justify-center bg-black w-full min-h-[400px]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50 text-white">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p>Conectando lector...</p>
        </div>
      )}
      <div id={scannerId} className="w-full h-full" />
      <div className="absolute bottom-4 flex flex-col gap-2 z-50 pointer-events-none">
        <Button 
          variant="destructive" 
          className="rounded-full px-8 pointer-events-auto shadow-xl" 
          onClick={onClose}
        >
          <X className="mr-2 h-4 w-4" /> Cancelar
        </Button>
      </div>
    </div>
  )
}

// --- COMPONENTE PRINCIPAL (Con las mejoras aplicadas) ---
export default function CajaVentas({ turnoId, empleadoNombre, sucursalId, onVentaCompletada }: CajaVentasProps) {
  const [busqueda, setBusqueda] = useState("")
  const [productos, setProductos] = useState<Producto[]>([])
  const [carrito, setCarrito] = useState<ItemVenta[]>([])
  const [loading, setLoading] = useState(false)
  const [procesandoVenta, setProcesandoVenta] = useState(false)
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "tarjeta" | "billetera_virtual">("efectivo")
  const [showScanner, setShowScanner] = useState(false)
  const [imprimirTicket, setImprimirTicket] = useState(true)
  
  const inputRef = useRef<HTMLInputElement>(null)

  const agregarAlCarrito = useCallback((producto: Producto) => {
    setCarrito(prev => {
      const existe = prev.find(p => p.id === producto.id)
      if (existe) {
        return prev.map(p => p.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p)
      }
      return [...prev, { ...producto, cantidad: 1 }]
    })
    setBusqueda("") 
    setProductos([])
    toast.success(`+1 ${producto.nombre}`, { position: 'bottom-center', duration: 800 })
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const buscarProductos = useCallback(async (query: string, autoAdd: boolean = false) => {
    if (!query || query.trim().length === 0) {
      setProductos([])
      return
    }
    setLoading(true)
    try {
      const result = await searchProductsAction(query, sucursalId)

      if (!result.success) {
        throw new Error(result.error || 'Error en búsqueda')
      }

      setProductos(result.productos)

      if (autoAdd && result.productos.length > 0) {
        const matchExacto = result.productos.find(p => p.codigo_barras === query)
        if (matchExacto) agregarAlCarrito(matchExacto)
        else if (result.productos.length === 1) agregarAlCarrito(result.productos[0])
      }
    } catch (error: any) {
      console.error("Error buscando:", error)
      toast.error("Error en búsqueda", { description: error.message })
    } finally {
      setLoading(false)
    }
  }, [sucursalId, agregarAlCarrito])

  // ✅ MEJORA 1: Búsqueda predictiva (Debounce)
  // Esto permite que el empleado busque sin necesidad de presionar ENTER a cada rato.
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (busqueda.trim().length >= 2) {
        buscarProductos(busqueda, false)
      } else if (busqueda.trim().length === 0) {
        setProductos([])
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [busqueda, buscarProductos])

  const handleBarcodeScanned = (code: string) => {
    setShowScanner(false)
    toast.success("Código detectado", { description: "Buscando producto..." })
    buscarProductos(code, true)
  }

  const cambiarCantidad = (id: string, delta: number) => {
    setCarrito(prev => prev.map(p => 
      p.id === id ? { ...p, cantidad: Math.max(1, p.cantidad + delta) } : p
    ))
  }

  const removerDelCarrito = (id: string) => {
    setCarrito(prev => prev.filter(item => item.id !== id))
  }

  const calcularTotal = () => carrito.reduce((total, item) => total + (item.precio * item.cantidad), 0)

  const procesarVenta = async () => {
    if (carrito.length === 0) return
    setProcesandoVenta(true)
    try {
      const itemsSimplificados = carrito.map(item => ({
        producto_id: item.id,
        cantidad: item.cantidad
      }))

      const result = await confirmVentaAction({
        sucursalId,
        turnoId,
        items: itemsSimplificados,
        metodoPago,
        montoTotal: calcularTotal()
      })

      if (!result.success) {
        throw new Error(result.error || 'Error al procesar venta')
      }

      // Generación de ticket opcional según el estado
      if (imprimirTicket) {
        generarTicketVenta({
          organizacion: "Kiosco 24hs",
          fecha: new Date().toLocaleString('es-AR'),
          items: carrito.map(i => ({
              cantidad: i.cantidad,
              producto: i.nombre,
              precioUnitario: i.precio,
              subtotal: i.precio * i.cantidad
          })),
          total: calcularTotal(),
          metodoPago: metodoPago,
          vendedor: empleadoNombre
        })
      }

      toast.success("Venta Exitosa")
      setCarrito([])
      if (onVentaCompletada) onVentaCompletada()
    } catch (error: any) {
      toast.error("Error", { description: error.message })
    } finally {
      setProcesandoVenta(false)
    }
  }

  return (
    <Card className="flex flex-col h-full shadow-2xl border-0 bg-white rounded-[2rem] overflow-hidden">
      <div className="p-6 border-b bg-slate-900 text-white flex justify-between items-center">
        <div>
          <h3 className="font-black uppercase text-sm tracking-tighter">Punto de Venta</h3>
          <p className="text-[9px] text-blue-300 font-bold uppercase tracking-widest">ID: {sucursalId.slice(0,5)}</p>
        </div>
        <Badge className="bg-blue-500">OPERATIVO</Badge>
      </div>

      <div className="p-6 space-y-6 flex-1 bg-slate-50/50">
        <div className="relative">
          <Input 
            ref={inputRef}
            placeholder="BUSCAR O ESCANEAR..." 
            className="pl-4 pr-32 bg-white font-black h-16 rounded-2xl border-2 border-slate-100"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            // Mantenemos onKeyDown para permitir búsqueda manual inmediata si el usuario quiere
            onKeyDown={(e) => e.key === 'Enter' && buscarProductos(busqueda, true)} 
          />
          <Button
            onClick={() => setShowScanner(true)}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 h-10 rounded-xl"
          >
            <ScanBarcode className="h-4 w-4 mr-2" /> Escanear
          </Button>

          {productos.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border-2 z-50 overflow-hidden">
              {productos.map(p => (
                <button key={p.id} onClick={() => agregarAlCarrito(p)} className="w-full text-left px-5 py-4 hover:bg-blue-50 flex justify-between items-center border-b last:border-0 uppercase font-bold text-xs">
                  <span>{p.nombre}</span>
                  <span className="text-blue-600">$ {p.precio}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide">
          {carrito.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-300 border-4 border-dashed rounded-[2.5rem] bg-white">
              <ShoppingCart className="h-12 w-12 opacity-20 mb-4" />
              <p className="text-xs font-black uppercase tracking-widest text-center">Esperando Productos</p>
            </div>
          ) : (
            carrito.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-2xl border-2 border-transparent shadow-sm">
                <div className="flex-1">
                  <p className="font-black text-slate-800 text-sm uppercase">{item.nombre}</p>
                  <p className="text-[10px] font-bold text-slate-400">$ {item.precio} u.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => cambiarCantidad(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-6 text-center text-sm font-black">{item.cantidad}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => cambiarCantidad(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <Button variant="ghost" size="icon" className="text-red-400" onClick={() => removerDelCarrito(item.id)}><Trash2 className="h-5 w-5" /></Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="p-6 bg-white border-t space-y-4">
        <div className="flex justify-between font-black text-2xl tracking-tighter">
          <span className="text-slate-400 text-xs uppercase">Total</span>
          <span>$ {calcularTotal().toLocaleString('es-AR')}</span>
        </div>

        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">¿Generar comprobante?</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setImprimirTicket(!imprimirTicket)}
            className={cn(
              "h-8 px-4 rounded-lg font-black text-[9px] uppercase transition-all",
              imprimirTicket ? "bg-blue-100 text-blue-600" : "bg-slate-200 text-slate-500"
            )}
          >
            {imprimirTicket ? "SÍ, IMPRIMIR" : "NO, SOLO REGISTRAR"}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
            {(['efectivo', 'billetera_virtual', 'tarjeta'] as const).map((m) => (
                <button 
                    key={m}
                    onClick={() => setMetodoPago(m)}
                    className={cn(
                        "flex flex-col items-center gap-1 py-3 rounded-xl border-2 font-bold text-[9px] uppercase transition-all", 
                        metodoPago === m ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-100 text-slate-400"
                    )}
                >
                    {m === 'efectivo' && 'Efectivo'}
                    {m === 'billetera_virtual' && 'Virtual'}
                    {m === 'tarjeta' && 'Tarjeta'}
                </button>
            ))}
        </div>
        <Button 
          className="w-full h-20 text-xl font-black rounded-[1.5rem] bg-blue-600 hover:bg-blue-700" 
          onClick={procesarVenta}
          disabled={carrito.length === 0 || procesandoVenta}
        >
          {procesandoVenta ? <Loader2 className="animate-spin h-8 w-8" /> : (
            <div className="flex items-center gap-3">
              <ReceiptText className="h-7 w-7" />
              <span>CONFIRMAR VENTA</span>
            </div>
          )}
        </Button>
      </div>

      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black border-none">
          {showScanner && <BarcodeScannerVentas onResult={handleBarcodeScanned} onClose={() => setShowScanner(false)} />}
        </DialogContent>
      </Dialog>
    </Card>
  )
}