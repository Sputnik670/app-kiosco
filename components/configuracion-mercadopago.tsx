'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
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
  LinkIcon,
  Unlink,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getMercadoPagoConfigAction,
  saveMercadoPagoCredentialsAction,
  getOAuthUrlAction,
  disconnectMercadoPagoAction,
} from '@/lib/actions/mercadopago.actions'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔧 CONFIGURACIÓN DE MERCADO PAGO
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Componente de administración para conectar Mercado Pago.
 *
 * FLUJO PRINCIPAL (OAuth - para clientes):
 * 1. Click "Conectar con Mercado Pago"
 * 2. Se abre MP, el usuario autoriza con su cuenta normal
 * 3. Vuelve a la app, todo conectado automáticamente
 *
 * FLUJO AVANZADO (Manual - para developers):
 * 1. Expandir "Configuración avanzada"
 * 2. Pegar Access Token y Webhook Secret manualmente
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

interface ConfigData {
  accessToken?: string
  publicKey?: string
  collecterId?: string
  isSandbox?: boolean
  connectedVia?: string
}

export default function ConfiguracionMercadoPago() {
  // ───────────────────────────────────────────────────────────────────────────
  // ESTADO
  // ───────────────────────────────────────────────────────────────────────────

  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<ConfigData | null>(null)

  // OAuth
  const [connectingOAuth, setConnectingOAuth] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // Formulario manual (avanzado)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [accessToken, setAccessToken] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // URL params (para detectar retorno de OAuth)
  const searchParams = useSearchParams()

  // ───────────────────────────────────────────────────────────────────────────
  // DETECTAR RETORNO DE OAUTH
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const mpSuccess = searchParams.get('mp_success')
    const mpError = searchParams.get('mp_error')

    if (mpSuccess === 'connected') {
      toast.success('Mercado Pago conectado exitosamente', {
        description: 'Ya podés cobrar con QR desde la caja',
      })
    } else if (mpError) {
      const errorMessages: Record<string, string> = {
        access_denied: 'No autorizaste el acceso a Mercado Pago',
        invalid_request: 'Solicitud inválida. Intentá de nuevo.',
        csrf_failed: 'Error de seguridad. Intentá de nuevo.',
        token_exchange: 'No se pudo completar la conexión con MP. Intentá de nuevo.',
        no_token: 'Mercado Pago no envió las credenciales. Intentá de nuevo.',
        save_failed: 'Error guardando las credenciales. Intentá de nuevo.',
        server_config: 'Error de configuración del servidor. Contactá soporte.',
        no_org: 'Tu cuenta no tiene organización asignada.',
        not_owner: 'Solo el dueño puede conectar Mercado Pago.',
        mp_config_missing: 'La integración OAuth no está configurada aún.',
        unexpected: 'Error inesperado. Intentá de nuevo.',
      }
      toast.error('Error al conectar Mercado Pago', {
        description: errorMessages[mpError] || 'Error desconocido',
      })
    }
  }, [searchParams])

  // ───────────────────────────────────────────────────────────────────────────
  // CARGAR CONFIGURACIÓN ACTUAL
  // ───────────────────────────────────────────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    const result = await getMercadoPagoConfigAction()

    if (result.success && result.config) {
      setConfig(result.config)
    } else if (!result.success && result.error?.includes('no configuradas')) {
      setConfig(null)
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
  // CONECTAR CON OAUTH
  // ───────────────────────────────────────────────────────────────────────────

  const handleConnectOAuth = async () => {
    setConnectingOAuth(true)

    const result = await getOAuthUrlAction()

    if (result.success && result.url) {
      // Redirigir al endpoint de authorize
      window.location.href = result.url
    } else {
      toast.error('No se puede conectar', {
        description: result.error || 'Error obteniendo URL de autorización',
      })
      setConnectingOAuth(false)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DESCONECTAR
  // ───────────────────────────────────────────────────────────────────────────

  const handleDisconnect = async () => {
    if (!confirm('¿Seguro que querés desconectar Mercado Pago? No podrás cobrar con QR hasta volver a conectar.')) {
      return
    }

    setDisconnecting(true)
    const result = await disconnectMercadoPagoAction()

    if (result.success) {
      toast.success('Mercado Pago desconectado')
      setConfig(null)
    } else {
      toast.error('Error al desconectar', { description: result.error })
    }

    setDisconnecting(false)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GUARDAR MANUAL
  // ───────────────────────────────────────────────────────────────────────────

  const handleSaveManual = async () => {
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

    const result = await saveMercadoPagoCredentialsAction(accessToken, webhookSecret)

    if (result.success) {
      setAccessToken('')
      setWebhookSecret('')
      setShowAdvanced(false)
      toast.success('Credenciales guardadas exitosamente')
      setTimeout(() => fetchConfig(), 1000)
    } else {
      setValidationError(result.error || 'Error al guardar')
      toast.error('Error al guardar', { description: result.error })
    }

    setSaving(false)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // COPIAR WEBHOOK URL
  // ───────────────────────────────────────────────────────────────────────────

  const handleCopyWebhookUrl = () => {
    const webhookUrl = `https://${typeof window !== 'undefined' ? window.location.host : 'app.kiosco.ar'}/api/mercadopago/webhook`
    navigator.clipboard.writeText(webhookUrl)
    toast.success('URL copiada')
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
  // RENDER: YA CONECTADO
  // ───────────────────────────────────────────────────────────────────────────

  if (config) {
    return (
      <div className="space-y-4 animate-in fade-in">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader className="flex flex-row items-start justify-between pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Mercado Pago</CardTitle>
              </div>
              <CardDescription>Pagos con QR habilitados</CardDescription>
            </div>
            <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Conectado
            </Badge>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Seller ID</p>
                <p className="font-mono mt-0.5">{config.collecterId || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Conexión</p>
                <p className="mt-0.5">
                  {config.connectedVia === 'oauth' ? (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      <LinkIcon className="mr-1 h-3 w-3" />
                      OAuth
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Manual</Badge>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Token</p>
                <p className="font-mono mt-0.5 text-xs">{config.accessToken || '****'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Modo</p>
                <p className="mt-0.5 text-xs">
                  {config.isSandbox ? 'Sandbox' : 'Producción'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botón desconectar */}
        <Button
          onClick={handleDisconnect}
          disabled={disconnecting}
          variant="outline"
          className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          {disconnecting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Unlink className="mr-2 h-4 w-4" />
          )}
          Desconectar Mercado Pago
        </Button>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER: NO CONECTADO — BOTÓN OAUTH + AVANZADO
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* ENCABEZADO */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-bold">Mercado Pago</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Conectá tu cuenta para aceptar pagos con QR desde la caja
        </p>
      </div>

      {/* BOTÓN PRINCIPAL: CONECTAR CON OAUTH */}
      <Card className="border-blue-200">
        <CardContent className="pt-6 space-y-4">
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center">
              <CreditCard className="h-8 w-8 text-sky-600" />
            </div>

            <div>
              <h3 className="font-semibold text-lg">Conectá tu Mercado Pago</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Iniciá sesión con tu cuenta normal de Mercado Pago y autorizá la app.
                No necesitás ser desarrollador.
              </p>
            </div>

            <Button
              onClick={handleConnectOAuth}
              disabled={connectingOAuth}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white h-12 text-base"
              size="lg"
            >
              {connectingOAuth ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-5 w-5" />
                  Conectar con Mercado Pago
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              Serás redirigido a Mercado Pago para autorizar el acceso. Tus datos están seguros.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* SECCIÓN AVANZADA (MANUAL) */}
      <div className="border rounded-lg">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Configuración avanzada (manual)</span>
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {showAdvanced && (
          <div className="px-3 pb-3 space-y-4 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Si tenés cuenta de desarrollador en Mercado Pago, podés pegar tus credenciales directamente.
            </p>

            {/* ERROR */}
            {validationError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{validationError}</p>
              </div>
            )}

            {/* ACCESS TOKEN */}
            <div className="space-y-1.5">
              <Label htmlFor="accessToken" className="text-xs">Access Token</Label>
              <div className="relative">
                <Input
                  id="accessToken"
                  type={showToken ? 'text' : 'password'}
                  placeholder="APP_USR_..."
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="pr-10 text-sm"
                  disabled={saving}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* WEBHOOK SECRET */}
            <div className="space-y-1.5">
              <Label htmlFor="webhookSecret" className="text-xs">Webhook Secret</Label>
              <div className="relative">
                <Input
                  id="webhookSecret"
                  type={showSecret ? 'text' : 'password'}
                  placeholder="Secret de webhook"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="pr-10 text-sm"
                  disabled={saving}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* WEBHOOK URL */}
            <div className="space-y-1.5">
              <Label className="text-xs">URL de Webhook</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  readOnly
                  value={`https://${typeof window !== 'undefined' ? window.location.host : 'app.kiosco.ar'}/api/mercadopago/webhook`}
                  className="font-mono text-xs bg-slate-50"
                />
                <Button variant="outline" size="icon" onClick={handleCopyWebhookUrl} className="shrink-0">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* GUARDAR */}
            <Button
              onClick={handleSaveManual}
              disabled={saving || !accessToken.trim() || !webhookSecret.trim()}
              className="w-full"
              variant="outline"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Guardar credenciales
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
