/**
 * Sistema de logging centralizado para App-Kiosco
 *
 * Este módulo proporciona un logger unificado que:
 * - Formatea logs con timestamp y contexto
 * - Está preparado para integración con Sentry
 * - Proporciona niveles de log (error, warn, info, debug)
 *
 * NOTA: Para habilitar Sentry, instalar:
 *   npm install @sentry/nextjs
 *   npx @sentry/wizard@latest -i nextjs
 */

type LogLevel = "error" | "warn" | "info" | "debug"

interface LogMeta {
  [key: string]: unknown
}

interface LogEntry {
  level: LogLevel
  context: string
  message: string
  timestamp: string
  meta?: LogMeta
  error?: Error
}

// Configuración del logger
const LOG_CONFIG = {
  // Habilitar logs en consola
  enableConsole: true,
  // Nivel mínimo de log (en orden: debug < info < warn < error)
  minLevel: (process.env.NODE_ENV === "production" ? "info" : "debug") as LogLevel,
  // Habilitar Sentry (activar cuando se instale)
  enableSentry: false,
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[LOG_CONFIG.minLevel]
}

function formatTimestamp(): string {
  return new Date().toISOString()
}

function formatLogMessage(entry: LogEntry): string {
  const metaStr = entry.meta ? ` | ${JSON.stringify(entry.meta)}` : ""
  return `[${entry.timestamp}][${entry.level.toUpperCase()}][${entry.context}] ${entry.message}${metaStr}`
}

// Función para capturar en Sentry (placeholder)
async function captureToSentry(entry: LogEntry): Promise<void> {
  if (!LOG_CONFIG.enableSentry) return

  // Cuando se instale Sentry, descomentar:
  // try {
  //   const Sentry = await import("@sentry/nextjs")
  //   if (entry.error) {
  //     Sentry.captureException(entry.error, {
  //       extra: { context: entry.context, ...entry.meta },
  //       level: entry.level as Sentry.SeverityLevel,
  //     })
  //   } else {
  //     Sentry.captureMessage(entry.message, {
  //       extra: { context: entry.context, ...entry.meta },
  //       level: entry.level as Sentry.SeverityLevel,
  //     })
  //   }
  // } catch {
  //   // Sentry no está disponible
  // }
}

function logToConsole(entry: LogEntry): void {
  if (!LOG_CONFIG.enableConsole) return

  const message = formatLogMessage(entry)

  switch (entry.level) {
    case "error":
      if (entry.error) {
        console.error(message, entry.error)
      } else {
        console.error(message)
      }
      break
    case "warn":
      console.warn(message)
      break
    case "info":
      console.info(message)
      break
    case "debug":
      console.debug(message)
      break
  }
}

/**
 * Logger principal de la aplicación
 *
 * @example
 * // Log de error con excepción
 * logger.error("createSale", "Error al procesar venta", error, { branchId, userId })
 *
 * // Log informativo
 * logger.info("auth", "Usuario autenticado", { userId, email })
 *
 * // Log de advertencia
 * logger.warn("inventory", "Stock bajo detectado", { productId, stock: 3 })
 */
export const logger = {
  /**
   * Log de error - para excepciones y errores críticos
   */
  error: (context: string, message: string, error?: Error, meta?: LogMeta): void => {
    if (!shouldLog("error")) return

    const entry: LogEntry = {
      level: "error",
      context,
      message,
      timestamp: formatTimestamp(),
      meta,
      error,
    }

    logToConsole(entry)
    captureToSentry(entry)
  },

  /**
   * Log de advertencia - para situaciones anómalas que no son errores
   */
  warn: (context: string, message: string, meta?: LogMeta): void => {
    if (!shouldLog("warn")) return

    const entry: LogEntry = {
      level: "warn",
      context,
      message,
      timestamp: formatTimestamp(),
      meta,
    }

    logToConsole(entry)
  },

  /**
   * Log informativo - para eventos importantes del flujo normal
   */
  info: (context: string, message: string, meta?: LogMeta): void => {
    if (!shouldLog("info")) return

    const entry: LogEntry = {
      level: "info",
      context,
      message,
      timestamp: formatTimestamp(),
      meta,
    }

    logToConsole(entry)
  },

  /**
   * Log de debug - para desarrollo y troubleshooting
   */
  debug: (context: string, message: string, meta?: LogMeta): void => {
    if (!shouldLog("debug")) return

    const entry: LogEntry = {
      level: "debug",
      context,
      message,
      timestamp: formatTimestamp(),
      meta,
    }

    logToConsole(entry)
  },
}

/**
 * Códigos de error estandarizados para la aplicación
 */
export const ERROR_CODES = {
  // Auth
  AUTH_NOT_AUTHENTICATED: "AUTH_001",
  AUTH_NOT_AUTHORIZED: "AUTH_002",
  AUTH_SESSION_EXPIRED: "AUTH_003",

  // Ventas
  SALE_FAILED: "SALE_001",
  SALE_NO_STOCK: "SALE_002",
  SALE_INVALID_ITEMS: "SALE_003",

  // Caja
  CASH_REGISTER_NOT_OPEN: "CASH_001",
  CASH_REGISTER_ALREADY_OPEN: "CASH_002",
  CASH_MOVEMENT_FAILED: "CASH_003",

  // Productos
  PRODUCT_NOT_FOUND: "PROD_001",
  PRODUCT_CREATE_FAILED: "PROD_002",
  PRODUCT_UPDATE_FAILED: "PROD_003",

  // Sync
  SYNC_FAILED: "SYNC_001",
  SYNC_CONFLICT: "SYNC_002",

  // General
  UNKNOWN_ERROR: "GEN_001",
  VALIDATION_ERROR: "GEN_002",
  DATABASE_ERROR: "GEN_003",
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

/**
 * Función helper para crear respuestas de error consistentes
 */
export function createErrorResponse(
  errorCode: ErrorCode,
  userMessage: string,
  internalError?: Error,
  meta?: LogMeta
): { success: false; error: string; errorCode: ErrorCode } {
  // Log interno con detalles técnicos
  if (internalError) {
    logger.error("action", userMessage, internalError, { errorCode, ...meta })
  }

  // Respuesta limpia para el usuario
  return {
    success: false,
    error: userMessage,
    errorCode,
  }
}
