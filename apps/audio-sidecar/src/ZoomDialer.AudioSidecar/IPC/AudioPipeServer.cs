using System.IO.Pipes;
using System.Security.AccessControl;
using System.Security.Principal;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ZoomDialer.AudioSidecar.Configuration;
using ZoomDialer.AudioSidecar.Logging;
using ZoomDialer.AudioSidecar.Protocol;

namespace ZoomDialer.AudioSidecar.IPC;

public sealed class AudioPipeServer : IAudioPipeServer, IAsyncDisposable, IDisposable
{
    private readonly NamedPipeOptions _options;
    private readonly IMessageSerializer<MessageEnvelope> _serializer;
    private readonly IMessageDispatcher<MessageEnvelope> _dispatcher;
    private readonly ILogger<AudioPipeServer> _logger;
    private readonly SemaphoreSlim _writeLock = new(1, 1);
    private readonly object _gate = new();

    private CancellationTokenSource? _runCts;
    private Task? _acceptLoopTask;
    private NamedPipeServerStream? _activePipe;
    private bool _started;
    private bool _disposed;

    public AudioPipeServer(
        IOptions<NamedPipeOptions> options,
        IMessageSerializer<MessageEnvelope> serializer,
        IMessageDispatcher<MessageEnvelope> dispatcher,
        ILogger<AudioPipeServer> logger)
    {
        _options = options.Value;
        _serializer = serializer;
        _dispatcher = dispatcher;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_gate)
        {
            if (_started)
            {
                return Task.CompletedTask;
            }

            if (string.IsNullOrWhiteSpace(_options.PipeName))
            {
                throw new InvalidOperationException("Pipe name is required to start the named pipe server.");
            }

            _runCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            _acceptLoopTask = Task.Run(() => AcceptLoopAsync(_runCts.Token), CancellationToken.None);
            _started = true;
        }

        _logger.LogInformation(
            SidecarLogEventIds.PipeListening,
            "Named pipe server listening");

        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        Task? acceptLoop;
        CancellationTokenSource? cts;
        NamedPipeServerStream? pipe;

        lock (_gate)
        {
            if (!_started)
            {
                return;
            }

            cts = _runCts;
            acceptLoop = _acceptLoopTask;
            pipe = _activePipe;
            _started = false;
            _runCts = null;
            _acceptLoopTask = null;
            _activePipe = null;
        }

        try
        {
            if (cts is not null)
            {
                await cts.CancelAsync().ConfigureAwait(false);
            }

            if (pipe is not null)
            {
                await pipe.DisposeAsync().ConfigureAwait(false);
            }

            if (acceptLoop is not null)
            {
                try
                {
                    await acceptLoop.WaitAsync(cancellationToken).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    // Host shutdown cancelled the wait; accept loop is already cancelling.
                }
            }
        }
        finally
        {
            cts?.Dispose();
        }

        _logger.LogInformation(SidecarLogEventIds.PipeStopped, "Named pipe server stopped");
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        await StopAsync(CancellationToken.None).ConfigureAwait(false);
        _writeLock.Dispose();
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        DisposeAsync().AsTask().GetAwaiter().GetResult();
    }

    public async Task SendEventAsync(MessageEnvelope envelope, CancellationToken cancellationToken)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        ArgumentNullException.ThrowIfNull(envelope);

        NamedPipeServerStream? pipe;
        lock (_gate)
        {
            pipe = _activePipe;
        }

        if (pipe is null || !pipe.IsConnected)
        {
            _logger.LogDebug("Dropping event {EventType}; no connected pipe client", envelope.Type);
            return;
        }

        try
        {
            await WriteEnvelopeAsync(pipe, envelope, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is IOException or ObjectDisposedException)
        {
            _logger.LogWarning(SidecarLogEventIds.PipeClientDisconnected, ex, "Failed to send event {EventType}", envelope.Type);
        }
    }

    private async Task AcceptLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            NamedPipeServerStream? pipe = null;
            try
            {
                pipe = CreatePipe();
                lock (_gate)
                {
                    _activePipe = pipe;
                }

                await pipe.WaitForConnectionAsync(cancellationToken).ConfigureAwait(false);
                _logger.LogInformation(SidecarLogEventIds.PipeClientConnected, "Named pipe client connected");

                await ServeClientAsync(pipe, cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
            catch (IOException ex)
            {
                _logger.LogWarning(SidecarLogEventIds.PipeClientDisconnected, ex, "Named pipe I/O ended");
            }
            catch (Exception ex)
            {
                _logger.LogError(SidecarLogEventIds.PipeFaulted, ex, "Named pipe accept loop faulted");
            }
            finally
            {
                if (pipe is not null)
                {
                    await pipe.DisposeAsync().ConfigureAwait(false);
                }

                lock (_gate)
                {
                    if (ReferenceEquals(_activePipe, pipe))
                    {
                        _activePipe = null;
                    }
                }

                if (!cancellationToken.IsCancellationRequested)
                {
                    _logger.LogInformation(
                        SidecarLogEventIds.PipeClientDisconnected,
                        "Named pipe client disconnected; waiting for reconnect");
                }
            }
        }
    }

    private async Task ServeClientAsync(NamedPipeServerStream pipe, CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested && pipe.IsConnected)
        {
            byte[]? payload;
            try
            {
                payload = await LengthPrefixFrameCodec
                    .ReadFrameAsync(pipe, _options.MaxPayloadBytes, cancellationToken)
                    .ConfigureAwait(false);
            }
            catch (InvalidDataException ex)
            {
                _logger.LogWarning(SidecarLogEventIds.PipeMalformedFrame, ex, "Malformed or oversized frame");
                break;
            }

            if (payload is null)
            {
                break;
            }

            MessageEnvelope request;
            try
            {
                request = _serializer.Deserialize(payload);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(SidecarLogEventIds.PipeMalformedFrame, ex, "Failed to deserialize envelope");
                var error = EnvelopeFactory.CreateErrorResponse(
                    null,
                    ProtocolConstants.ErrorCodes.InvalidMessage,
                    "Malformed message envelope.",
                    retriable: false);
                await WriteEnvelopeAsync(pipe, error, cancellationToken).ConfigureAwait(false);
                continue;
            }

            using var requestScope = LogScopes.BeginCorrelationScope(
                _logger,
                request.CorrelationId,
                request.Id);

            MessageEnvelope? response;
            try
            {
                response = await _dispatcher.DispatchAsync(request, cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }

            if (response is not null)
            {
                await WriteEnvelopeAsync(pipe, response, cancellationToken).ConfigureAwait(false);
            }
        }
    }

    private async Task WriteEnvelopeAsync(
        Stream pipe,
        MessageEnvelope envelope,
        CancellationToken cancellationToken)
    {
        var bytes = _serializer.Serialize(envelope);
        await _writeLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await LengthPrefixFrameCodec.WriteFrameAsync(pipe, bytes, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            _writeLock.Release();
        }
    }

    private NamedPipeServerStream CreatePipe()
    {
        var security = new PipeSecurity();
        var currentUser = WindowsIdentity.GetCurrent().User
            ?? throw new InvalidOperationException("Unable to resolve the current user SID for pipe ACL.");

        security.AddAccessRule(
            new PipeAccessRule(
                currentUser,
                PipeAccessRights.FullControl,
                AccessControlType.Allow));

        return NamedPipeServerStreamAcl.Create(
            _options.PipeName,
            PipeDirection.InOut,
            maxNumberOfServerInstances: 1,
            PipeTransmissionMode.Byte,
            PipeOptions.Asynchronous,
            inBufferSize: 0,
            outBufferSize: 0,
            security);
    }
}
