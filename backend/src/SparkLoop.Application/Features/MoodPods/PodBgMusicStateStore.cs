using System.Collections.Concurrent;
using SparkLoop.Application.DTOs;

namespace SparkLoop.Application.Features.MoodPods;

/// <summary>
/// In-memory, process-wide store of the currently-playing background music per
/// pod. We keep this ephemeral because the playback is streamed directly from
/// the original URL on each client — there is no need to re-host the audio on
/// the server. The store only needs to survive long enough for late joiners
/// to fetch it, which is what /api/pods/{id}/bg-music-state does.
///
/// Why this exists:
/// Live audio events (BG_MUSIC_STATE, AUDIO_CHUNK, …) are streamed over
/// Centrifugo in real time. A user who joins AFTER the host pressed "Play"
/// never receives the play event, so they have no idea music is supposed to
/// be playing — they stay silent until the host presses something again.
/// Persisting the latest state per pod and exposing a fetch endpoint on
/// join fixes this so everyone hears the same ambient track.
/// </summary>
public class PodBgMusicStateStore
{
    private readonly ConcurrentDictionary<Guid, PodBgMusicStateDto> _states = new();

    public PodBgMusicStateDto? Get(Guid podId) =>
        _states.TryGetValue(podId, out var state) ? state : null;

    public void Set(Guid podId, PodBgMusicStateDto state) =>
        _states[podId] = state;

    public void Clear(Guid podId, string action) =>
        _states[podId] = new PodBgMusicStateDto(
            PodId: podId,
            Action: action,
            TrackTitle: null,
            TrackUrl: null,
            PresetId: null,
            CurrentTime: null,
            Duration: null,
            DjUserId: null,
            DjUsername: null,
            DjDisplayName: null,
            DjAvatarUrl: null,
            UpdatedAtUtc: DateTime.UtcNow);
}

public record PodBgMusicStateDto(
    Guid PodId,
    string Action,
    string? TrackTitle,
    string? TrackUrl,
    string? PresetId,
    double? CurrentTime,
    double? Duration,
    string? DjUserId,
    string? DjUsername,
    string? DjDisplayName,
    string? DjAvatarUrl,
    DateTime UpdatedAtUtc);