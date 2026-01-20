"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Loader2, X, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface QRFichajeScannerProps {
  onQRScanned?: (data: any) => void
  onClose: () => void
  isOpen: boolean
}

export default function QRFichajeScanner({ onClose, isOpen, onQRScanned }: QRFichajeScannerProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isProcessingRef = useRef(false)

  // ID único para el contenedor del video
  const scannerId = "reader-fichaje-v2"

  useEffect(() => {
    if (!isOpen) return

    // 1. Limpieza preventiva de instancias anteriores
    if (scannerRef.current?.isScanning) {
      scannerRef.current.stop().catch(console.error)
    }

    // 2. Retraso crítico para Vercel/Móviles:
    // Esperamos 500ms a que el Dialog termine de renderizarse en el DOM
    // antes de inyectar el video. Esto evita el error "Element not found" o "Camera unavailable".
    const initTimer = setTimeout(async () => {
      try {
        // Asegurarse de que el elemento existe antes de instanciar
        if (!document.getElementById(scannerId)) {
          throw new Error("El contenedor de video no está listo.")
        }

        const html5QrCode = new Html5Qrcode(scannerId)
        scannerRef.current = html5QrCode

        const config = {
          fps: 20, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
        }

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if (isProcessingRef.current) return
            handleScanSuccess(decodedText)
          },
          () => { 
            // Error silencioso de frame (normal mientras busca)
          }
        )
        setLoading(false)
      } catch (err: any) {
        console.error("Error crítico scanner:", err)
        // Solo mostramos error si no fue cancelado por el usuario
        if (isOpen) {
          setError("No se pudo iniciar la cámara. Por favor cierra y vuelve a intentar.")
          setLoading(false)
        }
      }
    }, 500)

    // Cleanup al cerrar
    return () => {
      clearTimeout(initTimer) // Cancelar inicio si el usuario cierra rápido
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error)
        scannerRef.current.clear()
      }
    }
  }, [isOpen])

  const handleScanSuccess = async (text: string) => {
    isProcessingRef.current = true
    let redirectUrl: string | null = null

    try {
      if (text.includes('/fichaje?')) {
        redirectUrl = text.substring(text.indexOf('/fichaje'))
      } else if (text.startsWith('/fichaje')) {
        redirectUrl = text
      } else {
        const data = JSON.parse(text)
        if (data.sucursal_id && data.tipo) {
          redirectUrl = `/fichaje?sucursal_id=${data.sucursal_id}&tipo=${data.tipo}`
        }
      }
    } catch (e) {
      console.error("Error parseando QR", e)
    }

    if (redirectUrl) {
      toast.success("Código detectado")
      
      if (onQRScanned) {
        onQRScanned({ text })
      }

      await stopAndClose()
      router.push(redirectUrl)
    } else {
      isProcessingRef.current = false
      toast.error("QR no válido para fichaje")
    }
  }

  const stopAndClose = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      }
    } catch (err) {
      console.error("Error al detener:", err)
    } finally {
      onClose()
    }
  }

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md p-6 bg-slate-900 text-white border-none">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
            <p className="font-bold text-lg">Cámara no disponible</p>
            <p className="text-sm text-slate-400">{error}</p>
            <Button onClick={onClose} variant="outline" className="w-full text-black bg-white">Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={stopAndClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black border-none">
        <div className="relative flex flex-col items-center justify-center min-h-[450px]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
              <div className="text-center text-white space-y-4">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-500" />
                <p className="text-sm font-medium">Conectando cámara...</p>
              </div>
            </div>
          )}
          
          {/* DIV CRÍTICO: html5-qrcode inyecta el video aquí */}
          <div id={scannerId} className="w-full h-full" />
          
          <div className="absolute bottom-8 w-full flex flex-col items-center gap-4 z-50 pointer-events-none">
            <Button 
              onClick={stopAndClose} 
              variant="destructive" 
              className="rounded-full px-10 shadow-2xl pointer-events-auto h-12 font-bold"
            >
              <X className="mr-2 h-5 w-5" /> Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}