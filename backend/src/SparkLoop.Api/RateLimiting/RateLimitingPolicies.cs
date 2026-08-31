using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace SparkLoop.Api.RateLimiting;

/// <summary>
/// Centralised ASP.NET Core rate-limit policies used by the API.
///
/// Names defined here are referenced from controllers via <c>[EnableRateLimiting(...)]</c>:
///   • "auth"          — Login / Register / Resend verification / OAuth callback (per-IP).
///   • "write-content" — Create post / chain / pod / spark submission (per-user).
///   • "reactions"     — React / vote / pod reaction / raise-hand bursts (per-user).
///   • "uploads"       — Media upload (per-user).
///   • "pod-audio"     — Base64 audio chunk upload (per-user per-pod).
/// </summary>
public static class RateLimitingPolicies
{
    public const string Auth          = "rl-auth";
    public const string WriteContent  = "rl-write-content";
    public const string Reactions     = "rl-reactions";
    public const string Uploads       = "rl-uploads";
    public const string PodAudio      = "rl-pod-audio";

    public static void AddSparkLoopRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            // Reject with 429 + a small JSON body (avoid leaking ASP.NET defaults).
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, ct) =>
            {
                context.HttpContext.Response.ContentType = "application/json";
                await context.HttpContext.Response.WriteAsync(
                    "{\"error\":\"rate_limited\",\"message\":\"Too many requests. Please slow down and try again shortly.\"}",
                    ct);
            };

            // 1. Auth — partitioned by client IP, sliding window 10 per minute.
            options.AddPolicy(Auth, httpContext =>
            {
                var key = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown-ip";
                return RateLimitPartition.GetSlidingWindowLimiter(key, _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(1),
                    SegmentsPerWindow = 6,
                    QueueLimit = 0,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    AutoReplenishment = true
                });
            });

            // 2. Write-content — per authenticated user, token bucket.
            options.AddPolicy(WriteContent, httpContext =>
            {
                var key = httpContext.User?.Identity?.Name
                       ?? httpContext.Connection.RemoteIpAddress?.ToString()
                       ?? "unknown";
                return RateLimitPartition.GetTokenBucketLimiter(key, _ => new TokenBucketRateLimiterOptions
                {
                    TokenLimit = 30,
                    ReplenishmentPeriod = TimeSpan.FromSeconds(1),
                    TokensPerPeriod = 5,
                    QueueLimit = 0,
                    AutoReplenishment = true
                });
            });

            // 3. Reactions — bursty, per-user, fixed window 60/min.
            options.AddPolicy(Reactions, httpContext =>
            {
                var key = httpContext.User?.Identity?.Name
                       ?? httpContext.Connection.RemoteIpAddress?.ToString()
                       ?? "unknown";
                return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 60,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                });
            });

            // 4. Uploads — per-user, 15 / minute.
            options.AddPolicy(Uploads, httpContext =>
            {
                var key = httpContext.User?.Identity?.Name
                       ?? httpContext.Connection.RemoteIpAddress?.ToString()
                       ?? "unknown";
                return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 15,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                });
            });

            // 5. Pod audio chunks — per-user, 120 / minute (LiveKit is primary; this caps the fallback path).
            options.AddPolicy(PodAudio, httpContext =>
            {
                var key = httpContext.User?.Identity?.Name
                       ?? httpContext.Connection.RemoteIpAddress?.ToString()
                       ?? "unknown";
                return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 120,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                });
            });
        });
    }
}
