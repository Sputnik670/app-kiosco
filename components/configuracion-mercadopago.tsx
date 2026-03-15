'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CreditCard,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getMercadoPagoConfigAction,
  saveMercadoPagoCredentialsAction,
  type GetMercadoPagoConfigResult,
} from '@/lib/actions/mercadopago.actions'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔧 CONFIGURACIÓN DE MERCADO PAGO
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Página de administración para configurar credenciales de Mercado Pago.
 * Solo el owner puede acceder.
 *
 * FLUJO:
 * 1. Carga configuración actual (enmascarada)
 * 2. Si no configurado: muestra form + pasos para obtener credenciales
 * 3. Si configurado: muestra estado + opción de actualizar
 * 4. Guarda credenciales encriptadas en BD
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

interface ConfigData {
  accessToken?: string
  publicKey?: string
  collecterId?: string
  isSandbox?: boolean
}

export default function ConfiguracionMercadoPago() {
  // ───────────────────────────────────────────────────────────────────────────
  // ESTADO
  // ───────────────────────────────────────────────────────────────────────────

  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<ConfigData | null>(null)

  // Formulario
  const [accessToken, setAccessToken] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  // Estados de envío
  const [saving, setSaving] = useState(false)
  const [validationSuccess, setValidationSuccess] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Controlar si estamos en modo edición
  const [isEditing, setIsEditing] = useState(false)

  // ───────────────────────────────────────────────────────────────────────────
  // CARGAR CONFIGURACIÓN ACTUAL
  // ───────────────────────────────────────────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setValidationSuccess(false)
    setValidationError(null)

    const result = await getMercadoPagoConfigAction()

    if (result.success && result.config) {
      setConfig(result.config)
      setIsEditing(false)
    } else if (!result.success && result.error?.includes('no configuradas')) {
      // No hay configuración aún, mostrar form vacío
      setConfig(null)
      setIsEditing(true)
    } else {
      toast.error('Error al cargar configuración', { description: result.error })
      setConfig(null)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // ───────────────────────────────────────────────────────────────────────────
  // GUARDAR CREDENCIALES
  // ───────────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    // Validaciones
    if (!accessToken.trim()) {
      setValidationError('El access token no puede estar vacío')
      return
    }

    if (!webhookSecret.trim()) {
      setValidationError('El webhook secret no puede estar vacío')
      return
    }

    setSaving(true)
    setValidationError(null)
    setValidationSuccess(false)

    const result = await saveMercadoPagoCredentialsAction(accessToken, webhookSecret)

    if (result.success) {
      setValidationSuccess(true)
      setAccessToken('')
      setWebhookSecret('')
      toast.success('Credenciales de Mercado Pago guardadas exitosamente')

      // Recargar configuración después de un delay
      setTimeout(() => {
        fetchConfig()
      }, 1500)
    } else {
      setValidationError(result.error || 'Error al guardar credenciales')
      toast.error('Error al guardar', { description: result.error })
    }

    setSaving(false)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // COPIAR AL PORTAPAPELES
  // ───────────────────────────────────────────────────────────────────────────

  const handleCopyWebhookUrl = () => {
    const webhookUrl = `https://${typeof window !== 'undefined' ? window.location.host : 'app.kiosco.ar'}/api/mercadopago/webhook`
    navigator.clipboard.writeText(webhookUrl)
    toast.success('URL de webhook copiada al portapapeles')
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER: CARGANDO
  // ───────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER: CONFIGURADO (VISTA ACTUAL)
  // ───────────────────────────────────────────────────────────────────────────

  if (config && !isEditing) {
    return (
      <div className="space-y-6 animate-in fade-in">
        {/* TARJETA DE ESTADO */}
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <CardTitle>Mercado Pago QR</CardTitle>
              </div>
              <CardDescription>Integración de pagos habilitada</CardDescription>
            </div>
            <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Conectado
            </Badge>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* INFO: COLLECTOR_ID */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Seller ID (Collector ID)
              </Label>
              <div className="rounded-md bg-white p-3 font-mono text-sm text-foreground">
                {config.collecterId || '—'}
              </div>
            </div>

            {/* INFO: PUBLIC_KEY */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Public Key
              </Label>
              <div className="rounded-md bg-white p-3 break-all text-xs text-foreground font-mono">
                {config.publicKey ? config.publicKey.substring(0, 50) + '...' : '—'}
              </div>
            </div>

            {/* INFO: ACCESS_TOKEN (ENMASCARADO) */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Access Token
              </Label>
              <div className="rounded-md bg-white p-3 font-mono text-sm text-foreground">
                {config.accessToken || '****...'}
              </div>
            </div>

            {/* MODO */}
            <div className="flex items-center gap-2 pt-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {config.isSandbox ? '🔄 Modo Sandbox' : '🚀 Modo Producción'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* WEBHOOK URL */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">URL de Webhook</CardTitle>
            <CardDescription>
              Configura esta URL en el panel de Mercado Pago para recibir confirmaciones de pago
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                readOnly
                value={`https://${typeof window !== 'undefined' ? window.location.host : 'app.kiosco.ar'}/api/mercadopago/webhook`}
                className="font-mono text-xs bg-slate-50"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyWebhookUrl}
                title="Copiar URL"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* BOTÓN: ACTUALIZAR CREDENCIALES */}
        <div className="flex gap-2">
          <Button onClick={() => setIsEditing(true)} variant="outline" className="w-full">
            Actualizar Credenciales
          </Button>
        </div>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER: FORMULARIO (SETUP O EDICIÓN)
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* ENCABEZADO */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Mercado Pago QR</h2>
        </div>
        <p className="text-muted-foreground">
          Configura credenciales para aceptar pagos mediante códigos QR dinámicos
        </p>
      </div>

      {/* PASOS: CÓMO OBTENER LAS CREDENCIALES */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
            Pasos para obtener tus credenciales
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                1
              </div>
              <div>
                <p className="font-medium">Ingresa a Mercado Pago</p>
                <p className="text-xs text-muted-foreground">
                  Ve a{' '}
                  <a
                    href="https://www.mercadopago.com.ar/developers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    mercadopago.com.ar/developers
                  </a>
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                2
              </div>
              <div>
                <p className="font-medium">Accede a tu cuenta o crea una</p>
                <p className="text-xs text-muted-foreground">
                  Necesitarás tu CUIT y datos de tu negocio
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                3
              </div>
              <div>
                <p className="font-medium">Ve a Aplicaciones &gt; Mis aplicaciones</p>
                <p className="text-xs text-muted-foreground">
                  Crea una nueva aplicación o selecciona una existente
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                4
              </div>
              <div>
                <p className="font-medium">Copia el Access Token de Producción</p>
                <p className="text-xs text-muted-foreground">
                  Búscalo en la sección "Credenciales" (comienza con "APP_USR_")
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                5
              </div>
              <div>
                <p className="font-medium">Configura el Webhook</p>
                <p className="text-xs text-muted-foreground">
                  Pega la URL de abajo en la sección "Webhooks" de tu aplicación MP
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FORMULARIO DE CREDENCIALES */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configura tus credenciales</CardTitle>
          <CardDescription>
            Tus datos se encriptan y se guardan de forma segura en la nube
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ERROR */}
          {validationError && (
            <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-destructive">Error de validación</p>
                <p className="text-xs text-destructive/80 mt-1">{validationError}</p>
              </div>
            </div>
          )}

          {/* ÉXITO */}
          {validationSuccess && (
            <div className="flex items-start gap-3 rounded-md border border-emerald-500/50 bg-emerald-50 p-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-emerald-700">Credenciales guardadas</p>
                <p className="text-xs text-emerald-600 mt-1">
                  Tu integración con Mercado Pago está lista
                </p>
              </div>
            </div>
          )}

          {/* CAMPO: ACCESS TOKEN */}
          <div className="space-y-2">
            <Label htmlFor="accessToken">Access Token (obligatorio)</Label>
            <div className="relative">
              <Input
                id="accessToken"
                type={showToken ? 'text' : 'password'}
                placeholder="APP_USR_..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="pr-10"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Desde: Panel MP &gt; Aplicaciones &gt; Credenciales
            </p>
          </div>

          {/* CAMPO: WEBHOOK SECRET */}
          <div className="space-y-2">
            <Label htmlFor="webhookSecret">Webhook Secret (obligatorio)</Label>
            <div className="relative">
              <Input
                id="webhookSecret"
                type={showSecret ? 'text' : 'password'}
                placeholder="Ingresa el secret de webhook"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="pr-10"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Desde: Panel MP &gt; Aplicaciones &gt; Webhooks (cualquier valor seguro)
            </p>
          </div>

          {/* CAMPO: WEBHOOK URL */}
          <div className="space-y-2">
            <Label>URL de Webhook</Label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                readOnly
                value={`https://${typeof window !== 'undefined' ? window.location.host : 'app.kiosco.ar'}/api/mercadopago/webhook`}
                className="font-mono text-xs bg-slate-50"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyWebhookUrl}
                title="Copiar"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Copia esta URL en Panel MP &gt; Aplicaciones &gt; Webhooks &gt; Eventos
            </p>
          </div>
        </CardContent>
      </Card>

      {/* BOTONES DE ACCIÓN */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={saving || !accessToken.trim() || !webhookSecret.trim()}
          className="flex-1"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Guardar Credenciales
            </>
          )}
        </Button>

        {config && (
          <Button
            variant="outline"
            onClick={() => setIsEditing(false)}
            disabled={saving}
            className="flex-1"
          >
            Cancelar
          </Button>
        )}
      </div>

      {/* AVISO DE SEGURIDAD */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-amber-900">⚠️ Importante para tu seguridad</p>
              <ul className="list-disc list-inside text-xs text-amber-800 space-y-1 ml-2">
                <li>Nunca compartas tu Access Token</li>
                <li>Tus credenciales se encriptan antes de guardarse</li>
                <li>Solo los administradores pueden acceder a esta página</li>
                <li>Revoca los tokens en MP si crees que se comprometieron</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
