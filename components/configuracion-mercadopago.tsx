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
  Store,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getMercadoPagoConfigAction,
  saveMercadoPagoCredentialsAction,
  getOAuthUrlAction,
  disconnectMercadoPagoAction,
  updateMercadoPagoWebhookSecretAction,
  getBranchesMpRegistrationStatusAction,
  registerMercadoPagoPosForBranchAction,
  probeMercadoPagoApiAction,
  type BranchMpStatus,
  type ProbeMpApiCallResult,
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
  hasWebhookSecret?: boolean
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

  // Carga/rotación del webhook secret cuando ya hay credenciales conectadas
  // (típicamente vía OAuth, donde el access_token vive encriptado en DB y el
  // dueño no lo tiene en claro, pero igual necesita pegar el webhook secret).
  const [showWebhookForm, setShowWebhookForm] = useState(false)
  const [webhookSecretOnly, setWebhookSecretOnly] = useState('')
  const [showWebhookSecretInput, setShowWebhookSecretInput] = useState(false)
  const [savingWebhookSecret, setSavingWebhookSecret] = useState(false)

  // Sucursales registradas como POS en MP — requisito para QR EMVCo
  // interoperable (Naranja X, MODO, Brubank, etc.).
  const [branches, setBranches] = useState<BranchMpStatus[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [registeringBranchId, setRegisteringBranchId] = useState<string | null>(null)
  const [registeringAll, setRegisteringAll] = useState(false)

  // [TEMPORAL — debug 27-abr-2026] Estado del probe contra la API de MP.
  // Permite diagnosticar si el endpoint de Stores responde para esta cuenta.
  // Borrar junto con probeMercadoPagoApiAction cuando se cierre la decisión.
  const [probing, setProbing] = useState(false)
  const [probeResults, setProbeResults] = useState<ProbeMpApiCallResult[] | null>(null)
  const [probeError, setProbeError] = useState<string | null>(null)

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
  // CARGAR SUCURSALES + ESTADO POS EN MP
  // ───────────────────────────────────────────────────────────────────────────

  const fetchBranches = useCallback(async () => {
    setLoadingBranches(true)
    const result = await getBranchesMpRegistrationStatusAction()
    if (result.success && result.branches) {
      setBranches(result.branches)
    } else {
      // No-toast: la card muestra estado vacío por su cuenta. El error verdadero
      // sería de auth, que ya cubre la pantalla principal.
      setBranches([])
    }
    setLoadingBranches(false)
  }, [])

  // Trigger fetchBranches cada vez que tenemos config conectada (post-OAuth o
  // recarga). Si no hay config, no tiene sentido pedir las sucursales — el
  // botón de registrar las necesita igual.
  useEffect(() => {
    if (config) {
      fetchBranches()
    }
  }, [config, fetchBranches])

  const pendingBranchesCount = branches.filter((b) => !b.isRegistered).length

  // ───────────────────────────────────────────────────────────────────────────
  // REGISTRAR SUCURSAL INDIVIDUAL EN MP
  // ───────────────────────────────────────────────────────────────────────────

  const handleRegisterBranch = useCallback(
    async (branchId: string) => {
      setRegisteringBranchId(branchId)
      const result = await registerMercadoPagoPosForBranchAction(branchId)
      if (result.success) {
        if (result.alreadyRegistered) {
          toast.info('Sucursal ya estaba registrada en MP')
        } else {
          toast.success('Sucursal registrada en Mercado Pago', {
            description: 'Ya podés cobrar QR interoperable desde esta caja.',
          })
        }
        await fetchBranches()
      } else {
        toast.error('No se pudo registrar la sucursal', {
          description: result.error,
        })
      }
      setRegisteringBranchId(null)
    },
    [fetchBranches]
  )

  // ───────────────────────────────────────────────────────────────────────────
  // REGISTRAR TODAS LAS SUCURSALES PENDIENTES
  // ───────────────────────────────────────────────────────────────────────────

  const handleRegisterAllPending = useCallback(async () => {
    const pending = branches.filter((b) => !b.isRegistered)
    if (pending.length === 0) return

    setRegisteringAll(true)
    let okCount = 0
    let errCount = 0

    // Las llamadas se hacen secuenciales para no saturar a MP con N requests
    // simultáneas y poder mostrar progreso ordenado en logs si hay falla. Para
    // 1-3 sucursales esto es trivial; si una org tiene 20+ sucursales, podemos
    // paralelizar con Promise.all en una segunda iteración.
    for (const b of pending) {
      const result = await registerMercadoPagoPosForBranchAction(b.id)
      if (result.success) {
        okCount++
      } else {
        errCount++
        // No spammeamos toasts por cada falla — al final mostramos resumen.
      }
    }

    if (errCount === 0) {
      toast.success(`${okCount} sucursal${okCount > 1 ? 'es' : ''} registrada${okCount > 1 ? 's' : ''} en MP`)
    } else if (okCount === 0) {
      toast.error('No se pudo registrar ninguna sucursal', {
        description: 'Verificá que tu cuenta de MP esté verificada (KYC) y reintentá.',
      })
    } else {
      toast.warning(`Registramos ${okCount} de ${okCount + errCount}`, {
        description: 'Algunas sucursales fallaron. Probá registrarlas individualmente.',
      })
    }

    await fetchBranches()
    setRegisteringAll(false)
  }, [branches, fetchBranches])

  // ───────────────────────────────────────────────────────────────────────────
  // [TEMPORAL — debug 27-abr-2026] Probe directo contra la API de MP
  // ───────────────────────────────────────────────────────────────────────────

  const handleProbe = useCallback(async () => {
    setProbing(true)
    setProbeError(null)
    setProbeResults(null)

    const result = await probeMercadoPagoApiAction()

    if (result.success && result.results) {
      setProbeResults(result.results)
      const allOk = result.results.every((r) => r.ok)
      if (allOk) {
        toast.success('Probe OK — revisá los resultados abajo')
      } else {
        toast.warning('Probe completado con errores — revisá los resultados abajo')
      }
    } else {
      setProbeError(result.error || 'Error desconocido en el probe')
      toast.error('No se pudo correr el probe', { description: result.error })
    }

    setProbing(false)
  }, [])

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
  // GUARDAR / ROTAR SOLO WEBHOOK SECRET
  // ───────────────────────────────────────────────────────────────────────────

  const handleSaveWebhookSecret = async () => {
    if (!webhookSecretOnly.trim()) {
      toast.error('El webhook secret no puede estar vacío')
      return
    }

    setSavingWebhookSecret(true)
    const result = await updateMercadoPagoWebhookSecretAction(webhookSecretOnly.trim())

    if (result.success) {
      toast.success('Webhook secret guardado', {
        description: 'Mercado Pago ya puede verificar firmas de webhook.',
      })
      setWebhookSecretOnly('')
      setShowWebhookForm(false)
      setShowWebhookSecretInput(false)
      // Recargar config para que el badge "Configurado" se actualice
      setTimeout(() => fetchConfig(), 500)
    } else {
      toast.error('No se pudo guardar', { description: result.error })
    }

    setSavingWebhookSecret(false)
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

        {/* SUCURSALES — registro POS en MP para QR EMVCo interoperable */}
        <Card
          className={
            !loadingBranches && pendingBranchesCount > 0
              ? 'border-amber-300 bg-amber-50/50'
              : 'border-emerald-200'
          }
        >
          <CardHeader className="pb-3">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Store className="h-4 w-4" />
                Sucursales en Mercado Pago
                {!loadingBranches && branches.length > 0 && (
                  pendingBranchesCount > 0 ? (
                    <Badge
                      variant="outline"
                      className="text-amber-700 border-amber-400 text-xs"
                    >
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {pendingBranchesCount} pendiente{pendingBranchesCount > 1 ? 's' : ''}
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Todas registradas
                    </Badge>
                  )
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Cada sucursal tiene que estar registrada como POS en Mercado Pago para
                generar QRs interoperables (Naranja X, MODO, Brubank, Ualá, Cuenta DNI,
                Santander, etc.). Se hace una sola vez por sucursal.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingBranches ? (
              <div className="flex justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : branches.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No tenés sucursales activas todavía. Creá al menos una desde
                "Sucursales" antes de registrar POS.
              </p>
            ) : (
              <>
                <ul className="space-y-1.5">
                  {branches.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between gap-2 text-sm rounded-md border bg-background px-3 py-2"
                    >
                      <span className="truncate font-medium">{b.name}</span>
                      {b.isRegistered ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px] shrink-0">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Registrada
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            registeringBranchId === b.id || registeringAll
                          }
                          onClick={() => handleRegisterBranch(b.id)}
                          className="h-7 text-xs shrink-0"
                        >
                          {registeringBranchId === b.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Registrar'
                          )}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                {pendingBranchesCount > 1 && (
                  <Button
                    onClick={handleRegisterAllPending}
                    disabled={registeringAll || registeringBranchId !== null}
                    className="w-full mt-2"
                    size="sm"
                  >
                    {registeringAll ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Registrar todas las pendientes ({pendingBranchesCount})
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* [TEMPORAL — debug 27-abr-2026] Probe contra API de MP.
            Sirve para decidir si vamos por Stores+POS o si revertimos a
            Preferences. Borrar este bloque junto con probeMercadoPagoApiAction
            cuando cierre el ticket. */}
        <Card className="border-dashed border-amber-300 bg-amber-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              🔬 Diagnóstico API Mercado Pago
              <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-400">
                Temporal
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Prueba dos endpoints reales contra MP con tu token actual:
              <br />
              1) <code className="font-mono text-[10px]">GET /users/me</code> (sanity check)
              <br />
              2) <code className="font-mono text-[10px]">POST /users/{'{id}'}/stores</code> (probe de creación de Store)
              <br />
              Si el segundo responde 2xx, MP creó un store llamado{' '}
              <code className="font-mono text-[10px]">TEST_PROBE_DELETE_ME</code> en tu cuenta —
              borralo después desde el panel de MP.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={handleProbe}
              disabled={probing}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {probing ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Probando…
                </>
              ) : (
                'Correr probe'
              )}
            </Button>

            {probeError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                {probeError}
              </div>
            )}

            {probeResults && (
              <div className="space-y-2">
                {probeResults.map((r, i) => (
                  <div
                    key={i}
                    className={`rounded-md border p-2 text-xs ${
                      r.ok
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-red-200 bg-red-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          r.ok ? 'text-emerald-700 border-emerald-400' : 'text-red-700 border-red-400'
                        }`}
                      >
                        {r.status === null ? 'NETWORK' : `HTTP ${r.status}`}
                      </Badge>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground mt-1">
                      {r.method} {r.path}
                    </p>
                    <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-900 text-slate-100 p-2 text-[10px] leading-snug">
                      {r.responseBody || '(empty body)'}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* WEBHOOK SECRET — carga/rotación independiente del access_token */}
        <Card
          className={
            config.hasWebhookSecret
              ? 'border-emerald-200'
              : 'border-amber-300 bg-amber-50/50'
          }
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  Webhook secret
                  {config.hasWebhookSecret ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Configurado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-700 border-amber-400 text-xs">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Pendiente
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {config.hasWebhookSecret
                    ? 'Mercado Pago verifica las firmas de los webhooks. Si rotás el secret en MP, actualizalo acá.'
                    : 'Sin esto, los webhooks de Mercado Pago entran sin verificar la firma. Pegá el secret del panel de developers de MP para activar la verificación.'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Mostrar el form si: (a) falta el secret, o (b) usuario hizo click en "Actualizar" */}
            {(!config.hasWebhookSecret || showWebhookForm) ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="webhookSecretOnly" className="text-xs">
                    Webhook secret de Mercado Pago
                  </Label>
                  <div className="relative">
                    <Input
                      id="webhookSecretOnly"
                      type={showWebhookSecretInput ? 'text' : 'password'}
                      placeholder="Pegá el secret del panel de developers de MP"
                      value={webhookSecretOnly}
                      onChange={(e) => setWebhookSecretOnly(e.target.value)}
                      className="pr-10 text-sm"
                      disabled={savingWebhookSecret}
                    />
                    <button
                      type="button"
                      onClick={() => setShowWebhookSecretInput(!showWebhookSecretInput)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showWebhookSecretInput ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Lo encontrás en Mercado Pago → Tu integración → Webhooks → Mostrar firma secreta.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveWebhookSecret}
                    disabled={savingWebhookSecret || !webhookSecretOnly.trim()}
                    className="flex-1"
                    size="sm"
                  >
                    {savingWebhookSecret ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {config.hasWebhookSecret ? 'Actualizar secret' : 'Guardar webhook secret'}
                  </Button>
                  {config.hasWebhookSecret && showWebhookForm && (
                    <Button
                      onClick={() => {
                        setShowWebhookForm(false)
                        setWebhookSecretOnly('')
                      }}
                      variant="outline"
                      size="sm"
                      disabled={savingWebhookSecret}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <Button
                onClick={() => setShowWebhookForm(true)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Rotar / actualizar webhook secret
              </Button>
            )}
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
