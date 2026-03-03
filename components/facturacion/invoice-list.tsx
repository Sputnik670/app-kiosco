'use client'

/**
 * ============================================================================
 * INVOICE LIST - Historial de facturas emitidas
 * ============================================================================
 *
 * Muestra las facturas emitidas con opción de descargar PDF y ver detalles.
 *
 * ============================================================================
 */

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  FileText,
  Download,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { getInvoicesAction, getInvoiceDetailAction } from '@/lib/actions/invoicing.actions'
import type { InvoiceWithSales, InvoiceStatus } from '@/types/invoicing.types'

// ----------------------------------------------------------------------------
// TIPOS
// ----------------------------------------------------------------------------

interface InvoiceListProps {
  branchId: string
  refreshTrigger?: number
}

interface InvoiceDetail {
  id: string
  invoice_type: string
  invoice_number: number
  point_of_sale: number
  customer_name: string | null
  customer_cuit: string | null
  subtotal: number
  tax_amount: number
  total: number
  cae: string | null
  cae_expiry: string | null
  status: string
  issued_at: string | null
  created_at: string
  items: {
    product_name: string
    quantity: number
    unit_price: number
    subtotal: number
  }[]
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const statusConfig: Record<InvoiceStatus, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: {
    label: 'Borrador',
    icon: <Clock className="h-3 w-3" />,
    variant: 'secondary',
  },
  issued: {
    label: 'Emitida',
    icon: <CheckCircle className="h-3 w-3" />,
    variant: 'default',
  },
  cancelled: {
    label: 'Anulada',
    icon: <XCircle className="h-3 w-3" />,
    variant: 'destructive',
  },
}

// ----------------------------------------------------------------------------
// COMPONENTE
// ----------------------------------------------------------------------------

export function InvoiceList({ branchId, refreshTrigger }: InvoiceListProps) {
  const [invoices, setInvoices] = useState<InvoiceWithSales[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Estado del modal de detalle
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  // Cargar facturas
  useEffect(() => {
    async function loadInvoices() {
      setIsLoading(true)
      setError(null)

      const result = await getInvoicesAction({
        branch_id: branchId,
      })

      if (result.success) {
        setInvoices(result.invoices)
      } else {
        setError(result.error || 'Error al cargar facturas')
      }

      setIsLoading(false)
    }

    loadInvoices()
  }, [branchId, refreshTrigger])

  // Cargar detalle de factura
  const handleViewDetail = async (invoiceId: string) => {
    setIsLoadingDetail(true)

    const result = await getInvoiceDetailAction(invoiceId)

    if (result.success && result.invoice) {
      setSelectedInvoice(result.invoice)
    }

    setIsLoadingDetail(false)
  }

  // Descargar PDF (placeholder - se implementará con generar-ticket.ts)
  const handleDownloadPdf = async (invoice: InvoiceWithSales) => {
    // TODO: Implementar generación de PDF de factura
    console.log('Descargar PDF de factura:', invoice.id)
    alert('La descarga de PDF se implementará próximamente')
  }

  // Render
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Facturas Emitidas
          </CardTitle>
        </CardHeader>

        <CardContent>
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Cargando facturas...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center justify-center py-8 text-destructive gap-2">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          )}

          {/* Sin facturas */}
          {!isLoading && !error && invoices.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay facturas emitidas</p>
            </div>
          )}

          {/* Tabla de facturas */}
          {!isLoading && !error && invoices.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const status = statusConfig[invoice.status as InvoiceStatus]
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <span className="font-mono">
                          {String(invoice.point_of_sale).padStart(4, '0')}-
                          {String(invoice.invoice_number).padStart(8, '0')}
                        </span>
                        <Badge variant="outline" className="ml-2">
                          {invoice.invoice_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.created_at), "dd/MM/yyyy", { locale: es })}
                      </TableCell>
                      <TableCell>
                        {invoice.customer_name || 'Consumidor Final'}
                        {invoice.customer_cuit && (
                          <span className="block text-xs text-muted-foreground">
                            CUIT: {invoice.customer_cuit}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatMoney(invoice.total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          {status.icon}
                          {status.label}
                        </Badge>
                        {invoice.is_mock && (
                          <Badge variant="outline" className="ml-1 text-xs">
                            Mock
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetail(invoice.id)}
                            disabled={isLoadingDetail}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {invoice.status === 'issued' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadPdf(invoice)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalle */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Factura {selectedInvoice?.invoice_type}{' '}
              {selectedInvoice && (
                <span className="font-mono">
                  {String(selectedInvoice.point_of_sale).padStart(4, '0')}-
                  {String(selectedInvoice.invoice_number).padStart(8, '0')}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              {/* Datos del comprobante */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Fecha de emisión:</span>
                  <p className="font-medium">
                    {selectedInvoice.issued_at
                      ? format(new Date(selectedInvoice.issued_at), "dd/MM/yyyy HH:mm", { locale: es })
                      : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">CAE:</span>
                  <p className="font-mono">{selectedInvoice.cae || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cliente:</span>
                  <p className="font-medium">
                    {selectedInvoice.customer_name || 'Consumidor Final'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">CUIT:</span>
                  <p className="font-mono">{selectedInvoice.customer_cuit || '-'}</p>
                </div>
              </div>

              <Separator />

              {/* Items */}
              <div>
                <h4 className="font-medium mb-2">Detalle</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(item.subtotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Separator />

              {/* Totales */}
              <div className="space-y-1 text-right">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatMoney(selectedInvoice.subtotal)}</span>
                </div>
                {selectedInvoice.tax_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IVA 21%:</span>
                    <span>{formatMoney(selectedInvoice.tax_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>TOTAL:</span>
                  <span>{formatMoney(selectedInvoice.total)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
