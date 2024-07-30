import { randomUUID } from 'node:crypto'
import net from 'node:net'
import { EventEmitter } from 'node:events'
import {
  PROTOCOL_TIMEOUTS,
  PROTOCOL_VERSION,
  type MessageEnvelope,
  type SuccessEnvelope
} from '../../shared/protocol'
import type { Logger } from '../logger'
import { encodeJsonFrame, FrameCodecError, FrameDecoder } from './frame-codec'

export type PipeClientState = 'disconnected' | 'connecting' | 'connected'

interface PendingRequest {
  readonly resolve: (value: MessageEnvelope) => void
  readonly reject: (reason: Error) => void
  readonly timer: NodeJS.Timeout
}

export interface PipeClientOptions {
  readonly pipeName: string
  readonly logger: Logger
  readonly requestTimeoutMs?: number
  readonly maxPayloadBytes?: number
}

export class PipeClient extends EventEmitter {
  private socket: net.Socket | null = null
  private readonly decoder: FrameDecoder
  private readonly pending = new Map<string, PendingRequest>()
  private state: PipeClientState = 'disconnected'
  private readonly requestTimeoutMs: number

  constructor(private readonly options: PipeClientOptions) {
    super()
    this.decoder = new FrameDecoder()
    this.requestTimeoutMs = options.requestTimeoutMs ?? PROTOCOL_TIMEOUTS.defaultRequestMilliseconds
  }

  getState(): PipeClientState {
    return this.state
  }

  connect(): Promise<void> {
    if (this.state === 'connected') {
      return Promise.resolve()
    }

    if (this.state === 'connecting') {
      return new Promise((resolve, reject) => {
        const onConnected = (): void => {
          cleanup()
          resolve()
        }
        const onError = (error: Error): void => {
          cleanup()
          reject(error)
        }
        const cleanup = (): void => {
          this.off('connected', onConnected)
          this.off('error', onError)
        }
        this.on('connected', onConnected)
        this.on('error', onError)
      })
    }

    this.setState('connecting')
    this.decoder.reset()

    return new Promise((resolve, reject) => {
      const pipePath = `\\\\.\\pipe\\${this.options.pipeName}`
      const socket = net.createConnection(pipePath)
      this.socket = socket

      const onConnect = (): void => {
        cleanupConnectListeners()
        this.setState('connected')
        this.options.logger.info(
          'Pipe client connected',
          { pipePath: 'redacted' },
          'pipe.connected'
        )
        this.emit('connected')
        resolve()
      }

      const onError = (error: Error): void => {
        cleanupConnectListeners()
        this.cleanupSocket(error)
        reject(error)
      }

      const cleanupConnectListeners = (): void => {
        socket.off('connect', onConnect)
        socket.off('error', onError)
      }

      socket.on('connect', onConnect)
      socket.once('error', onError)
      socket.on('data', (chunk) => {
        void this.onData(chunk)
      })
      socket.on('close', () => {
        this.cleanupSocket(new Error('Named pipe connection closed'))
      })
    })
  }

  async request(
    type: string,
    payload: Record<string, unknown> | null = null,
    correlationId: string = randomUUID().replaceAll('-', ''),
    timeoutMs?: number
  ): Promise<MessageEnvelope> {
    if (!this.socket || this.state !== 'connected') {
      throw new Error('Pipe client is not connected')
    }

    const id = randomUUID().replaceAll('-', '').slice(0, 32)
    const envelope: MessageEnvelope = {
      id,
      type,
      protocolVersion: PROTOCOL_VERSION,
      direction: 'request',
      correlationId,
      requestId: null,
      payload,
      ts: new Date().toISOString()
    }

    const effectiveTimeout = timeoutMs ?? this.requestTimeoutMs
    const frame = encodeJsonFrame(envelope)
    return await new Promise<MessageEnvelope>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Request '${type}' timed out after ${effectiveTimeout}ms`))
      }, effectiveTimeout)

      this.pending.set(id, { resolve, reject, timer })
      this.socket!.write(frame, (error) => {
        if (error) {
          clearTimeout(timer)
          this.pending.delete(id)
          reject(error)
        }
      })
    })
  }

  disconnect(): void {
    this.cleanupSocket()
  }

  private async onData(chunk: Buffer): Promise<void> {
    try {
      const frames = this.decoder.push(chunk)
      for (const frame of frames) {
        const envelope = JSON.parse(frame.toString('utf8')) as MessageEnvelope
        if (envelope.direction === 'event') {
          this.emit('protocolEvent', envelope)
          continue
        }

        if (envelope.direction !== 'response' || !envelope.requestId) {
          this.options.logger.warn(
            'Ignoring unexpected pipe message',
            { type: envelope.type, direction: envelope.direction },
            'pipe.unexpected_message'
          )
          continue
        }

        const pending = this.pending.get(envelope.requestId)
        if (!pending) {
          continue
        }

        clearTimeout(pending.timer)
        this.pending.delete(envelope.requestId)
        pending.resolve(envelope)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      if (error instanceof FrameCodecError || error instanceof SyntaxError) {
        this.options.logger.error('Malformed pipe frame', { error: err }, 'pipe.malformed_frame')
      }
      this.cleanupSocket(err)
    }
  }

  private cleanupSocket(error?: Error): void {
    const socket = this.socket
    this.socket = null
    this.decoder.reset()

    if (socket) {
      socket.removeAllListeners()
      socket.destroy()
    }

    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(error ?? new Error('Pipe client disconnected'))
      this.pending.delete(id)
    }

    if (this.state !== 'disconnected') {
      this.setState('disconnected')
      this.emit('disconnected', error)
    }
  }

  private setState(state: PipeClientState): void {
    this.state = state
    this.emit('state', state)
  }
}

export function extractSuccessData<T>(envelope: MessageEnvelope): T {
  const payload = envelope.payload as SuccessEnvelope | null
  if (!payload || payload.ok !== true) {
    throw new Error(`Expected success payload for ${envelope.type}`)
  }

  return payload.data as T
}
