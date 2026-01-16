import { Format, useLogg as useLoggFn } from '@guiiai/logg'

/**
 * Logger type that supports both standard debug library and enhanced loggers.
 * - Standard debug: function `(message: string) => void`
 * - Enhanced loggers: object with `debug`/`log` and optional `withField` methods
 */
export type Logger
  = | ((message: string) => void)
    | {
      debug?: (message: string) => void
      log?: (message: string) => void
      withField?: (key: string, value: unknown) => Logger
    }

/**
 * Normalized logger interface that always has both debug and withField methods
 */
export interface NormalizedLogger {
  debug: (message: string) => void
  withField: (key: string, value: unknown) => NormalizedLogger
}

/**
 * Creates a default logger using @guiiai/logg
 */
export function createDefaultLog(packageName: string = '@proj-airi/drizzle-orm-browser-migrator'): NormalizedLogger {
  const log = useLoggFn(packageName).withFormat(Format.Pretty)
  return normalizeLogger(log)
}

/**
 * Normalizes a logger to ensure it has both `debug` and `withField` methods.
 * Supports:
 * - Standard debug library (function): uses function as debug, withField is no-op
 * - Enhanced loggers (object): uses debug/log method, withField if available
 */
export function normalizeLogger(logger: Logger): NormalizedLogger {
  // If it's a function (standard debug library)
  if (typeof logger === 'function') {
    return {
      debug: logger,
      withField: () => normalizeLogger(logger), // No-op: return self
    }
  }

  // Get debug method: prefer debug, fallback to log
  const debugMethod = logger.debug ?? logger.log ?? (() => {})

  // Handle withField if available
  const withField = logger.withField
    ? (key: string, value: unknown) => normalizeLogger(logger.withField!(key, value))
    : () => normalizeLogger(logger) // No-op: return self

  return { debug: debugMethod, withField }
}
