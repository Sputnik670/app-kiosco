/**
 * Types and utilities for Supabase join results.
 *
 * Supabase's TypeScript client types FK joins as arrays even for many-to-one
 * relationships (when isOneToOne is false). At runtime, PostgREST returns a
 * single object for these joins. The `resolveJoin` helper normalizes both cases.
 */

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Resolves a Supabase FK join that may be typed as array or single object.
 * Supabase TS client infers `{ field: any }[]` for FK joins with isOneToOne: false,
 * but PostgREST returns a single object at runtime. This handles both cases.
 */
export function resolveJoin<T extends Record<string, unknown>>(
  val: T | T[] | null | undefined
): T | null {
  if (val == null) return null
  if (Array.isArray(val)) return (val[0] as T) ?? null
  return val
}

// ─── Product joins ──────────────────────────────────────────────────────────

export type JoinedProductName = { name: string } | null

export type JoinedProductNameEmoji = { name: string; emoji?: string } | null

export type JoinedProductDetail = {
  name: string
  emoji?: string
  sale_price?: number
} | null

// ─── Branch joins ───────────────────────────────────────────────────────────

export type JoinedBranchName = { name: string } | null

// ─── Membership joins ───────────────────────────────────────────────────────

export type JoinedMembershipName = { display_name: string } | null

// ─── Cash register joins ────────────────────────────────────────────────────

export type JoinedCashRegisterWithMembership = {
  memberships: JoinedMembershipName
} | null

// ─── Sale items joins ───────────────────────────────────────────────────────

export type JoinedSaleItemQuantity = { quantity: number }

export type JoinedSaleItemWithProduct = {
  quantity: number
  unit_price: number
  products: JoinedProductName
}
