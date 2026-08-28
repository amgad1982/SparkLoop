using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SparkLoop.Application.Interfaces;
using StackExchange.Redis;

namespace SparkLoop.Infrastructure.Services;

public class RedisCacheService : ICacheService
{
    private readonly IConnectionMultiplexer? _redis;
    private readonly IDatabase? _db;
    private readonly ILogger<RedisCacheService> _logger;
    private readonly bool _isConnected;

    public RedisCacheService(IConfiguration configuration, ILogger<RedisCacheService> logger)
    {
        _logger = logger;
        var connectionString = configuration.GetConnectionString("Redis") ?? "localhost:6379,abortConnect=false";

        try
        {
            var options = ConfigurationOptions.Parse(connectionString);
            options.AbortOnConnectFail = false;
            options.ConnectTimeout = 3000;
            _redis = ConnectionMultiplexer.Connect(options);
            _db = _redis.GetDatabase();
            _isConnected = _redis.IsConnected;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis connection failed ({Message}). Caching will operate in in-memory fallback mode.", ex.Message);
            _isConnected = false;
        }
    }

    public async Task<T> GetOrSetAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan? duration = null,
        TimeSpan? failSafeMaxDuration = null,
        CancellationToken cancellationToken = default)
    {
        var existing = await GetAsync<T>(key, cancellationToken);
        if (existing != null)
        {
            return existing;
        }

        var freshlyComputed = await factory(cancellationToken);
        await SetAsync(key, freshlyComputed, duration, cancellationToken);
        return freshlyComputed;
    }

    public async Task<T?> GetOrDefaultAsync<T>(
        string key,
        T? defaultValue = default,
        CancellationToken cancellationToken = default)
    {
        var val = await GetAsync<T>(key, cancellationToken);
        return val ?? defaultValue;
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        if (_db == null || !_isConnected) return default;

        try
        {
            var val = await _db.StringGetAsync(key);
            if (!val.HasValue) return default;
            return JsonSerializer.Deserialize<T>(val.ToString()!);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get redis key {Key}", key);
            return default;
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken cancellationToken = default)
    {
        if (_db == null || !_isConnected) return;

        try
        {
            var json = JsonSerializer.Serialize(value);
            if (expiry.HasValue)
            {
                await _db.StringSetAsync(key, json, expiry.Value);
            }
            else
            {
                await _db.StringSetAsync(key, json);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to set redis key {Key}", key);
        }
    }

    public async Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        if (_db == null || !_isConnected) return;

        try
        {
            await _db.KeyDeleteAsync(key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete redis key {Key}", key);
        }
    }

    public async Task<long> IncrementAsync(string key, TimeSpan? expiry = null, CancellationToken cancellationToken = default)
    {
        if (_db == null || !_isConnected) return 1;

        try
        {
            var newVal = await _db.StringIncrementAsync(key);
            if (expiry.HasValue)
            {
                await _db.KeyExpireAsync(key, expiry.Value);
            }
            return newVal;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to increment redis key {Key}", key);
            return 1;
        }
    }
}
