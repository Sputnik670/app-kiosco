"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  QrCode,
  Loader2,
  CheckCircle2,
  XCircle,
  Timer,
  X,
  RefreshCw
} from "lucide-react"
import { toast } from "sonner"
import {
  createMercadoPagoOrderAction,
  checkMercadoPagoPaymentStatusAction,
  cancelMercadoPagoOrderAction,
} from "@/lib/actions/mercadopago.actions"

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

type MercadoPagoQRState = "loading" | "waiting" | "confirmed" | "failed" | "expired" | "error"

/**
 * Item del carrito en el formato que espera el RPC `process_sale_from_webhook`.
 * Se persiste como `cart_snapshot` en `mercadopago_orders` al generar el QR
 * para que el webhook pueda crear la sale aunque el dialog se cierre antes.
 */
export interface MPCartItem {
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
}

interface MercadoPagoQRDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  saleId: string
  amount: number
  branchId: string
  cashRegisterId: string
  cartItems: MPCartItem[]
  onPaymentConfirmed: () => void
  onPaymentFailed: () => void
}

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

const POLLING_INTERVAL_MS = 2000 // 2 segundos
const TOTAL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutos
const AUTO_CLOSE_DELAY_MS = 3000 // 3 segundos para cierre automático

// ───────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────

export function MercadoPagoQRDialog({
  open,
  onOpenChange,
  saleId,
  amount,
  branchId,
  cashRegisterId,
  cartItems,
  onPaymentConfirmed,
  onPaymentFailed,
}: MercadoPagoQRDialogProps) {
  // Estados principales
  const [state, setState] = useState<MercadoPagoQRState>("loading")
  const [orderId, setOrderId] = useState<string | null>(null)
  const [qrData, setQrData] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)

  // Referencias para limpiar efectos
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  // ───────────────────────────────────────────────────────────────────────────────
  // EFECTOS
  // ───────────────────────────────────────────────────────────────────────────────

  // Crear orden QR cuando el dialog se abre
  useEffect(() => {
    if (!open) return

    const createOrder = async () => {
      setState("loading")
      setOrderId(null)
      setQrData(null)
      setErrorMessage(null)
      setExpiresAt(null)

      const result = await createMercadoPagoOrderAction(
        saleId,
        amount,
        "Venta kiosco",
        branchId,
        cashRegisterId,
        cartItems
      )

      if (!result.success) {
        setErrorMessage(result.error || "Error desconocido al crear QR")
        setState("error")
        return
      }

      setOrderId(result.orderId || null)
      setQrData(result.qrData || null)
      setExpiresAt(result.expiresAt || null)
      setState("waiting")
      startTimeRef.current = Date.now()

      // Iniciar timeout de 5 min
      timeoutRef.current = setTimeout(() => {
        if (orderId) {
          cancelOrder(orderId)
        }
        setState("expired")
        setErrorMessage("El código QR expiró. Por favor, intenta nuevamente.")
      }, TOTAL_TIMEOUT_MS)

      // Iniciar polling de estado
      if (result.orderId) {
        startPolling(result.orderId)
      }
    }

    createOrder()

    return () => {
      // Cleanup al cerrar el dialog
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [open, saleId, amount, branchId])

  // Timer countdown
  useEffect(() => {
    if (state !== "waiting" || !expiresAt) return

    const updateTimer = () => {
      const now = Date.now()
      const expiryTime = new Date(expiresAt).getTime()
      const remaining = Math.max(0, expiryTime - now)

      setTimeRemaining(remaining)

      if (remaining <= 0) {
        if (timerRef.current) clearTimeout(timerRef.current)
      }
    }

    updateTimer()
    timerRef.current = setInterval(updateTimer, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [state, expiresAt])

  // ───────────────────────────────────────────────────────────────────────────────
  // FUNCIONES
  // ───────────────────────────────────────────────────────────────────────────────

  const startPolling = useCallback((id: string) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)

    pollingIntervalRef.current = setInterval(async () => {
      const result = await checkMercadoPagoPaymentStatusAction(id)

      if (!result.success) {
        // Error en polling, pero continuar intentando
        return
      }

      if (result.status === "confirmed") {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setState("confirmed")

        // Auto-cerrar después de 3 segundos
        setTimeout(() => {
          onPaymentConfirmed()
          onOpenChange(false)
        }, AUTO_CLOSE_DELAY_MS)
      } else if (result.status === "failed") {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setState("failed")
        setErrorMessage("El pago fue rechazado. Por favor, intenta nuevamente.")
      } else if (result.status === "expired") {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setState("expired")
        setErrorMessage("El código QR expiró. Por favor, genera uno nuevo.")
      }
    }, POLLING_INTERVAL_MS)
  }, [onPaymentConfirmed, onOpenChange])

  const cancelOrder = async (id: string) => {
    const result = await cancelMercadoPagoOrderAction(id)
    if (!result.success) {
      console.error("Error cancelando orden:", result.error)
    }
  }

  const handleCancel = async () => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (timerRef.current) clearTimeout(timerRef.current)

    if (orderId) {
      await cancelOrder(orderId)
    }

    onPaymentFailed()
    onOpenChange(false)
  }

  const handleRetry = () => {
    onOpenChange(false)
    onPaymentFailed()
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // FORMATTERS
  // ───────────────────────────────────────────────────────────────────────────────

  const formatAmount = (num: number) => {
    return `$${num.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor((ms / 1000) % 60)
    const minutes = Math.floor(ms / 1000 / 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // RENDER CONTENT POR ESTADO
  // ───────────────────────────────────────────────────────────────────────────────

  const renderContent = () => {
    switch (state) {
      case "loading":
        return (
          <div className="flex flex-col items-center justify-center py-12 gap-4 px-6">
            <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600 animate-spin" />
            <p className="text-xs sm:text-sm font-bold text-slate-600 uppercase">
              Generando código QR...
            </p>
          </div>
        )

      case "waiting":
        return (
          <div className="flex flex-col items-center justify-center gap-4 py-4 px-6 sm:gap-6 sm:py-6">
            {/* Monto */}
            <div className="text-center w-full">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Total a pagar
              </p>
              <p className="text-3xl sm:text-4xl font-black text-slate-900">
                {formatAmount(amount)}
              </p>
            </div>

            {/* QR Code - Placeholder SVG */}
            {qrData && (
              <div className="bg-white p-3 sm:p-6 rounded-2xl border-2 border-slate-200 shadow-sm max-w-xs w-full">
                <QRCodeDisplay qrData={qrData} />
              </div>
            )}

            {/* Instrucciones */}
            <div className="text-center space-y-1 sm:space-y-2 w-full">
              <p className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase">
                Escanea con tu celular
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">
                Abre Mercado Pago y escanea el código QR
              </p>
            </div>

            {/* Timer prominently displayed */}
            <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-blue-600 bg-blue-50 px-4 py-3 sm:py-4 rounded-lg w-full justify-center border-2 border-blue-100">
              <Timer className="h-5 w-5 flex-shrink-0" />
              <span className="font-black text-lg sm:text-xl">{formatTime(timeRemaining)}</span>
            </div>

            {/* Spinner */}
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 animate-spin" />

            {/* Cancel Button */}
            <Button
              variant="outline"
              onClick={handleCancel}
              className="w-full border-2 border-slate-300 text-slate-600 hover:bg-slate-50 min-h-[44px] text-sm font-bold"
            >
              Cancelar
            </Button>
          </div>
        )

      case "confirmed":
        return (
          <div className="flex flex-col items-center justify-center py-8 sm:py-12 gap-4 sm:gap-6 px-6">
            <CheckCircle2 className="h-12 w-12 sm:h-16 sm:w-16 text-green-500 animate-bounce" />
            <div className="text-center space-y-2">
              <p className="text-sm sm:text-base font-black text-slate-900 uppercase">
                Pago confirmado
              </p>
              <p className="text-xs sm:text-sm text-slate-500">
                {formatAmount(amount)} - Procesando...
              </p>
            </div>
          </div>
        )

      case "failed":
      case "expired":
        return (
          <div className="flex flex-col items-center justify-center py-8 sm:py-12 gap-4 sm:gap-6 px-6">
            <XCircle className="h-12 w-12 sm:h-16 sm:w-16 text-red-500" />
            <div className="text-center space-y-2">
              <p className="text-sm sm:text-base font-black text-slate-900 uppercase">
                {state === "expired" ? "Código expirado" : "Pago rechazado"}
              </p>
              {errorMessage && (
                <p className="text-xs sm:text-sm text-slate-600">{errorMessage}</p>
              )}
            </div>
            <Button
              onClick={handleRetry}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase text-sm min-h-[44px]"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Intentar nuevamente
            </Button>
          </div>
        )

      case "error":
        return (
          <div className="flex flex-col items-center justify-center py-8 sm:py-12 gap-4 sm:gap-6 px-6">
            <XCircle className="h-12 w-12 sm:h-16 sm:w-16 text-red-500" />
            <div className="text-center space-y-2">
              <p className="text-sm sm:text-base font-black text-slate-900 uppercase">
                Error al crear QR
              </p>
              {errorMessage && (
                <p className="text-xs sm:text-sm text-slate-600">{errorMessage}</p>
              )}
            </div>
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full bg-slate-600 hover:bg-slate-700 text-white font-bold uppercase text-sm min-h-[44px]"
            >
              Cerrar
            </Button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm p-0 overflow-hidden border-0 rounded-3xl"
        showCloseButton={false}
      >
        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// QR CODE DISPLAY COMPONENT
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Renderiza el código QR real usando qrcode.react.
 * El qrData es el string EMVCo que devuelve la API de Mercado Pago
 * y que la app de MP escanea para iniciar el pago.
 */
function QRCodeDisplay({ qrData }: { qrData: string }) {
  // Lazy import para que no rompa si qrcode.react no está instalado aún
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [QRModule, setQRModule] = useState<any>(null)

  useEffect(() => {
    import('qrcode.react')
      .then((mod) => {
        setQRModule(mod)
      })
      .catch(() => {
        // Si no está instalado, se queda en null y se muestra el fallback
        console.warn('qrcode.react no instalado — mostrando fallback')
      })
  }, [])

  if (QRModule) {
    const QRCodeSVG = QRModule.QRCodeSVG
    return (
      <div className="flex justify-center">
        <QRCodeSVG
          value={qrData}
          size={220}
          level="M"
          includeMargin={false}
          bgColor="#FFFFFF"
          fgColor="#000000"
        />
      </div>
    )
  }

  // Fallback si qrcode.react no está disponible
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <QrCode className="h-16 w-16 text-blue-600" />
      <p className="text-xs text-slate-500 text-center">
        Código QR generado. Escaneá con Mercado Pago.
      </p>
      <div className="text-center text-[7px] font-mono text-slate-400 max-h-12 overflow-hidden break-all px-2">
        {qrData.substring(0, 80)}...
      </div>
    </div>
  )
}
