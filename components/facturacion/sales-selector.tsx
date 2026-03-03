'use client'

/**
 * ============================================================================
 * SALES SELECTOR - Selector de ventas para facturar
 * ============================================================================
 *
 * Permite al dueño seleccionar múltiples ventas sin facturar
 * para agruparlas en una factura.
 *
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, FileText, Calendar, CreditCard, Receipt } from 'lucide-react'
import { getUninvoicedSalesAction } from '@/lib/actions/invoicing.actions'
import type { UninvoicedSale } from '@/types/invoicing.types'

// ----------------------------------------------------------------------------
// TIPOS
// ----------------------------------------------------------------------------

interface SalesSelectorProps {
  branchId: string
  onSelectionChange: (selectedIds: string[], totalAmount: number) => void
  onCreateInvoice: (selectedIds: string[]) => void
}

type DateRange = '7' | '15' | '30' | '60'

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

const paymentMethodLabels: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  wallet: 'Billetera',
}

const paymentMethodIcons: Record<string, string> = {
  cash: '💵',
  card: '💳',
  transfer: '🏦',
  wallet: '📱',
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ----------------------------------------------------------------------------
// COMPONENTE
// ----------------------------------------------------------------------------

export function SalesSelector({
  branchId,
  onSelectionChange,
  onCreateInvoice,
}: SalesSelectorProps) {
  // Estado
  const [sales, setSales] = useState<UninvoicedSale[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>('7')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')

  // Cargar ventas sin facturar
  useEffect(() => {
    async function loadSales() {
      setIsLoading(true)
      setError(null)

      const dateFrom = format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd')
      const dateTo = format(new Date(), 'yyyy-MM-dd')

      const result = await getUninvoicedSalesAction({
        branch_id: branchId,
        date_from: dateFrom,
        date_to: dateTo,
        payment_method: paymentFilter !== 'all' ? paymentFilter : undefined,
      })

      if (result.success) {
        setSales(result.sales)
        // Limpiar selección al cambiar filtros
        setSelectedIds(new Set())
      } else {
        setError(result.error || 'Error al cargar ventas')
      }

      setIsLoading(false)
    }

    loadSales()
  }, [branchId, dateRange, paymentFilter])

  // Calcular totales de selección
  const selectionStats = useMemo(() => {
    const selectedSales = sales.filter(s => selectedIds.has(s.id))
    const totalAmount = selectedSales.reduce((sum, s) => sum + s.total, 0)
    return {
      count: selectedIds.size,
      totalAmount,
    }
  }, [sales, selectedIds])

  // Notificar cambios de selección
  useEffect(() => {
    onSelectionChange(Array.from(selectedIds), selectionStats.totalAmount)
  }, [selectedIds, selectionStats.totalAmount, onSelectionChange])

  // Handlers
  const handleToggleAll = () => {
    if (selectedIds.size === sales.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sales.map(s => s.id)))
    }
  }

  const handleToggleSale = (saleId: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(saleId)) {
      newSet.delete(saleId)
    } else {
      newSet.add(saleId)
    }
    setSelectedIds(newSet)
  }

  const handleCreateInvoice = () => {
    onCreateInvoice(Array.from(selectedIds))
  }

  // Render
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Ventas Sin Facturar
          </CardTitle>

          <div className="flex gap-2">
            {/* Filtro por período */}
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 días</SelectItem>
                <SelectItem value="15">Últimos 15 días</SelectItem>
                <SelectItem value="30">Últimos 30 días</SelectItem>
                <SelectItem value="60">Últimos 60 días</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro por método de pago */}
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[140px]">
                <CreditCard className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
                <SelectItem value="wallet">Billetera</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Cargando ventas...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-8 text-destructive">
            {error}
          </div>
        )}

        {/* Sin ventas */}
        {!isLoading && !error && sales.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay ventas sin facturar en este período</p>
          </div>
        )}

        {/* Lista de ventas */}
        {!isLoading && !error && sales.length > 0 && (
          <>
            {/* Header con seleccionar todo */}
            <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-t-lg border-b">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedIds.size === sales.length}
                  onCheckedChange={handleToggleAll}
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  Seleccionar todas ({sales.length})
                </label>
              </div>
              {selectedIds.size > 0 && (
                <Badge variant="secondary">
                  {selectionStats.count} seleccionada{selectionStats.count !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {/* Lista */}
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {sales.map((sale) => (
                <div
                  key={sale.id}
                  className={`flex items-center gap-3 py-3 px-3 hover:bg-muted/30 cursor-pointer transition-colors ${
                    selectedIds.has(sale.id) ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => handleToggleSale(sale.id)}
                >
                  <Checkbox
                    checked={selectedIds.has(sale.id)}
                    onCheckedChange={() => handleToggleSale(sale.id)}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {format(new Date(sale.created_at), "dd/MM HH:mm", { locale: es })}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {paymentMethodIcons[sale.payment_method]} {paymentMethodLabels[sale.payment_method] || sale.payment_method}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {sale.item_count} {sale.item_count === 1 ? 'item' : 'items'}
                      {sale.items_preview && sale.items_preview.length > 0 && (
                        <span className="ml-1">
                          • {sale.items_preview.slice(0, 2).map(i => i.product_name).join(', ')}
                          {sale.items_preview.length > 2 && '...'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-semibold">
                      {formatMoney(sale.total)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer con resumen y botón */}
            <div className="flex items-center justify-between pt-4 mt-2 border-t">
              <div className="text-sm">
                {selectedIds.size > 0 ? (
                  <>
                    <span className="text-muted-foreground">Total seleccionado:</span>
                    <span className="ml-2 font-bold text-lg">
                      {formatMoney(selectionStats.totalAmount)}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    Selecciona ventas para facturar
                  </span>
                )}
              </div>

              <Button
                onClick={handleCreateInvoice}
                disabled={selectedIds.size === 0}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                Generar Factura
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
