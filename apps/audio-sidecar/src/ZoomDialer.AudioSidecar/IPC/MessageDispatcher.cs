using Microsoft.Extensions.Logging;
using ZoomDialer.AudioSidecar.Logging;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.IPC;

public sealed class MessageDispatcher : IMessageDispatcher<MessageEnvelope>
{
    private readonly IReadOnlyDictionary<string, IRequestHandler<MessageEnvelope>> _handlers;
    private readonly IProtocolVersionValidator _versionValidator;
    private readonly ILogger<MessageDispatcher> _logger;

    public MessageDispatcher(
        IEnumerable<IRequestHandler<MessageEnvelope>> handlers,
        IProtocolVersionValidator versionValidator,
        ILogger<MessageDispatcher> logger)
    {
        _versionValidator = versionValidator;
        _logger = logger;

        var map = new Dictionary<string, IRequestHandler<MessageEnvelope>>(StringComparer.Ordinal);
        foreach (var handler in handlers)
        {
            if (!map.TryAdd(handler.MessageType, handler))
            {
                throw new InvalidOperationException($"Duplicate handler registered for '{handler.MessageType}'.");
            }
        }

        _handlers = map;
    }

    public async Task<MessageEnvelope?> DispatchAsync(
        MessageEnvelope envelope,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(envelope);

        if (!_versionValidator.IsSupported(envelope.ProtocolVersion))
        {
            _logger.LogWarning(
                SidecarLogEventIds.PipeVersionRejected,
                "Rejected unsupported protocol version {ProtocolVersion}",
                envelope.ProtocolVersion);

            return EnvelopeFactory.CreateErrorResponse(
                envelope,
                ProtocolConstants.ErrorCodes.UnsupportedVersion,
                $"Unsupported protocol version '{envelope.ProtocolVersion}'. Expected '{ProtocolConstants.ProtocolVersion}'.",
                retriable: false);
        }

        if (!string.Equals(envelope.Direction, ProtocolConstants.Directions.Request, StringComparison.Ordinal))
        {
            return EnvelopeFactory.CreateErrorResponse(
                envelope,
                ProtocolConstants.ErrorCodes.InvalidMessage,
                $"Expected direction '{ProtocolConstants.Directions.Request}'.",
                retriable: false);
        }

        if (!_handlers.TryGetValue(envelope.Type, out var handler))
        {
            _logger.LogWarning(
                SidecarLogEventIds.PipeUnknownCommand,
                "Unknown command {CommandType}",
                envelope.Type);

            return EnvelopeFactory.CreateErrorResponse(
                envelope,
                ProtocolConstants.ErrorCodes.InvalidMessage,
                $"Unknown command '{envelope.Type}'.",
                retriable: false);
        }

        try
        {
            return await handler.HandleAsync(envelope, cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(
                SidecarLogEventIds.PipeHandlerFaulted,
                ex,
                "Handler for {CommandType} faulted",
                envelope.Type);

            return EnvelopeFactory.CreateErrorResponse(
                envelope,
                ProtocolConstants.ErrorCodes.InternalError,
                "An internal error occurred while handling the request.",
                retriable: true);
        }
    }
}
