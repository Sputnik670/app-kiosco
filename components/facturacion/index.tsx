'use client'

/**
 * ============================================================================
 * FACTURACION - Componente principal de facturación
 * ============================================================================
 *
 * Integra el selector de ventas, formulario de factura y listado de facturas
 * en una sola vista para el dashboard del dueño.
 *
 * ============================================================================
 */

import { useState, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FileText, History, Settings, AlertCircle } from 'lucide-react'
import { SalesSelector } from './sales-selector'
import { InvoiceForm } from './invoice-form'
import { InvoiceList } from './invoice-list'
import type { FiscalConfig } from '@/types/invoicing.types'

// ----------------------------------------------------------------------------
// TIPOS
// ----------------------------------------------------------------------------

interface FacturacionProps {
  branchId: string
  fiscalConfig: FiscalConfig | null
  onConfigureClick: () => void
}

// ----------------------------------------------------------------------------
// COMPONENTE
// ----------------------------------------------------------------------------

export function Facturacion({
  branchId,
  fiscalConfig,
  onConfigureClick,
}: FacturacionProps) {
  // Estado de selección
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([])
  const [selectedTotal, setSelectedTotal] = useState(0)

  // Estado del formulario
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)

  // Trigger para refrescar listas
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Handlers
  const handleSelectionChange = useCallback((ids: string[], total: number) => {
    setSelectedSaleIds(ids)
    setSelectedTotal(total)
  }, [])

  const handleCreateInvoice = useCallback((ids: string[]) => {
    setSelectedSaleIds(ids)
    setShowInvoiceForm(true)
  }, [])

  const handleInvoiceSuccess = useCallback(() => {
    setSelectedSaleIds([])
    setSelectedTotal(0)
    setRefreshTrigger(prev => prev + 1)
  }, [])

  // Si no hay configuración fiscal, mostrar mensaje
  if (!fiscalConfig || !fiscalConfig.enabled) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Facturación no configurada</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-3">
            Para emitir facturas electrónicas, primero debes configurar tus datos fiscales
            (CUIT, condición IVA, punto de venta).
          </p>
          <Button onClick={onConfigureClick} variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configurar Facturación
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabs principales */}
      <Tabs defaultValue="crear" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="crear" className="gap-2">
            <FileText className="h-4 w-4" />
            Crear Factura
          </TabsTrigger>
          <TabsTrigger value="historial" className="gap-2">
            <History className="h-4 w-4" />
            Historial
          </TabsTrigger>
        </TabsList>

        {/* Tab: Crear Factura */}
        <TabsContent value="crear" className="mt-4">
          <SalesSelector
            branchId={branchId}
            onSelectionChange={handleSelectionChange}
            onCreateInvoice={handleCreateInvoice}
          />
        </TabsContent>

        {/* Tab: Historial */}
        <TabsContent value="historial" className="mt-4">
          <InvoiceList
            branchId={branchId}
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>
      </Tabs>

      {/* Modal de formulario */}
      <InvoiceForm
        open={showInvoiceForm}
        onClose={() => setShowInvoiceForm(false)}
        branchId={branchId}
        saleIds={selectedSaleIds}
        totalAmount={selectedTotal}
        fiscalConfig={fiscalConfig}
        onSuccess={handleInvoiceSuccess}
      />
    </div>
  )
}

// Re-exportar componentes individuales
export { SalesSelector } from './sales-selector'
export { InvoiceForm } from './invoice-form'
export { InvoiceList } from './invoice-list'
