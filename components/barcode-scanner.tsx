"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, X, AlertCircle } from "lucide-react"
// html5-qrcode is loaded dynamically inside useEffect to avoid adding ~200KB to the initial bundle

interface BarcodeScannerProps {
  onResult: (code: string) => void
  onClose: () => void
  scannerId?: string
}

export function BarcodeScanner({
  onResult,
  onClose,
  scannerId = "barcode-reader",
}: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null)
  const onResultRef = useRef(onResult)

  // Mantener ref actualizada sin disparar re-init del scanner
  useEffect(() => { onResultRef.current = onResult }, [onResult])

  useEffect(() => {
    let cancelled = false

    const initTimer = setTimeout(async () => {
      try {
        if (cancelled) return
        if (!document.getElementById(scannerId)) {
          throw new Error("El contenedor de video no está listo.")
        }

        const { Html5Qrcode } = await import("html5-qrcode")
        if (cancelled) return

        const html5QrCode = new Html5Qrcode(scannerId)
        scannerRef.current = html5QrCode

        // qrbox responsivo: 85% del ancho del contenedor
        const container = document.getElementById(scannerId)
        const containerWidth = container?.clientWidth || 300
        const qrboxWidth = Math.min(Math.floor(containerWidth * 0.85), 350)
        const qrboxHeight = Math.floor(qrboxWidth * 0.6)

        const config = {
          fps: 10,
          qrbox: { width: qrboxWidth, height: qrboxHeight },
          disableFlip: true,
        }

        if (cancelled) return

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if (navigator.vibrate) navigator.vibrate(100)
            onResultRef.current(decodedText)
          },
          () => {}
        )

        // Upgradear resolución del video track a HD después de arrancar
        try {
          const containerEl = document.getElementById(scannerId)
          const videoEl = containerEl?.querySelector("video")
          if (videoEl?.srcObject && videoEl.srcObject instanceof MediaStream) {
            const track = videoEl.srcObject.getVideoTracks()[0]
            if (track) {
              await track.applyConstraints({
                width: { ideal: 1280 },
                height: { ideal: 720 },
              })
            }
          }
        } catch (hdErr) {
          console.warn("No se pudo upgradear a HD:", hdErr)
        }

        if (!cancelled) setLoading(false)
      } catch (err) {
        console.error("Error iniciando scanner:", err)
        if (!cancelled) {
          setError("No se pudo iniciar la cámara. Verifica los permisos.")
          setLoading(false)
        }
      }
    }, 500)

    return () => {
      cancelled = true
      clearTimeout(initTimer)
      const scanner = scannerRef.current
      if (scanner?.isScanning) {
        scanner.stop().then(() => scanner.clear()).catch(console.error)
      }
    }
  }, [scannerId])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center bg-black min-h-[400px] p-6 text-white text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="font-bold">Error de cámara</p>
        <p className="text-sm text-slate-400">{error}</p>
        <Button onClick={onClose} variant="destructive" className="w-full">
          Cerrar
        </Button>
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
