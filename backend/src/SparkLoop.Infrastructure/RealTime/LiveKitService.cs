using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using SparkLoop.Application.Interfaces;

namespace SparkLoop.Infrastructure.RealTime;

public class LiveKitService : ILiveKitService
{
    private readonly string _serverUrl;
    private readonly string _apiKey;
    private readonly string _apiSecret;
    private readonly ILogger<LiveKitService> _logger;

    public LiveKitService(IConfiguration configuration, ILogger<LiveKitService> logger)
    {
        _logger = logger;
        _serverUrl = configuration["LiveKit:ServerUrl"] ?? "ws://localhost:7880";
        _apiKey = configuration["LiveKit:ApiKey"] ?? "sparkloop_livekit_key";
        _apiSecret = configuration["LiveKit:ApiSecret"] ?? "sparkloop_livekit_secret_2026_super_secure_32chars";
    }

    public string GetServerUrl() => _serverUrl;

    public string GenerateVoiceToken(
        string podId,
        string userId,
        string username,
        string displayName,
        bool isOnStage,
        TimeSpan? ttl = null)
    {
        try
        {
            var roomName = podId.StartsWith("pod-") ? podId : $"pod-{podId}";
            var keyBytes = Encoding.UTF8.GetBytes(_apiSecret);
            var signingCredentials = new SigningCredentials(
                new SymmetricSecurityKey(keyBytes),
                SecurityAlgorithms.HmacSha256
            );

            var now = DateTimeOffset.UtcNow;
            var expires = now.Add(ttl ?? TimeSpan.FromHours(6));

            var videoGrants = new Dictionary<string, object>
            {
                { "room", roomName },
                { "roomJoin", true },
                { "canPublish", isOnStage },
                { "canSubscribe", true },
                { "canPublishData", true }
            };

            var metadata = JsonSerializer.Serialize(new
            {
                userId,
                username,
                displayName,
                isOnStage
            });

            var payload = new JwtPayload
            {
                { "iss", _apiKey },
                { "sub", userId },
                { "name", string.IsNullOrWhiteSpace(displayName) ? username : displayName },
                { "video", videoGrants },
                { "metadata", metadata },
                { "iat", now.ToUnixTimeSeconds() },
                { "nbf", now.ToUnixTimeSeconds() },
                { "exp", expires.ToUnixTimeSeconds() },
                { "jti", Guid.NewGuid().ToString() }
            };

            var header = new JwtHeader(signingCredentials);
            var token = new JwtSecurityToken(header, payload);
            return new JwtSecurityTokenHandler().WriteToken(token);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate LiveKit voice token for user {UserId} in pod {PodId}", userId, podId);
            throw;
        }
    }
}

