/**
 * Tests P0: cash.actions.ts
 *
 * Flujo de caja — operación crítica financiera:
 * - Apertura de caja con monto inicial
 * - Cierre con auditoría (arqueo)
 * - Movimientos (ingresos/egresos)
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

vi.mock('date-fns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('date-fns')>()
  return {
    ...actual,
    format: vi.fn((date: any, fmt: string) => '2026-02-25'),
    addDays: actual.addDays,
  }
})

import {
  abrirCajaAction,
  cerrarCajaAction,
  getCajaActivaAction,
  createCashMovementAction,
  getShiftMovementsAction,
} from '@/lib/actions/cash.actions'
import { verifyAuth } from '@/lib/actions/auth-helpers'

const mockVerifyAuth = vi.mocked(verifyAuth)

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('cash.actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAuth.mockResolvedValue({
      supabase: mockSupabase as any,
      user: MOCK_USER,
      orgId: MOCK_ORG_ID,
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // abrirCajaAction
  // ═══════════════════════════════════════════════════════════════════════════

  describe('abrirCajaAction', () => {
    it('abre caja correctamente con monto inicial', async () => {
      // Mock cash_registers insert
      mockSupabase._mockTable('cash_registers', {
        data: { id: 'caja-new', opening_amount: 5000 },
        error: null,
      })
      // Mock stock_batches for missions generation
      mockSupabase._mockTable('stock_batches', { data: [], error: null })
      // Mock missions insert
      mockSupabase._mockTable('missions', { data: null, error: null })
      // Mock mission_templates
      mockSupabase._mockTable('mission_templates', { data: [], error: null })

      const result = await abrirCajaAction(5000, MOCK_BRANCH_ID)

      expect(result.success).toBe(true)
      expect(result.cajaId).toBe('caja-new')
    })

    it('devuelve error si no hay auth', async () => {
      mockVerifyAuth.mockRejectedValue(new Error('No autenticado'))

      const result = await abrirCajaAction(5000, MOCK_BRANCH_ID)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No autenticado')
    })

    it('devuelve error si falla INSERT en cash_registers', async () => {
      mockSupabase._mockTable('cash_registers', {
        data: null,
        error: { message: 'Unique constraint violation' },
      })

      const result = await abrirCajaAction(5000, MOCK_BRANCH_ID)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Error al crear la caja')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // cerrarCajaAction
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cerrarCajaAction', () => {
    it('cierra caja con arqueo perfecto (diferencia <= $100)', async () => {
      // Base = 5000, ventas efectivo = 10000, ingresos = 2000, gastos = 1000
      // Esperado = 5000 + 10000 + 2000 - 1000 = 16000
      mockSupabase._mockTable('cash_registers', {
        data: { id: 'caja-1', opening_amount: 5000, opened_by: MOCK_USER.id, organization_id: MOCK_ORG_ID },
        error: null,
      })

      mockSupabase._mockTable('sales', {
        data: [{ total: 6000 }, { total: 4000 }],
        error: null,
      })

      mockSupabase._mockTable('cash_movements', {
        data: [
          { amount: 2000, type: 'income', category: 'manual' },
          { amount: 1000, type: 'expense', category: 'manual' },
        ],
        error: null,
      })

      // Mock for missions and memberships updates
      mockSupabase._mockTable('missions', { data: null, error: null })
      mockSupabase._mockTable('memberships', { data: { xp: 100 }, error: null })

      // Mock is_owner RPC
      mockSupabase.rpc.mockImplementation((fn: string) => {
        if (fn === 'is_owner') return Promise.resolve({ data: true, error: null })
        return Promise.resolve({ data: null, error: null })
      })

      const result = await cerrarCajaAction('caja-1', 16050) // Declarado ~= esperado

      expect(result.success).toBe(true)
      expect(result.exitoArqueo).toBe(true)
      expect(result.dineroEsperado).toBe(16000)
      expect(result.montoDeclarado).toBe(16050)
      expect(result.desvio).toBe(50)
      expect(result.detalles).toBeDefined()
      expect(result.detalles!.montoInicial).toBe(5000)
      expect(result.detalles!.totalVentasEfectivo).toBe(10000)
    })

    it('cierra caja con diferencia > $100 (arqueo fallido)', async () => {
      mockSupabase._mockTable('cash_registers', {
        data: { id: 'caja-1', opening_amount: 5000, opened_by: MOCK_USER.id, organization_id: MOCK_ORG_ID },
        error: null,
      })

      mockSupabase._mockTable('sales', { data: [{ total: 10000 }], error: null })
      mockSupabase._mockTable('cash_movements', { data: [], error: null })

      mockSupabase.rpc.mockImplementation((fn: string) => {
        if (fn === 'is_owner') return Promise.resolve({ data: true, error: null })
        return Promise.resolve({ data: null, error: null })
      })

      // Esperado = 5000 + 10000 = 15000, declarado = 14000 → diff = -1000
      const result = await cerrarCajaAction('caja-1', 14000)

      expect(result.success).toBe(true)
      expect(result.exitoArqueo).toBe(false)
      expect(result.desvio).toBe(-1000)
    })

    it('devuelve error si caja no existe', async () => {
      mockSupabase._mockTable('cash_registers', {
        data: null,
        error: null,
      })

      const result = await cerrarCajaAction('caja-inexistente', 5000)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No se encontró la caja')
    })

    it('rechaza cierre por usuario no autorizado (no opener, no owner)', async () => {
      mockSupabase._mockTable('cash_registers', {
        data: { id: 'caja-1', opening_amount: 5000, opened_by: 'otro-usuario', organization_id: MOCK_ORG_ID },
        error: null,
      })

      mockSupabase.rpc.mockImplementation((fn: string) => {
        if (fn === 'is_owner') return Promise.resolve({ data: false, error: null })
        return Promise.resolve({ data: null, error: null })
      })

      const result = await cerrarCajaAction('caja-1', 5000)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Solo el empleado que abrió')
    })

    it('devuelve error si no hay auth', async () => {
      mockVerifyAuth.mockRejectedValue(new Error('No autenticado'))

      const result = await cerrarCajaAction('caja-1', 5000)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No autenticado')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // getCajaActivaAction
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getCajaActivaAction', () => {
    it('devuelve caja abierta si existe', async () => {
      mockSupabase._mockTable('cash_registers', {
        data: { id: 'caja-1', opening_amount: 5000, opened_at: '2026-02-25T08:00:00Z', opened_by: MOCK_USER.id },
        error: null,
      })

      const result = await getCajaActivaAction(MOCK_BRANCH_ID)

      expect(result.success).toBe(true)
      expect(result.hayCajaAbierta).toBe(true)
      expect(result.caja).toBeDefined()
      expect(result.caja!.id).toBe('caja-1')
      expect(result.caja!.monto_inicial).toBe(5000)
    })

    it('devuelve sin caja si no hay turno abierto (PGRST116)', async () => {
      mockSupabase._mockTable('cash_registers', {
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      })

      const result = await getCajaActivaAction(MOCK_BRANCH_ID)

      // PGRST116 is treated as "no caja" not error
      expect(result.success).toBe(true)
      expect(result.hayCajaAbierta).toBe(false)
    })

    it('devuelve error si no hay auth', async () => {
      mockVerifyAuth.mockRejectedValue(new Error('No autenticado'))

      const result = await getCajaActivaAction(MOCK_BRANCH_ID)

      expect(result.success).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // createCashMovementAction
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createCashMovementAction', () => {
    it('registra ingreso correctamente', async () => {
      mockSupabase._mockTable('cash_movements', { data: null, error: null })

      const result = await createCashMovementAction({
        monto: 5000,
        descripcion: 'Ingreso por cambio',
        tipo: 'ingreso',
        turnoId: 'caja-1',
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain('ingresaron')
      expect(result.message).toContain('5.000')
    })

    it('registra egreso correctamente', async () => {
      mockSupabase._mockTable('cash_movements', { data: null, error: null })

      const result = await createCashMovementAction({
        monto: 2000,
        descripcion: 'Retiro para compras',
        tipo: 'egreso',
        turnoId: 'caja-1',
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain('retiraron')
    })

    it('rechaza monto <= 0', async () => {
      const result = await createCashMovementAction({
        monto: 0,
        descripcion: 'Test',
        tipo: 'ingreso',
        turnoId: 'caja-1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('monto')
    })

    it('rechaza monto negativo', async () => {
      const result = await createCashMovementAction({
        monto: -100,
        descripcion: 'Test',
        tipo: 'ingreso',
        turnoId: 'caja-1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('monto')
    })

    it('rechaza descripción vacía', async () => {
      const result = await createCashMovementAction({
        monto: 1000,
        descripcion: '',
        tipo: 'ingreso',
        turnoId: 'caja-1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('descripción')
    })

    it('rechaza tipo de movimiento inválido', async () => {
      const result = await createCashMovementAction({
        monto: 1000,
        descripcion: 'Test',
        tipo: 'invalido' as any,
        turnoId: 'caja-1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Tipo de movimiento')
    })

    it('rechaza sin turnoId', async () => {
      const result = await createCashMovementAction({
        monto: 1000,
        descripcion: 'Test',
        tipo: 'ingreso',
        turnoId: '',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('turno')
    })

    it('devuelve error si no hay auth', async () => {
      mockVerifyAuth.mockRejectedValue(new Error('No autenticado'))

      const result = await createCashMovementAction({
        monto: 1000,
        descripcion: 'Test',
        tipo: 'ingreso',
        turnoId: 'caja-1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('No autenticado')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // getShiftMovementsAction
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getShiftMovementsAction', () => {
    it('devuelve movimientos de un turno', async () => {
      const mockMovements = [
        { id: 'm1', organization_id: MOCK_ORG_ID, cash_register_id: 'caja-1', amount: 5000, type: 'income', description: 'Cambio', category: null, user_id: MOCK_USER.id, created_at: '2026-02-25T10:00:00Z' },
      ]

      mockSupabase._mockTable('cash_movements', { data: mockMovements, error: null })

      const result = await getShiftMovementsAction('caja-1')

      expect(result.success).toBe(true)
      expect(result.movements).toHaveLength(1)
    })

    it('rechaza sin cajaId', async () => {
      const result = await getShiftMovementsAction('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('turno')
    })

    it('devuelve error si no hay auth', async () => {
      mockVerifyAuth.mockRejectedValue(new Error('No autenticado'))

      const result = await getShiftMovementsAction('caja-1')

      expect(result.success).toBe(false)
    })
  })
})
