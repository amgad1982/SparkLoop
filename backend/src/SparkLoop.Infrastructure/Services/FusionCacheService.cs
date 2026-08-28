using System.Collections.Concurrent;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SparkLoop.Application.Interfaces;
using StackExchange.Redis;
using ZiggyCreatures.Caching.Fusion;

namespace SparkLoop.Infrastructure.Services;

public class FusionCacheService : ICacheService
{
    private readonly IFusionCache _cache;
    private readonly IConnectionMultiplexer? _redis;
    private readonly ILogger<FusionCacheService> _logger;
    private readonly ConcurrentDictionary<string, long> _inMemoryCounters = new();

    public FusionCacheService(
        IFusionCache cache,
        IConfiguration configuration,
        ILogger<FusionCacheService> logger,
        IConnectionMultiplexer? redis = null)
    {
        _cache = cache;
        _logger = logger;
        _redis = redis;
    }

    public async Task<T> GetOrSetAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan? duration = null,
        TimeSpan? failSafeMaxDuration = null,
        CancellationToken cancellationToken = default)
    {
        FusionCacheEntryOptions? options = null;

        if (duration.HasValue || failSafeMaxDuration.HasValue)
        {
            options = _cache.CreateEntryOptions();
            if (duration.HasValue)
            {
                options.SetDuration(duration.Value);
            }
            if (failSafeMaxDuration.HasValue)
            {
                options.SetFailSafe(true, failSafeMaxDuration.Value, TimeSpan.FromSeconds(10));
            }
        }

        return await _cache.GetOrSetAsync<T>(
            key,
            async (ctx, ct) => await factory(ct),
            options: options,
            token: cancellationToken
        );
    }

    public async Task<T?> GetOrDefaultAsync<T>(
        string key,
        T? defaultValue = default,
        CancellationToken cancellationToken = default)
    {
        return await _cache.GetOrDefaultAsync<T?>(
            key,
            defaultValue: defaultValue,
            token: cancellationToken
        );
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        return await _cache.GetOrDefaultAsync<T?>(key, default, null, cancellationToken);
    }

    public async Task SetAsync<T>(
        string key,
        T value,
        TimeSpan? expiry = null,
        CancellationToken cancellationToken = default)
    {
        FusionCacheEntryOptions? options = null;
        if (expiry.HasValue)
        {
            options = _cache.CreateEntryOptions().SetDuration(expiry.Value);
        }

        await _cache.SetAsync(key, value, options, cancellationToken);
    }

    public async Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        await _cache.RemoveAsync(key, null, cancellationToken);
    }

    public async Task<long> IncrementAsync(
        string key,
        TimeSpan? expiry = null,
        CancellationToken cancellationToken = default)
    {
        // 1. Try Redis Atomic Increment if connected
        if (_redis != null && _redis.IsConnected)
        {
            try
            {
                var db = _redis.GetDatabase();
                var newVal = await db.StringIncrementAsync(key);
                if (expiry.HasValue)
                {
                    await db.KeyExpireAsync(key, expiry.Value);
                }
                return newVal;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Redis Increment failed for key {Key}. Falling back to in-memory counter.", key);
            }
        }

        // 2. Fallback to thread-safe in-memory counter
        var updatedVal = _inMemoryCounters.AddOrUpdate(key, 1, (_, current) => current + 1);
        return updatedVal;
    }
}
