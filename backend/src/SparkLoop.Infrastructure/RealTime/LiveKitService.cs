using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;

namespace SparkLoop.Infrastructure.RealTime;

public class LiveKitService : ILiveKitService
{
    private readonly IConfiguration _configuration;
    private readonly string _serverUrl;
    private readonly string _apiKey;
    private readonly string _apiSecret;
    private readonly ILogger<LiveKitService> _logger;

    public LiveKitService(IConfiguration configuration, ILogger<LiveKitService> logger)
    {
        _configuration = configuration;
        _logger = logger;
        // FIX (Bug #3 - "remote calls from the pod's host don't work on mobile"):
        //
        // Before this change the LiveKit service silently overrode the configured
        // secure hostname (`wss://slooplive.mydev-lab.com`) back to the raw IP
        // `ws://92.4.162.183:7880`. Any client that received this URL — web or
        // mobile — had to work around the missing TLS. The web app did so via a
        // browser-side auto-upgrade in `usePodVoiceEngine.ts`; the Flutter app
        // did not, which made every WebRTC connection from a real iOS / iPadOS
        // device fail and silently dropped every remote host action
        // (open mic, remote mute, kick from stage, etc.).
        //
        // We now honor whatever is configured. In production deployments the
        // `LiveKit:ServerUrl` value is `wss://slooplive.mydev-lab.com`, and
        // clients receive a TLS URL they can use directly. Local development
        // still works because the dev override sets `ws://localhost:7880` or
        // the raw IP.
        _serverUrl = configuration["LiveKit:ServerUrl"] ?? "ws://localhost:7880";
        _apiKey = configuration["LiveKit:ApiKey"] ?? "sparkloop_livekit_key";
        _apiSecret = configuration["LiveKit:ApiSecret"] ?? "sparkloop_livekit_secret_2026_super_secure_32chars";
    }

    public string GetServerUrl() => _serverUrl;

    public IReadOnlyList<IceServerDto> GetIceServers()
    {
        var turnServer = _configuration["LiveKit:Turn:Server"] ?? "turn:92.4.162.183:3478";
        var turnUsername = _configuration["LiveKit:Turn:Username"] ?? "sparkloop";
        var turnCredential = _configuration["LiveKit:Turn:Credential"] ?? "SparkLoopTurnSecret2026Secure!";

        return new List<IceServerDto>
        {
            new(new[] { "stun:stun.l.google.com:19302" }),
            new(new[] { "stun:92.4.162.183:3478" }),
            new(new[] { turnServer }, turnUsername, turnCredential)
        };
    }

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

            // FIX (Bug #1 - SparkLoop raise-hand approval flow):
            //
            // Before this change the JWT ALWAYS granted `canPublish: true`,
            // regardless of whether the user was a host / moderator / approved
            // speaker, or merely an audience member in a `allowOpenMic = false`
            // room. That meant an audience participant could ignore the
            // moderator's raise-hand gate and start publishing audio simply by
            // calling `setMicrophoneEnabled(true)` on their LiveKit
            // local participant. The frontend raised-hand UI therefore could
            // not reliably enforce the "moderated stage" policy.
            //
            // We now flip `canPublish` / `canPublishAudio` to follow the
            // server-computed `isOnStage` flag:
            //
            //   * isOnStage == true  -> canPublishAudio = true  (speaker)
            //   * isOnStage == false -> canPublishAudio = false (listener)
            //
            // The user is still allowed to receive audio (`canSubscribe`) and
            // to publish data signals (chat, reactions, hand-raise, etc.)
            // so the rest of the social features keep working.
            var canPublishAudio = isOnStage;

            var videoGrants = new Dictionary<string, object>
            {
                { "room", roomName },
                { "roomJoin", true },
                { "canPublish", canPublishAudio },
                { "canPublishAudio", canPublishAudio },
                { "canPublishVideo", false },
                { "canSubscribe", true },
                { "canPublishData", true }
            };

            var metadata = JsonSerializer.Serialize(new
            {
                userId,
                username,
                displayName,
                isOnStage,
                canPublish = canPublishAudio
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

    public string GenerateStationToken(
        string stationId,
        string userId,
        string username,
        string displayName,
        bool isDjHost,
        TimeSpan? ttl = null)
    {
        try
        {
            var roomName = stationId.StartsWith("station-") ? stationId : $"station-{stationId}";
            var keyBytes = Encoding.UTF8.GetBytes(_apiSecret);
            var signingCredentials = new SigningCredentials(
                new SymmetricSecurityKey(keyBytes),
                SecurityAlgorithms.HmacSha256
            );

            var now = DateTimeOffset.UtcNow;
            var expires = now.Add(ttl ?? TimeSpan.FromHours(8));

            // DJ Host can publish audio track to SFU; Listeners subscribe only (downlink only)
            var videoGrants = new Dictionary<string, object>
            {
                { "room", roomName },
                { "roomJoin", true },
                { "canPublish", isDjHost },
                { "canSubscribe", true },
                { "canPublishData", true }
            };

            var metadata = JsonSerializer.Serialize(new
            {
                userId,
                username,
                displayName,
                isDjHost,
                isStation = true
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
            _logger.LogError(ex, "Failed to generate LiveKit station token for user {UserId} in station {StationId}", userId, stationId);
            throw;
        }
    }
}

