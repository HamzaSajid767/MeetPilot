namespace ZoomDialer.AudioSidecar.Services;

public interface IApplicationInfoService
{
    string ProductName { get; }

    string Version { get; }
}
