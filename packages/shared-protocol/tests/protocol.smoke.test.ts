import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'
import {
  APP_PATH_NAMES,
  MINIMUM_SUPPORTED_PROTOCOL_VERSION,
  PROTOCOL_COMMANDS,
  PROTOCOL_ERROR_CODES,
  PROTOCOL_VERSION
} from '../src/index.js'

const schemaDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schema')

function loadSchema(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(schemaDir, name), 'utf8')) as Record<string, unknown>
}

function createValidator() {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false
  })
  addFormats(ajv)

  for (const fileName of [
    'message-direction.schema.json',
    'error-code.schema.json',
    'command-name.schema.json',
    'event-name.schema.json',
    'dtos.schema.json',
    'envelope.schema.json',
    'commands.schema.json',
    'events.schema.json',
    'validators.schema.json'
  ]) {
    ajv.addSchema(loadSchema(fileName))
  }

  return ajv
}

describe('shared protocol schema smoke', () => {
  const ajv = createValidator()
  const messageEnvelope = ajv.getSchema(
    'https://zoomdialer.local/protocol/envelope.schema.json#/$defs/MessageEnvelope'
  )
  const errorEnvelope = ajv.getSchema(
    'https://zoomdialer.local/protocol/envelope.schema.json#/$defs/ErrorEnvelope'
  )
  const successEnvelope = ajv.getSchema(
    'https://zoomdialer.local/protocol/envelope.schema.json#/$defs/SuccessEnvelope'
  )

  it('centralizes protocol version metadata', () => {
    expect(PROTOCOL_VERSION).toBe('1.0.0')
    expect(MINIMUM_SUPPORTED_PROTOCOL_VERSION).toBe('1.0.0')
    expect(PROTOCOL_COMMANDS).toContain('Ping')
    expect(PROTOCOL_ERROR_CODES).toContain('UnsupportedVersion')
  })

  it('centralizes application data directory names', () => {
    expect(APP_PATH_NAMES.rootDirectoryName).toBe('ZoomDialerCompanion')
    expect(APP_PATH_NAMES.config).toBe('config')
    expect(APP_PATH_NAMES.database).toBe('database')
    expect(APP_PATH_NAMES.logs).toBe('logs')
    expect(APP_PATH_NAMES.assets).toBe('assets')
    expect(APP_PATH_NAMES.phrases).toBe('phrases')
    expect(APP_PATH_NAMES.cache).toBe('cache')
    expect(APP_PATH_NAMES.temp).toBe('temp')
    expect(APP_PATH_NAMES.imports).toBe('imports')
    expect(APP_PATH_NAMES.exports).toBe('exports')
  })

  it('accepts a valid request envelope', () => {
    const valid = {
      id: 'req-1',
      type: 'Ping',
      protocolVersion: PROTOCOL_VERSION,
      direction: 'request',
      correlationId: null,
      requestId: 'req-1',
      payload: { nonce: 'abc' },
      ts: '2026-07-22T00:00:00.000Z'
    }

    expect(messageEnvelope?.(valid)).toBe(true)
  })

  it('accepts success and error envelopes', () => {
    expect(
      successEnvelope?.({
        ok: true,
        data: { pong: true }
      })
    ).toBe(true)

    expect(
      errorEnvelope?.({
        code: 'InvalidMessage',
        message: 'Missing type field',
        retriable: false,
        details: null
      })
    ).toBe(true)
  })

  it('rejects an unsupported envelope shape', () => {
    const invalid = {
      id: '',
      type: 'Ping',
      protocolVersion: PROTOCOL_VERSION,
      direction: 'sideways',
      ts: 'not-a-date'
    }

    expect(messageEnvelope?.(invalid)).toBe(false)
  })

  it('accepts a host started event payload', () => {
    const eventSchema = ajv.getSchema(
      'https://zoomdialer.local/protocol/events.schema.json#/$defs/HostStartedEvent'
    )

    expect(
      eventSchema?.({
        startedAt: '2026-07-22T00:00:00.000Z'
      })
    ).toBe(true)
  })
})
