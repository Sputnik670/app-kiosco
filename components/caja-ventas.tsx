"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, ShoppingCart, Plus, Minus, Loader2, ScanBarcode, ReceiptText, WifiOff, RefreshCw, CloudOff, QrCode } from "lucide-react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { generarTicketVenta } from "@/lib/generar-ticket"
import { useOfflineVentas } from "@/hooks/use-offline-ventas"
import { useCart } from "@/hooks/use-cart"
import { BarcodeScanner } from "@/components/barcode-scanner"
import { MercadoPagoQRDialog } from "@/components/mercadopago-qr-dialog"
import type { ProductoVenta } from "@/lib/actions/ventas.actions"

type CajaPaymentMethod = "cash" | "card" | "wallet" | "mercadopago"

// Generador de UUID simple sin dependencias externas
function generateTempSaleId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

interface CajaVentasProps {
  turnoId: string
  empleadoNombre: string
  sucursalId: string
  organizationId: string
  vendedorId?: string
  onVentaCompletada?: () => void
}

// --- COMPONENTE PRINCIPAL CON SOPORTE OFFLINE ---
export default function CajaVentas({
  turnoId,
  empleadoNombre,
  sucursalId,
  organizationId,
  vendedorId,
  onVentaCompletada,
}: CajaVentasProps) {
  const [busqueda, setBusqueda] = useState("")
  const [productos, setProductos] = useState<ProductoVenta[]>([])
  const [loading, setLoading] = useState(false)
  const [procesandoVenta, setProcesandoVenta] = useState(false)
  const [metodoPago, setMetodoPago] = useState<CajaPaymentMethod>("cash")
  const [showScanner, setShowScanner] = useState(false)
  const [imprimirTicket, setImprimirTicket] = useState(true)
  const [showMercadoPagoQR, setShowMercadoPagoQR] = useState(false)
  const [mercadoPagoTempSaleId, setMercadoPagoTempSaleId] = useState<string>("")

  const inputRef = useRef<HTMLInputElement>(null)

  // Hook de carrito refactorizado
  const cart = useCart()

  // Hook de ventas offline
  const {
    searchProducts,
    processVenta,
    isOffline,
    isSearchingOffline,
    pendingCount,
    syncStatus,
    forceSyncNow,
    connectionQuality,
  } = useOfflineVentas({
    sucursalId,
    organizationId,
    turnoId,
    vendedorId,
    syncProductsOnMount: true,
    onVentaCompleted: (result) => {
      if (result.isOffline) {
        toast.info("Venta guardada offline", {
          description: "Se sincronizará cuando haya conexión",
          icon: <CloudOff className="h-4 w-4" />
        })
      }
    },
  })

  const agregarAlCarrito = useCallback(
    (producto: ProductoVenta) => {
      cart.addItem({
        id: producto.id,
        name: producto.name,
        price: producto.price,
        stock: producto.stock,
        barcode: producto.barcode,
        emoji: producto.emoji,
      })
      setBusqueda("")
      setProductos([])
      setTimeout(() => inputRef.current?.focus(), 100)
    },
    [cart]
  )

  const buscarProductos = useCallback(async (query: string, autoAdd: boolean = false) => {
    if (!query || query.trim().length === 0) {
      setProductos([])
      return
    }
    setLoading(true)
    try {
      // Usa el hook offline que automáticamente decide si buscar online o en cache
      const resultados = await searchProducts(query)
      setProductos(resultados)

      if (autoAdd && resultados.length > 0) {
        const matchExacto = resultados.find(p => p.barcode === query)
        if (matchExacto) agregarAlCarrito(matchExacto)
        else if (resultados.length === 1) agregarAlCarrito(resultados[0])
      }
    } catch (error) {
      // Error logged by offline hook
      toast.error("Error en búsqueda", {
        description: error instanceof Error ? error.message : 'Error desconocido'
      })
    } finally {
      setLoading(false)
    }
  }, [searchProducts, agregarAlCarrito])

  // Búsqueda predictiva (Debounce)
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

  // Los métodos del carrito ahora vienen del hook useCart

  const procesarVentaHandler = async () => {
    if (cart.isEmpty) return

    // Si el método de pago es Mercado Pago, abrir el dialog QR en lugar de procesar directamente
    if (metodoPago === "mercadopago") {
      const tempSaleId = generateTempSaleId()
      setMercadoPagoTempSaleId(tempSaleId)
      setShowMercadoPagoQR(true)
      return
    }

    // Flujo normal para otros métodos de pago
    setProcesandoVenta(true)
    try {
      const items = cart.items.map((item) => ({
        producto_id: item.id,
        cantidad: item.cantidad,
        precio_unitario: item.price,
        nombre: item.name,
      }))

      const result = await processVenta({
        items,
        metodoPago,
        montoTotal: cart.getTotal()
      })

      if (!result.success) {
        throw new Error(result.error || 'Error al procesar venta')
      }

      // Generación de ticket (dynamic import - jsPDF loaded on demand)
      if (imprimirTicket) {
        await generarTicketVenta({
          organizacion: "Kiosco 24hs",
          fecha: new Date().toLocaleString("es-AR"),
          items: cart.items.map((i) => ({
            cantidad: i.cantidad,
            producto: i.name,
            precioUnitario: i.price,
            subtotal: i.price * i.cantidad,
          })),
          total: cart.getTotal(),
          metodoPago: metodoPago,
          vendedor: empleadoNombre,
          // Marcar si es offline
          offlinePending: result.isOffline,
          localId: result.isOffline ? result.ventaId : undefined,
        })
      }

      toast.success(result.isOffline ? "Venta guardada (offline)" : "Venta Exitosa")
      cart.clearCart()
      if (onVentaCompletada) onVentaCompletada()
    } catch (error) {
      toast.error("Error", {
        description: error instanceof Error ? error.message : 'Error desconocido'
      })
    } finally {
      setProcesandoVenta(false)
    }
  }

  const handleMercadoPagoPaymentConfirmed = async () => {
    // Una vez confirmado el pago, procesar la venta con método mercadopago
    setProcesandoVenta(true)
    try {
      const items = cart.items.map((item) => ({
        producto_id: item.id,
        cantidad: item.cantidad,
        precio_unitario: item.price,
        nombre: item.name,
      }))

      const result = await processVenta({
        items,
        metodoPago: "mercadopago",
        montoTotal: cart.getTotal()
      })

      if (!result.success) {
        throw new Error(result.error || 'Error al procesar venta')
      }

      // Generación de ticket
      if (imprimirTicket) {
        await generarTicketVenta({
          organizacion: "Kiosco 24hs",
          fecha: new Date().toLocaleString("es-AR"),
          items: cart.items.map((i) => ({
            cantidad: i.cantidad,
            producto: i.name,
            precioUnitario: i.price,
            subtotal: i.price * i.cantidad,
          })),
          total: cart.getTotal(),
          metodoPago: "mercadopago",
          vendedor: empleadoNombre,
          offlinePending: result.isOffline,
          localId: result.isOffline ? result.ventaId : undefined,
        })
      }

      toast.success(result.isOffline ? "Venta guardada (offline)" : "Venta Exitosa")
      cart.clearCart()
      if (onVentaCompletada) onVentaCompletada()
    } catch (error) {
      toast.error("Error", {
        description: error instanceof Error ? error.message : 'Error al procesar venta después del pago'
      })
    } finally {
      setProcesandoVenta(false)
    }
  }

  const handleMercadoPagoPaymentFailed = () => {
    setShowMercadoPagoQR(false)
    toast.error("Pago cancelado o rechazado", {
      description: "Por favor, intenta nuevamente o usa otro método de pago"
    })
  }

  return (
    <Card className="flex flex-col h-full shadow-2xl border-0 bg-white rounded-[2rem] overflow-hidden">
      {/* Header con estado de conexión */}
      <div className="p-6 border-b bg-slate-900 text-white flex justify-between items-center">
        <div>
          <h3 className="font-black uppercase text-sm tracking-tighter">Punto de Venta</h3>
          <p className="text-[9px] text-blue-300 font-bold uppercase tracking-widest">
            ID: {sucursalId.slice(0,5)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Indicador de ventas pendientes */}
          {pendingCount > 0 && (
            <Badge
              className="bg-amber-500 cursor-pointer"
              onClick={() => forceSyncNow()}
            >
              <CloudOff className="h-3 w-3 mr-1" />
              {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
            </Badge>
          )}

          {/* Estado de conexión */}
          {isOffline ? (
            <Badge className="bg-red-500">
              <WifiOff className="h-3 w-3 mr-1" />
              OFFLINE
            </Badge>
          ) : (
            <Badge className={cn(
              syncStatus === 'syncing' && "bg-amber-500",
              syncStatus === 'error' && "bg-red-500",
              syncStatus === 'success' && "bg-green-500",
              syncStatus === 'idle' && "bg-blue-500"
            )}>
              {syncStatus === 'syncing' && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
              {syncStatus === 'syncing' ? 'SINCRONIZANDO' : 'OPERATIVO'}
            </Badge>
          )}
        </div>
      </div>

      {/* Búsqueda offline indicator */}
      {isSearchingOffline && (
        <div className="px-6 py-2 bg-amber-50 text-amber-700 text-xs font-medium flex items-center gap-2">
          <CloudOff className="h-3 w-3" />
          Buscando en cache local (sin conexión)
        </div>
      )}

      <div className="p-6 space-y-6 flex-1 bg-slate-50/50">
        <div className="relative">
          <Input
            ref={inputRef}
            placeholder="Nombre, código o marca del producto..."
            aria-label="Buscar producto por nombre, código de barras o marca"
            className="pl-4 pr-32 bg-white font-black h-16 rounded-2xl border-2 border-slate-100"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
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
                <button
                  key={p.id}
                  onClick={() => agregarAlCarrito(p)}
                  className="w-full text-left px-5 py-4 hover:bg-blue-50 flex justify-between items-center border-b last:border-0 uppercase font-bold text-xs"
                >
                  <span>{p.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[10px]">Stock: {p.stock}</span>
                    <span className="text-blue-600">$ {p.price}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide">
          {cart.isEmpty ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-300 border-4 border-dashed rounded-[2.5rem] bg-white">
              <ShoppingCart className="h-12 w-12 opacity-20 mb-4" />
              <p className="text-xs font-black uppercase tracking-widest text-center">
                Esperando Productos
              </p>
            </div>
          ) : (
            cart.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-white p-4 rounded-2xl border-2 border-transparent shadow-sm"
              >
                <div className="flex-1">
                  <p className="font-black text-slate-800 text-sm uppercase">{item.name}</p>
                  <p className="text-[10px] font-bold text-slate-400">$ {item.price} u.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => cart.decrementItem(item.id)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-black">{item.cantidad}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => cart.incrementItem(item.id)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-400"
                    onClick={() => cart.removeItem(item.id)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="p-6 bg-white border-t space-y-4">
        <div className="flex justify-between font-black text-2xl tracking-tighter">
          <span className="text-slate-400 text-xs uppercase">Total</span>
          <span>$ {cart.getTotal().toLocaleString("es-AR")}</span>
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

        <div className="grid grid-cols-4 gap-2">
          {(['cash', 'wallet', 'card', 'mercadopago'] as const).map((m) => {
            const labels = {
              cash: 'Efectivo',
              wallet: 'Virtual',
              card: 'Tarjeta',
              mercadopago: 'QR MP'
            } as const
            const icons = {
              cash: null,
              wallet: null,
              card: null,
              mercadopago: <QrCode className="h-3 w-3" />
            }
            return (
              <button
                key={m}
                onClick={() => setMetodoPago(m)}
                aria-label={`Pagar con ${labels[m]}`}
                aria-pressed={metodoPago === m}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 rounded-xl border-2 font-bold text-[8px] uppercase transition-all",
                  metodoPago === m ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-100 text-slate-400"
                )}
              >
                {icons[m] && <span>{icons[m]}</span>}
                {labels[m]}
              </button>
            )
          })}
        </div>

        <Button
          className={cn(
            "w-full h-20 text-xl font-black rounded-[1.5rem]",
            isOffline ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"
          )}
          onClick={procesarVentaHandler}
          disabled={cart.isEmpty || procesandoVenta}
        >
          {procesandoVenta ? <Loader2 className="animate-spin h-8 w-8" /> : (
            <div className="flex items-center gap-3">
              {isOffline ? <CloudOff className="h-7 w-7" /> : <ReceiptText className="h-7 w-7" />}
              <span>{isOffline ? 'GUARDAR OFFLINE' : 'CONFIRMAR VENTA'}</span>
            </div>
          )}
        </Button>
      </div>

      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black border-none">
          {showScanner && (
            <BarcodeScanner
              scannerId="reader-ventas"
              onResult={handleBarcodeScanned}
              onClose={() => setShowScanner(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <MercadoPagoQRDialog
        open={showMercadoPagoQR}
        onOpenChange={setShowMercadoPagoQR}
        saleId={mercadoPagoTempSaleId}
        amount={cart.getTotal()}
        branchId={sucursalId}
        onPaymentConfirmed={handleMercadoPagoPaymentConfirmed}
        onPaymentFailed={handleMercadoPagoPaymentFailed}
      />
    </Card>
  )
}
