'use client'

/**
 * ============================================================================
 * INVOICE FORM - Formulario para crear y emitir facturas
 * ============================================================================
 *
 * Modal/Dialog que permite ingresar datos del cliente y emitir la factura.
 * Se muestra después de seleccionar ventas para facturar.
 *
 * ============================================================================
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileText, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createInvoiceDraftAction,
  issueInvoiceAction,
} from '@/lib/actions/invoicing.actions'
import {
  type InvoiceType,
  type CustomerTaxStatus,
  type FiscalConfig,
  formatCuit,
  isValidCuit,
  calculateTax,
} from '@/types/invoicing.types'

// ----------------------------------------------------------------------------
// TIPOS
// ----------------------------------------------------------------------------

interface InvoiceFormProps {
  open: boolean
  onClose: () => void
  branchId: string
  saleIds: string[]
  totalAmount: number
  fiscalConfig: FiscalConfig
  onSuccess: () => void
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const taxStatusLabels: Record<CustomerTaxStatus, string> = {
  RI: 'Responsable Inscripto',
  MONO: 'Monotributista',
  CF: 'Consumidor Final',
  EX: 'Exento',
}

// ----------------------------------------------------------------------------
// COMPONENTE
// ----------------------------------------------------------------------------

export function InvoiceForm({
  open,
  onClose,
  branchId,
  saleIds,
  totalAmount,
  fiscalConfig,
  onSuccess,
}: InvoiceFormProps) {
  // Estado del formulario
  const [invoiceType, setInvoiceType] = useState<InvoiceType>(
    fiscalConfig.tax_status === 'MONO' ? 'C' : 'B'
  )
  const [customerCuit, setCustomerCuit] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerTaxStatus, setCustomerTaxStatus] = useState<CustomerTaxStatus>('CF')

  // Estado de proceso
  const [isProcessing, setIsProcessing] = useState(false)
  const [step, setStep] = useState<'form' | 'preview' | 'success'>('form')
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [cae, setCae] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Calcular totales según tipo de factura
  const { taxAmount, total } = calculateTax(totalAmount, invoiceType)

  // Validaciones
  const isFacturaA = invoiceType === 'A'
  const cuitValid = !customerCuit || isValidCuit(customerCuit)
  const canSubmit = !isFacturaA || (customerCuit && cuitValid && customerName)

  // Handlers
  const handleCuitChange = (value: string) => {
    // Solo permitir números y guiones
    const cleaned = value.replace(/[^\d-]/g, '')
    setCustomerCuit(cleaned)

    // Auto-determinar tipo de factura si el emisor es RI
    if (fiscalConfig.tax_status === 'RI' && isValidCuit(cleaned)) {
      // Si ingresa CUIT, probablemente es RI → Factura A
      setInvoiceType('A')
      setCustomerTaxStatus('RI')
    }
  }

  const handleTaxStatusChange = (value: CustomerTaxStatus) => {
    setCustomerTaxStatus(value)

    // Ajustar tipo de factura
    if (fiscalConfig.tax_status === 'RI') {
      if (value === 'RI') {
        setInvoiceType('A')
      } else {
        setInvoiceType('B')
      }
    }
  }

  const handleCreateDraft = async () => {
    setIsProcessing(true)
    setError(null)

    try {
      const result = await createInvoiceDraftAction({
        branch_id: branchId,
        sale_ids: saleIds,
        invoice_type: invoiceType,
        customer_cuit: customerCuit || undefined,
        customer_name: customerName || undefined,
        customer_tax_status: customerTaxStatus,
      })

      if (!result.success) {
        setError(result.error || 'Error al crear factura')
        return
      }

      setInvoiceId(result.invoice?.id || null)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleIssueInvoice = async () => {
    if (!invoiceId) return

    setIsProcessing(true)
    setError(null)

    try {
      const result = await issueInvoiceAction(invoiceId)

      if (!result.success) {
        setError(result.error || 'Error al emitir factura')
        return
      }

      setCae(result.cae || null)
      setStep('success')
      toast.success('Factura emitida correctamente')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    // Limpiar estado
    setStep('form')
    setInvoiceId(null)
    setCae(null)
    setError(null)
    setCustomerCuit('')
    setCustomerName('')
    setCustomerTaxStatus('CF')

    if (step === 'success') {
      onSuccess()
    }
    onClose()
  }

  // Render según paso
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {/* PASO 1: Formulario de datos */}
        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Generar Factura
              </DialogTitle>
              <DialogDescription>
                {saleIds.length} venta{saleIds.length !== 1 ? 's' : ''} seleccionada{saleIds.length !== 1 ? 's' : ''}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Tipo de factura */}
              <div className="space-y-2">
                <Label>Tipo de Comprobante</Label>
                <RadioGroup
                  value={invoiceType}
                  onValueChange={(v) => setInvoiceType(v as InvoiceType)}
                  className="flex gap-4"
                  disabled={fiscalConfig.tax_status === 'MONO'}
                >
                  {fiscalConfig.tax_status === 'RI' && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="A" id="type-a" />
                      <Label htmlFor="type-a" className="cursor-pointer">
                        Factura A
                      </Label>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value={fiscalConfig.tax_status === 'MONO' ? 'C' : 'B'}
                      id="type-b"
                    />
                    <Label htmlFor="type-b" className="cursor-pointer">
                      Factura {fiscalConfig.tax_status === 'MONO' ? 'C' : 'B'}
                    </Label>
                  </div>
                </RadioGroup>
                {fiscalConfig.tax_status === 'MONO' && (
                  <p className="text-xs text-muted-foreground">
                    Como Monotributista solo puede emitir Factura C
                  </p>
                )}
              </div>

              <Separator />

              {/* Datos del cliente */}
              <div className="space-y-3">
                <Label className="text-base">Datos del Cliente</Label>

                {/* CUIT/DNI */}
                <div className="space-y-1.5">
                  <Label htmlFor="cuit" className="text-sm">
                    CUIT/DNI {isFacturaA && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="cuit"
                    placeholder="XX-XXXXXXXX-X"
                    value={customerCuit}
                    onChange={(e) => handleCuitChange(e.target.value)}
                    className={!cuitValid ? 'border-destructive' : ''}
                  />
                  {!cuitValid && customerCuit && (
                    <p className="text-xs text-destructive">CUIT inválido</p>
                  )}
                </div>

                {/* Razón Social */}
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm">
                    Razón Social {isFacturaA && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="name"
                    placeholder="Nombre o razón social"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                {/* Condición IVA */}
                <div className="space-y-1.5">
                  <Label htmlFor="tax-status" className="text-sm">
                    Condición frente al IVA
                  </Label>
                  <Select
                    value={customerTaxStatus}
                    onValueChange={(v) => handleTaxStatusChange(v as CustomerTaxStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CF">Consumidor Final</SelectItem>
                      <SelectItem value="RI">Responsable Inscripto</SelectItem>
                      <SelectItem value="MONO">Monotributista</SelectItem>
                      <SelectItem value="EX">Exento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Resumen de montos */}
              <div className="space-y-2 bg-muted/50 p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatMoney(totalAmount)}</span>
                </div>
                {invoiceType === 'A' && (
                  <div className="flex justify-between text-sm">
                    <span>IVA 21%:</span>
                    <span>{formatMoney(taxAmount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>TOTAL:</span>
                  <span>{formatMoney(total)}</span>
                </div>
                {invoiceType !== 'A' && (
                  <p className="text-xs text-muted-foreground">
                    IVA incluido en el precio
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateDraft}
                disabled={!canSubmit || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Continuar'
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* PASO 2: Confirmación antes de emitir */}
        {step === 'preview' && (
          <>
            <DialogHeader>
              <DialogTitle>Confirmar Emisión</DialogTitle>
              <DialogDescription>
                Revisa los datos antes de emitir la factura
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo:</span>
                  <span className="font-medium">Factura {invoiceType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-medium">
                    {customerName || 'Consumidor Final'}
                  </span>
                </div>
                {customerCuit && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CUIT:</span>
                    <span className="font-medium">{formatCuit(customerCuit)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cond. IVA:</span>
                  <span className="font-medium">{taxStatusLabels[customerTaxStatus]}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatMoney(total)}</span>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Una vez emitida, la factura no podrá modificarse.
                  {fiscalConfig.arca_environment === 'testing' && (
                    <span className="block mt-1 text-amber-600">
                      Ambiente de prueba: el CAE será simulado.
                    </span>
                  )}
                </AlertDescription>
              </Alert>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('form')}>
                Volver
              </Button>
              <Button onClick={handleIssueInvoice} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Emitiendo...
                  </>
                ) : (
                  'Emitir Factura'
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* PASO 3: Éxito */}
        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                Factura Emitida
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-green-50 p-4 rounded-lg space-y-2 text-center">
                <p className="text-lg font-bold text-green-700">
                  Factura {invoiceType} emitida correctamente
                </p>
                {cae && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">CAE: </span>
                    <span className="font-mono">{cae}</span>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Puedes descargar el PDF desde el historial de facturas
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Cerrar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
