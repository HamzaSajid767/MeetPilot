import { appendFileSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'critical'

export const LOG_LEVELS = Object.freeze([
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'critical'
] as const satisfies readonly LogLevel[])

const LOG_LEVEL_RANK: Readonly<Record<LogLevel, number>> = Object.freeze({
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  critical: 5
})

export const LOG_CATEGORIES = Object.freeze({
  main: 'main',
  window: 'window'
})

export const LOG_EVENT_IDS = Object.freeze({
  appReady: 'app.ready',
  appDataReady: 'app.data_ready',
  appQuitting: 'app.quitting',
  bootstrapFailed: 'app.bootstrap_failed',
  uncaughtException: 'app.uncaught_exception',
  unhandledRejection: 'app.unhandled_rejection',
  windowReady: 'window.ready',
  windowLoadDev: 'window.load_dev',
  windowLoadPackaged: 'window.load_packaged'
})

export type LogContext = Readonly<Record<string, unknown>>

export interface LogEvent {
  readonly ts: string
  readonly level: LogLevel
  readonly category: string
  readonly message: string
  readonly eventId?: string
  readonly sessionId?: string
  readonly correlationId?: string
  readonly requestId?: string
  readonly context?: LogContext
}

export interface Logger {
  readonly category: string
  trace(message: string, context?: LogContext, eventId?: string): void
  debug(message: string, context?: LogContext, eventId?: string): void
  info(message: string, context?: LogContext, eventId?: string): void
  warn(message: string, context?: LogContext, eventId?: string): void
  error(message: string, context?: LogContext, eventId?: string): void
  critical(message: string, context?: LogContext, eventId?: string): void
  child(category: string, context?: LogContext): Logger
}

export interface LogSink {
  write(event: LogEvent): void
}

export interface LoggerFactoryOptions {
  readonly minimumLevel?: LogLevel
  readonly sinks?: readonly LogSink[]
  readonly sessionId?: string
  readonly baseContext?: LogContext
  readonly clock?: () => Date
  readonly nowIso?: () => string
}

export interface ConsoleLike {
  debug(...args: unknown[]): void
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

const SENSITIVE_KEY_PATTERN = /(token|secret|password|passwd|authorization|api[_-]?key|auth)/i

function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value)
}

export function resolveMinimumLogLevel(
  isDevelopment: boolean,
  override?: string | undefined
): LogLevel {
  if (override !== undefined && isLogLevel(override)) {
    return override
  }

  return isDevelopment ? 'debug' : 'info'
}

export function redactValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    }
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, seen))
  }

  if (value !== null && typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]'
    }

    seen.add(value)
    const result: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[Redacted]' : redactValue(entry, seen)
    }
    return result
  }

  return value
}

export function serializeLogEvent(event: LogEvent): string {
  try {
    return JSON.stringify(event)
  } catch {
    return JSON.stringify({
      ts: event.ts,
      level: event.level,
      category: event.category,
      message: event.message,
      eventId: event.eventId,
      sessionId: event.sessionId,
      context: {
        serializationError: true
      }
    })
  }
}

export function createConsoleJsonSink(consoleLike: ConsoleLike = console): LogSink {
  return {
    write(event: LogEvent): void {
      const line = serializeLogEvent(event)
      switch (event.level) {
        case 'trace':
        case 'debug':
          consoleLike.debug(line)
          break
        case 'info':
          consoleLike.info(line)
          break
        case 'warn':
          consoleLike.warn(line)
          break
        case 'error':
        case 'critical':
          consoleLike.error(line)
          break
      }
    }
  }
}

export interface JsonFileSinkOptions {
  readonly appendFile?: (filePath: string, data: string) => void
  readonly clock?: () => Date
  readonly fileNamePrefix?: string
}

export function createJsonFileSink(
  logsDirectory: string,
  options: JsonFileSinkOptions = {}
): LogSink {
  if (!path.isAbsolute(logsDirectory)) {
    throw new Error(`Logs directory must be absolute: ${logsDirectory}`)
  }

  const appendFile = options.appendFile ?? appendFileSync
  const clock = options.clock ?? (() => new Date())
  const fileNamePrefix = options.fileNamePrefix ?? 'desktop'

  return {
    write(event: LogEvent): void {
      try {
        const day = clock().toISOString().slice(0, 10)
        const filePath = path.join(logsDirectory, `${fileNamePrefix}-${day}.jsonl`)
        appendFile(filePath, `${serializeLogEvent(event)}\n`)
      } catch {
        // File sink failures must never crash the application.
      }
    }
  }
}

export class LoggerFactory {
  private minimumLevel: LogLevel
  private readonly sinks: LogSink[]
  private readonly sessionId: string
  private readonly baseContext: LogContext
  private readonly nowIso: () => string

  constructor(options: LoggerFactoryOptions = {}) {
    this.minimumLevel = options.minimumLevel ?? 'info'
    this.sinks = [...(options.sinks ?? [])]
    this.sessionId = options.sessionId ?? randomUUID()
    this.baseContext = Object.freeze({ ...(options.baseContext ?? {}) })
    this.nowIso =
      options.nowIso ??
      (() => {
        const clock = options.clock ?? (() => new Date())
        return clock().toISOString()
      })
  }

  getSessionId(): string {
    return this.sessionId
  }

  getMinimumLevel(): LogLevel {
    return this.minimumLevel
  }

  setMinimumLevel(level: LogLevel): void {
    this.minimumLevel = level
  }

  addSink(sink: LogSink): void {
    this.sinks.push(sink)
  }

  createLogger(category: string, context?: LogContext): Logger {
    return this.createChildLogger(category, context)
  }

  private createChildLogger(category: string, parentContext?: LogContext): Logger {
    const write = (level: LogLevel, message: string, context?: LogContext, eventId?: string) => {
      if (LOG_LEVEL_RANK[level] < LOG_LEVEL_RANK[this.minimumLevel]) {
        return
      }

      const mergedContext = mergeContexts(this.baseContext, parentContext, context)
      const correlationId = readStringField(mergedContext, 'correlationId')
      const requestId = readStringField(mergedContext, 'requestId')
      const sanitizedContext = stripReservedContextFields(mergedContext)

      const event: LogEvent = {
        ts: this.nowIso(),
        level,
        category,
        message,
        sessionId: this.sessionId,
        ...(eventId === undefined ? {} : { eventId }),
        ...(correlationId === undefined ? {} : { correlationId }),
        ...(requestId === undefined ? {} : { requestId }),
        ...(sanitizedContext === undefined ? {} : { context: sanitizedContext })
      }

      for (const sink of this.sinks) {
        try {
          sink.write(event)
        } catch {
          // Sink failures must never crash the application.
        }
      }
    }

    return {
      category,
      trace: (message, context, eventId) => write('trace', message, context, eventId),
      debug: (message, context, eventId) => write('debug', message, context, eventId),
      info: (message, context, eventId) => write('info', message, context, eventId),
      warn: (message, context, eventId) => write('warn', message, context, eventId),
      error: (message, context, eventId) => write('error', message, context, eventId),
      critical: (message, context, eventId) => write('critical', message, context, eventId),
      child: (childCategory, childContext) =>
        this.createChildLogger(childCategory, mergeContexts(parentContext, childContext))
    }
  }
}

export function createLoggerFactory(options: LoggerFactoryOptions = {}): LoggerFactory {
  return new LoggerFactory(options)
}

function mergeContexts(...parts: Array<LogContext | undefined>): LogContext | undefined {
  const merged: Record<string, unknown> = {}
  let hasEntries = false

  for (const part of parts) {
    if (part === undefined) {
      continue
    }

    for (const [key, value] of Object.entries(part)) {
      merged[key] = value
      hasEntries = true
    }
  }

  if (!hasEntries) {
    return undefined
  }

  return redactValue(merged) as LogContext
}

function readStringField(context: LogContext | undefined, key: string): string | undefined {
  if (context === undefined) {
    return undefined
  }

  const value = context[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function stripReservedContextFields(context: LogContext | undefined): LogContext | undefined {
  if (context === undefined) {
    return undefined
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context)) {
    if (key === 'correlationId' || key === 'requestId') {
      continue
    }
    result[key] = value
  }

  return Object.keys(result).length === 0 ? undefined : Object.freeze(result)
}
