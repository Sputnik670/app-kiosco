/**
 * Tests P0: ventas.actions.ts
 *
 * Flujo más crítico del sistema — cada venta involucra:
 * - Auth check (verifyAuth)
 * - Búsqueda de productos en vista
 * - Procesamiento vía RPC process_sale
 * - Descuento de stock FIFO
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase, setupAuthenticatedUser, setupNoAuth, MOCK_USER, MOCK_ORG_ID, MOCK_BRANCH_ID } from '../../mocks/supabase'

// ─── Module mocks ───────────────────────────────────────────────────────────

const mockSupabase = createMockSupabase()

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/actions/auth-helpers', () => ({
  verifyAuth: vi.fn(),
}))

vi.mock('@/types/supabase-joins', () => ({
  resolveJoin: vi.fn((val: any) => {
    if (val == null) return null
    if (Array.isArray(val)) return val[0] ?? null
    return val
  }),
}))

// Import the module under test AFTER mocks
import {
  searchProductsAction,
  confirmSaleAction,
  getRecentSalesAction,
  getSaleDetailAction,
} from '@/lib/actions/ventas.actions'
import { verifyAuth } from '@/lib/actions/auth-helpers'

const mockVerifyAuth = vi.mocked(verifyAuth)

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ventas.actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: authenticated user
    mockVerifyAuth.mockResolvedValue({
      supabase: mockSupabase as any,
      user: MOCK_USER,
      orgId: MOCK_ORG_ID,
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // searchProductsAction
  // ═══════════════════════════════════════════════════════════════════════════

  describe('searchProductsAction', () => {
    it('devuelve productos cuando la búsqueda es exitosa', async () => {
      const mockProducts = [
        { id: 'p1', name: 'Coca Cola', sale_price: 1500, stock_available: 10, barcode: '123', emoji: '🥤', is_service: false, is_active: true, branch_id: MOCK_BRANCH_ID },
      ]

      mockSupabase._mockTable('v_products_with_stock', { data: mockProducts, error: null })

      const result = await searchProductsAction('coca', MOCK_BRANCH_ID)

      expect(result.success).toBe(true)
      expect(result.products).toHaveLength(1)
      expect(result.products[0].name).toBe('Coca Cola')
      expect(result.products[0].price).toBe(1500)
      expect(result.products[0].stock).toBe(10)
    })

    it('devuelve lista vacía para query vacío', async () => {
      const result = await searchProductsAction('', MOCK_BRANCH_ID)

      expect(result.success).toBe(true)
      expect(result.products).toEqual([])
    })

    it('devuelve error sin branchId', async () => {
      const result = await searchProductsAction('coca', '')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('devuelve error si no hay auth', async () => {
      mockVerifyAuth.mockRejectedValue(new Error('No autenticado'))

      const result = await searchProductsAction('coca', MOCK_BRANCH_ID)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No autenticado')
    })

    it('maneja error de Supabase', async () => {
      mockSupabase._mockTable('v_products_with_stock', {
        data: null,
        error: { message: 'DB error' },
      })

      const result = await searchProductsAction('coca', MOCK_BRANCH_ID)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Error en búsqueda')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // confirmSaleAction
  // ═══════════════════════════════════════════════════════════════════════════

  describe('confirmSaleAction', () => {
    const validParams = {
      branchId: MOCK_BRANCH_ID,
      cashRegisterId: 'caja-1',
      items: [
        { product_id: 'p1', quantity: 2, unit_price: 1500, subtotal: 3000 },
      ],
      paymentMethod: 'cash' as const,
      total: 3000,
    }

    it('procesa venta válida con RPC process_sale', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'sale-id-1', error: null })

      const result = await confirmSaleAction(validParams)

      expect(result.success).toBe(true)
      expect(result.saleId).toBe('sale-id-1')
      expect(mockSupabase.rpc).toHaveBeenCalledWith('process_sale', expect.objectContaining({
        p_branch_id: MOCK_BRANCH_ID,
        p_cash_register_id: 'caja-1',
        p_payment_method: 'cash',
        p_total: 3000,
      }))
    })

    it('rechaza venta sin items', async () => {
      const result = await confirmSaleAction({
        ...validParams,
        items: [],
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('rechaza venta sin branchId', async () => {
      const result = await confirmSaleAction({
        ...validParams,
        branchId: '',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('rechaza venta sin cashRegisterId', async () => {
      const result = await confirmSaleAction({
        ...validParams,
        cashRegisterId: '',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('rechaza venta con total <= 0', async () => {
      const result = await confirmSaleAction({
        ...validParams,
        total: 0,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('rechaza venta con total negativo', async () => {
      const result = await confirmSaleAction({
        ...validParams,
        total: -100,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('devuelve error si no hay auth', async () => {
      mockVerifyAuth.mockRejectedValue(new Error('No autenticado'))

      const result = await confirmSaleAction(validParams)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No autenticado')
    })

    it('maneja error del RPC process_sale', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Insufficient stock' },
      })

      const result = await confirmSaleAction(validParams)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Error procesando venta')
    })

    it('soporta venta con método de pago card', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'sale-card-1', error: null })

      const result = await confirmSaleAction({
        ...validParams,
        paymentMethod: 'card',
      })

      expect(result.success).toBe(true)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('process_sale', expect.objectContaining({
        p_payment_method: 'card',
      }))
    })

    it('soporta venta con método de pago transfer', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'sale-t-1', error: null })

      const result = await confirmSaleAction({
        ...validParams,
        paymentMethod: 'transfer',
      })

      expect(result.success).toBe(true)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('process_sale', expect.objectContaining({
        p_payment_method: 'transfer',
      }))
    })

    it('soporta venta con método de pago wallet', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'sale-w-1', error: null })

      const result = await confirmSaleAction({
        ...validParams,
        paymentMethod: 'wallet',
      })

      expect(result.success).toBe(true)
    })

    it('pasa localId para idempotencia offline', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'sale-offline-1', error: null })

      const result = await confirmSaleAction({
        ...validParams,
        localId: 'offline-abc-123',
      })

      expect(result.success).toBe(true)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('process_sale', expect.objectContaining({
        p_local_id: 'offline-abc-123',
      }))
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // getRecentSalesAction
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getRecentSalesAction', () => {
    it('devuelve ventas recientes de una caja', async () => {
      const mockSales = [
        { id: 's1', total: 5000, payment_method: 'cash', created_at: '2026-02-25T10:00:00Z', sale_items: [{}] },
        { id: 's2', total: 2000, payment_method: 'card', created_at: '2026-02-25T09:00:00Z', sale_items: [{}, {}] },
      ]

      mockSupabase._mockTable('sales', { data: mockSales, error: null })

      const result = await getRecentSalesAction('caja-1')

      expect(result.success).toBe(true)
      expect(result.sales).toHaveLength(2)
      expect(result.sales[0].total).toBe(5000)
      expect(result.sales[1].item_count).toBe(2)
    })

    it('devuelve error si no hay auth', async () => {
      mockVerifyAuth.mockRejectedValue(new Error('No autenticado'))

      const result = await getRecentSalesAction('caja-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('No autenticado')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // getSaleDetailAction
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getSaleDetailAction', () => {
    it('devuelve detalle completo de una venta', async () => {
      // Mock for sales table
      mockSupabase._mockTable('sales', {
        data: { id: 's1', total: 3000, payment_method: 'cash', created_at: '2026-02-25T10:00:00Z', notes: null },
        error: null,
      })

      // Mock for sale_items table
      mockSupabase._mockTable('sale_items', {
        data: [
          { id: 'si1', quantity: 2, unit_price: 1500, subtotal: 3000, products: { name: 'Coca Cola' } },
        ],
        error: null,
      })

      const result = await getSaleDetailAction('s1')

      expect(result.success).toBe(true)
      expect(result.sale).toBeDefined()
      expect(result.sale!.total).toBe(3000)
      expect(result.sale!.items).toHaveLength(1)
      expect(result.sale!.items[0].product_name).toBe('Coca Cola')
    })

    it('devuelve error si no hay auth', async () => {
      mockVerifyAuth.mockRejectedValue(new Error('No autenticado'))

      const result = await getSaleDetailAction('s1')

      expect(result.success).toBe(false)
    })
  })
})
