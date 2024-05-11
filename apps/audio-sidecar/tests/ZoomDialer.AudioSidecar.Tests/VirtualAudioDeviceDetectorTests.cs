using ZoomDialer.AudioSidecar.Audio;

namespace ZoomDialer.AudioSidecar.Tests;

public sealed class VirtualAudioDeviceDetectorTests
{
    [Fact]
    public void Software_Instance_Id_Is_Virtual()
    {
        var result = VirtualAudioDeviceDetector.IsLikelyVirtual(
            new VirtualAudioDeviceDetector.Signals(
                InstanceId: @"SWD\MMDEVAPI\{0.0.0.00000000}.{abc}",
                FriendlyName: "Speakers",
                DeviceFriendlyName: "Some Adapter",
                FormFactor: 1, // Speakers
                HasPairedCaptureAdapter: false));

        Assert.True(result);
    }

    [Fact]
    public void Root_Instance_Id_Is_Virtual()
    {
        Assert.True(
            VirtualAudioDeviceDetector.HasSoftwareEnumeratorPath(@"ROOT\MEDIA\0000"));
    }

    [Fact]
    public void Physical_Speakers_Without_Soft_Signals_Are_Not_Virtual()
    {
        var result = VirtualAudioDeviceDetector.IsLikelyVirtual(
            new VirtualAudioDeviceDetector.Signals(
                InstanceId: @"USB\VID_1234&PID_5678\AUDIO",
                FriendlyName: "Speakers (Realtek Audio)",
                DeviceFriendlyName: "Realtek Audio",
                FormFactor: 1, // Speakers
                HasPairedCaptureAdapter: false));

        Assert.False(result);
    }

    [Fact]
    public void Name_Family_Token_Marks_Virtual()
    {
        Assert.True(VirtualAudioDeviceDetector.MatchesNameFamily("CABLE Input"));
        Assert.True(VirtualAudioDeviceDetector.MatchesNameFamily("Voicemeeter Input"));
        Assert.True(
            VirtualAudioDeviceDetector.IsLikelyVirtual(
                new VirtualAudioDeviceDetector.Signals(
                    InstanceId: null,
                    FriendlyName: "Line 1 (Virtual Audio Device)",
                    DeviceFriendlyName: null,
                    FormFactor: null,
                    HasPairedCaptureAdapter: false)));
    }

    [Fact]
    public void Unknown_FormFactor_Marks_Virtual()
    {
        Assert.True(VirtualAudioDeviceDetector.IsVirtualLikeFormFactor(10));
        Assert.True(
            VirtualAudioDeviceDetector.IsLikelyVirtual(
                new VirtualAudioDeviceDetector.Signals(
                    InstanceId: @"PCI\VEN_8086",
                    FriendlyName: "Mystery Output",
                    DeviceFriendlyName: "Mystery",
                    FormFactor: 10,
                    HasPairedCaptureAdapter: false)));
    }

    [Fact]
    public void Paired_Capture_Adapter_Marks_Virtual()
    {
        Assert.True(
            VirtualAudioDeviceDetector.IsLikelyVirtual(
                new VirtualAudioDeviceDetector.Signals(
                    InstanceId: @"PCI\VEN_8086",
                    FriendlyName: "Input (Shared Adapter)",
                    DeviceFriendlyName: "Shared Adapter",
                    FormFactor: 1,
                    HasPairedCaptureAdapter: true)));
    }
}
