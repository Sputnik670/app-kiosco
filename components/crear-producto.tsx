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
import { checkExistingProductAction, createFullProductAction } from "@/lib/actions/product.actions"

// --- SCANNER v8: BarcodeDetector nativo + Quagga2 fallback ---
// Safari 17.2+ (iOS 17.2+, dic 2023) y Chrome Android soportan BarcodeDetector nativo.
// Es MUCHO más rápido y confiable que Quagga2 puro JS.
// Quagga2 se mantiene como fallback para browsers viejos, con settings mejorados.

function BarcodeScannerOverlay({ onResult, onClose }: { onResult: (code: string) => void, onClose: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanMethod, setScanMethod] = useState<string>("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const onResultRef = useRef(onResult)
  const foundRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => { onResultRef.current = onResult }, [onResult])

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  useEffect(() => {
    let cancelled = false
    let animFrameId: number | null = null

    async function startNativeDetector(stream: MediaStream) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BarcodeDetectorClass = (window as any).BarcodeDetector
      if (!BarcodeDetectorClass) return false

      try {
        // Verificar que soporte los formatos que necesitamos
        const formats = await BarcodeDetectorClass.getSupportedFormats()
        const needed = ["ean_13", "ean_8", "code_128", "upc_a", "upc_e"]
        const hasFormats = needed.some((f: string) => formats.includes(f))
        if (!hasFormats) return false

        const detector = new BarcodeDetectorClass({
          formats: needed.filter((f: string) => formats.includes(f)),
        })

        const video = videoRef.current!
        video.srcObject = stream
        video.setAttribute("playsinline", "true")
        await video.play()

        setScanMethod("nativo")
        setLoading(false)

        // Loop de detección con requestAnimationFrame
        async function detectLoop() {
          if (cancelled || foundRef.current) return
          try {
            if (video.readyState >= 2) {
              const barcodes = await detector.detect(video)
              if (barcodes.length > 0 && !foundRef.current) {
                const code = barcodes[0].rawValue
                if (code) {
                  foundRef.current = true
                  if (navigator.vibrate) navigator.vibrate(100)
                  stream.getTracks().forEach(t => t.stop())
                  onResultRef.current(code)
                  return
                }
              }
            }
          } catch {
            // detect() puede fallar en algunos frames, ignorar
          }
          animFrameId = requestAnimationFrame(detectLoop)
        }
        detectLoop()
        return true
      } catch {
        return false
      }
    }

    async function startQuaggaFallback() {
      if (cancelled || !containerRef.current) return

      const Quagga = (await import("@ericblade/quagga2")).default
      if (cancelled) return

      Quagga.init(
        {
          inputStream: {
            type: "LiveStream",
            constraints: {
              facingMode: "environment",
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
            },
            target: containerRef.current,
          },
          decoder: {
            readers: [
              "ean_reader",
              "ean_8_reader",
              "code_128_reader",
              "upc_reader",
              "upc_e_reader",
            ],
          },
          locator: {
            patchSize: "large",
            halfSample: false,
          },
          frequency: 15,
          locate: true,
        },
        (err: unknown) => {
          if (cancelled) return
          if (err) {
            console.error("Quagga init error:", err)
            setError(err instanceof Error ? err.message : "No se pudo iniciar la cámara. Verifica los permisos.")
            setLoading(false)
            return
          }

          Quagga.start()
          setScanMethod("quagga")
          setLoading(false)
        }
      )

      // Filtro de confianza: solo aceptar si el código se detecta 2 veces seguidas
      let lastCode = ""
      let confirmCount = 0

      Quagga.onDetected((result) => {
        if (cancelled || foundRef.current) return
        const code = result?.codeResult?.code
        if (!code) return

        // Validar confianza: necesitamos 2 lecturas iguales consecutivas
        if (code === lastCode) {
          confirmCount++
        } else {
          lastCode = code
          confirmCount = 1
        }

        if (confirmCount >= 2) {
          foundRef.current = true
          if (navigator.vibrate) navigator.vibrate(100)
          Quagga.stop()
          onResultRef.current(code)
        }
      })
    }

    const timer = setTimeout(async () => {
      if (cancelled) return

      try {
        // Intentar BarcodeDetector nativo primero
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
          },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        streamRef.current = stream
        const nativeWorked = await startNativeDetector(stream)

        if (!nativeWorked) {
          // Nativo no disponible, parar stream y usar Quagga2
          stream.getTracks().forEach(t => t.stop())
          streamRef.current = null
          await startQuaggaFallback()
        }
      } catch (err) {
        console.error("Scanner error:", err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo iniciar la cámara. Verifica los permisos.")
          setLoading(false)
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (animFrameId) cancelAnimationFrame(animFrameId)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      import("@ericblade/quagga2").then(m => m.default.stop()).catch(() => {})
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
          <p className="font-bold uppercase text-sm">Error de C&aacute;mara</p>
          <p className="text-xs text-slate-400">{error}</p>
          <Button onClick={onClose} variant="destructive" className="w-full max-w-xs">Cerrar</Button>
        </div>
      ) : (
        <>
          {/* Video element para BarcodeDetector nativo */}
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: scanMethod === "nativo" ? "block" : "none",
            }}
          />
          {/* Container para Quagga2 fallback */}
          <div
            ref={containerRef}
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              overflow: "hidden",
              display: scanMethod === "quagga" || scanMethod === "" ? "block" : "none",
            }}
          />
        </>
      )}
      {/* Guía visual central */}
      {!error && !loading && (
        <>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "80%", maxWidth: 320, height: 120,
            border: "3px solid rgba(255,255,255,0.7)",
            borderRadius: 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
            pointerEvents: "none", zIndex: 10,
          }} />
          {/* Indicador de método */}
          <div style={{
            position: "absolute", top: 60, left: 0, right: 0,
            display: "flex", justifyContent: "center", zIndex: 11,
          }}>
            <span style={{
              background: scanMethod === "nativo" ? "rgba(16,185,129,0.8)" : "rgba(139,92,246,0.8)",
              color: "white", fontSize: 9, fontWeight: 800,
              padding: "4px 12px", borderRadius: 20, textTransform: "uppercase",
              letterSpacing: 1,
            }}>
              {scanMethod === "nativo" ? "Detección nativa" : "Quagga2"}
            </span>
          </div>
        </>
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

async function fetchProductFromApi(barcode: string) {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
    const data = await response.json()
    if (data.status === 1) {
      return { 
        found: true, 
        nombre: data.product.product_name_es || data.product.product_name, 
        marca: data.product.brands 
      }
    }
    return { found: false }
  } catch (e) { return { found: false } }
}

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

        const apiData = await fetchProductFromApi(code)
        setFormData(prev => ({
            ...prev,
            codigo_barras: code,
            nombre: apiData.found ? `${apiData.marca ? apiData.marca + ' ' : ''}${apiData.nombre}` : prev.nombre,
            emoji: apiData.found ? "🥫" : "📦"
        }))
        if (apiData.found) toast.success("Identificado")
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