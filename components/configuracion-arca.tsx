'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Upload,
  Unlink,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getArcaConfigAction,
  saveArcaConfigAction,
  uploadArcaCertificateAction,
  toggleArcaActiveAction,
  disconnectArcaAction,
} from '@/lib/actions/arca.actions'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📋 CONFIGURACIÓN ARCA/AFIP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Componente para configurar facturación electrónica ARCA (opcional).
 *
 * FLUJO PRINCIPAL:
 * 1. Expandir formulario de configuración
 * 2. Ingresar datos: CUIT, Razón Social, etc.
 * 3. Subir certificado y clave privada
 * 4. Guardar configuración
 * 5. Activar/desactivar según necesidad
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

interface ArcaConfig {
  id?: string
  cuit: string
  razonSocial: string
  puntoVenta: number
  tipoContribuyente: 'monotributista' | 'responsable_inscripto' | 'exento'
  condicionIva: string
  tipoFacturaDefault: 'A' | 'B' | 'C'
  domicilioFiscal?: string | null
  hasCert?: boolean
  isActive?: boolean
  isSandbox?: boolean
}

interface ValidationErrors {
  [key: string]: string
}

type TipoContribuyente = 'monotributista' | 'responsable_inscripto' | 'exento'

const TIPO_CONTRIBUYENTE_MAP: Record<TipoContribuyente, { label: string; tipoFactura: 'A' | 'B' | 'C'; condicionIva: string }> = {
  'monotributista': {
    label: 'Monotributista',
    tipoFactura: 'C',
    condicionIva: 'monotributista',
  },
  'responsable_inscripto': {
    label: 'Responsable Inscripto',
    tipoFactura: 'B',
    condicionIva: 'responsable_inscripto',
  },
  'exento': {
    label: 'Exento',
    tipoFactura: 'C',
    condicionIva: 'exento',
  },
}

export default function ConfiguracionArca() {
  // ───────────────────────────────────────────────────────────────────────────
  // ESTADO
  // ───────────────────────────────────────────────────────────────────────────

  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<ArcaConfig | null>(null)

  // Formulario
  const [showForm, setShowForm] = useState(false)
  const [cuit, setCuit] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [puntoVenta, setPuntoVenta] = useState('1')
  const [tipoContribuyente, setTipoContribuyente] = useState<TipoContribuyente>('monotributista')
  const [domicilioFiscal, setDomicilioFiscal] = useState('')
  const [certificateFile, setCertificateFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})

  // Toggle activo
  const [toggling, setToggling] = useState(false)

  // Desconectar
  const [disconnecting, setDisconnecting] = useState(false)

  // ───────────────────────────────────────────────────────────────────────────
  // CARGAR CONFIGURACIÓN ACTUAL
  // ───────────────────────────────────────────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    const result = await getArcaConfigAction()

    if (result.success && result.isConfigured && result.config) {
      setConfig(result.config)
      // Pre-llenar formulario si existe configuración
      setCuit(result.config.cuit || '')
      setRazonSocial(result.config.razonSocial || '')
      setPuntoVenta(String(result.config.puntoVenta || 1))
      setTipoContribuyente((result.config.tipoContribuyente as TipoContribuyente) || 'monotributista')
      setDomicilioFiscal(result.config.domicilioFiscal || '')
    } else if (result.success && !result.isConfigured) {
      setConfig(null)
    } else if (result.error) {
      toast.error('Error al cargar configuración', { description: result.error })
      setConfig(null)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // ───────────────────────────────────────────────────────────────────────────
  // VALIDACIÓN
  // ───────────────────────────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {}

    // CUIT: 11 dígitos
    if (!cuit.trim()) {
      errors.cuit = 'El CUIT es obligatorio'
    } else if (!/^\d{11}$/.test(cuit.replace(/[-.\s]/g, ''))) {
      errors.cuit = 'El CUIT debe tener 11 dígitos'
    }

    // Razón Social
    if (!razonSocial.trim()) {
      errors.razonSocial = 'La razón social es obligatoria'
    }

    // Punto de Venta
    const pvNum = parseInt(puntoVenta, 10)
    if (isNaN(pvNum) || pvNum < 1 || pvNum > 9999) {
      errors.puntoVenta = 'El punto de venta debe estar entre 1 y 9999'
    }

    // Certificado y clave (si es nueva configuración)
    if (!config) {
      if (!certificateFile) {
        errors.certificate = 'El certificado es obligatorio'
      }
      if (!keyFile) {
        errors.key = 'La clave privada es obligatoria'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GUARDAR CONFIGURACIÓN
  // ───────────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    setSaving(true)
    setValidationErrors({})

    try {
      // 1. Guardar datos de configuración
      const pvNum = parseInt(puntoVenta, 10)
      const condicionIva = TIPO_CONTRIBUYENTE_MAP[tipoContribuyente].condicionIva

      const configResult = await saveArcaConfigAction({
        cuit: cuit.replace(/[-.\s]/g, ''),
        razonSocial: razonSocial.trim(),
        puntoVenta: pvNum,
        tipoContribuyente,
        condicionIva,
        domicilioFiscal: domicilioFiscal.trim() || undefined,
      })

      if (!configResult.success) {
        setValidationErrors({ form: configResult.error || 'Error al guardar configuración' })
        toast.error('Error', { description: configResult.error })
        setSaving(false)
        return
      }

      // 2. Subir certificado y clave si existen (leer archivos como texto PEM)
      if (certificateFile && keyFile) {
        const certPem = await certificateFile.text()
        const keyPem = await keyFile.text()

        const certResult = await uploadArcaCertificateAction(certPem, keyPem)

        if (!certResult.success) {
          setValidationErrors({ files: certResult.error || 'Error al subir certificado' })
          toast.error('Error al subir certificado', { description: certResult.error })
          setSaving(false)
          return
        }
      }

      toast.success('Configuración guardada', {
        description: 'Tu ARCA está listo para usar. Activalo cuando lo necesites.',
      })

      setCertificateFile(null)
      setKeyFile(null)
      setShowForm(false)
      setTimeout(() => fetchConfig(), 1000)
    } catch (err) {
      toast.error('Error inesperado', {
        description: err instanceof Error ? err.message : 'Intenta de nuevo',
      })
    }

    setSaving(false)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TOGGLE ACTIVO
  // ───────────────────────────────────────────────────────────────────────────

  const handleToggleActive = async (newState: boolean) => {
    if (newState && !config?.hasCert) {
      toast.error('Certificado incompleto', {
        description: 'Necesitas subir certificado y clave antes de activar ARCA',
      })
      return
    }

    setToggling(true)

    const result = await toggleArcaActiveAction(newState)

    if (result.success) {
      setConfig((prev) => (prev ? { ...prev, isActive: newState } : null))
      toast.success(newState ? 'ARCA activado' : 'ARCA desactivado', {
        description: newState ? 'Se generarán facturas automáticamente' : 'No se generarán facturas',
      })
      setTimeout(() => fetchConfig(), 500)
    } else {
      toast.error('Error', { description: result.error })
    }

    setToggling(false)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DESCONECTAR
  // ───────────────────────────────────────────────────────────────────────────

  const handleDisconnect = async () => {
    if (!confirm('¿Seguro que querés desconectar ARCA? Tendrás que reconfigurarlo para volver a usar.')) {
      return
    }

    setDisconnecting(true)

    const result = await disconnectArcaAction()

    if (result.success) {
      toast.success('ARCA desconectado')
      setConfig(null)
      setCuit('')
      setRazonSocial('')
      setPuntoVenta('1')
      setTipoContribuyente('monotributista')
      setDomicilioFiscal('')
    } else {
      toast.error('Error al desconectar', { description: result.error })
    }

    setDisconnecting(false)
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
  // RENDER: YA CONFIGURADO
  // ───────────────────────────────────────────────────────────────────────────

  if (config) {
    return (
      <div className="space-y-4 animate-in fade-in">
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="flex flex-row items-start justify-between pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-lg">Facturación Electrónica ARCA</CardTitle>
              </div>
              <CardDescription>Emití facturas desde la caja</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge
                variant="default"
                className={config.isSandbox ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {config.isSandbox ? 'Sandbox' : 'Configurado'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Información actual */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">CUIT</p>
                <p className="font-mono mt-0.5">
                  {config.cuit ? `${config.cuit.slice(0, 2)}.${config.cuit.slice(2, 5)}.${config.cuit.slice(5, 8)}-${config.cuit.slice(8)}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Razón Social</p>
                <p className="mt-0.5 text-xs truncate">{config.razonSocial || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Punto de Venta</p>
                <p className="font-mono mt-0.5">{config.puntoVenta || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Tipo Factura</p>
                <p className="font-mono mt-0.5">{config.tipoFacturaDefault || '—'}</p>
              </div>
            </div>

            {/* Certificados */}
            <div className="pt-2 border-t space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">Certificados</p>
              <div className="flex items-center gap-2 text-xs">
                {config.hasCert ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Certificado y clave cargados</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span>Certificado no cargado</span>
                  </>
                )}
              </div>
            </div>

            {/* Toggle Activo */}
            <div className="pt-2 border-t flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Facturación activa</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {config.isActive ? 'Se generan facturas automáticamente' : 'No se generan facturas'}
                </p>
              </div>
              <Switch
                checked={config.isActive || false}
                onCheckedChange={handleToggleActive}
                disabled={toggling || !config.hasCert}
              />
            </div>
          </CardContent>
        </Card>

        {/* Sección Editar */}
        <div className="border rounded-lg">
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full flex items-center justify-between p-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Editar configuración</span>
            {showForm ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showForm && (
            <div className="px-3 pb-3 space-y-4 border-t pt-3">
              {validationErrors.form && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{validationErrors.form}</p>
                </div>
              )}

              {validationErrors.files && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{validationErrors.files}</p>
                </div>
              )}

              {/* CUIT */}
              <div className="space-y-1.5">
                <Label htmlFor="cuit" className="text-xs">CUIT (11 dígitos)</Label>
                <Input
                  id="cuit"
                  type="text"
                  placeholder="20123456789"
                  value={cuit}
                  onChange={(e) => setCuit(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  disabled={saving}
                  className={validationErrors.cuit ? 'border-destructive' : ''}
                />
                {validationErrors.cuit && (
                  <p className="text-xs text-destructive">{validationErrors.cuit}</p>
                )}
              </div>

              {/* Razón Social */}
              <div className="space-y-1.5">
                <Label htmlFor="razonSocial" className="text-xs">Razón Social</Label>
                <Input
                  id="razonSocial"
                  type="text"
                  placeholder="Mi Kiosco SRL"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  disabled={saving}
                  className={validationErrors.razonSocial ? 'border-destructive' : ''}
                />
                {validationErrors.razonSocial && (
                  <p className="text-xs text-destructive">{validationErrors.razonSocial}</p>
                )}
              </div>

              {/* Tipo Contribuyente */}
              <div className="space-y-1.5">
                <Label htmlFor="tipoContribuyente" className="text-xs">Tipo Contribuyente</Label>
                <Select value={tipoContribuyente} onValueChange={(v) => setTipoContribuyente(v as TipoContribuyente)} disabled={saving}>
                  <SelectTrigger id="tipoContribuyente" className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monotributista">Monotributista</SelectItem>
                    <SelectItem value="responsable_inscripto">Responsable Inscripto</SelectItem>
                    <SelectItem value="exento">Exento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Punto de Venta */}
              <div className="space-y-1.5">
                <Label htmlFor="puntoVenta" className="text-xs">Punto de Venta</Label>
                <Input
                  id="puntoVenta"
                  type="number"
                  min="1"
                  max="9999"
                  placeholder="1"
                  value={puntoVenta}
                  onChange={(e) => setPuntoVenta(e.target.value)}
                  disabled={saving}
                  className={validationErrors.puntoVenta ? 'border-destructive' : ''}
                />
                {validationErrors.puntoVenta && (
                  <p className="text-xs text-destructive">{validationErrors.puntoVenta}</p>
                )}
              </div>

              {/* Domicilio Fiscal */}
              <div className="space-y-1.5">
                <Label htmlFor="domicilio" className="text-xs">Domicilio Fiscal (opcional)</Label>
                <Input
                  id="domicilio"
                  type="text"
                  placeholder="Calle 123, La Plata, Buenos Aires"
                  value={domicilioFiscal}
                  onChange={(e) => setDomicilioFiscal(e.target.value)}
                  disabled={saving}
                />
              </div>

              {/* Upload Certificado y Clave */}
              <div className="pt-2 border-t space-y-4">
                <p className="text-xs font-medium text-muted-foreground uppercase">Certificados</p>
                <p className="text-xs text-muted-foreground">
                  Obtené tu certificado en ARCA con tu clave fiscal. Tu asesor o Ram te puede ayudar.
                </p>

                {/* Certificado */}
                <div className="space-y-1.5">
                  <Label htmlFor="certificate" className="text-xs">Certificado (.crt o .pem)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="certificate"
                      type="file"
                      accept=".crt,.pem"
                      onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                      disabled={saving}
                      className="text-xs"
                    />
                    {certificateFile && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                  {validationErrors.certificate && (
                    <p className="text-xs text-destructive">{validationErrors.certificate}</p>
                  )}
                </div>

                {/* Clave Privada */}
                <div className="space-y-1.5">
                  <Label htmlFor="key" className="text-xs">Clave Privada (.key o .pem)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="key"
                      type="file"
                      accept=".key,.pem"
                      onChange={(e) => setKeyFile(e.target.files?.[0] || null)}
                      disabled={saving}
                      className="text-xs"
                    />
                    {keyFile && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                  {validationErrors.key && (
                    <p className="text-xs text-destructive">{validationErrors.key}</p>
                  )}
                </div>
              </div>

              {/* Guardar */}
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full"
                variant="default"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Guardar cambios
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Desconectar */}
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
          Desconectar ARCA
        </Button>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER: NO CONFIGURADO
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Encabezado */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-amber-600" />
          <h2 className="text-xl font-bold">Facturación Electrónica ARCA</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Emití facturas electrónicas desde la caja. Opcional — activalo cuando lo necesites.
        </p>
      </div>

      {/* Card con botón para expandir formulario */}
      <Card className="border-amber-200">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-lg">Configurá ARCA</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Guardá tus datos fiscales y certificados para emitir facturas automáticamente.
              </p>
            </div>

            <Button
              onClick={() => setShowForm(!showForm)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white h-12 text-base"
              size="lg"
            >
              {showForm ? (
                <>
                  <ChevronUp className="mr-2 h-5 w-5" />
                  Ocultar formulario
                </>
              ) : (
                <>
                  <ChevronDown className="mr-2 h-5 w-5" />
                  Expandir configuración
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              No te preocupes, podés configurar esto más tarde con ayuda.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Formulario expandido */}
      {showForm && (
        <Card className="border-amber-200 bg-amber-50/30 animate-in fade-in">
          <CardContent className="pt-6 space-y-4">
            {validationErrors.form && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{validationErrors.form}</p>
              </div>
            )}

            {/* CUIT */}
            <div className="space-y-1.5">
              <Label htmlFor="cuit" className="text-xs font-medium">CUIT (11 dígitos)</Label>
              <Input
                id="cuit"
                type="text"
                placeholder="20123456789"
                value={cuit}
                onChange={(e) => setCuit(e.target.value.replace(/\D/g, '').slice(0, 11))}
                disabled={saving}
                className={validationErrors.cuit ? 'border-destructive' : ''}
              />
              {validationErrors.cuit && (
                <p className="text-xs text-destructive">{validationErrors.cuit}</p>
              )}
            </div>

            {/* Razón Social */}
            <div className="space-y-1.5">
              <Label htmlFor="razonSocial" className="text-xs font-medium">Razón Social</Label>
              <Input
                id="razonSocial"
                type="text"
                placeholder="Mi Kiosco SRL"
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                disabled={saving}
                className={validationErrors.razonSocial ? 'border-destructive' : ''}
              />
              {validationErrors.razonSocial && (
                <p className="text-xs text-destructive">{validationErrors.razonSocial}</p>
              )}
            </div>

            {/* Tipo Contribuyente */}
            <div className="space-y-1.5">
              <Label htmlFor="tipoContribuyente" className="text-xs font-medium">Tipo Contribuyente</Label>
              <Select value={tipoContribuyente} onValueChange={(v) => setTipoContribuyente(v as TipoContribuyente)} disabled={saving}>
                <SelectTrigger id="tipoContribuyente" className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monotributista">Monotributista</SelectItem>
                  <SelectItem value="responsable_inscripto">Responsable Inscripto</SelectItem>
                  <SelectItem value="exento">Exento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tipo Factura Default (auto-sugerido) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tipo Factura (auto-sugerido)</Label>
              <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-md">
                <FileText className="h-4 w-4 text-amber-600" />
                <span className="font-mono font-bold text-sm">
                  Tipo {TIPO_CONTRIBUYENTE_MAP[tipoContribuyente].tipoFactura}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({TIPO_CONTRIBUYENTE_MAP[tipoContribuyente].label})
                </span>
              </div>
            </div>

            {/* Punto de Venta */}
            <div className="space-y-1.5">
              <Label htmlFor="puntoVenta" className="text-xs font-medium">Punto de Venta</Label>
              <Input
                id="puntoVenta"
                type="number"
                min="1"
                max="9999"
                placeholder="1"
                value={puntoVenta}
                onChange={(e) => setPuntoVenta(e.target.value)}
                disabled={saving}
                className={validationErrors.puntoVenta ? 'border-destructive' : ''}
              />
              {validationErrors.puntoVenta && (
                <p className="text-xs text-destructive">{validationErrors.puntoVenta}</p>
              )}
            </div>

            {/* Domicilio Fiscal */}
            <div className="space-y-1.5">
              <Label htmlFor="domicilio" className="text-xs font-medium">Domicilio Fiscal (opcional)</Label>
              <Input
                id="domicilio"
                type="text"
                placeholder="Calle 123, La Plata, Buenos Aires"
                value={domicilioFiscal}
                onChange={(e) => setDomicilioFiscal(e.target.value)}
                disabled={saving}
              />
            </div>

            {/* Certificados */}
            <div className="pt-4 border-t space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase">Certificados ARCA</p>
              <p className="text-xs text-muted-foreground">
                Obtené tu certificado en ARCA con tu clave fiscal. Tu asesor o Ram te puede ayudar.
              </p>

              {validationErrors.files && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{validationErrors.files}</p>
                </div>
              )}

              {/* Certificado */}
              <div className="space-y-1.5">
                <Label htmlFor="certificate" className="text-xs font-medium">Certificado (.crt o .pem)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="certificate"
                    type="file"
                    accept=".crt,.pem"
                    onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                    disabled={saving}
                    className="text-xs"
                  />
                  {certificateFile && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  )}
                </div>
                {validationErrors.certificate && (
                  <p className="text-xs text-destructive">{validationErrors.certificate}</p>
                )}
              </div>

              {/* Clave Privada */}
              <div className="space-y-1.5">
                <Label htmlFor="key" className="text-xs font-medium">Clave Privada (.key o .pem)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="key"
                    type="file"
                    accept=".key,.pem"
                    onChange={(e) => setKeyFile(e.target.files?.[0] || null)}
                    disabled={saving}
                    className="text-xs"
                  />
                  {keyFile && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  )}
                </div>
                {validationErrors.key && (
                  <p className="text-xs text-destructive">{validationErrors.key}</p>
                )}
              </div>
            </div>

            {/* Guardar */}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-amber-600 hover:bg-amber-700"
              size="lg"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Guardar configuración
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
