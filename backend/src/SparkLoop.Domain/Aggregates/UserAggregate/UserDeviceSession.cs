using SparkLoop.Domain.Common;

namespace SparkLoop.Domain.Aggregates.UserAggregate;

public class UserDeviceSession : Entity<Guid>
{
    public Guid UserId { get; private set; }
    public string RefreshTokenHash { get; private set; } = string.Empty;
    public string DeviceId { get; private set; } = string.Empty;
    public string DeviceName { get; private set; } = string.Empty;
    public string DeviceType { get; private set; } = "web"; // "flutter_android", "flutter_ios", "web", etc.
    public string? IpAddress { get; private set; }
    public string? UserAgent { get; private set; }
    public bool IsTrusted { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime LastActiveAtUtc { get; private set; }
    public DateTime ExpiresAtUtc { get; private set; }
    public DateTime? RevokedAtUtc { get; private set; }
    public string? RevokedReason { get; private set; }
    public Guid? ReplacedBySessionId { get; private set; }

    public bool IsActive => RevokedAtUtc == null && DateTime.UtcNow < ExpiresAtUtc;
    public bool IsExpired => DateTime.UtcNow >= ExpiresAtUtc;
    public bool IsRevoked => RevokedAtUtc != null;

    private UserDeviceSession() : base() { }

    public static UserDeviceSession Create(
        Guid id,
        Guid userId,
        string refreshTokenHash,
        string deviceId,
        string deviceName,
        string deviceType,
        TimeSpan ttl,
        string? ipAddress = null,
        string? userAgent = null,
        bool isTrusted = false)
    {
        var now = DateTime.UtcNow;
        return new UserDeviceSession
        {
            Id = id,
            UserId = userId,
            RefreshTokenHash = refreshTokenHash,
            DeviceId = string.IsNullOrWhiteSpace(deviceId) ? Guid.NewGuid().ToString("N") : deviceId.Trim(),
            DeviceName = string.IsNullOrWhiteSpace(deviceName) ? "Unknown Device" : deviceName.Trim(),
            DeviceType = string.IsNullOrWhiteSpace(deviceType) ? "web" : deviceType.Trim().ToLowerInvariant(),
            IpAddress = ipAddress,
            UserAgent = userAgent,
            IsTrusted = isTrusted,
            CreatedAtUtc = now,
            LastActiveAtUtc = now,
            ExpiresAtUtc = now.Add(ttl),
            RevokedAtUtc = null,
            RevokedReason = null,
            ReplacedBySessionId = null
        };
    }

    public void RotateToken(string newRefreshTokenHash, TimeSpan newTtl, Guid? newSessionId = null, string? ipAddress = null)
    {
        var now = DateTime.UtcNow;
        RefreshTokenHash = newRefreshTokenHash;
        ExpiresAtUtc = now.Add(newTtl);
        LastActiveAtUtc = now;
        if (!string.IsNullOrWhiteSpace(ipAddress))
        {
            IpAddress = ipAddress;
        }
        if (newSessionId.HasValue)
        {
            ReplacedBySessionId = newSessionId.Value;
        }
    }

    public void Revoke(string reason = "Explicitly revoked by user")
    {
        RevokedAtUtc = DateTime.UtcNow;
        RevokedReason = reason;
    }

    public void SetTrust(bool isTrusted)
    {
        IsTrusted = isTrusted;
        LastActiveAtUtc = DateTime.UtcNow;
    }

    public void Touch(string? ipAddress = null, string? userAgent = null)
    {
        LastActiveAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(ipAddress)) IpAddress = ipAddress;
        if (!string.IsNullOrWhiteSpace(userAgent)) UserAgent = userAgent;
    }
}

