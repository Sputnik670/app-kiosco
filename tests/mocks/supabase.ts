/**
 * Mock de Supabase client para tests unitarios.
 *
 * Permite configurar respuestas por tabla/operación y verificar
 * que las queries se ejecutan con los parámetros correctos.
 */
import { vi } from 'vitest'

// ─── Chainable query builder mock ───────────────────────────────────────────

export interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  neq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  not: ReturnType<typeof vi.fn>
  gt: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lt: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  or: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  // Terminal — the resolved value
  _resolve: { data: unknown; error: unknown }
}

function createQueryBuilder(defaultResolve?: { data: unknown; error: unknown }): MockQueryBuilder {
  const resolve = defaultResolve ?? { data: null, error: null }

  const builder: MockQueryBuilder = {} as MockQueryBuilder
  builder._resolve = resolve

  // Every chainable method returns the builder itself
  const chainMethods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'in', 'is', 'not',
    'gt', 'gte', 'lt', 'lte', 'or',
    'order', 'limit',
  ] as const

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder)
  }

  // Terminal methods return the resolved value
  builder.single = vi.fn().mockImplementation(() => Promise.resolve(resolve))
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(resolve))

  // Make the builder thenable so `await supabase.from('x').select()` works
  // When you `await` a query without .single(), PostgREST returns { data: [], error }
  ;(builder as any).then = (onFulfilled: any, onRejected?: any) =>
    Promise.resolve(resolve).then(onFulfilled, onRejected)

  return builder
}

// ─── Mock Supabase client ───────────────────────────────────────────────────

export interface MockSupabaseClient {
  from: ReturnType<typeof vi.fn>
  rpc: ReturnType<typeof vi.fn>
  auth: {
    getUser: ReturnType<typeof vi.fn>
    getSession: ReturnType<typeof vi.fn>
  }
  /** Helper: configure response for a specific table */
  _mockTable: (table: string, resolve: { data: unknown; error: unknown }) => void
  /** Helper: get the query builder for a table (after from() was called) */
  _getBuilder: (table: string) => MockQueryBuilder | undefined
}

export function createMockSupabase(): MockSupabaseClient {
  const tableBuilders = new Map<string, MockQueryBuilder>()

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (!tableBuilders.has(table)) {
      tableBuilders.set(table, createQueryBuilder())
    }
    return tableBuilders.get(table)!
  })

  const client: MockSupabaseClient = {
    from: mockFrom,
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    _mockTable(table: string, resolve: { data: unknown; error: unknown }) {
      tableBuilders.set(table, createQueryBuilder(resolve))
    },
    _getBuilder(table: string) {
      return tableBuilders.get(table)
    },
  }

  return client
}

// ─── Helpers for common auth setups ─────────────────────────────────────────

export const MOCK_USER = {
  id: 'user-123',
  email: 'test@kiosco.com',
}

export const MOCK_ORG_ID = 'org-456'
export const MOCK_BRANCH_ID = 'branch-789'

/** Configure mock to simulate an authenticated user with org */
export function setupAuthenticatedUser(mock: MockSupabaseClient) {
  mock.auth.getUser.mockResolvedValue({
    data: { user: MOCK_USER },
    error: null,
  })
  mock.rpc.mockImplementation((fn: string) => {
    if (fn === 'get_my_org_id') return Promise.resolve({ data: MOCK_ORG_ID, error: null })
    if (fn === 'is_owner') return Promise.resolve({ data: true, error: null })
    return Promise.resolve({ data: null, error: null })
  })
}

/** Configure mock to simulate no auth session */
export function setupNoAuth(mock: MockSupabaseClient) {
  mock.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'No session' },
  })
}
