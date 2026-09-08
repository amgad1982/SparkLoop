using System.Collections.Concurrent;

namespace SparkLoop.Application.Features.MoodPods;

/// <summary>
/// In-memory thread-safe store of active radio station broadcasts.
/// Tracks current live state, playback progress, and deduplicated active listener sessions.
/// </summary>
public class DjStationStateStore
{
    private readonly ConcurrentDictionary<Guid, DjStationBroadcastStateDto> _states = new();
    private readonly ConcurrentDictionary<Guid, ConcurrentDictionary<string, DateTime>> _activeListeners = new();

    public DjStationBroadcastStateDto? Get(Guid stationId)
    {
        if (_states.TryGetValue(stationId, out var state))
        {
            var activeCount = GetListenerCount(stationId);
            return state.ListenersCount != activeCount ? state with { ListenersCount = activeCount } : state;
        }
        return null;
    }

    public void Set(Guid stationId, DjStationBroadcastStateDto state) =>
        _states[stationId] = state;

    public void Clear(Guid stationId)
    {
        _states.TryRemove(stationId, out _);
        _activeListeners.TryRemove(stationId, out _);
    }

    public void ClearListeners(Guid stationId)
    {
        _activeListeners.TryRemove(stationId, out _);
        if (_states.TryGetValue(stationId, out var old))
        {
            _states[stationId] = old with
            {
                ListenersCount = 0,
                UpdatedAtUtc = DateTime.UtcNow
            };
        }
    }

    public int AddOrUpdateListener(Guid stationId, string listenerKey)
    {
        var listeners = _activeListeners.GetOrAdd(stationId, _ => new ConcurrentDictionary<string, DateTime>());
        listeners[listenerKey] = DateTime.UtcNow;

        var count = GetListenerCount(stationId);
        if (_states.TryGetValue(stationId, out var old))
        {
            _states[stationId] = old with
            {
                ListenersCount = count,
                UpdatedAtUtc = DateTime.UtcNow
            };
        }
        return count;
    }

    public int RemoveListener(Guid stationId, string? listenerKey)
    {
        if (_activeListeners.TryGetValue(stationId, out var listeners))
        {
            if (!string.IsNullOrWhiteSpace(listenerKey))
            {
                listeners.TryRemove(listenerKey, out _);
            }
            else
            {
                var oldest = listeners.OrderBy(kv => kv.Value).FirstOrDefault();
                if (!string.IsNullOrEmpty(oldest.Key))
                {
                    listeners.TryRemove(oldest.Key, out _);
                }
            }
        }

        var count = GetListenerCount(stationId);
        if (_states.TryGetValue(stationId, out var old))
        {
            _states[stationId] = old with
            {
                ListenersCount = count,
                UpdatedAtUtc = DateTime.UtcNow
            };
        }
        return count;
    }

    public int GetListenerCount(Guid stationId)
    {
        if (!_activeListeners.TryGetValue(stationId, out var listeners))
        {
            return _states.TryGetValue(stationId, out var state) ? state.ListenersCount : 0;
        }

        // Clean up listeners inactive for more than 3 minutes
        var cutoff = DateTime.UtcNow.AddMinutes(-3);
        foreach (var (key, lastSeen) in listeners)
        {
            if (lastSeen < cutoff)
            {
                listeners.TryRemove(key, out _);
            }
        }

        return listeners.Count;
    }

    public IReadOnlyList<DjStationBroadcastStateDto> GetAllActive() =>
        _states.Values.Where(s => s.IsLive).Select(s => s with { ListenersCount = GetListenerCount(s.StationId) }).ToList();
}

public record DjStationBroadcastStateDto(
    Guid StationId,
    bool IsLive,
    int CurrentTrackIndex,
    string? CurrentTrackTitle,
    string? CurrentTrackArtist,
    double PositionSeconds,
    bool IsPlaying,
    string? DjUserId,
    string? DjUsername,
    string? DjDisplayName,
    string? DjAvatarUrl,
    int ListenersCount,
    DateTime UpdatedAtUtc,
    double TempoRate = 1.0,
    string? FilterPreset = "normal"
);
