"use client"

/**
 * QR EMPLEADO SCANNER — Fichaje por tarjeta personal (nuevo flujo 2026-04-23)
 *
 * Lee la tarjeta QR de un empleado (UUID único por membership), dispara la action
 * processEmployeeQRScanAction y muestra el resultado:
 * - Entrada: "Bienvenido, Juan. Turno iniciado."
 * - Salida (al dueño): "Hasta mañana, Juan. 8h 12min."
 * - Salida (al empleado): "Turno cerrado. Hasta mañana."
 *
 * DIFERENCIA CON qr-fichaje-scanner.tsx (viejo):
 * - Viejo: parsea QR como URL con sucursal_id+tipo. El empleado escanea desde su celular.
 * - Nuevo: parsea QR como UUID raw. El kiosco escanea la tarjeta del empleado.
 *
 * El scanner base (cámara + decoder) es el mismo patrón, solo cambia el parsing
 * del resultado y la action llamada.
 */

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Loader2, X, AlertCircle, CheckCircle2, LogIn, LogOut } from "lucide-react"
import { toast } from "sonner"
import {
  processEmployeeQRScanAction,
  type ProcessEmployeeQRScanResult,
} from "@/lib/actions/attendance.actions"

interface QREmpleadoScannerProps {
  isOpen: boolean
  onClose: () => void
  branchId: string                         // Sucursal donde se registra el fichaje
  onResult?: (result: ProcessEmployeeQRScanResult) => void
  showHoursOnExit?: boolean                // Default: true (para el dueño). Pasar false si lo ve el empleado.
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ViewState =
  | { kind: "scanning" }
  | { kind: "processing" }
  | { kind: "result"; result: ProcessEmployeeQRScanResult }

export default function QREmpleadoScanner({
  isOpen,
  onClose,
  branchId,
  onResult,
  showHoursOnExit = true,
}: QREmpleadoScannerProps) {
  const [view, setView] = useState<ViewState>({ kind: "scanning" })
  const [error, setError] = useState<string | null>(null)
  const [cameraLoading, setCameraLoading] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null)
  const isProcessingRef = useRef(false)
  const scannerId = "reader-empleado-qr-v1"

  useEffect(() => {
    if (!isOpen) return
    // Reset view al abrir
    setView({ kind: "scanning" })
    setError(null)
    setCameraLoading(true)
    isProcessingRef.current = false

    // Limpieza de instancias anteriores
    if (scannerRef.current?.isScanning) {
      scannerRef.current.stop().catch(console.error)
    }

    // Esperar al DOM del Dialog (mismo patrón que scanner viejo)
    const initTimer = setTimeout(async () => {
      try {
        if (!document.getElementById(scannerId)) {
          throw new Error("Contenedor de video no disponible")
        }

        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode")
        const html5QrCode = new Html5Qrcode(scannerId)
        scannerRef.current = html5QrCode

        const config = {
          fps: 20,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        }

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText: string) => {
            if (isProcessingRef.current) return
            handleScan(decodedText)
          },
          () => {
            // Frame sin detección, ignorar
          }
        )
        setCameraLoading(false)
      } catch (err: unknown) {
        console.error("Error scanner empleado:", err)
        if (isOpen) {
          setError("No se pudo iniciar la cámara. Cerrá y volvé a intentar.")
          setCameraLoading(false)
        }
      }
    }, 500)

    return () => {
      clearTimeout(initTimer)
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error)
        scannerRef.current.clear()
      }
    }
  }, [isOpen, branchId])

  const handleScan = async (text: string) => {
    // Parseamos UUID raw. También aceptamos el formato URL por si alguien pegó la URL
    // del sistema viejo — solo tomamos un UUID si está presente.
    let qrCode: string | null = null
    const trimmed = text.trim()

    if (UUID_RE.test(trimmed)) {
      qrCode = trimmed
    } else {
      // Intentar extraer UUID de una URL (permite re-uso si el QR fue generado
      // con formato URL como kioscoapp.com/fichaje?qr=UUID)
      const match = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
      if (match) qrCode = match[0]
    }

    if (!qrCode) {
      toast.error("QR no válido", { description: "Escaneá una tarjeta de empleado" })
      return
    }

    isProcessingRef.current = true

    // Detener cámara mientras procesamos
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop()
      }
    } catch (err) {
      console.error("Error deteniendo cámara:", err)
    }

    setView({ kind: "processing" })

    const result = await processEmployeeQRScanAction(qrCode, branchId)

    setView({ kind: "result", result })
    onResult?.(result)

    if (result.success) {
      const verb = result.action === "entrada" ? "abierto" : "cerrado"
      toast.success(`Turno ${verb}`, { description: result.employeeName })
    } else {
      toast.error("Fichaje rechazado", { description: result.error })
    }
  }

  const stopAndClose = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      }
    } catch (err) {
      console.error("Error cerrando scanner:", err)
    } finally {
      onClose()
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md p-6 bg-slate-900 text-white border-none">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
            <p className="font-bold text-lg">Cámara no disponible</p>
            <p className="text-sm text-slate-400">{error}</p>
            <Button onClick={onClose} variant="outline" className="w-full text-black bg-white">
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // RESULT VIEW
  if (view.kind === "result") {
    const r = view.result
    const isEntry = r.success && r.action === "entrada"
    const isExit = r.success && r.action === "salida"

    return (
      <Dialog open={isOpen} onOpenChange={stopAndClose}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white border-none">
          <div className="p-8 text-center space-y-4">
            {r.success ? (
              <>
                <div
                  className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center ${
                    isEntry ? "bg-green-100" : "bg-blue-100"
                  }`}
                >
                  {isEntry ? (
                    <LogIn className="h-10 w-10 text-green-600" />
                  ) : (
                    <LogOut className="h-10 w-10 text-blue-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase">
                    {isEntry ? "Turno iniciado" : "Turno finalizado"}
                  </p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{r.employeeName}</p>
                </div>

                {isExit && showHoursOnExit && r.minutesWorked != null && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase">Horas trabajadas</p>
                    <p className="text-3xl font-black text-slate-900 mt-1">
                      {formatDuration(r.minutesWorked)}
                    </p>
                  </div>
                )}

                {isExit && !showHoursOnExit && (
                  <p className="text-sm text-slate-600">Hasta mañana 👋</p>
                )}
              </>
            ) : (
              <>
                <div className="mx-auto w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="h-10 w-10 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-600 uppercase">Fichaje rechazado</p>
                  <p className="text-base text-slate-700 mt-2">{r.error}</p>
                </div>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => {
                  // Volver a escanear (resetea el scanner)
                  setView({ kind: "scanning" })
                  isProcessingRef.current = false
                  // Re-iniciar cámara
                  setCameraLoading(true)
                  setTimeout(() => window.location.reload(), 100) // reload simple por ahora
                }}
                variant="outline"
                className="flex-1"
              >
                Escanear otra
              </Button>
              <Button onClick={stopAndClose} className="flex-1">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Listo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // PROCESSING VIEW
  if (view.kind === "processing") {
    return (
      <Dialog open={isOpen} onOpenChange={stopAndClose}>
        <DialogContent className="sm:max-w-md p-8 bg-slate-900 text-white border-none">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-400" />
            <p className="font-bold text-lg">Registrando fichaje…</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // SCANNING VIEW
  return (
    <Dialog open={isOpen} onOpenChange={stopAndClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black border-none">
        <div className="relative flex flex-col items-center justify-center min-h-[500px]">
          {cameraLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
              <div className="text-center text-white space-y-4">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-500" />
                <p className="text-sm font-medium">Conectando cámara…</p>
              </div>
            </div>
          )}

          <div id={scannerId} className="w-full h-full" />

          <div className="absolute top-4 left-0 right-0 z-50 pointer-events-none">
            <div className="mx-4 bg-black/60 backdrop-blur rounded-xl p-3 text-center text-white">
              <p className="text-sm font-bold">Escaneá la tarjeta del empleado</p>
              <p className="text-xs text-slate-300 mt-1">Apuntá al QR, se detecta solo</p>
            </div>
          </div>

          <div className="absolute bottom-8 w-full flex flex-col items-center gap-4 z-50 pointer-events-none">
            <Button
              onClick={stopAndClose}
              variant="destructive"
              className="rounded-full px-10 shadow-2xl pointer-events-auto h-12 font-bold"
            >
              <X className="mr-2 h-5 w-5" />
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}
