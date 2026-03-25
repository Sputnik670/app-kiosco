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
import { Loader2, Package, Plus, DollarSign, ScanBarcode, X, AlertCircle, Camera } from "lucide-react"
import { toast } from "sonner"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { checkExistingProductAction, createFullProductAction } from "@/lib/actions/product.actions"

// --- SCANNER v11: Foto nativa + html5-qrcode live como bonus ---
// El video stream de getUserMedia en muchos celulares NO activa autofocus,
// y por eso Quagga2, BarcodeDetector, WASM y html5-qrcode fallan todos.
// Solución: usar <input type="file" capture="environment"> que abre la
// cámara NATIVA del celular (con autofocus real) y luego decodificar la foto.
// El scan en vivo queda como intento adicional pero no como único camino.

// Decodifica un barcode desde un File/Blob de imagen usando html5-qrcode
async function decodeFromImage(file: File): Promise<string | null> {
  try {
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode")

    const scanner = new Html5Qrcode("decode-temp-container", {
      useBarCodeDetectorIfSupported: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
      ],
      verbose: false,
    })

    const result = await scanner.scanFileV2(file, /* showImage */ false)
    scanner.clear()
    return result.decodedText
  } catch {
    return null
  }
}

const SCANNER_CONTAINER_ID = "barcode-scanner-crear-producto"

function BarcodeScannerOverlay({ onResult, onClose }: { onResult: (code: string) => void, onClose: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [decodingPhoto, setDecodingPhoto] = useState(false)
  const onResultRef = useRef(onResult)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { onResultRef.current = onResult }, [onResult])

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  // Manejar foto tomada con cámara nativa
  const handlePhotoCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setDecodingPhoto(true)
    try {
      const code = await decodeFromImage(file)
      if (code) {
        if (navigator.vibrate) navigator.vibrate(100)
        // Parar scanner live si estaba corriendo
        const scanner = scannerRef.current
        if (scanner?.isScanning) {
          scanner.stop().catch(() => {})
        }
        onResultRef.current(code)
      } else {
        toast.error("No se detectó código de barras en la foto", {
          description: "Intentá sacar la foto más de cerca y con buena luz."
        })
      }
    } catch {
      toast.error("Error procesando la foto")
    } finally {
      setDecodingPhoto(false)
      // Reset input para poder seleccionar la misma foto
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [])

  // Intentar scan en vivo como bonus (puede no funcionar en todos los dispositivos)
  useEffect(() => {
    let cancelled = false

    const timer = setTimeout(async () => {
      if (cancelled) return
      const container = document.getElementById(SCANNER_CONTAINER_ID)
      if (!container) return

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode")
        if (cancelled) return

        const scanner = new Html5Qrcode(SCANNER_CONTAINER_ID, {
          useBarCodeDetectorIfSupported: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
          verbose: false,
        })
        scannerRef.current = scanner

        const containerWidth = container.clientWidth || 320
        const qrboxWidth = Math.min(Math.floor(containerWidth * 0.85), 350)
        const qrboxHeight = Math.floor(qrboxWidth * 0.45)

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: qrboxWidth, height: qrboxHeight },
            aspectRatio: 1.7778,
            disableFlip: true,
          },
          (decodedText) => {
            if (cancelled) return
            if (navigator.vibrate) navigator.vibrate(100)
            scanner.stop().then(() => scanner.clear()).catch(() => {})
            onResultRef.current(decodedText)
          },
          () => {}
        )

        // Pedir autofocus continuo al track de video
        try {
          const videoEl = container.querySelector("video")
          if (videoEl?.srcObject && videoEl.srcObject instanceof MediaStream) {
            const track = videoEl.srcObject.getVideoTracks()[0]
            if (track) {
              // HD + autofocus
              const constraints: MediaTrackConstraints = {
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
              // focusMode puede no estar en los types estándar pero funciona en runtime
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const capabilities = track.getCapabilities?.() as any
              if (capabilities?.focusMode?.includes?.("continuous")) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ;(constraints as any).focusMode = "continuous"
              }
              await track.applyConstraints(constraints)
            }
          }
        } catch { /* upgrade es opcional */ }

        if (!cancelled) setLoading(false)
      } catch (err) {
        console.error("Scanner live init error:", err)
        // No mostrar error — el usuario tiene el botón de foto como alternativa
        if (!cancelled) setLoading(false)
      }
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
      const scanner = scannerRef.current
      if (scanner) {
        const isScanning = scanner.isScanning || scanner.getState?.() === 2
        if (isScanning) {
          scanner.stop().then(() => scanner.clear()).catch(() => {})
        }
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const overlay = (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#000" }}>
      {/* Container oculto para decodeSingle */}
      <div id="decode-temp-container" style={{ display: "none" }} />

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50 text-white gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-[10px] font-bold uppercase">Iniciando Lector...</p>
        </div>
      )}

      {decodingPhoto && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-[100001] text-white gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-green-500" />
          <p className="text-[10px] font-bold uppercase">Leyendo código...</p>
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
        <div id={SCANNER_CONTAINER_ID} style={{ width: "100%", height: "100%" }} />
      )}

      {/* Input oculto para captura de foto nativa */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoCapture}
        style={{ display: "none" }}
      />

      {/* Botones inferiores */}
      <div style={{
        position: "absolute", bottom: 24, left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        zIndex: 100000, padding: "0 20px",
      }}>
        {/* Botón principal: sacar foto */}
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full max-w-xs h-14 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-black uppercase text-xs shadow-2xl gap-2"
          disabled={decodingPhoto}
        >
          <Camera className="h-5 w-5" />
          Sacar Foto del Código
        </Button>
        <Button
          variant="destructive"
          className="rounded-full px-10 shadow-xl font-bold uppercase text-[10px]"
          onClick={onClose}
        >
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