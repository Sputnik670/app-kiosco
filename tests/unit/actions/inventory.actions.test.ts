/**
 * Tests P0: inventory.actions.ts
 *
 * Stock e inventario — operaciones FIFO:
 * - Escaneo de producto por barcode
 * - Resumen de stock (batch query)
 * - Alertas de stock crítico/vencimiento
 * - Entrada de mercadería
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase, MOCK_USER, MOCK_ORG_ID, MOCK_BRANCH_ID } from '../../mocks/supabase'

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

// Mock repository functions
vi.mock('@/lib/repositories/producto.repository', () => ({
  searchProductos: vi.fn(),
  updateProducto: vi.fn(),
  getProductoById: vi.fn(),
}))

vi.mock('@/lib/repositories/stock.repository', () => ({
  getStockDisponible: vi.fn(),
  createStockEntrada: vi.fn(),
}))

import {
  handleProductScan,
  getStockSummary,
  processComplexStockEntry,
  getExpiringStockAction,
  getCriticalStockAction,
  processStockLossAction,
} from '@/lib/actions/inventory.actions'
import { verifyAuth } from '@/lib/actions/auth-helpers'
import { searchProductos, getProductoById, updateProducto } from '@/lib/repositories/producto.repository'
import { getStockDisponible, createStockEntrada } from '@/lib/repositories/stock.repository'

const mockVerifyAuth = vi.mocked(verifyAuth)
const mockSearchProductos = vi.mocked(searchProductos)
const mockGetStockDisponible = vi.mocked(getStockDisponible)
const mockCreateStockEntrada = vi.mocked(createStockEntrada)
const mockGetProductoById = vi.mocked(getProductoById)
const mockUpdateProducto = vi.mocked(updateProducto)

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('inventory.actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAuth.mockResolvedValue({
      supabase: mockSupabase as any,
      user: MOCK_USER,
      orgId: MOCK_ORG_ID,
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // handleProductScan
  // ═══════════════════════════════════════════════════════════════════════════

  describe('handleProductScan', () => {
    it('encuentra producto por barcode exacto', async () => {
      const mockProduct = { id: 'p1', name: 'Coca Cola', barcode: '7790895000508', sale_price: 1500 }
      mockSearchProductos.mockResolvedValue({
        data: [mockProduct] as any,
        error: null,
      })
      mockGetStockDisponible.mockResolvedValue({
        data: 10,
        error: null,
      })

      const result = await handleProductScan('7790895000508', MOCK_ORG_ID, MOCK_BRANCH_ID)

      expect(result.status).toBe('FOUND')
      if (result.status === 'FOUND') {
        expect(result.producto.name).toBe('Coca Cola')
        expect(result.stockDisponible).toBe(10)
      }
    })

    it('devuelve NOT_FOUND si barcode no existe', async () => {
      mockSearchProductos.mockResolvedValue({
        data: [],
        error: null,
      })

      const result = await handleProductScan('9999999999999', MOCK_ORG_ID, MOCK_BRANCH_ID)

      expect(result.status).toBe('NOT_FOUND')
      if (result.status === 'NOT_FOUND') {
        expect(result.barcode).toBe('9999999999999')
      }
    })

    it('devuelve ERROR con barcode vacío', async () => {
      const result = await handleProductScan('', MOCK_ORG_ID, MOCK_BRANCH_ID)

      expect(result.status).toBe('ERROR')
      if (result.status === 'ERROR') {
        expect(result.error).toBeDefined()
      }
    })

    it('devuelve ERROR sin organizationId', async () => {
      const result = await handleProductScan('123', '', MOCK_BRANCH_ID)

      expect(result.status).toBe('ERROR')
      if (result.status === 'ERROR') {
        expect(result.error).toBeDefined()
      }
    })

    it('devuelve ERROR sin sucursalId', async () => {
      const result = await handleProductScan('123', MOCK_ORG_ID, '')

      expect(result.status).toBe('ERROR')
      if (result.status === 'ERROR') {
        expect(result.error).toContain('sucursal')
      }
    })

    it('maneja error de búsqueda en repositorio', async () => {
      mockSearchProductos.mockResolvedValue({
        data: null,
        error: { message: 'DB error' } as any,
      })

      const result = await handleProductScan('123', MOCK_ORG_ID, MOCK_BRANCH_ID)

      expect(result.status).toBe('ERROR')
      if (result.status === 'ERROR') {
        expect(result.error).toContain('Error al buscar')
      }
    })

    it('búsqueda es case-insensitive en barcode', async () => {
      const mockProduct = { id: 'p1', name: 'Test', barcode: 'ABC123', sale_price: 100 }
      mockSearchProductos.mockResolvedValue({
        data: [mockProduct] as any,
        error: null,
      })
      mockGetStockDisponible.mockResolvedValue({ data: 5, error: null })

      const result = await handleProductScan('abc123', MOCK_ORG_ID, MOCK_BRANCH_ID)

      expect(result.status).toBe('FOUND')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // getStockSummary (batch query — N+1 fixed)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getStockSummary', () => {
    it('devuelve stock agregado para múltiples productos', async () => {
      // Two batches for p1, one batch for p2
      mockSupabase._mockTable('stock_batches', {
        data: [
          { product_id: 'p1', quantity: 5 },
          { product_id: 'p1', quantity: 3 },
          { product_id: 'p2', quantity: 10 },
        ],
        error: null,
      })

      const result = await getStockSummary(['p1', 'p2', 'p3'], MOCK_ORG_ID, MOCK_BRANCH_ID)

      expect(result).toHaveLength(3)
      expect(result.find(r => r.productoId === 'p1')?.stock).toBe(8)  // 5+3
      expect(result.find(r => r.productoId === 'p2')?.stock).toBe(10)
      expect(result.find(r => r.productoId === 'p3')?.stock).toBe(0)  // not in DB
    })

    it('devuelve array vacío para lista vacía de productos', async () => {
      const result = await getStockSummary([], MOCK_ORG_ID, MOCK_BRANCH_ID)

      expect(result).toEqual([])
    })

    it('devuelve stock 0 para todos si hay error de DB', async () => {
      mockSupabase._mockTable('stock_batches', {
        data: null,
        error: { message: 'Connection failed' },
      })

      const result = await getStockSummary(['p1', 'p2'], MOCK_ORG_ID, MOCK_BRANCH_ID)

      expect(result).toHaveLength(2)
      expect(result[0].stock).toBe(0)
      expect(result[1].stock).toBe(0)
    })

    it('agrega correctamente cantidades de múltiples lotes FIFO', async () => {
      // Simulating FIFO batches with different quantities
      mockSupabase._mockTable('stock_batches', {
        data: [
          { product_id: 'p1', quantity: 2 },
          { product_id: 'p1', quantity: 8 },
          { product_id: 'p1', quantity: 15 },
        ],
        error: null,
      })

      const result = await getStockSummary(['p1'], MOCK_ORG_ID, MOCK_BRANCH_ID)

      expect(result[0].stock).toBe(25) // 2+8+15
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // processComplexStockEntry
  // ═══════════════════════════════════════════════════════════════════════════

  describe('processComplexStockEntry', () => {
    it('registra entrada de stock correctamente', async () => {
      mockCreateStockEntrada.mockResolvedValue({
        data: { id: 'stock-1' } as any,
        error: null,
      })

      const result = await processComplexStockEntry({
        productoId: 'p1',
        sucursalId: MOCK_BRANCH_ID,
        cantidad: 24,
        fechaVencimiento: '2026-06-01',
      })

      expect(result.success).toBe(true)
      expect(result.details?.stockId).toBe('stock-1')
    })

    it('actualiza costo del producto si cambió', async () => {
      mockCreateStockEntrada.mockResolvedValue({
        data: { id: 'stock-1' } as any,
        error: null,
      })
      mockGetProductoById.mockResolvedValue({
        data: { id: 'p1', cost: 500, sale_price: 1000 } as any,
        error: null,
      })
      mockUpdateProducto.mockResolvedValue({ data: null, error: null })

      // Mock price_history insert
      mockSupabase._mockTable('price_history', { data: null, error: null })

      const result = await processComplexStockEntry({
        productoId: 'p1',
        sucursalId: MOCK_BRANCH_ID,
        cantidad: 24,
        fechaVencimiento: '2026-06-01',
        costoUnitario: 600, // Changed from 500 to 600
      })

      expect(result.success).toBe(true)
      expect(result.details?.precioActualizado).toBe(true)
    })

    it('devuelve error si falla entrada de stock', async () => {
      mockCreateStockEntrada.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' } as any,
      })

      const result = await processComplexStockEntry({
        productoId: 'p1',
        sucursalId: MOCK_BRANCH_ID,
        cantidad: 24,
        fechaVencimiento: '2026-06-01',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Error al registrar el stock')
    })

    it('devuelve error si no hay auth', async () => {
      mockVerifyAuth.mockRejectedValue(new Error('No autenticado'))

      const result = await processComplexStockEntry({
        productoId: 'p1',
        sucursalId: MOCK_BRANCH_ID,
        cantidad: 24,
        fechaVencimiento: '2026-06-01',
      })

      expect(result.success).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // getExpiringStockAction
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getExpiringStockAction', () => {
    it('devuelve stock próximo a vencer', async () => {
      mockSupabase._mockTable('stock_batches', {
        data: [
          { id: 'sb1', quantity: 5, expiration_date: '2026-02-28', product_id: 'p1', products: { name: 'Leche', emoji: '🥛', category: 'Lácteos' } },
        ],
        error: null,
      })

      const result = await getExpiringStockAction(MOCK_BRANCH_ID)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
    })

    it('devuelve error si no hay auth', async () => {
      mockVerifyAuth.mockRejectedValue(new Error('No autenticado'))

      const result = await getExpiringStockAction(MOCK_BRANCH_ID)

      expect(result.success).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // getCriticalStockAction
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getCriticalStockAction', () => {
    it('devuelve stock crítico (vence en < 7 días)', async () => {
      mockSupabase._mockTable('stock_batches', {
        data: [
          { id: 'sb1', product_id: 'p1', expiration_date: '2026-02-27', products: { name: 'Yogurt', emoji: '🍶', sale_price: 800 } },
        ],
        error: null,
      })

      const result = await getCriticalStockAction(MOCK_BRANCH_ID)

      expect(result.success).toBe(true)
      expect(result.stock).toHaveLength(1)
      expect(result.stock[0].nombre_producto).toBe('Yogurt')
    })

    it('rechaza sin branchId', async () => {
      const result = await getCriticalStockAction('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('branchId')
    })

    it('devuelve error si no hay auth', async () => {
      mockVerifyAuth.mockRejectedValue(new Error('No autenticado'))

      const result = await getCriticalStockAction(MOCK_BRANCH_ID)

      expect(result.success).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // processStockLossAction
  // ═══════════════════════════════════════════════════════════════════════════

  describe('processStockLossAction', () => {
    it('marca lote como damaged (merma)', async () => {
      mockSupabase._mockTable('stock_batches', { data: null, error: null })

      const result = await processStockLossAction('sb1', 'caja-1', MOCK_USER.id)

      expect(result.success).toBe(true)
    })

    it('rechaza sin stockId', async () => {
      const result = await processStockLossAction('', 'caja-1', MOCK_USER.id)

      expect(result.success).toBe(false)
    })

    it('devuelve error si no hay auth', async () => {
      mockVerifyAuth.mockRejectedValue(new Error('No autenticado'))

      const result = await processStockLossAction('sb1', 'caja-1', MOCK_USER.id)

      expect(result.success).toBe(false)
    })
  })
})
