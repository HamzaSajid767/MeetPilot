import { appPathConstants } from './generated/app-paths.constants.js'
import { protocolConstants } from './generated/protocol.constants.js'

export const PROTOCOL_VERSION = protocolConstants.protocolVersion
export const MINIMUM_SUPPORTED_PROTOCOL_VERSION = protocolConstants.minimumSupportedVersion

export const PROTOCOL_LIMITS = Object.freeze({
  maxPayloadBytes: protocolConstants.limits.maxPayloadBytes,
  maxMessageNameLength: protocolConstants.limits.maxMessageNameLength,
  maxCorrelationIdLength: protocolConstants.limits.maxCorrelationIdLength
})

export const PROTOCOL_TIMEOUTS = Object.freeze({
  handshakeMilliseconds: protocolConstants.timeouts.handshakeMilliseconds,
  heartbeatIntervalMilliseconds: protocolConstants.timeouts.heartbeatIntervalMilliseconds,
  defaultRequestMilliseconds: protocolConstants.timeouts.defaultRequestMilliseconds
})

export const RESERVED_CHANNELS = Object.freeze({
  control: protocolConstants.reservedChannels.control,
  events: protocolConstants.reservedChannels.events
})

export const MESSAGE_DIRECTIONS = Object.freeze([...protocolConstants.messageDirections] as const)

export const PROTOCOL_COMMANDS = Object.freeze([...protocolConstants.commands] as const)

export const PROTOCOL_EVENTS = Object.freeze([...protocolConstants.events] as const)

export const PROTOCOL_ERROR_CODES = Object.freeze([...protocolConstants.errorCodes] as const)

export const APP_PATH_NAMES = Object.freeze({
  rootDirectoryName: appPathConstants.rootDirectoryName,
  config: appPathConstants.directories.config,
  database: appPathConstants.directories.database,
  logs: appPathConstants.directories.logs,
  assets: appPathConstants.directories.assets,
  phrases: appPathConstants.directories.phrases,
  cache: appPathConstants.directories.cache,
  temp: appPathConstants.directories.temp,
  imports: appPathConstants.directories.imports,
  exports: appPathConstants.directories.exports
})

export type ProtocolCommandName = (typeof PROTOCOL_COMMANDS)[number]
export type ProtocolEventName = (typeof PROTOCOL_EVENTS)[number]
export type ProtocolErrorCodeName = (typeof PROTOCOL_ERROR_CODES)[number]
export type MessageDirectionName = (typeof MESSAGE_DIRECTIONS)[number]
export type AppPathNameKey = keyof typeof APP_PATH_NAMES

export interface IMessageValidator {
  readonly interfaceName: 'IMessageValidator'
}

export interface IProtocolVersionValidator {
  readonly interfaceName: 'IProtocolVersionValidator'
}
