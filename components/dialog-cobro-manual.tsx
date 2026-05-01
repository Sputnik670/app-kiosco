"use client"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 💳 DIALOG DE COBRO MANUAL
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Se muestra en caja cuando el cajero selecciona uno de los 3 métodos manuales:
 *   - posnet_mp     → Acerca el posnet al cliente (por la reja)
 *   - qr_static_mp  → Muestra el QR fijo (imagen ampliada)
 *   - transfer_alias→ Muestra el alias/CBU para que transfiera
 *
 * El cajero verifica el cobro en su app (MP / banco) y toca "Ya cobré"
 * para confirmar la venta. Si algo falla, toca "Cancelar" y no se registra.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  CreditCard,
  QrCode,
  Banknote,
  Copy,
  Check,
  Loader2,
  CheckCircle2,
} from "lucide-react"
import type { PaymentMethodsConfig } from "@/lib/actions/payment-methods.actions"

export type ManualPaymentMethod = "posnet_mp" | "qr_static_mp" | "transfer_alias"

interface DialogCobroManualProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  method: ManualPaymentMethod | null
  amount: number
  config: PaymentMethodsConfig | null
  onConfirmed: () => void | Promise<void>
  processing?: boolean
}

export function DialogCobroManual({
  open,
  onOpenChange,
  method,
  amount,
  config,
  onConfirmed,
  processing = false,
}: DialogCobroManualProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const formattedAmount = `$${amount.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(label)
      toast.success(`${label} copiado`)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast.error("No se pudo copiar al portapapeles")
    }
  }

  const handleClose = () => {
    if (!processing) {
      onOpenChange(false)
    }
  }

  const title =
    method === "posnet_mp"
      ? "Cobro con Posnet MP"
      : method === "qr_static_mp"
      ? "Cobro con QR fijo"
      : "Cobro por transferencia"

  const Icon =
    method === "posnet_mp"
      ? CreditCard
      : method === "qr_static_mp"
      ? QrCode
      : Banknote

  const accentColor =
    method === "posnet_mp"
      ? "indigo"
      : method === "qr_static_mp"
      ? "emerald"
      : "violet"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b">
          <div className="flex items-center gap-3">
            <div
              className={
                accentColor === "indigo"
                  ? "h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center"
                  : accentColor === "emerald"
                  ? "h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center"
                  : "h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center"
              }
            >
              <Icon
                className={
                  accentColor === "indigo"
                    ? "h-5 w-5 text-indigo-600"
                    : accentColor === "emerald"
                    ? "h-5 w-5 text-emerald-600"
                    : "h-5 w-5 text-violet-600"
                }
              />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-black uppercase tracking-tight">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Total a cobrar: <span className="font-black text-slate-900">{formattedAmount}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* POSNET MP */}
          {method === "posnet_mp" && (
            <div className="space-y-3">
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                <p className="text-[11px] font-black uppercase text-indigo-700 tracking-widest mb-2">
                  Pasos
                </p>
                <ol className="space-y-2 text-sm text-slate-700 list-decimal list-inside">
                  <li>Acercale el posnet al cliente (por la reja si aplica).</li>
                  <li>Cargá el monto <strong>{formattedAmount}</strong> en el posnet.</li>
                  <li>Esperá a que aparezca <strong>aprobado</strong> en la pantalla.</li>
                  <li>Recién ahí tocá <strong>&quot;Ya cobré&quot;</strong>.</li>
                </ol>
              </div>

              {config?.posnet_mp_label && (
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                    Equipo
                  </p>
                  <p className="text-sm font-bold text-slate-900">{config.posnet_mp_label}</p>
                </div>
              )}

              {config?.posnet_mp_notes && (
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                    Notas internas
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">
                    {config.posnet_mp_notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* QR FIJO */}
          {method === "qr_static_mp" && (
            <div className="space-y-3">
              {config?.qr_static_image_url ? (
                <div className="bg-white border-4 border-emerald-200 rounded-2xl p-3 flex items-center justify-center">
                  <Image
                    src={config.qr_static_image_url}
                    alt="QR fijo de Mercado Pago"
                    width={320}
                    height={320}
                    className="max-w-full h-auto rounded-xl"
                    unoptimized
                    priority
                  />
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
                  No hay una imagen de QR configurada. Configurala en Ajustes &gt; Métodos de cobro.
                </div>
              )}

              {config?.qr_static_holder_name && (
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                    Titular
                  </p>
                  <p className="text-sm font-bold text-slate-900">
                    {config.qr_static_holder_name}
                  </p>
                </div>
              )}

              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                <p className="text-[11px] font-black uppercase text-emerald-700 tracking-widest mb-2">
                  Recordale al cliente
                </p>
                <p className="text-sm text-slate-700">
                  Que cargue exactamente <strong>{formattedAmount}</strong> en Mercado Pago.
                </p>
                {config?.qr_static_instructions && (
                  <>
                    <Separator className="my-2" />
                    <p className="text-sm text-slate-700 whitespace-pre-line">
                      {config.qr_static_instructions}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TRANSFERENCIA / ALIAS */}
          {method === "transfer_alias" && (
            <div className="space-y-3">
              {config?.alias_value && (
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                    Alias
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 block bg-violet-50 border border-violet-200 rounded-xl px-3 py-3 text-base font-black text-violet-900 select-all font-mono">
                      {config.alias_value}
                    </code>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-11 w-11 shrink-0"
                      onClick={() => handleCopy(config.alias_value!, "Alias")}
                      aria-label="Copiar alias"
                    >
                      {copiedField === "Alias" ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {config?.alias_cbu_cvu && (
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                    CBU / CVU
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 block bg-violet-50 border border-violet-200 rounded-xl px-3 py-3 text-xs font-bold text-violet-900 select-all font-mono break-all">
                      {config.alias_cbu_cvu}
                    </code>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-11 w-11 shrink-0"
                      onClick={() => handleCopy(config.alias_cbu_cvu!, "CBU/CVU")}
                      aria-label="Copiar CBU o CVU"
                    >
                      {copiedField === "CBU/CVU" ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {(config?.alias_titular_name || config?.alias_bank_name) && (
                <div className="grid grid-cols-2 gap-2">
                  {config?.alias_titular_name && (
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                        Titular
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        {config.alias_titular_name}
                      </p>
                    </div>
                  )}
                  {config?.alias_bank_name && (
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                        Banco
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        {config.alias_bank_name}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
                <p className="text-[11px] font-black uppercase text-violet-700 tracking-widest mb-2">
                  Importante
                </p>
                <p className="text-sm text-slate-700">
                  Confirmá la transferencia en tu app del banco o MP antes de tocar &quot;Ya cobré&quot;.
                  El monto debe ser <strong>{formattedAmount}</strong>.
                </p>
                {config?.alias_instructions && (
                  <>
                    <Separator className="my-2" />
                    <p className="text-sm text-slate-700 whitespace-pre-line">
                      {config.alias_instructions}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-5 pt-3 border-t bg-slate-50 gap-2 flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={processing}
            className="flex-1 h-14 rounded-2xl font-black uppercase text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => onConfirmed()}
            disabled={processing}
            className={
              "flex-1 h-14 rounded-2xl font-black uppercase text-xs text-white " +
              (accentColor === "indigo"
                ? "bg-indigo-600 hover:bg-indigo-700"
                : accentColor === "emerald"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-violet-600 hover:bg-violet-700")
            }
          >
            {processing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                <span>Ya cobré</span>
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
