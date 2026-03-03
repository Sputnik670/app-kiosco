"use client"

import { useState, useEffect, useRef } from "react"
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

  useEffect(() => {
    const initTimer = setTimeout(async () => {
      try {
        if (!document.getElementById(scannerId)) {
          throw new Error("El contenedor de video no está listo.")
        }

        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode")
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
            Html5QrcodeSupportedFormats.UPC_E,
          ],
        }

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if (navigator.vibrate) navigator.vibrate(100)
            onResult(decodedText)
          },
          () => {}
        )
        setLoading(false)
      } catch (err) {
        console.error("Error iniciando scanner:", err)
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
  }, [onResult, scannerId])

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
