import { vi } from 'vitest'

// Mock next/headers (used by supabase-server.ts)
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}))

// Mock lib/logging to suppress console output during tests
vi.mock('@/lib/logging', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  ERROR_CODES: {},
  createErrorResponse: vi.fn(),
}))
