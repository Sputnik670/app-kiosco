/**
 * Tests P0: auth-helpers.ts
 *
 * Helpers de autenticación centralizados — base de seguridad:
 * - verifyAuth: sesión + organización
 * - verifyOwner: sesión + organización + rol owner
 * - verifyMembership: sesión + membership completa
 * - getServerOrgId: derivar org_id del servidor
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase, MOCK_USER, MOCK_ORG_ID } from '../../mocks/supabase'

// ─── Module mocks ───────────────────────────────────────────────────────────

const mockSupabase = createMockSupabase()

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

import { verifyAuth, verifyOwner, verifyMembership, getServerOrgId } from '@/lib/actions/auth-helpers'

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('auth-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // verifyAuth
  // ═══════════════════════════════════════════════════════════════════════════

  describe('verifyAuth', () => {
    it('devuelve contexto completo para usuario autenticado con org', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: MOCK_USER },
        error: null,
      })
      mockSupabase.rpc.mockResolvedValue({ data: MOCK_ORG_ID, error: null })

      const ctx = await verifyAuth()

      expect(ctx.user.id).toBe(MOCK_USER.id)
      expect(ctx.user.email).toBe(MOCK_USER.email)
      expect(ctx.orgId).toBe(MOCK_ORG_ID)
      expect(ctx.supabase).toBeDefined()
    })

    it('lanza error si no hay sesión', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      await expect(verifyAuth()).rejects.toThrow('No autenticado')
    })

    it('lanza error si getUser devuelve error de auth', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Session expired' },
      })

      await expect(verifyAuth()).rejects.toThrow('No autenticado')
    })

    it('lanza error si usuario no tiene organización', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: MOCK_USER },
        error: null,
      })
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await expect(verifyAuth()).rejects.toThrow('Sin organización activa')
    })

    it('lanza error si user.id es undefined', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: undefined } },
        error: null,
      })

      await expect(verifyAuth()).rejects.toThrow('No autenticado')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // verifyOwner
  // ═══════════════════════════════════════════════════════════════════════════

  describe('verifyOwner', () => {
    it('permite acceso a owner', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: MOCK_USER },
        error: null,
      })
      mockSupabase.rpc.mockImplementation((fn: string) => {
        if (fn === 'get_my_org_id') return Promise.resolve({ data: MOCK_ORG_ID, error: null })
        if (fn === 'is_owner') return Promise.resolve({ data: true, error: null })
        return Promise.resolve({ data: null, error: null })
      })

      const ctx = await verifyOwner()

      expect(ctx.user.id).toBe(MOCK_USER.id)
      expect(ctx.orgId).toBe(MOCK_ORG_ID)
    })

    it('rechaza employee (no es owner)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: MOCK_USER },
        error: null,
      })
      mockSupabase.rpc.mockImplementation((fn: string) => {
        if (fn === 'get_my_org_id') return Promise.resolve({ data: MOCK_ORG_ID, error: null })
        if (fn === 'is_owner') return Promise.resolve({ data: false, error: null })
        return Promise.resolve({ data: null, error: null })
      })

      await expect(verifyOwner()).rejects.toThrow('Solo el dueño puede realizar esta acción')
    })

    it('rechaza si no hay sesión (hereda error de verifyAuth)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      await expect(verifyOwner()).rejects.toThrow('No autenticado')
    })

    it('rechaza si no hay organización (hereda error de verifyAuth)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: MOCK_USER },
        error: null,
      })
      mockSupabase.rpc.mockImplementation((fn: string) => {
        if (fn === 'get_my_org_id') return Promise.resolve({ data: null, error: null })
        return Promise.resolve({ data: null, error: null })
      })

      await expect(verifyOwner()).rejects.toThrow('Sin organización activa')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // verifyMembership
  // ═══════════════════════════════════════════════════════════════════════════

  describe('verifyMembership', () => {
    it('devuelve contexto completo para usuario con membership', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: MOCK_USER },
        error: null,
      })
      mockSupabase._mockTable('memberships', {
        data: {
          organization_id: MOCK_ORG_ID,
          role: 'employee',
          branch_id: 'branch-1',
        },
        error: null,
      })

      const ctx = await verifyMembership()

      expect(ctx.user.id).toBe(MOCK_USER.id)
      expect(ctx.orgId).toBe(MOCK_ORG_ID)
      expect(ctx.role).toBe('employee')
      expect(ctx.branchId).toBe('branch-1')
    })

    it('devuelve role=owner para dueño', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: MOCK_USER },
        error: null,
      })
      mockSupabase._mockTable('memberships', {
        data: {
          organization_id: MOCK_ORG_ID,
          role: 'owner',
          branch_id: null,
        },
        error: null,
      })

      const ctx = await verifyMembership()

      expect(ctx.role).toBe('owner')
      expect(ctx.branchId).toBeNull()
    })

    it('lanza error si no hay sesión', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      await expect(verifyMembership()).rejects.toThrow('No autenticado')
    })

    it('lanza error si no hay membership activa', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: MOCK_USER },
        error: null,
      })
      mockSupabase._mockTable('memberships', {
        data: null,
        error: null,
      })

      await expect(verifyMembership()).rejects.toThrow('Sin membresía activa')
    })

    it('lanza error si membership query falla', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: MOCK_USER },
        error: null,
      })
      mockSupabase._mockTable('memberships', {
        data: null,
        error: { message: 'DB error' },
      })

      await expect(verifyMembership()).rejects.toThrow('Sin membresía activa')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // getServerOrgId
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getServerOrgId', () => {
    it('devuelve org_id cuando existe membership', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: MOCK_ORG_ID, error: null })

      const orgId = await getServerOrgId(mockSupabase as any)

      expect(orgId).toBe(MOCK_ORG_ID)
    })

    it('lanza error si no hay org_id', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await expect(getServerOrgId(mockSupabase as any)).rejects.toThrow('Sin organización activa')
    })
  })
})
