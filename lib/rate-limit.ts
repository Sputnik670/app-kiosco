/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🛡️ RATE LIMITER - Protección contra abuso de API
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Rate limiter en memoria para Vercel Serverless.
 *
 * LIMITACIONES:
 * - En memoria = no persiste entre cold starts (aceptable para MVP)
 * - Cada instancia serverless tiene su propio contador (aceptable para MVP)
 * - Para producción con alto tráfico, migrar a Vercel KV o Upstash Redis
 *
 * USO EN MIDDLEWARE:
 *   import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
 *   const result = rateLimit(ip, RATE_LIMITS.API)
 *   if (!result.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
 *
 * USO EN SERVER ACTIONS:
 *   import { rateLimitAction } from '@/lib/rate-limit'
 *   const check = rateLimitAction(userId, 'ventas')
 *   if (!check.success) return { success: false, error: check.error }
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number
  resetAt: number // timestamp
}

interface RateLimitConfig {
  /** Máximo de requests en la ventana */
  maxRequests: number
  /** Duración de la ventana en milisegundos */
  windowMs: number
}

interface RateLimitResult {
  success: boolean
  /** Requests restantes en la ventana */
  remaining: number
  /** Timestamp de reset */
  resetAt: number
  /** Mensaje de error si fue rechazado */
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// CONFIGURACIONES PREDEFINIDAS
// ───────────────────────────────────────────────────────────────────────────────

export const RATE_LIMITS = {
  /** API general: 60 req/min por IP */
  API: { maxRequests: 60, windowMs: 60_000 },
  /** Auth: 10 intentos/min por IP (login, signup) */
  AUTH: { maxRequests: 10, windowMs: 60_000 },
  /** Ventas: 30 ventas/min por usuario (suficiente para hora pico) */
  VENTAS: { maxRequests: 30, windowMs: 60_000 },
  /** Sync offline: 100 req/min (batch de ventas pendientes) */
  SYNC: { maxRequests: 100, windowMs: 60_000 },
  /** Escritura general: 30 ops/min por usuario */
  WRITE: { maxRequests: 30, windowMs: 60_000 },
  /** Lectura: 120 req/min por usuario (dashboard carga muchos datos) */
  READ: { maxRequests: 120, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitConfig>

// ───────────────────────────────────────────────────────────────────────────────
// STORE EN MEMORIA
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Map de identificador → entrada de rate limit
 * Se limpia automáticamente cuando supera MAX_ENTRIES
 */
const store = new Map<string, RateLimitEntry>()
const MAX_ENTRIES = 10_000 // Prevenir memory leak

/**
 * Limpia entradas expiradas del store
 */
function cleanup(): void {
  if (store.size < MAX_ENTRIES) return

  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key)
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Verifica y registra un request contra el rate limit
 *
 * @param identifier - IP, userId, o cualquier string único
 * @param config - Configuración de límites
 * @returns RateLimitResult
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanup()

  const now = Date.now()
  const key = identifier
  const existing = store.get(key)

  // Si no existe o expiró, crear nueva ventana
  if (!existing || existing.resetAt <= now) {
    const entry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    }
    store.set(key, entry)

    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetAt: entry.resetAt,
    }
  }

  // Incrementar contador
  existing.count++

  // Verificar límite
  if (existing.count > config.maxRequests) {
    const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000)

    return {
      success: false,
      remaining: 0,
      resetAt: existing.resetAt,
      error: `Demasiadas solicitudes. Intentá de nuevo en ${retryAfterSec} segundos.`,
    }
  }

  return {
    success: true,
    remaining: config.maxRequests - existing.count,
    resetAt: existing.resetAt,
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// HELPER PARA SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Rate limit para server actions (usa userId como identificador)
 *
 * @param userId - ID del usuario autenticado
 * @param action - Nombre del tipo de acción para elegir el límite
 * @returns { success: boolean, error?: string }
 */
export function rateLimitAction(
  userId: string,
  action: 'ventas' | 'sync' | 'write' | 'read'
): { success: boolean; error?: string } {
  const configMap: Record<string, RateLimitConfig> = {
    ventas: RATE_LIMITS.VENTAS,
    sync: RATE_LIMITS.SYNC,
    write: RATE_LIMITS.WRITE,
    read: RATE_LIMITS.READ,
  }

  const config = configMap[action] || RATE_LIMITS.API
  const result = rateLimit(`action:${action}:${userId}`, config)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true }
}
