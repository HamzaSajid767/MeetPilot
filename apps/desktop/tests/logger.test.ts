import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAppPathsService } from '../src/main/app-paths'
import {
  LOG_CATEGORIES,
  LOG_EVENT_IDS,
  createConsoleJsonSink,
  createJsonFileSink,
  createLoggerFactory,
  redactValue,
  resolveMinimumLogLevel,
  serializeLogEvent,
  type LogEvent
} from '../src/main/logger'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map(async (root) => {
      await rm(root, { recursive: true, force: true })
    })
  )
})

async function createTempAppData(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'zoom-dialer-logs-'))
  tempRoots.push(root)
  return root
}

function createCapturingSink(): { events: LogEvent[]; sink: { write(event: LogEvent): void } } {
  const events: LogEvent[] = []
  return {
    events,
    sink: {
      write(event) {
        events.push(event)
      }
    }
  }
}

describe('structured logging skeleton', () => {
  it('initializes a factory with a session id and category logger', () => {
    const { events, sink } = createCapturingSink()
    const factory = createLoggerFactory({
      sessionId: 'session-1',
      sinks: [sink],
      nowIso: () => '2026-07-22T00:00:00.000Z'
    })

    const logger = factory.createLogger(LOG_CATEGORIES.main)
    logger.info('ready', { boot: true }, LOG_EVENT_IDS.appReady)

    expect(factory.getSessionId()).toBe('session-1')
    expect(logger.category).toBe('main')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      ts: '2026-07-22T00:00:00.000Z',
      level: 'info',
      category: 'main',
      message: 'ready',
      eventId: LOG_EVENT_IDS.appReady,
      sessionId: 'session-1',
      context: { boot: true }
    })
  })

  it('filters levels and supports all severities', () => {
    const { events, sink } = createCapturingSink()
    const factory = createLoggerFactory({
      minimumLevel: 'info',
      sinks: [sink],
      nowIso: () => '2026-07-22T00:00:00.000Z'
    })
    const logger = factory.createLogger(LOG_CATEGORIES.main)

    logger.trace('t')
    logger.debug('d')
    logger.info('i')
    logger.warn('w')
    logger.error('e')
    logger.critical('c')

    expect(events.map((event) => event.level)).toEqual(['info', 'warn', 'error', 'critical'])
  })

  it('merges child context and elevates correlation fields', () => {
    const { events, sink } = createCapturingSink()
    const factory = createLoggerFactory({
      sinks: [sink],
      sessionId: 'session-2',
      nowIso: () => '2026-07-22T00:00:00.000Z',
      baseContext: { process: 'desktop-main' }
    })

    const child = factory
      .createLogger(LOG_CATEGORIES.window, { area: 'ui' })
      .child(LOG_CATEGORIES.window, {
        correlationId: 'corr-1',
        requestId: 'req-1',
        phraseId: 'ignored-later'
      })

    child.info('correlated', { step: 1 })

    expect(events[0]).toMatchObject({
      category: 'window',
      sessionId: 'session-2',
      correlationId: 'corr-1',
      requestId: 'req-1',
      context: {
        process: 'desktop-main',
        area: 'ui',
        phraseId: 'ignored-later',
        step: 1
      }
    })
    expect(events[0]?.context).not.toHaveProperty('correlationId')
    expect(events[0]?.context).not.toHaveProperty('requestId')
  })

  it('redacts sensitive fields and preserves structured properties', () => {
    expect(
      redactValue({
        token: 'abc',
        nested: { accessToken: 'xyz', count: 2 },
        list: [{ password: 'secret' }, 1]
      })
    ).toEqual({
      token: '[Redacted]',
      nested: { accessToken: '[Redacted]', count: 2 },
      list: [{ password: '[Redacted]' }, 1]
    })

    const { events, sink } = createCapturingSink()
    const factory = createLoggerFactory({ sinks: [sink], nowIso: () => '2026-07-22T00:00:00.000Z' })
    factory.createLogger(LOG_CATEGORIES.main).error('failed', {
      authorization: 'Bearer secret',
      retryCount: 3,
      error: new Error('boom')
    })

    expect(events[0]?.context).toMatchObject({
      authorization: '[Redacted]',
      retryCount: 3,
      error: {
        name: 'Error',
        message: 'boom'
      }
    })
    expect((events[0]?.context?.error as { stack?: string }).stack).toContain('Error: boom')
  })

  it('routes JSON console output by level', () => {
    const consoleLike = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
    const sink = createConsoleJsonSink(consoleLike)
    const event: LogEvent = {
      ts: '2026-07-22T00:00:00.000Z',
      level: 'warn',
      category: 'main',
      message: 'hello'
    }

    sink.write(event)
    expect(consoleLike.warn).toHaveBeenCalledWith(serializeLogEvent(event))
  })

  it('writes JSONL into the resolved AppPaths logs directory', async () => {
    const appData = await createTempAppData()
    const appPaths = createAppPathsService(appData)
    await appPaths.ensureCreated()

    const written: string[] = []
    const sink = createJsonFileSink(appPaths.logs, {
      clock: () => new Date('2026-07-22T12:00:00.000Z'),
      appendFile: (filePath, data) => {
        written.push(filePath, data)
      }
    })

    sink.write({
      ts: '2026-07-22T12:00:00.000Z',
      level: 'info',
      category: 'main',
      message: 'file-ready',
      sessionId: 'session-3'
    })

    expect(written[0]).toBe(path.join(appPaths.logs, 'desktop-2026-07-22.jsonl'))
    expect(written[1]).toContain('"message":"file-ready"')

    const factory = createLoggerFactory({
      sinks: [
        createJsonFileSink(appPaths.logs, { clock: () => new Date('2026-07-22T12:00:00.000Z') })
      ],
      sessionId: 'session-4',
      nowIso: () => '2026-07-22T12:00:00.000Z'
    })
    factory.createLogger(LOG_CATEGORIES.main).info('persisted')

    const contents = await readFile(path.join(appPaths.logs, 'desktop-2026-07-22.jsonl'), 'utf8')
    expect(contents).toContain('"message":"persisted"')
    expect(contents).toContain('"sessionId":"session-4"')
  })

  it('isolates circular context and sink failures', () => {
    const circular: Record<string, unknown> = { ok: true }
    circular.self = circular

    const { events, sink } = createCapturingSink()
    const factory = createLoggerFactory({
      sinks: [
        sink,
        {
          write() {
            throw new Error('sink failed')
          }
        }
      ],
      nowIso: () => '2026-07-22T00:00:00.000Z'
    })

    expect(() => {
      factory.createLogger(LOG_CATEGORIES.main).info('safe', circular)
    }).not.toThrow()

    expect(events[0]?.context).toMatchObject({
      ok: true,
      self: {
        ok: true,
        self: '[Circular]'
      }
    })
  })

  it('resolves development and production minimum levels', () => {
    expect(resolveMinimumLogLevel(true)).toBe('debug')
    expect(resolveMinimumLogLevel(false)).toBe('info')
    expect(resolveMinimumLogLevel(false, 'trace')).toBe('trace')
    expect(resolveMinimumLogLevel(true, 'nope')).toBe('debug')
  })
})
