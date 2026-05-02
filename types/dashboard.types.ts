/**
 * ===============================================================================
 * DASHBOARD TYPES - Tipos específicos para el dashboard del dueño
 * ===============================================================================
 */

import type { PaymentMethod } from './app.types'

// ─────────────────────────────────────────────────────────────────────────────
// MÉTRICAS DE STOCK
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricaStock {
  capital: number
  unidades: number
  criticos: CriticalItem[]
}

// Tipo para items críticos por vencimiento (alineado con ExpiringItem del servidor)
export interface CriticalItem {
  id: string
  producto_id: string
  nombre: string
  emoji: string | null
  fechaVenc: string
  cantidad: number
  monto: number
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTOS
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductoDashboard {
  id: string
  nombre: string
  categoria: string | null
  precio_venta: number
  costo: number
  emoji: string | null
  codigo_barras?: string | null
  stock_disponible?: number
}

export interface HistorialPrecio {
  created_at: string
  old_price: number | null
  new_price: number
  old_cost: number | null
  new_cost: number | null
  changed_by: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// VENTAS
// ─────────────────────────────────────────────────────────────────────────────

export interface VentaJoin {
  id: string
  fecha_venta: string
  metodo_pago: string
  precio_venta_historico?: number
  costo_unitario_historico?: number
  notas?: string | null
  cantidad: number
  productos: { nombre: string; precio_venta: number; emoji: string } | null
  caja_diaria_id?: string
}

export interface VentaUnificada {
  venta_id: string
  organization_id: string
  sucursal_id: string
  caja_diaria_id: string | null
  fecha_venta: string
  tipo_venta: 'producto' | 'servicio'
  descripcion: string
  icono: string | null
  referencia_id: string
  unidades_vendidas: number
  precio_unitario: number
  monto_total: number
  costo_unitario: number
  ganancia_neta: number
  metodo_pago: string
  notas: string | null
  timestamp_original: string
}

export interface VentaServicio {
  id: string
  fecha_venta: string
  metodo_pago: string
  tipo_servicio: string
  monto_carga: number
  comision: number
  total_cobrado: number
  notas?: string | null
  caja_diaria_id?: string
}

export interface PaymentBreakdown {
  cash: number
  card: number
  transfer: number
  wallet: number
  // Métodos electrónicos introducidos por migration 00010 — mantener en sync
  // con la PaymentBreakdown definida en lib/actions/dashboard.actions.ts.
  mercadopago: number
  posnet_mp: number
  qr_static_mp: number
  transfer_alias: number
}

// ─────────────────────────────────────────────────────────────────────────────
// TURNOS Y AUDITORÍA
// ─────────────────────────────────────────────────────────────────────────────

export interface TurnoAudit {
  id: string
  fecha_apertura: string
  fecha_cierre: string | null
  monto_inicial: number
  monto_final: number | null
  empleado_id: string
  sucursal_id: string
  perfiles: { nombre: string } | null
  misiones: MisionTurno[]
  movimientos_caja: MovimientoCaja[]
}

export interface MisionTurno {
  id: string
  descripcion: string
  es_completada: boolean
  puntos: number
}

export interface MovimientoCaja {
  id: string
  tipo: 'ingreso' | 'egreso'
  monto: number
  categoria: string
  descripcion: string | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// ASISTENCIA
// ─────────────────────────────────────────────────────────────────────────────

export interface AsistenciaRecord {
  id: string
  entrada: string
  salida: string | null
  empleado_id: string
  perfiles: { nombre: string } | null
  sucursal_id: string
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS METRICS
// ─────────────────────────────────────────────────────────────────────────────

export interface BusinessMetrics {
  gross: number
  net: number
  margin: number
  traceable: number
  cash: number
  ROI: number
}

// ─────────────────────────────────────────────────────────────────────────────
// TABS DEL DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

export type DashboardTab =
  | "stock"
  | "ventas"
  | "proveedores"
  | "equipo"
  | "analisis"
  | "historial"
  | "ajustes"

export type SupervisionTab = "cajas" | "asistencia"

// ─────────────────────────────────────────────────────────────────────────────
// PROPS COMPARTIDAS PARA TABS
// ─────────────────────────────────────────────────────────────────────────────

export interface TabBaseProps {
  sucursalId: string
  organizationId: string
  formatMoney: (amount: number | null) => string
  onRefresh: () => void
}

export interface SalesTabProps extends TabBaseProps {
  totalVendido: number
  totalServiciosVendido: number
  paymentBreakdown: PaymentBreakdown
  paymentBreakdownServicios: PaymentBreakdown
  ventasRecientes: VentaJoin[]
  ventasServicios: VentaServicio[]
  chartData: { fecha: string; total: number }[]
  onShowSalesDetail: () => void
}

export interface AlertsTabProps extends TabBaseProps {
  capitalEnRiesgo: MetricaStock
  productos: ProductoDashboard[]
  umbralStockBajo: number
}

export interface FinanceTabProps extends TabBaseProps {
  biMetrics: BusinessMetrics
}

export interface SupervisionTabProps extends TabBaseProps {
  turnosAudit: TurnoAudit[]
  asistencias: AsistenciaRecord[]
  ventasRecientes: VentaJoin[]
  onPrintTurno: (turno: TurnoAudit) => void
}

export interface InventoryTabProps extends TabBaseProps {
  productos: ProductoDashboard[]
  searchQuery: string
  onSearchChange: (query: string) => void
  loading: boolean
  umbralStockBajo: number
  onEditProduct: (product: ProductoDashboard) => void
  onLoadPriceHistory: (productId: string) => void
  onLoadStockBatches: (productId: string) => void
}

export interface TeamTabProps extends TabBaseProps {}

export interface SuppliersTabProps extends TabBaseProps {}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK SNAPSHOT (Landing KPIs)
// ─────────────────────────────────────────────────────────────────────────────

export interface QuickSnapshot {
  success: boolean
  ventasHoy: number
  cantVentas: number
  productosStockBajo: number
  error?: string
}
