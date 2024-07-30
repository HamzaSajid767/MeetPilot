import { randomBytes } from 'node:crypto'
import net from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { PROTOCOL_VERSION, type MessageEnvelope } from '../src/shared/protocol'
import { encodeJsonFrame } from '../src/main/ipc/frame-codec'
import { PipeClient } from '../src/main/ipc/pipe-client'
import { createLoggerFactory, createConsoleJsonSink } from '../src/main/logger'

const servers: net.Server[] = []
const clients: PipeClient[] = []

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect()
  }

  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve())
        })
    )
  )
})

function createLogger() {
  const quiet = {
    debug() {},
    info() {},
    warn() {},
    error() {}
  }
  return createLoggerFactory({
    minimumLevel: 'critical',
    sinks: [createConsoleJsonSink(quiet)]
  }).createLogger('test')
}

async function createEchoServer(pipeName: string): Promise<net.Server> {
  const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0)
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      while (buffer.length >= 4) {
        const length = buffer.readUInt32LE(0)
        if (buffer.length < 4 + length) {
          break
        }

        const payload = buffer.subarray(4, 4 + length)
        buffer = buffer.subarray(4 + length)
        const request = JSON.parse(payload.toString('utf8')) as MessageEnvelope
        const response: MessageEnvelope = {
          id: randomBytes(8).toString('hex'),
          type: request.type === 'Ping' ? 'Pong' : request.type,
          protocolVersion: PROTOCOL_VERSION,
          direction: 'response',
          requestId: request.id,
          correlationId: request.correlationId,
          payload: {
            ok: true,
            data:
              request.type === 'Ping'
                ? { nonce: (request.payload as { nonce?: string } | null)?.nonce ?? '' }
                : { protocolVersion: PROTOCOL_VERSION, applicationVersion: 'test' }
          },
          ts: new Date().toISOString()
        }
        socket.write(encodeJsonFrame(response))
      }
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(`\\\\.\\pipe\\${pipeName}`, () => resolve())
  })
  servers.push(server)
  return server
}

describe('PipeClient', () => {
  it('correlates request and response', async () => {
    const pipeName = `ZoomDialerClientTest-${randomBytes(8).toString('hex')}`
    await createEchoServer(pipeName)

    const client = new PipeClient({ pipeName, logger: createLogger() })
    clients.push(client)
    await client.connect()

    const response = await client.request('Ping', { nonce: 'n-1' })
    expect(response.type).toBe('Pong')
    expect(response.direction).toBe('response')
    expect((response.payload as { data: { nonce: string } }).data.nonce).toBe('n-1')
  })

  it('times out when no response arrives', async () => {
    const pipeName = `ZoomDialerClientTimeout-${randomBytes(8).toString('hex')}`
    const server = net.createServer((socket) => {
      socket.on('data', () => {
        // Intentionally do not respond.
      })
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(`\\\\.\\pipe\\${pipeName}`, () => resolve())
    })
    servers.push(server)

    const client = new PipeClient({
      pipeName,
      logger: createLogger(),
      requestTimeoutMs: 100
    })
    clients.push(client)
    await client.connect()

    await expect(client.request('Ping', { nonce: 'late' })).rejects.toThrow(/timed out/)
  })

  it('emits protocolEvent for direction=event frames', async () => {
    const pipeName = `ZoomDialerClientEvent-${randomBytes(8).toString('hex')}`
    const server = net.createServer((socket) => {
      const eventEnvelope: MessageEnvelope = {
        id: randomBytes(8).toString('hex'),
        type: 'PlaybackStarted',
        protocolVersion: PROTOCOL_VERSION,
        direction: 'event',
        payload: { phraseId: 'abc', durationMs: 123 },
        ts: new Date().toISOString()
      }
      socket.write(encodeJsonFrame(eventEnvelope))
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(`\\\\.\\pipe\\${pipeName}`, () => resolve())
    })
    servers.push(server)

    const client = new PipeClient({ pipeName, logger: createLogger() })
    clients.push(client)

    const eventPromise = new Promise<MessageEnvelope>((resolve) => {
      client.once('protocolEvent', (envelope: MessageEnvelope) => resolve(envelope))
    })
    await client.connect()
    const event = await eventPromise
    expect(event.type).toBe('PlaybackStarted')
    expect(event.direction).toBe('event')
    expect((event.payload as { phraseId: string }).phraseId).toBe('abc')
  })
})
