/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🛡️ VALIDACIONES ZOD - Schemas reutilizables
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Schemas de validación centralizados para Server Actions.
 * Previenen datos malformados antes de llegar a la BD.
 *
 * USO:
 *   import { confirmSaleSchema } from '@/lib/validations'
 *   const parsed = confirmSaleSchema.safeParse(params)
 *   if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod'

// ───────────────────────────────────────────────────────────────────────────────
// PRIMITIVOS REUTILIZABLES
// ───────────────────────────────────────────────────────────────────────────────

export const idSchema = z.string().min(1, 'ID es requerido')
export const positiveNumber = z.number().positive('El valor debe ser mayor a 0')
export const nonNegativeNumber = z.number().min(0, 'El valor no puede ser negativo')
export const nonEmptyString = z.string().min(1, 'Este campo es requerido')
export const emailSchema = z.string().email('Email inválido').transform(v => v.toLowerCase().trim())

// ───────────────────────────────────────────────────────────────────────────────
// AUTH
// ───────────────────────────────────────────────────────────────────────────────

export const completeProfileSchema = z.object({
  userId: nonEmptyString,
  email: emailSchema,
  name: z.string().min(1, 'El nombre es requerido').max(100, 'Nombre demasiado largo'),
  role: z.enum(['dueño', 'empleado'], { message: 'Rol inválido' }),
  inviteToken: z.string().optional(),
})

export const resetPasswordSchema = z.object({
  email: emailSchema,
  redirectTo: z.string().url().optional(),
})

// ───────────────────────────────────────────────────────────────────────────────
// VENTAS
// ───────────────────────────────────────────────────────────────────────────────

export const paymentMethodSchema = z.enum(['cash', 'card', 'transfer', 'wallet'], {
  message: 'Método de pago inválido',
})

export const saleItemSchema = z.object({
  product_id: idSchema,
  quantity: z.number().int('La cantidad debe ser un número entero').positive('La cantidad debe ser mayor a 0'),
  unit_price: nonNegativeNumber,
  subtotal: nonNegativeNumber,
})

export const confirmSaleSchema = z.object({
  branchId: idSchema,
  cashRegisterId: idSchema,
  items: z.array(saleItemSchema).min(1, 'La venta debe tener al menos un producto'),
  paymentMethod: paymentMethodSchema,
  total: positiveNumber,
  localId: z.string().optional(),
  notes: z.string().max(500, 'Las notas no pueden exceder 500 caracteres').optional(),
})

export const searchProductsSchema = z.object({
  query: z.string().max(200, 'Búsqueda demasiado larga'),
  branchId: idSchema,
})

// ───────────────────────────────────────────────────────────────────────────────
// CAJA
// ───────────────────────────────────────────────────────────────────────────────

export const abrirCajaSchema = z.object({
  montoInicial: nonNegativeNumber,
  sucursalId: idSchema,
})

export const cerrarCajaSchema = z.object({
  cajaId: idSchema,
  montoDeclarado: nonNegativeNumber,
})

export const cashMovementSchema = z.object({
  monto: positiveNumber,
  descripcion: z.string().min(1, 'La descripción es requerida').max(300, 'Descripción demasiado larga'),
  tipo: z.enum(['ingreso', 'egreso'], { message: 'Tipo de movimiento inválido' }),
  turnoId: idSchema,
  categoria: z.string().max(100).optional(),
})

// ───────────────────────────────────────────────────────────────────────────────
// INVENTARIO
// ───────────────────────────────────────────────────────────────────────────────

export const handleProductScanSchema = z.object({
  barcode: nonEmptyString,
  organizationId: idSchema,
  sucursalId: idSchema,
})

export const complexStockEntrySchema = z.object({
  productoId: idSchema,
  sucursalId: idSchema,
  cantidad: z.number().int('La cantidad debe ser un número entero').positive('La cantidad debe ser mayor a 0'),
  fechaVencimiento: z.string().min(1, 'La fecha de vencimiento es requerida'),
  costoUnitario: positiveNumber.optional(),
  proveedorId: idSchema.optional(),
  estadoPago: z.enum(['pendiente', 'pagado']).optional(),
  medioPago: z.enum(['efectivo', 'transferencia', 'debito']).optional(),
  fechaVencimientoPago: z.string().optional(),
})

// ───────────────────────────────────────────────────────────────────────────────
// ASISTENCIA / FICHAJE
// ───────────────────────────────────────────────────────────────────────────────

export const toggleAttendanceSchema = z.object({
  sucursalId: idSchema,
})

export const processQRScanSchema = z.object({
  qrData: z.object({
    tipo: z.enum(['entrada', 'salida'], { message: 'Tipo de QR inválido' }),
    sucursal_id: idSchema,
    sucursal_nombre: nonEmptyString,
  }),
  sucursalId: idSchema,
})

// ───────────────────────────────────────────────────────────────────────────────
// TURNOS (SHIFT)
// ───────────────────────────────────────────────────────────────────────────────

export const openShiftSchema = z.object({
  montoInicial: nonNegativeNumber,
})

export const closeShiftSchema = z.object({
  shiftId: idSchema,
  montoFinal: nonNegativeNumber,
})

// ───────────────────────────────────────────────────────────────────────────────
// INCIDENTES
// ───────────────────────────────────────────────────────────────────────────────

export const createIncidentSchema = z.object({
  employeeId: idSchema,
  branchId: idSchema.optional(),
  cashRegisterId: idSchema.optional(),
  type: z.enum(['error', 'cash_difference', 'stock_loss', 'attendance', 'other'], {
    message: 'Tipo de incidente inválido',
  }),
  description: z.string().min(1, 'La descripción es requerida').max(1000, 'Descripción demasiado larga'),
  severity: z.enum(['low', 'medium', 'high'], { message: 'Severidad inválida' }),
  resolution: z.string().max(1000, 'Resolución demasiado larga').optional(),
})

export const justifyIncidentSchema = z.object({
  incidentId: idSchema,
  justification: z.string().min(1, 'La justificación es requerida').max(1000, 'Justificación demasiado larga'),
  justificationType: z.enum(['desconocimiento', 'olvido', 'externo', 'otro'], {
    message: 'Tipo de justificación inválido',
  }),
})

export const resolveIncidentSchema = z.object({
  incidentId: idSchema,
  status: z.enum(['resolved', 'dismissed'], { message: 'Estado inválido' }),
  resolution: z.string().max(1000, 'Resolución demasiado larga').optional(),
})

// ───────────────────────────────────────────────────────────────────────────────
// NOTAS DEL DUEÑO
// ───────────────────────────────────────────────────────────────────────────────

export const createNoteSchema = z.object({
  noteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  title: z.string().max(200, 'Título demasiado largo').optional(),
  content: z.string().min(1, 'El contenido es requerido').max(5000, 'Contenido demasiado largo'),
  category: z.string().max(100, 'Categoría demasiado larga').optional(),
  branchId: idSchema.optional(),
  pinned: z.boolean().optional(),
})

export const updateNoteSchema = z.object({
  id: idSchema,
  title: z.string().max(200, 'Título demasiado largo').optional(),
  content: z.string().min(1, 'El contenido es requerido').max(5000, 'Contenido demasiado largo').optional(),
  category: z.string().max(100, 'Categoría demasiado larga').optional(),
  noteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido').optional(),
  pinned: z.boolean().optional(),
})

// ───────────────────────────────────────────────────────────────────────────────
// PROVEEDORES
// ───────────────────────────────────────────────────────────────────────────────

export const createProviderSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(200, 'Nombre demasiado largo'),
  tax_id: z.string().max(50, 'CUIT demasiado largo').optional(),
  phone: z.string().max(50, 'Teléfono demasiado largo').optional(),
  email: emailSchema.optional().or(z.literal('')),
  rubro: z.string().max(100, 'Rubro demasiado largo').optional(),
  sucursalId: idSchema,
})

export const rechargeBalanceSchema = z.object({
  providerId: idSchema,
  monto: positiveNumber,
})

export const updateProviderMarkupSchema = z.object({
  providerId: idSchema,
  markupType: z.enum(['percentage', 'fixed'], { message: 'Tipo de markup inválido' }),
  markupValue: z.number().min(0, 'El markup no puede ser negativo').max(100, 'Markup excede el máximo'),
})

// ───────────────────────────────────────────────────────────────────────────────
// PRODUCTOS
// ───────────────────────────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  codigo_barras: z.string().max(100, 'Código de barras demasiado largo').nullable().optional(),
  nombre: z.string().min(1, 'El nombre es requerido').max(200, 'Nombre demasiado largo'),
  categoria: z.string().min(1, 'La categoría es requerida').max(100, 'Categoría demasiado larga'),
  precio_venta: nonNegativeNumber,
  costo: nonNegativeNumber,
  emoji: z.string().max(10, 'Emoji demasiado largo'),
  fecha_vencimiento: z.string().nullable().optional(),
  cantidad_inicial: z.number().int('Cantidad debe ser entero').min(0, 'Cantidad no puede ser negativa'),
  sucursalId: idSchema,
})

export const updateProductSchema = z.object({
  productId: idSchema,
  nombre: z.string().min(1, 'El nombre es requerido').max(200, 'Nombre demasiado largo'),
  precio_venta: nonNegativeNumber,
  costo: nonNegativeNumber,
  categoria: z.string().min(1, 'La categoría es requerida').max(100),
  emoji: z.string().max(10).optional(),
  codigo_barras: z.string().max(100).optional(),
})

export const massivePriceUpdateSchema = z.object({
  percentage: z.number().min(-99, 'Descuento máximo 99%').max(1000, 'Aumento máximo 1000%'),
  category: z.string().optional(),
  branchId: idSchema.optional(),
})

// ───────────────────────────────────────────────────────────────────────────────
// SUCURSALES (BRANCHES)
// ───────────────────────────────────────────────────────────────────────────────

export const createBranchSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(200, 'Nombre demasiado largo'),
  direccion: z.string().min(1, 'La dirección es requerida').max(500, 'Dirección demasiado larga'),
})

export const updateBranchSchema = z.object({
  branchId: idSchema,
  nombre: z.string().min(1, 'El nombre es requerido').max(200, 'Nombre demasiado largo'),
  direccion: z.string().max(500, 'Dirección demasiado larga').optional(),
})

export const updateBranchQRSchema = z.object({
  sucursalId: idSchema,
  tipo: z.enum(['entrada', 'salida'], { message: 'Tipo de QR inválido' }),
  qrUrl: z.string().url('URL de QR inválida').max(2000, 'URL demasiado larga'),
})

// ───────────────────────────────────────────────────────────────────────────────
// SERVICIOS VIRTUALES
// ───────────────────────────────────────────────────────────────────────────────

export const serviceRechargeSchema = z.object({
  turnoId: idSchema,
  sucursalId: idSchema,
  proveedorId: idSchema,
  tipoServicio: nonEmptyString,
  montoCarga: positiveNumber,
  comision: nonNegativeNumber,
  totalCobrado: positiveNumber,
  metodoPago: z.enum(['efectivo', 'tarjeta', 'billetera_virtual'], {
    message: 'Método de pago inválido',
  }),
})

// ───────────────────────────────────────────────────────────────────────────────
// MERCADO PAGO
// ───────────────────────────────────────────────────────────────────────────────

export const saveMPCredentialsSchema = z.object({
  accessToken: z.string().min(10, 'Token demasiado corto').max(500, 'Token demasiado largo'),
  webhookSecret: z.string().max(500, 'Secret demasiado largo').optional(),
})

// Item del carrito que el webhook necesita para crear la sale.
// Mismo shape que `processVenta`/`process_sale` espera.
export const mpCartItemSchema = z.object({
  product_id: idSchema,
  quantity: z.number().int().positive('Cantidad debe ser mayor a 0'),
  unit_price: positiveNumber,
  subtotal: positiveNumber,
})

export const createMPOrderSchema = z.object({
  saleId: idSchema,
  amount: positiveNumber,
  description: z.string().min(1, 'Descripción requerida').max(500, 'Descripción demasiado larga'),
  branchId: idSchema,
  cashRegisterId: idSchema,
  items: z.array(mpCartItemSchema).min(1, 'El carrito no puede estar vacío'),
})

// ───────────────────────────────────────────────────────────────────────────────
// HELPER: Extraer primer error legible de Zod
// ───────────────────────────────────────────────────────────────────────────────

export function getZodError(result: z.SafeParseError<unknown>): string {
  const firstIssue = result.error.issues[0]
  if (!firstIssue) return 'Datos inválidos'

  const field = firstIssue.path.length > 0 ? `${firstIssue.path.join('.')}: ` : ''
  return `${field}${firstIssue.message}`
}
