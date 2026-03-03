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
// HELPER: Extraer primer error legible de Zod
// ───────────────────────────────────────────────────────────────────────────────

export function getZodError(result: z.SafeParseError<unknown>): string {
  const firstIssue = result.error.issues[0]
  if (!firstIssue) return 'Datos inválidos'

  const field = firstIssue.path.length > 0 ? `${firstIssue.path.join('.')}: ` : ''
  return `${field}${firstIssue.message}`
}
