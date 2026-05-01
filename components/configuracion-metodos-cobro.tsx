'use client'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 💰 CONFIGURACIÓN DE MÉTODOS DE COBRO — Posnet / QR fijo / Alias
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Panel del dueño para habilitar las 3 modalidades manuales de cobro que
 * complementan el QR dinámico de Mercado Pago:
 *
 *   1. Posnet MP (lector físico — el más común en kioscos con reja)
 *   2. QR fijo MP (imagen pegada afuera — ahorra acercar el lector)
 *   3. Alias / CVU (transferencia — la opción sin integración de hardware)
 *
 * La config es cross-sucursal (una por organización). Las 3 son opcionales y
 * se pueden activar independientemente.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  CreditCard,
  QrCode,
  Wallet,
  Upload,
  Trash2,
  Loader2,
  Check,
  Info,
  Copy,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import {
  deleteQrStaticImageAction,
  getPaymentMethodsConfigAction,
  savePaymentMethodsConfigAction,
  uploadQrStaticImageAction,
  type PaymentMethodsConfig,
} from '@/lib/actions/payment-methods.actions'

const EMPTY_CONFIG: PaymentMethodsConfig = {
  posnet_mp_enabled: false,
  posnet_mp_label: null,
  posnet_mp_notes: null,
  qr_static_enabled: false,
  qr_static_image_url: null,
  qr_static_image_path: null,
  qr_static_holder_name: null,
  qr_static_instructions: null,
  alias_enabled: false,
  alias_value: null,
  alias_cbu_cvu: null,
  alias_titular_name: null,
  alias_bank_name: null,
  alias_instructions: null,
}

export default function ConfiguracionMetodosCobro() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [config, setConfig] = useState<PaymentMethodsConfig>(EMPTY_CONFIG)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD
  // ─────────────────────────────────────────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    const result = await getPaymentMethodsConfigAction()
    if (result.success && result.config) {
      setConfig(result.config)
    } else {
      toast.error('No se pudo cargar la configuración', { description: result.error })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const setField = <K extends keyof PaymentMethodsConfig>(
    key: K,
    value: PaymentMethodsConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copiado`)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPLOAD DE QR FIJO
  // ─────────────────────────────────────────────────────────────────────────

  const handleFilePick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset para poder subir el mismo archivo dos veces
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar los 2 MB')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Formato no soportado. Usá PNG, JPEG o WebP.')
      return
    }

    setUploading(true)

    // Si había una imagen previa, la borramos al final (best-effort)
    const previousPath = config.qr_static_image_path

    const formData = new FormData()
    formData.append('file', file)

    const result = await uploadQrStaticImageAction(formData)

    if (result.success && result.url && result.path) {
      setConfig((prev) => ({
        ...prev,
        qr_static_image_url: result.url ?? null,
        qr_static_image_path: result.path ?? null,
      }))
      toast.success('Imagen subida')

      if (previousPath && previousPath !== result.path) {
        // Limpieza en background — no bloqueamos la UI
        deleteQrStaticImageAction(previousPath).catch(() => {
          /* noop */
        })
      }
    } else {
      toast.error('No se pudo subir la imagen', { description: result.error })
    }

    setUploading(false)
  }

  const handleDeleteImage = async () => {
    if (!config.qr_static_image_path) return
    if (!confirm('¿Eliminar la imagen del QR fijo?')) return

    setDeleting(true)
    const result = await deleteQrStaticImageAction(config.qr_static_image_path)
    if (result.success) {
      setConfig((prev) => ({
        ...prev,
        qr_static_image_url: null,
        qr_static_image_path: null,
        qr_static_enabled: false,
      }))
      toast.success('Imagen eliminada')
    } else {
      toast.error('No se pudo eliminar', { description: result.error })
    }
    setDeleting(false)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GUARDAR
  // ─────────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    const result = await savePaymentMethodsConfigAction(config)
    if (result.success) {
      toast.success('Configuración guardada', {
        description: 'Los métodos habilitados ya aparecen en la caja',
      })
    } else {
      toast.error('No se pudo guardar', { description: result.error })
    }
    setSaving(false)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in">
      <div className="space-y-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Wallet className="h-5 w-5 text-indigo-600" />
          Métodos de cobro manuales
        </h2>
        <p className="text-sm text-muted-foreground">
          Habilitá las opciones que usás en tu kiosco además del QR dinámico de Mercado Pago.
        </p>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1) POSNET FÍSICO DE MERCADO PAGO                                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Card className={config.posnet_mp_enabled ? 'border-indigo-300 bg-indigo-50/30' : ''}>
        <CardHeader className="flex flex-row items-start justify-between pb-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-indigo-600" />
              Posnet Mercado Pago
            </CardTitle>
            <CardDescription className="text-xs">
              Lector físico de MP. El típico que se acerca al cliente por la reja.
            </CardDescription>
          </div>
          <Switch
            checked={config.posnet_mp_enabled}
            onCheckedChange={(v) => setField('posnet_mp_enabled', v)}
            aria-label="Habilitar Posnet MP"
          />
        </CardHeader>

        {config.posnet_mp_enabled && (
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="posnet-label" className="text-xs">
                Nombre interno (opcional)
              </Label>
              <Input
                id="posnet-label"
                placeholder="Ej: Posnet azul de la reja"
                value={config.posnet_mp_label ?? ''}
                onChange={(e) => setField('posnet_mp_label', e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="posnet-notes" className="text-xs">
                Instrucciones para el empleado (opcional)
              </Label>
              <Textarea
                id="posnet-notes"
                placeholder="Ej: Pedir DNI si el monto supera $50.000"
                value={config.posnet_mp_notes ?? ''}
                onChange={(e) => setField('posnet_mp_notes', e.target.value)}
                maxLength={500}
                rows={2}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2) QR FIJO                                                            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Card className={config.qr_static_enabled ? 'border-emerald-300 bg-emerald-50/30' : ''}>
        <CardHeader className="flex flex-row items-start justify-between pb-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-4 w-4 text-emerald-600" />
              QR fijo de Mercado Pago
            </CardTitle>
            <CardDescription className="text-xs">
              La imagen del QR que tenés pegada afuera. Súbila acá y en caja se muestra grande para que el cliente escanee.
            </CardDescription>
          </div>
          <Switch
            checked={config.qr_static_enabled}
            onCheckedChange={(v) => setField('qr_static_enabled', v)}
            disabled={!config.qr_static_image_url}
            aria-label="Habilitar QR fijo"
          />
        </CardHeader>

        <CardContent className="space-y-3">
          {/* PREVIEW + UPLOAD */}
          <div className="space-y-2">
            <Label className="text-xs">Imagen del QR</Label>
            {config.qr_static_image_url ? (
              <div className="relative inline-block">
                <div className="relative w-40 h-40 bg-white rounded-lg border-2 border-slate-200 overflow-hidden">
                  <Image
                    src={config.qr_static_image_url}
                    alt="QR fijo"
                    fill
                    sizes="160px"
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute -top-2 -right-2 h-7 w-7 p-0 bg-red-100 hover:bg-red-200 text-red-600 rounded-full"
                  onClick={handleDeleteImage}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ) : (
              <div className="rounded-md border-2 border-dashed border-slate-300 p-6 text-center">
                <QrCode className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-3">
                  Subí una foto nítida del QR estático que te dio Mercado Pago.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFilePick}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Subir imagen
                </Button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileSelected}
            />
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              PNG, JPEG o WebP · máx 2 MB
            </p>
          </div>

          {config.qr_static_image_url && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <Label htmlFor="qr-holder" className="text-xs">
                  Nombre del titular (opcional)
                </Label>
                <Input
                  id="qr-holder"
                  placeholder="Ej: MARIA GOMEZ"
                  value={config.qr_static_holder_name ?? ''}
                  onChange={(e) => setField('qr_static_holder_name', e.target.value)}
                  maxLength={200}
                />
                <p className="text-[11px] text-muted-foreground">
                  Le sirve al cliente para confirmar que está pagando a vos antes de transferir.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qr-instructions" className="text-xs">
                  Mensaje para el cliente (opcional)
                </Label>
                <Textarea
                  id="qr-instructions"
                  placeholder="Ej: Escanealo con tu app de Mercado Pago y poné el monto exacto"
                  value={config.qr_static_instructions ?? ''}
                  onChange={(e) => setField('qr_static_instructions', e.target.value)}
                  maxLength={500}
                  rows={2}
                />
              </div>
            </>
          )}

          {!config.qr_static_image_url && config.qr_static_enabled && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Necesitás subir la imagen del QR antes de habilitar este método.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3) ALIAS / TRANSFERENCIA                                             */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Card className={config.alias_enabled ? 'border-violet-300 bg-violet-50/30' : ''}>
        <CardHeader className="flex flex-row items-start justify-between pb-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-violet-600" />
              Alias / CVU / CBU
            </CardTitle>
            <CardDescription className="text-xs">
              Sin integración: el cliente transfiere a tu alias. Es la opción más rápida de configurar.
            </CardDescription>
          </div>
          <Switch
            checked={config.alias_enabled}
            onCheckedChange={(v) => setField('alias_enabled', v)}
            aria-label="Habilitar alias"
          />
        </CardHeader>

        {config.alias_enabled && (
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="alias-value" className="text-xs">
                Alias <span className="text-muted-foreground">(recomendado)</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="alias-value"
                  placeholder="MI.KIOSCO.MP"
                  value={config.alias_value ?? ''}
                  onChange={(e) => setField('alias_value', e.target.value.toUpperCase())}
                  maxLength={120}
                  className="uppercase"
                />
                {config.alias_value && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(config.alias_value ?? '', 'Alias')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alias-cbu" className="text-xs">
                CBU / CVU (opcional)
              </Label>
              <Input
                id="alias-cbu"
                placeholder="0000000000000000000000"
                value={config.alias_cbu_cvu ?? ''}
                onChange={(e) => setField('alias_cbu_cvu', e.target.value.replace(/\D/g, ''))}
                maxLength={22}
                inputMode="numeric"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="alias-titular" className="text-xs">
                  Nombre del titular
                </Label>
                <Input
                  id="alias-titular"
                  placeholder="Ramiro Iraola"
                  value={config.alias_titular_name ?? ''}
                  onChange={(e) => setField('alias_titular_name', e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alias-bank" className="text-xs">
                  Banco / Billetera
                </Label>
                <Input
                  id="alias-bank"
                  placeholder="Mercado Pago"
                  value={config.alias_bank_name ?? ''}
                  onChange={(e) => setField('alias_bank_name', e.target.value)}
                  maxLength={120}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alias-instructions" className="text-xs">
                Mensaje para el cliente (opcional)
              </Label>
              <Textarea
                id="alias-instructions"
                placeholder="Ej: Mandame captura del comprobante y te entrego lo comprado"
                value={config.alias_instructions ?? ''}
                onChange={(e) => setField('alias_instructions', e.target.value)}
                maxLength={500}
                rows={2}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* BOTÓN GUARDAR                                                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Button
        onClick={handleSave}
        disabled={saving || uploading || deleting}
        className="w-full h-12"
        size="lg"
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            <Check className="mr-2 h-5 w-5" />
            Guardar configuración
          </>
        )}
      </Button>
    </div>
  )
}
