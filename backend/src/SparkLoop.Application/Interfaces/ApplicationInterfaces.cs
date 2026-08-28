using Microsoft.EntityFrameworkCore;
using SparkLoop.Domain.Aggregates.ChainAggregate;
using SparkLoop.Domain.Aggregates.MoodPodAggregate;
using SparkLoop.Domain.Aggregates.PostAggregate;
using SparkLoop.Domain.Aggregates.SparkAggregate;
using SparkLoop.Domain.Aggregates.UserAggregate;

namespace SparkLoop.Application.Interfaces;

public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<Badge> Badges { get; }
    DbSet<Post> Posts { get; }
    DbSet<Reaction> Reactions { get; }
    DbSet<Spark> Sparks { get; }
    DbSet<SparkSubmission> SparkSubmissions { get; }
    DbSet<SparkVote> SparkVotes { get; }
    DbSet<Chain> Chains { get; }
    DbSet<ChainStep> ChainSteps { get; }
    DbSet<MoodPod> MoodPods { get; }
    DbSet<PodMessage> PodMessages { get; }
    DbSet<UserFollow> UserFollows { get; }
    DbSet<UserDeviceSession> UserDeviceSessions { get; }
    DbSet<UserSocialAccount> UserSocialAccounts { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface ICentrifugoService
{
    Task PublishAsync<T>(string channel, T data, CancellationToken cancellationToken = default);
    Task BroadcastAsync<T>(IEnumerable<string> channels, T data, CancellationToken cancellationToken = default);
    string GenerateConnectionToken(string userId, string username, TimeSpan? ttl = null);
    string GenerateSubscriptionToken(string client, string channel, TimeSpan? ttl = null);
}

public interface IBlobStorageService
{
    Task<string> UploadFileAsync(Stream stream, string fileName, string contentType, CancellationToken cancellationToken = default);
    Task DeleteFileAsync(string fileUrl, CancellationToken cancellationToken = default);
}

public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? Username { get; }
    string? DisplayName { get; }
    string? AvatarUrl { get; }
    bool IsAuthenticated { get; }
}

public interface ICacheService
{
    Task<T> GetOrSetAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan? duration = null,
        TimeSpan? failSafeMaxDuration = null,
        CancellationToken cancellationToken = default);

    Task<T?> GetOrDefaultAsync<T>(
        string key,
        T? defaultValue = default,
        CancellationToken cancellationToken = default);

    Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default);
    Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken cancellationToken = default);
    Task RemoveAsync(string key, CancellationToken cancellationToken = default);
    Task<long> IncrementAsync(string key, TimeSpan? expiry = null, CancellationToken cancellationToken = default);
}

public record OAuthUserProfile(
    string Provider,
    string ProviderUserId,
    string? Email,
    string? DisplayName,
    string? AvatarUrl
);

public record OAuthAuthorizationUrlResult(
    string Url,
    string State
);

public interface IOAuthService
{
    Task<OAuthAuthorizationUrlResult> GenerateAuthorizationUrlAsync(string provider, string redirectUri, string action, Guid? currentUserId, CancellationToken cancellationToken = default);
    Task<OAuthUserProfile> ExchangeCodeAndGetProfileAsync(string provider, string code, string state, string redirectUri, CancellationToken cancellationToken = default);
}

public interface ILiveKitService
{
    string GenerateVoiceToken(string podId, string userId, string username, string displayName, bool isOnStage, TimeSpan? ttl = null);
    string GetServerUrl();
}
