/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📋 APP TYPES - Tipos centralizados para toda la aplicación
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Este archivo contiene todos los tipos compartidos entre componentes y actions.
 * Elimina la necesidad de definir interfaces duplicadas en cada archivo.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import type { User } from '@supabase/supabase-js'

// ───────────────────────────────────────────────────────────────────────────────
// ROLES Y AUTENTICACIÓN
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Roles del sistema (valores en inglés para la BD)
 */
export type UserRole = 'owner' | 'employee'

/**
 * Roles para display en UI (valores en español)
 */
export type UserRoleDisplay = 'dueño' | 'empleado'

/**
 * Usuario de Supabase Auth (re-export para conveniencia)
 */
export type { User as SupabaseUser }

/**
 * Contexto de usuario en la organización
 */
export interface UserOrgContext {
  userId: string
  organizationId: string
  sucursalId: string | null
  role: UserRole
  isOwner: boolean
}

/**
 * Perfil de usuario completo
 */
export interface UserProfile {
  id: string
  nombre: string
  email: string
  organization_id: string | null
  sucursal_id: string | null
  activo: boolean
  xp: number
  nivel: number
  puntos: number
  created_at: string
}

// ───────────────────────────────────────────────────────────────────────────────
// ORGANIZACIÓN Y SUCURSALES
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Organización/Empresa
 */
export interface Organization {
  id: string
  nombre: string
  owner_id: string
  plan: 'free' | 'basic' | 'premium' | 'enterprise'
  created_at: string
}

/**
 * Sucursal básica
 */
export interface Branch {
  id: string
  nombre: string
  direccion: string | null
  organization_id: string
  qr_entrada_url: string | null
  qr_salida_url: string | null
  created_at: string
}

/**
 * Sucursal para selects (simplificada)
 */
export interface BranchOption {
  id: string
  nombre: string
}

// ───────────────────────────────────────────────────────────────────────────────
// PRODUCTOS E INVENTARIO
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Producto del catálogo
 */
export interface Product {
  id: string
  nombre: string
  categoria: string | null
  codigo_barras: string | null
  costo: number
  precio_venta: number
  stock_minimo: number | null
  vida_util_dias: number | null
  emoji: string | null
  organization_id: string
  created_at: string
}

/**
 * Producto con stock disponible (de view_productos_con_stock)
 */
export interface ProductWithStock {
  id: string
  nombre: string
  categoria: string | null
  codigo_barras: string | null
  costo: number | null
  emoji: string | null
  precio_venta: number
  stock_disponible: number
  stock_minimo: number | null
  sucursal_id: string
  organization_id: string
}

/**
 * Producto para visualización en dashboard/listas
 */
export interface ProductDisplay {
  id: string
  nombre: string
  categoria: string | null
  precio_venta: number
  costo: number
  emoji: string | null
  codigo_barras?: string | null
  stock_disponible?: number
}

/**
 * Producto crítico (stock bajo o próximo a vencer)
 */
export interface CriticalProduct {
  id: string
  nombre: string
  emoji: string | null
  stock_disponible: number
  stock_minimo: number | null
  dias_para_vencer: number | null
  razon: 'stock_bajo' | 'proximo_vencer' | 'vencido'
  sucursal_id: string
  producto_id: string
}

/**
 * Métricas de stock/inventario
 */
export interface StockMetrics {
  capital: number
  unidades: number
  criticos: CriticalProduct[]
}

/**
 * Historial de cambio de precios
 */
export interface PriceHistory {
  fecha_cambio: string
  precio_venta_anterior: number
  precio_venta_nuevo: number
  costo_anterior: number
  costo_nuevo: number
  empleado?: { nombre: string }
}

// ───────────────────────────────────────────────────────────────────────────────
// VENTAS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Métodos de pago disponibles (valores en inglés para BD)
 */
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'wallet'

/**
 * Métodos de pago en español (para UI legacy)
 * @deprecated Usar PaymentMethod con valores en inglés
 */
export type PaymentMethodLegacy = 'efectivo' | 'tarjeta' | 'transferencia' | 'billetera_virtual' | 'otro'

/**
 * Venta unificada (productos + servicios)
 */
export interface UnifiedSale {
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
  metodo_pago: PaymentMethod
  notas: string | null
  timestamp_original: string
}

/**
 * Venta de producto (legacy - con join)
 */
export interface ProductSale {
  id: string
  fecha_venta: string
  metodo_pago: PaymentMethod
  precio_venta_historico?: number
  costo_unitario_historico?: number
  notas?: string | null
  cantidad: number
  productos: { nombre: string; precio_venta: number; emoji: string } | null
  caja_diaria_id?: string
}

/**
 * Venta de servicio (SUBE, recargas, etc.)
 */
export interface ServiceSale {
  id: string
  fecha_venta: string
  metodo_pago: PaymentMethod
  tipo_servicio: string
  monto_carga: number
  comision: number
  total_cobrado: number
  notas?: string | null
  caja_diaria_id?: string
}

/**
 * Desglose de pagos por método
 */
export interface PaymentBreakdown {
  efectivo: number
  tarjeta: number
  transferencia: number
  billetera_virtual: number
  otro: number
}

/**
 * Item de venta para procesar
 */
export interface SaleItem {
  producto_id: string
  cantidad: number
  precio_unitario: number
  nombre: string
  subtotal: number
}

// ───────────────────────────────────────────────────────────────────────────────
// CAJA Y FINANZAS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Caja diaria / Cash Register (nuevo schema)
 */
export interface CashRegister {
  id: string
  organization_id: string
  branch_id: string
  date: string
  opening_amount: number
  closing_amount: number | null
  expected_amount: number | null
  variance: number | null
  is_open: boolean
  opened_by: string | null
  closed_by: string | null
  opened_at: string
  closed_at: string | null
  created_at: string
}

/**
 * Caja diaria legacy (para compatibilidad con componentes existentes)
 * @deprecated Usar CashRegister con campos en inglés
 */
export interface DailyCash {
  id: string
  fecha_apertura: string
  fecha_cierre: string | null
  monto_inicial: number
  monto_final: number | null
  diferencia: number | null
  empleado_id: string
  sucursal_id: string
  organization_id: string
  created_at: string
}

/**
 * Turno con datos de auditoría
 */
export interface ShiftAudit {
  id: string
  fecha_apertura: string
  fecha_cierre: string | null
  monto_inicial: number
  monto_final: number | null
  empleado_id: string
  sucursal_id: string
  empleado: { nombre: string } | null
  misiones: Mission[]
  movimientos_caja: CashMovement[]
}

/**
 * Movimiento de caja (nuevo schema)
 */
export interface CashMovement {
  id: string
  cash_register_id: string
  organization_id: string
  type: 'income' | 'expense' | 'opening' | 'closing' | 'adjustment'
  amount: number
  category: string | null
  description: string | null
  sale_id: string | null
  user_id: string | null
  created_at: string
}

/**
 * Movimiento de caja legacy (para compatibilidad)
 * @deprecated Usar CashMovement con campos en inglés
 */
export interface CashMovementLegacy {
  id: string
  caja_diaria_id: string
  organization_id: string
  tipo: 'ingreso' | 'egreso'
  monto: number
  categoria: string
  descripcion: string | null
  created_at: string
}

// ───────────────────────────────────────────────────────────────────────────────
// MISIONES Y GAMIFICACIÓN
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Tipos de misión
 */
export type MissionType = 'vencimiento' | 'arqueo_cierre' | 'manual'

/**
 * Misión de empleado (nuevo schema)
 */
export interface Mission {
  id: string
  organization_id: string
  user_id: string
  cash_register_id: string | null
  type: string
  description: string | null
  target_value: number
  current_value: number
  points: number
  is_completed: boolean
  completed_at: string | null
  created_at: string
}

/**
 * Misión legacy (para compatibilidad con componentes existentes)
 * @deprecated Usar Mission con campos en inglés
 */
export interface MissionLegacy {
  id: string
  organization_id: string
  empleado_id: string
  caja_diaria_id: string | null
  tipo: MissionType
  descripcion: string
  objetivo_unidades: number | null
  unidades_completadas: number
  es_completada: boolean
  puntos: number
  created_at: string
}

/**
 * Misión para display en UI
 */
export interface MissionDisplay {
  id: string
  descripcion: string
  puntos: number
  es_completada: boolean
  tipo: MissionType
  progreso?: number // porcentaje 0-100
}

// ───────────────────────────────────────────────────────────────────────────────
// ASISTENCIA Y FICHAJE
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Registro de asistencia
 */
export interface AttendanceRecord {
  id: string
  empleado_id: string
  sucursal_id: string
  organization_id: string
  entrada: string
  salida: string | null
  created_at: string
}

/**
 * Asistencia con datos del empleado
 */
export interface AttendanceWithEmployee {
  id: string
  entrada: string
  salida: string | null
  empleado_id: string
  empleado: { nombre: string } | null
  sucursal_id: string
}

// ───────────────────────────────────────────────────────────────────────────────
// PROVEEDORES
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Proveedor
 */
export interface Supplier {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  condicion_pago: string | null
  contacto_nombre: string | null
  rubro: string | null
  saldo_actual: number
  organization_id: string
  sucursal_id: string | null
  created_at: string
}

// ───────────────────────────────────────────────────────────────────────────────
// MÉTRICAS Y REPORTES
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Métricas de negocio del dashboard
 */
export interface BusinessMetrics {
  ventasTotales: number
  gananciaTotal: number
  margenPromedio: number
  ticketPromedio: number
  cantidadVentas: number
  topProductos: { name: string; count: number }[]
}

/**
 * Resumen de capital
 */
export interface CapitalSummary {
  capitalFisico: number
  saldoVirtual: number
  total: number
}

// ───────────────────────────────────────────────────────────────────────────────
// ESTADOS Y RESULTADOS GENÉRICOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Resultado de operación genérico
 */
export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Estado de sincronización
 */
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

/**
 * Estado de carga
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'
