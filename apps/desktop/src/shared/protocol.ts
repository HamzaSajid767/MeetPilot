/**
 * Re-exports the canonical sidecar IPC protocol contracts.
 * Source of truth: packages/shared-protocol/schema
 */
export {
  PROTOCOL_VERSION,
  MINIMUM_SUPPORTED_PROTOCOL_VERSION,
  PROTOCOL_LIMITS,
  PROTOCOL_TIMEOUTS,
  RESERVED_CHANNELS,
  PROTOCOL_COMMANDS,
  PROTOCOL_EVENTS,
  PROTOCOL_ERROR_CODES,
  APP_PATH_NAMES,
  type MessageEnvelope,
  type ErrorEnvelope,
  type SuccessEnvelope,
  type ProtocolCommandName,
  type ProtocolEventName,
  type ProtocolErrorCode,
  type AppPathNameKey
} from '@zoom-dialer/shared-protocol'
