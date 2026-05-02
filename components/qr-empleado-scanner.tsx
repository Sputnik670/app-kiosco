"use client"

/**
 * QR EMPLEADO SCANNER — Fichaje por tarjeta personal (nuevo flujo 2026-04-23)
 *
 * Lee la tarjeta QR de un empleado (UUID único por membership), dispara la action
 * processEmployeeQRScanAction y muestra el resultado.
 *
 * GUARDRAIL OFFLINE (Opción B, sesión 2-may-2026):
 * El fichaje por tarjeta requiere conexión obligatoria — processEmployeeQRScanAction
 * decide entrada/salida según el estado actual del empleado en la DB del server.
 * Sin conexión NO guardamos offline (riesgo de duplicar entradas o cerrar turnos
 * por error). Mostramos pantalla "Sin conexión" con botón Reintentar.
 * Si en piloto se reporta como pain point, escalar a Opción A (offline real).
 */

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Loader2, X, AlertCircle, CheckCircle2, LogIn, LogOut, WifiOff } from "lucide-react"
import { toast } from "sonner"
import {
  processEmployeeQRScanAction,
  type ProcessEmployeeQRScanResult,
} from "@/lib/actions/attendance.actions"
import { useOnlineStatus } from "@/hooks/use-online-status"

interface QREmpleadoScannerProps {
  isOpen: boolean
  onClose: () => void
  branchId: string
  onResult?: (result: ProcessEmployeeQRScanResult) => void
  showHoursOnExit?: boolean
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ViewState =
  | { kind: "scanning" }
  | { kind: "processing" }
  | { kind: "result"; result: ProcessEmployeeQRScanResult }
  | { kind: "offline" }

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
  const [reconnecting, setReconnecting] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null)
  const isProcessingRef = useRef(false)
  const scannerId = "reader-empleado-qr-v1"

  // Detección de conexión: el fichaje requiere red obligatoriamente porque
  // processEmployeeQRScanAction es server-side stateful (decide entrada/salida
  // según el estado actual del empleado en DB). Sin red, mostramos un mensaje
  // claro y pedimos reintentar.
  const { isOnline } = useOnlineStatus({ pingServer: true, pingInterval: 30000 })

  // Reset al abrir el dialog: decide vista inicial según conexión.
  useEffect(() => {
    if (!isOpen) return
    setError(null)
    isProcessingRef.current = false

    if (!isOnline) {
      setView({ kind: "offline" })
      setCameraLoading(false)
      return
    }

    setView({ kind: "scanning" })
    setCameraLoading(true)
  }, [isOpen, isOnline])

  // Cámara: solo se inicializa cuando estamos en vista "scanning".
  useEffect(() => {
    if (!isOpen) return
    if (view.kind !== "scanning") return

    if (scannerRef.current?.isScanning) {
      scannerRef.current.stop().catch(console.error)
    }

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
  }, [isOpen, branchId, view.kind])

  const retryConnection = async () => {
    setReconnecting(true)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      await fetch("/icon.svg", {
        method: "HEAD",
        cache: "no-store",
        mode: "no-cors",
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      toast.success("Conexión recuperada")
      setView({ kind: "scanning" })
      setCameraLoading(true)
    } catch {
      toast.error("Sigue sin conexión", {
        description: "Verificá tu wifi o datos móviles",
      })
    } finally {
      setReconnecting(false)
    }
  }

  const handleScan = async (text: string) => {
    let qrCode: string | null = null
    const trimmed = text.trim()

    if (UUID_RE.test(trimmed)) {
      qrCode = trimmed
    } else {
      const match = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
      if (match) qrCode = match[0]
    }

    if (!qrCode) {
      toast.error("QR no válido", { description: "Escaneá una tarjeta de empleado" })
      return
    }

    isProcessingRef.current = true

    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop()
      }
    } catch (err) {
      console.error("Error deteniendo cámara:", err)
    }

    // Guard tardío: red puede haber caído entre apertura del dialog y el scan.
    if (!isOnline) {
      setView({ kind: "offline" })
      isProcessingRef.current = false
      return
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
                <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center ${isEntry ? "bg-green-100" : "bg-blue-100"}`}>
                  {isEntry ? <LogIn className="h-10 w-10 text-green-600" /> : <LogOut className="h-10 w-10 text-blue-600" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase">{isEntry ? "Turno iniciado" : "Turno finalizado"}</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{r.employeeName}</p>
                </div>
                {isExit && showHoursOnExit && r.minutesWorked != null && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase">Horas trabajadas</p>
                    <p className="text-3xl font-black text-slate-900 mt-1">{formatDuration(r.minutesWorked)}</p>
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
                  setView({ kind: "scanning" })
                  isProcessingRef.current = false
                  setCameraLoading(true)
                  setTimeout(() => window.location.reload(), 100)
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

  if (view.kind === "offline") {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md p-6 bg-slate-900 text-white border-none">
          <div className="text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-amber-500/15 flex items-center justify-center">
              <WifiOff className="h-10 w-10 text-amber-400" />
            </div>
            <div>
              <p className="text-base font-bold uppercase tracking-wide text-amber-300">Sin conexión</p>
              <p className="text-sm text-slate-300 mt-2">El fichaje por tarjeta requiere internet para validar contra el servidor.</p>
              <p className="text-xs text-slate-400 mt-2">Conectate a wifi o datos móviles y volvé a intentar.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={onClose} variant="outline" className="flex-1 text-black bg-white">
                Cancelar
              </Button>
              <Button onClick={retryConnection} disabled={reconnecting} className="flex-1">
                {reconnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando…
                  </>
                ) : (
                  "Reintentar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

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
            <Button onClick={stopAndClose} variant="destructive" className="rounded-full px-10 shadow-2xl pointer-events-auto h-12 font-bold">
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
