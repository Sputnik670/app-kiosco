"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, ShoppingCart, Plus, Minus, Loader2, ScanBarcode, ReceiptText, CloudOff, QrCode, Star, ChevronDown, ChevronUp, CreditCard, Banknote } from "lucide-react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { generarTicketVenta } from "@/lib/generar-ticket"
import { useOfflineVentas } from "@/hooks/use-offline-ventas"
import { useCart } from "@/hooks/use-cart"
import { BarcodeScanner } from "@/components/barcode-scanner"
import { MercadoPagoQRDialog } from "@/components/mercadopago-qr-dialog"
import { DialogCobroManual, type ManualPaymentMethod } from "@/components/dialog-cobro-manual"
import { SyncStatusIndicator, SyncBadge } from "@/components/pwa"
import type { ProductoVenta } from "@/lib/actions/ventas.actions"
import { getTopProductsAction } from "@/lib/actions/ventas.actions"
import {
  getPaymentMethodsConfigAction,
  type PaymentMethodsConfig,
} from "@/lib/actions/payment-methods.actions"

type CajaPaymentMethod =
  | "cash"
  | "card"
  | "wallet"
  | "mercadopago"
  | "posnet_mp"
  | "qr_static_mp"
  | "transfer_alias"

const MANUAL_METHODS: ReadonlyArray<ManualPaymentMethod> = [
  "posnet_mp",
  "qr_static_mp",
  "transfer_alias",
]

function isManualMethod(m: CajaPaymentMethod): m is ManualPaymentMethod {
  return (MANUAL_METHODS as ReadonlyArray<string>).includes(m)
}

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
  const [topProducts, setTopProducts] = useState<ProductoVenta[]>([])
  const [showAllTop, setShowAllTop] = useState(false)
  const [loadingTop, setLoadingTop] = useState(true)
  // Métodos de cobro ampliados (Posnet / QR fijo / Alias)
  const [paymentMethodsConfig, setPaymentMethodsConfig] =
    useState<PaymentMethodsConfig | null>(null)
  const [showManualDialog, setShowManualDialog] = useState(false)
  const [manualMethod, setManualMethod] = useState<ManualPaymentMethod | null>(null)

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
    retryFailed,
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

  // Cargar top 30 productos al abrir la caja
  useEffect(() => {
    let cancelled = false
    const loadTopProducts = async () => {
      try {
        const result = await getTopProductsAction(sucursalId, 30)
        if (!cancelled && result.success) {
          setTopProducts(result.products)
        }
      } catch {
        // Silencioso — los botones simplemente no aparecen
      } finally {
        if (!cancelled) setLoadingTop(false)
      }
    }
    loadTopProducts()
    return () => { cancelled = true }
  }, [sucursalId])

  // Cargar configuración de métodos de cobro ampliados
  useEffect(() => {
    let cancelled = false
    const loadPaymentConfig = async () => {
      try {
        const result = await getPaymentMethodsConfigAction()
        if (!cancelled && result.success && result.config) {
          setPaymentMethodsConfig(result.config)
        }
      } catch {
        // Silencioso — si falla solo quedan los métodos básicos
      }
    }
    loadPaymentConfig()
    return () => { cancelled = true }
  }, [])

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

  const buscarProductos = useCallback(async (query: string, autoAdd: boolean = false): Promise<boolean> => {
    if (!query || query.trim().length === 0) {
      setProductos([])
      return false
    }
    setLoading(true)
    try {
      // Usa el hook offline que automáticamente decide si buscar online o en cache
      const resultados = await searchProducts(query)
      setProductos(resultados)

      if (autoAdd && resultados.length > 0) {
        const matchExacto = resultados.find(p => p.barcode === query)
        if (matchExacto) {
          agregarAlCarrito(matchExacto)
          return true
        } else if (resultados.length === 1) {
          agregarAlCarrito(resultados[0])
          return true
        }
        // Hay resultados pero no se pudo auto-agregar (múltiples coincidencias)
        // Los productos quedan visibles en el dropdown para selección manual
        return true
      }
      return resultados.length > 0
    } catch (error) {
      // Error logged by offline hook
      toast.error("Error en búsqueda", {
        description: error instanceof Error ? error.message : 'Error desconocido'
      })
      return false
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

  const handleBarcodeScanned = useCallback((code: string) => {
    const trimmed = code.trim()
    setShowScanner(false)
    // Poner el código en el input para que el usuario vea qué se escaneó
    // y como fallback: el debounce también buscará
    setBusqueda(trimmed)
    toast.success("Código detectado", { description: trimmed })
    buscarProductos(trimmed, true).then((found) => {
      // Si autoAdd no agregó nada, avisar al usuario
      if (!found) {
        toast.info("Producto no encontrado", {
          description: "Verificá que esté cargado en inventario con ese código de barras.",
          duration: 4000,
        })
      }
    })
  }, [buscarProductos])

  // Los métodos del carrito ahora vienen del hook useCart

  const procesarVentaHandler = async () => {
    if (cart.isEmpty) return

    // Si el método de pago es Mercado Pago (QR dinámico EMVCo), abrir el dialog QR
    if (metodoPago === "mercadopago") {
      const tempSaleId = generateTempSaleId()
      setMercadoPagoTempSaleId(tempSaleId)
      setShowMercadoPagoQR(true)
      return
    }

    // Métodos manuales (Posnet MP, QR fijo, Alias) → abrir dialog de confirmación
    if (isManualMethod(metodoPago)) {
      setManualMethod(metodoPago)
      setShowManualDialog(true)
      return
    }

    // Flujo normal para otros métodos de pago (cash, card, wallet)
    await completarVenta(metodoPago)
  }

  const completarVenta = async (metodo: CajaPaymentMethod) => {
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
        metodoPago: metodo,
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
          metodoPago: metodo,
          vendedor: empleadoNombre,
          // Marcar si es offline
          offlinePending: result.isOffline,
          localId: result.isOffline ? result.ventaId : undefined,
        })
      }

      // Toast diferenciado según resultado ARCA (T15a)
      if (result.isOffline) {
        toast.success("Venta guardada (offline)")
      } else if (result.invoiceCAE) {
        toast.success("Venta Exitosa", {
          description: `Factura emitida — CAE ${result.invoiceCAE}${result.invoiceCbteNumero ? ` (Nº ${result.invoiceCbteNumero})` : ""}`,
        })
      } else if (result.invoiceAlreadyInvoiced) {
        toast.success("Venta Exitosa", {
          description: `Esta venta ya tenía factura — CAE ${result.invoiceCAE ?? "registrado"}`,
        })
      } else if (result.invoiceError) {
        toast.warning("Venta Exitosa, factura no emitida", {
          description: "Reintentá desde panel ARCA. La venta quedó registrada OK.",
        })
      } else {
        // ARCA inactivo o sin info → toast normal sin mencionar factura
        toast.success("Venta Exitosa")
      }
      cart.clearCart()
      setShowManualDialog(false)
      setManualMethod(null)
      if (onVentaCompletada) onVentaCompletada()
    } catch (error) {
      toast.error("Error", {
        description: error instanceof Error ? error.message : 'Error desconocido'
      })
    } finally {
      setProcesandoVenta(false)
    }
  }

  const handleManualConfirmed = async () => {
    if (!manualMethod) return
    await completarVenta(manualMethod)
  }

  const handleMercadoPagoPaymentConfirmed = async () => {
    // PLAN B: la sale ya la creó el webhook server-side al recibir la
    // confirmación de MP, leyendo cart_snapshot de mercadopago_orders.
    // Este handler ahora SOLO se encarga del UX local: ticket + toast + clear cart.
    //
    // Esto significa que aunque el dialog se cierre antes de que el polling
    // detecte el confirmed, la venta igual se registra. La UI ya no es el
    // único camino para crear la sale.
    try {
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
        })
      }

      toast.success("Venta Exitosa")
      cart.clearCart()
      if (onVentaCompletada) onVentaCompletada()
    } catch (error) {
      // Si falla el ticket, la venta YA quedó registrada por el webhook —
      // sólo informamos el problema del comprobante, no perdemos la venta.
      toast.warning("Venta registrada, falló el ticket", {
        description: error instanceof Error ? error.message : 'Error generando comprobante',
      })
      cart.clearCart()
      if (onVentaCompletada) onVentaCompletada()
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
          <SyncBadge
            syncStatus={syncStatus}
            pendingCount={pendingCount}
            isOffline={isOffline}
          />
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
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 h-14 px-4 rounded-xl min-w-[56px] sm:px-6 sm:h-10"
            aria-label="Abrir escáner de código de barras"
          >
            <ScanBarcode className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Escanear</span>
            <span className="sm:hidden text-xs">Scan</span>
          </Button>

          {productos.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border-2 z-50 overflow-hidden max-h-72 overflow-y-auto">
              {productos.map(p => (
                <button
                  key={p.id}
                  onClick={() => agregarAlCarrito(p)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 flex justify-between items-center border-b last:border-0 uppercase font-bold text-xs active:bg-blue-100 min-h-[48px]"
                >
                  <span className="flex-1 truncate">{p.name}</span>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <span className="text-slate-400 text-[9px] whitespace-nowrap">S:{p.stock}</span>
                    <span className="text-blue-600 font-black">$ {p.price}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid de acceso rápido — Top 30 más vendidos */}
        {topProducts.length > 0 && (
          <div>
            <button
              onClick={() => setShowAllTop(!showAllTop)}
              className="flex items-center gap-1.5 mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
              Rápidos ({topProducts.length})
              {showAllTop ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            <div className={cn(
              "grid grid-cols-5 sm:grid-cols-6 gap-1.5 transition-all overflow-hidden",
              showAllTop ? "max-h-[500px]" : "max-h-[140px]"
            )}>
              {topProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => agregarAlCarrito(p)}
                  className="flex flex-col items-center justify-center bg-white border border-slate-100 rounded-xl p-1.5 hover:bg-blue-50 hover:border-blue-200 active:scale-95 transition-all min-h-[56px] shadow-sm"
                  title={`${p.name} — $${p.price}`}
                >
                  <span className="text-lg leading-none">{p.emoji || '📦'}</span>
                  <span className="text-[8px] font-bold text-slate-600 leading-tight mt-0.5 line-clamp-2 text-center w-full px-0.5">
                    {p.name.length > 12 ? p.name.slice(0, 12) : p.name}
                  </span>
                  <span className="text-[7px] font-black text-blue-600 leading-none mt-0.5">
                    ${p.price}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {loadingTop && (
          <div className="flex items-center gap-2 text-[10px] text-slate-300 font-bold uppercase">
            <Loader2 className="h-3 w-3 animate-spin" /> Cargando favoritos...
          </div>
        )}

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
                className="flex items-center justify-between bg-white p-3 sm:p-4 rounded-2xl border-2 border-transparent shadow-sm gap-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 text-xs sm:text-sm uppercase truncate">{item.name}</p>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400">$ {item.price} u.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 min-h-[44px] min-w-[44px]"
                      onClick={() => cart.decrementItem(item.id)}
                      aria-label={`Disminuir cantidad de ${item.name}`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center text-sm font-black">{item.cantidad}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 min-h-[44px] min-w-[44px]"
                      onClick={() => cart.incrementItem(item.id)}
                      aria-label={`Aumentar cantidad de ${item.name}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 min-h-[44px] min-w-[44px] text-red-400 hover:bg-red-50"
                    onClick={() => cart.removeItem(item.id)}
                    aria-label={`Eliminar ${item.name} del carrito`}
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
          {(() => {
            const baseMethods: CajaPaymentMethod[] = ['cash', 'wallet', 'card', 'mercadopago']
            const manualExtras: CajaPaymentMethod[] = []
            if (paymentMethodsConfig?.posnet_mp_enabled) manualExtras.push('posnet_mp')
            if (paymentMethodsConfig?.qr_static_enabled) manualExtras.push('qr_static_mp')
            if (paymentMethodsConfig?.alias_enabled) manualExtras.push('transfer_alias')
            const all = [...baseMethods, ...manualExtras]

            const labels: Record<CajaPaymentMethod, string> = {
              cash: 'Efectivo',
              wallet: 'Virtual',
              card: 'Tarjeta',
              mercadopago: 'QR MP',
              posnet_mp: 'Posnet',
              qr_static_mp: 'QR Fijo',
              transfer_alias: 'Alias',
            }
            const icons: Partial<Record<CajaPaymentMethod, React.ReactNode>> = {
              mercadopago: <QrCode className="h-4 w-4" />,
              posnet_mp: <CreditCard className="h-4 w-4" />,
              qr_static_mp: <QrCode className="h-4 w-4" />,
              transfer_alias: <Banknote className="h-4 w-4" />,
            }

            return all.map((m) => (
              <button
                key={m}
                onClick={() => setMetodoPago(m)}
                aria-label={`Pagar con ${labels[m]}`}
                aria-pressed={metodoPago === m}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 py-4 px-2 rounded-xl border-2 font-bold text-[9px] sm:text-[8px] uppercase transition-all min-h-[48px]",
                  metodoPago === m ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-100 text-slate-400"
                )}
              >
                {icons[m] && <span>{icons[m]}</span>}
                <span className="line-clamp-1">{labels[m]}</span>
              </button>
            ))
          })()}
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

      {showScanner && (
        <BarcodeScanner
          onResult={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      )}

      <MercadoPagoQRDialog
        open={showMercadoPagoQR}
        onOpenChange={setShowMercadoPagoQR}
        saleId={mercadoPagoTempSaleId}
        amount={cart.getTotal()}
        branchId={sucursalId}
        cashRegisterId={turnoId}
        cartItems={cart.items.map((i) => ({
          product_id: i.id,
          quantity: i.cantidad,
          unit_price: i.price,
          subtotal: i.price * i.cantidad,
        }))}
        onPaymentConfirmed={handleMercadoPagoPaymentConfirmed}
        onPaymentFailed={handleMercadoPagoPaymentFailed}
      />

      <DialogCobroManual
        open={showManualDialog}
        onOpenChange={(next) => {
          setShowManualDialog(next)
          if (!next) setManualMethod(null)
        }}
        method={manualMethod}
        amount={cart.getTotal()}
        config={paymentMethodsConfig}
        onConfirmed={handleManualConfirmed}
        processing={procesandoVenta}
      />

      {/* Indicador flotante de sincronización offline */}
      <SyncStatusIndicator
        syncStatus={syncStatus}
        pendingCount={pendingCount}
        isOffline={isOffline}
        onForceSyncNow={forceSyncNow}
        onRetryFailed={retryFailed}
        position="bottom-right"
      />
    </Card>
  )
}
