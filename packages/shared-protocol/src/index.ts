export type { MessageDirection } from './generated/message-direction.js'
export type { ProtocolErrorCode } from './generated/error-code.js'
export type { ProtocolCommandName as ProtocolCommandNameSchema } from './generated/command-name.js'
export type { ProtocolEventName as ProtocolEventNameSchema } from './generated/event-name.js'

export type {
  AudioDeviceDto,
  AudioOutputDeviceDto,
  AudioOutputDeviceListDto,
  AudioInputDeviceDto,
  AudioInputDeviceListDto,
  SetOutputDeviceResultDto,
  SetMicrophoneResultDto,
  SetMixerGainsResultDto,
  AudioLevelsDto,
  PlayAudioResultDto,
  PlaybackRequestDto,
  PlaybackResultDto,
  HealthStatusDto,
  VersionInfoDto,
  ApplicationStateDto
} from './generated/dtos.js'

export type {
  MessageEnvelope,
  ErrorEnvelope,
  SuccessEnvelope,
  ErrorResponseEnvelope,
  SuccessResponseEnvelope
} from './generated/envelope.js'

export type {
  PingCommand,
  PongCommand,
  HealthCheckCommand,
  ShutdownCommand,
  InitializeCommand,
  GetVersionCommand,
  StopPlaybackCommand,
  PlayAudioCommand,
  GetAudioOutputDevicesCommand,
  SetOutputDeviceCommand,
  GetAudioInputDevicesCommand,
  StartMicrophoneCommand,
  StopMicrophoneCommand,
  SetMixerGainsCommand,
  SpeakTextCommand,
  GetAudioDevicesCommand,
  SetMicrophoneCommand,
  SetVirtualOutputCommand,
  ReloadConfigurationCommand
} from './generated/commands.js'

export type { PlaybackRequestDto as PlayPhraseCommand } from './generated/dtos.js'

export type {
  HostStartedEvent,
  HostStoppedEvent,
  PlaybackStartedEvent,
  PlaybackFinishedEvent,
  PlaybackCompletedEvent,
  PlaybackFailedEvent,
  MicrophoneStartedEvent,
  MicrophoneStoppedEvent,
  MicrophoneFailedEvent,
  DeviceChangedEvent
} from './generated/events.js'

export type { AudioLevelsDto as AudioLevelsEvent } from './generated/dtos.js'

export type { HealthStatusDto as HealthStatusChangedEvent } from './generated/dtos.js'
export type { ErrorEnvelope as ErrorOccurredEvent } from './generated/envelope.js'

export type { IMessageValidator as IMessageValidatorSchema } from './generated/validators.js'
export type { IProtocolVersionValidator as IProtocolVersionValidatorSchema } from './generated/validators.js'

export {
  PROTOCOL_VERSION,
  MINIMUM_SUPPORTED_PROTOCOL_VERSION,
  PROTOCOL_LIMITS,
  PROTOCOL_TIMEOUTS,
  RESERVED_CHANNELS,
  MESSAGE_DIRECTIONS,
  PROTOCOL_COMMANDS,
  PROTOCOL_EVENTS,
  PROTOCOL_ERROR_CODES,
  APP_PATH_NAMES,
  type ProtocolCommandName,
  type ProtocolEventName,
  type ProtocolErrorCodeName,
  type MessageDirectionName,
  type AppPathNameKey,
  type IMessageValidator,
  type IProtocolVersionValidator
} from './constants.js'
