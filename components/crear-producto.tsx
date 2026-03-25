// components/crear-producto.tsx

"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
// Dialog removido: html5-qrcode no funciona dentro de Radix Dialog
// porque las CSS transforms (translate-x/y-50%) distorsionan getBoundingClientRect()
// Ver: https://github.com/mebjas/html5-qrcode/issues/476
import { Loader2, Package, Plus, DollarSign, ScanBarcode, X, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { checkExistingProductAction, createFullProductAction, lookupCatalogAction, lookupOpenFoodFactsAction, saveToCatalogAction } from "@/lib/actions/product.actions"

// --- SCANNER v12: ZBar WASM (web-wasm-barcode-reader) ---
// Después de probar ZXing (html5-qrcode), Quagga2, y BarcodeDetector:
// TODOS fallan en iOS Safari para barcodes 1D. Es un problema conocido y documentado.
// ZBar es una librería C de decodificación probada hace décadas.
// Compilada a WebAssembly corre a velocidad nativa en iOS Safari.
// El paquete web-wasm-barcode-reader maneja todo: cámara, WASM, detección con
// corrección de ángulo (0°, +30°, -30°).

// Carga el script Emscripten (a.out.js) que inicializa el Module global
function loadWasmScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).Module !== "undefined" && (window as any).Module.calledRun) {
      resolve()
      return
    }
    if (document.getElementById("zbar-wasm-script")) {
      // Script ya está cargando, esperar a que termine
      const check = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).Module?.calledRun) { clearInterval(check); resolve() }
      }, 100)
      setTimeout(() => { clearInterval(check); resolve() }, 5000)
      return
    }
    const script = document.createElement("script")
    script.id = "zbar-wasm-script"
    script.src = "/a.out.js"
    script.onload = () => {
      // Esperar a que Emscripten inicialice el runtime
      const check = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).Module?.calledRun) { clearInterval(check); resolve() }
      }, 50)
      setTimeout(() => { clearInterval(check); resolve() }, 5000)
    }
    script.onerror = () => reject(new Error("No se pudo cargar el motor de escaneo"))
    document.head.appendChild(script)
  })
}

function BarcodeScannerOverlay({ onResult, onClose }: { onResult: (code: string) => void, onClose: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const onResultRef = useRef(onResult)
  const foundRef = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null)

  useEffect(() => { onResultRef.current = onResult }, [onResult])

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  useEffect(() => {
    let cancelled = false

    const timer = setTimeout(async () => {
      if (cancelled || !containerRef.current) return

      try {
        // 1. Cargar WASM
        await loadWasmScript()
        if (cancelled) return

        // 2. Import dinámico de la librería
        const { BarcodeScanner } = await import("web-wasm-barcode-reader")
        if (cancelled) return

        // 3. Crear scanner
        const scanner = new BarcodeScanner({
          container: containerRef.current,
          onDetect: (result) => {
            if (foundRef.current) return
            foundRef.current = true
            if (navigator.vibrate) navigator.vibrate(100)
            scanner.stop()
            onResultRef.current(result.data)
          },
          onError: (err) => {
            if (!cancelled) {
              console.error("ZBar scanner error:", err)
              setError(err.message || "Error del lector de códigos")
              setLoading(false)
            }
          },
          scanInterval: 120,
          beepOnDetect: false, // usamos vibración en su lugar
          facingMode: "environment",
          scanRegion: { width: 0.85, height: 0.30 },
        })
        scannerRef.current = scanner

        // 4. Iniciar
        await scanner.start()
        if (!cancelled) setLoading(false)

      } catch (err) {
        console.error("Scanner init error:", err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo iniciar el lector")
          setLoading(false)
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (scannerRef.current?.isRunning) {
        scannerRef.current.stop()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const overlay = (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#000" }}>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50 text-white gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-[10px] font-bold uppercase">Iniciando Lector...</p>
        </div>
      )}
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-white text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <p className="font-bold uppercase text-sm">Error de Cámara</p>
          <p className="text-xs text-slate-400">{error}</p>
          <Button onClick={onClose} variant="destructive" className="w-full max-w-xs">Cerrar</Button>
        </div>
      ) : (
        <div
          ref={containerRef}
          style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}
        />
      )}
      <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 100000 }}>
        <Button variant="destructive" className="rounded-full px-10 shadow-xl font-bold uppercase text-[10px]" onClick={onClose}>
          <X className="mr-2 h-4 w-4" /> Cancelar
        </Button>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

// Flujo de búsqueda: Catálogo compartido → OpenFoodFacts (server-side) → Manual
// Todo se ejecuta en server actions para evitar problemas de CORS/User-Agent en mobile

const QUICK_EMOJIS = [
    "🍫", "🍬", "🍭", "🍩", "🍪", "🥤", "🧃", "☕", "🧉", "🥛", 
    "🥖", "🥐", "🥪", "🌭", "🍔", "🚬", "🔥", "🔋", "🧼", "🧴", 
    "🖊️", "📓", "✂️", "📍", "📱", "💻", "⚡", "📦", "🎁", "🎲"
]

interface CrearProductoProps {
  onProductCreated?: () => void
  sucursalId?: string 
}

export default function CrearProducto({ onProductCreated, sucursalId }: CrearProductoProps) {
  const [loading, setLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  const [formData, setFormData] = useState({
    codigo_barras: "",
    nombre: "",
    categoria: "",
    precio_venta: "",
    costo: "", 
    fecha_vencimiento: "",
    cantidad_inicial: "0",
    emoji: "📦"
  })

  const precioNum = parseFloat(formData.precio_venta) || 0
  const costoNum = parseFloat(formData.costo) || 0
  const ganancia = precioNum - costoNum
  const margen = costoNum > 0 ? ((ganancia / costoNum) * 100).toFixed(1) : "0.0"

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleBarcodeDetected = async (code: string) => {
    setShowScanner(false)
    if (code === formData.codigo_barras) return

    toast.info("Verificando código...")
    try {
        const result = await checkExistingProductAction(code)

        if (!result.success) {
            toast.error(result.error || "Error al verificar producto")
            return
        }

        if (result.exists && result.productName) {
            toast.warning("Producto existente", {
                description: `Ya tienes "${result.productName}" en tu catálogo.`
            })
            return
        }

        // PASO 1: Buscar en catálogo compartido de AppKiosco
        const catalogResult = await lookupCatalogAction(code)
        if (catalogResult.success && catalogResult.found) {
            setFormData(prev => ({
                ...prev,
                codigo_barras: code,
                nombre: catalogResult.name || prev.nombre,
                categoria: catalogResult.category || prev.categoria,
                emoji: catalogResult.emoji || "🥫",
            }))
            toast.success("Producto identificado", {
                description: `${catalogResult.name}${catalogResult.category ? ` • ${catalogResult.category}` : ""}`,
            })
            return
        }

        // PASO 2: Buscar en OpenFoodFacts (server-side, sin CORS)
        toast.info("Buscando en base de datos global...")
        const offResult = await lookupOpenFoodFactsAction(code)
        if (offResult.found && offResult.name) {
            const nombre = `${offResult.brand ? offResult.brand + ' ' : ''}${offResult.name}`.trim()
            setFormData(prev => ({
                ...prev,
                codigo_barras: code,
                nombre,
                categoria: offResult.category || prev.categoria,
                emoji: "🥫",
            }))
            toast.success("Producto identificado", {
                description: offResult.category
                  ? `Categoría: ${offResult.category}`
                  : "Completá la categoría manualmente"
            })
            return
        }

        // PASO 3: No encontrado — completar manual
        setFormData(prev => ({ ...prev, codigo_barras: code }))
        toast.info("Código registrado", {
            description: "Producto nuevo. Completá los datos manualmente.",
        })
    } catch (error: any) {
        console.error(error)
        toast.error("Error", { description: error.message })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sucursalId) {
        toast.error("Error", { description: "Selecciona una sucursal arriba." })
        return
    }
    setLoading(true)

    try {
      const result = await createFullProductAction(
        {
          codigo_barras: formData.codigo_barras || null,
          nombre: formData.nombre,
          categoria: formData.categoria,
          precio_venta: precioNum,
          costo: costoNum,
          emoji: formData.emoji,
          fecha_vencimiento: formData.fecha_vencimiento || null,
          cantidad_inicial: parseInt(formData.cantidad_inicial) || 0,
        },
        sucursalId
      )

      if (!result.success) {
        throw new Error(result.error || 'Error al crear producto')
      }

      // Guardar en catálogo compartido si tiene barcode (fire & forget)
      if (formData.codigo_barras) {
        saveToCatalogAction(
          formData.codigo_barras,
          formData.nombre,
          undefined,
          formData.categoria,
          formData.emoji
        ).catch(() => {}) // no bloquear si falla
      }

      toast.success("Catálogo actualizado")
      setFormData({ codigo_barras: "", nombre: "", categoria: "", precio_venta: "", costo: "", fecha_vencimiento: "", cantidad_inicial: "0", emoji: "📦" })
      if (onProductCreated) onProductCreated()

    } catch (error: any) {
      toast.error("Error", { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
        <Card className="p-6 w-full max-w-md mx-auto bg-white shadow-2xl border-0 rounded-[2.5rem]">
        <div className="flex items-center gap-3 mb-8 text-slate-900">
            <div className="p-3 bg-slate-100 rounded-2xl"><Package className="h-6 w-6" /></div>
            <h2 className="text-xl font-black uppercase tracking-tight leading-none">Añadir Producto Nuevo</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
                 <div className="flex justify-between items-end px-1"><label className="text-[10px] font-black text-slate-400 uppercase">Identificación</label><Button type="button" size="sm" variant={formData.codigo_barras ? "secondary" : "default"} onClick={() => setShowScanner(true)} className={`h-8 text-[9px] font-black uppercase rounded-xl gap-2 ${!formData.codigo_barras ? "bg-blue-600 text-white" : ""}`}><ScanBarcode className="h-3.5 w-3.5" />{formData.codigo_barras ? "Cambiar" : "Escanear"}</Button></div>
                 <div className="flex gap-2">
                    <Input id="nombre" name="nombre" placeholder="Nombre" value={formData.nombre} onChange={handleChange} className="font-bold flex-1 h-14 rounded-2xl bg-slate-50 border-transparent" required />
                    <div className="w-16 shrink-0">
                        <Popover>
                            <PopoverTrigger asChild><Button variant="outline" className="w-full h-14 text-2xl px-0 rounded-2xl bg-slate-50 border-transparent" type="button">{formData.emoji}</Button></PopoverTrigger>
                            <PopoverContent className="w-64 p-4 bg-white rounded-3xl shadow-2xl" align="end">
                                <p className="text-[10px] font-black text-slate-400 mb-3 text-center uppercase">Icono</p>
                                <div className="grid grid-cols-5 gap-2 max-h-56 overflow-y-auto pr-1">
                                    {QUICK_EMOJIS.map(em => (<button key={em} type="button" onClick={() => setFormData({...formData, emoji: em})} className="text-2xl hover:bg-slate-100 p-2 rounded-xl transition-all">{em}</button>))}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                 </div>
            </div>

            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase px-1">Categoría</label><Input id="categoria" name="categoria" placeholder="Ej: Bebidas" value={formData.categoria} onChange={handleChange} className="h-12 rounded-2xl bg-slate-50 border-transparent font-bold" required /></div>

            <div className="grid grid-cols-2 gap-4 p-5 bg-slate-900 rounded-3xl">
                <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-500 uppercase">Costo</label><div className="relative"><DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" /><Input id="costo" name="costo" type="number" className="pl-7 bg-slate-800 border-transparent text-white h-10 rounded-xl" value={formData.costo} onChange={handleChange} /></div></div>
                <div className="space-y-1.5"><label className="text-[9px] font-black text-blue-400 uppercase">Venta</label><div className="relative"><DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-400" /><Input id="precio_venta" name="precio_venta" type="number" className="pl-7 bg-slate-800 border-blue-900/50 text-blue-100 h-10 rounded-xl font-bold" value={formData.precio_venta} onChange={handleChange} required /></div></div>
                {(precioNum > 0 && costoNum > 0) && (<div className={`col-span-2 text-[9px] font-black flex justify-between items-center px-3 py-2 rounded-xl bg-white/5 border border-white/10 ${parseFloat(margen) < 30 ? "text-red-400" : "text-emerald-400"}`}><span>MARGEN: {margen}%</span><span>NETO: ${ganancia.toFixed(0)}</span></div>)}
            </div>

            <div className="p-5 bg-blue-50/50 rounded-3xl border-2 border-blue-100 space-y-4">
                <label className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-2"><Plus className="h-3 w-3" /> Stock de Inicio</label>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[9px] font-black text-blue-400 uppercase">Cant.</label><Input id="cantidad_inicial" name="cantidad_inicial" type="number" value={formData.cantidad_inicial} onChange={handleChange} className="bg-white text-xl font-black text-center h-14 rounded-2xl border-blue-200"/></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-blue-400 uppercase">Vence</label><Input id="fecha_vencimiento" type="date" name="fecha_vencimiento" value={formData.fecha_vencimiento} onChange={handleChange} className="bg-white text-[10px] font-bold h-14 rounded-2xl border-blue-200 px-2"/></div>
                </div>
            </div>

            <Button type="submit" className="w-full h-16 text-sm font-black uppercase tracking-widest shadow-xl rounded-2xl bg-blue-600 hover:bg-blue-700" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Confirmar Alta"}</Button>
        </form>
        </Card>

        {showScanner && (
          <BarcodeScannerOverlay
            onResult={handleBarcodeDetected}
            onClose={() => setShowScanner(false)}
          />
        )}
    </>
  )
}