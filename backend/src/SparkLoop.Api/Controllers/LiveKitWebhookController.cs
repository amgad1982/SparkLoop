using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using SparkLoop.Application.Interfaces;

namespace SparkLoop.Api.Controllers;

[ApiController]
[Route("api/livekit/webhook")]
public class LiveKitWebhookController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly ICentrifugoService _centrifugoService;
    private readonly IAppDbContext _dbContext;
    private readonly ILogger<LiveKitWebhookController> _logger;

    public LiveKitWebhookController(
        IConfiguration configuration,
        ICentrifugoService centrifugoService,
        IAppDbContext dbContext,
        ILogger<LiveKitWebhookController> logger)
    {
        _configuration = configuration;
        _centrifugoService = centrifugoService;
        _dbContext = dbContext;
        _logger = logger;
    }

    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> HandleWebhook(CancellationToken cancellationToken)
    {
        string body;
        using (var reader = new StreamReader(Request.Body, Encoding.UTF8))
        {
            body = await reader.ReadToEndAsync(cancellationToken);
        }

        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader))
        {
            _logger.LogWarning("LiveKit webhook rejected: missing Authorization header");
            return Unauthorized("Missing authorization header");
        }

        var apiSecret = _configuration["LiveKit:ApiSecret"] ?? "sparkloop_livekit_secret_2026_super_secure_32chars";

        // Validate JWT signature from LiveKit
        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(apiSecret);
            var token = authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                ? authHeader[7..]
                : authHeader;

            tokenHandler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = false,
                ValidateAudience = false,
                ClockSkew = TimeSpan.FromMinutes(5)
            }, out _);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "LiveKit webhook token validation failed");
            return Unauthorized("Invalid webhook signature");
        }

        // Process webhook payload
        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var eventType = root.TryGetProperty("event", out var ev) ? ev.GetString() : null;
            _logger.LogInformation("Received LiveKit webhook event: {EventType}", eventType);

            string? roomName = null;
            if (root.TryGetProperty("room", out var roomElem) && roomElem.TryGetProperty("name", out var rName))
            {
                roomName = rName.GetString();
            }

            if (!string.IsNullOrEmpty(roomName) && roomName.StartsWith("pod-"))
            {
                var podIdStr = roomName["pod-".Length..];
                if (Guid.TryParse(podIdStr, out var podId))
                {
                    var channel = $"pod:{podId}";

                    if (eventType == "room_finished")
                    {
                        _logger.LogInformation("LiveKit room finished for pod {PodId}. Updating pod status.", podId);
                        var pod = await _dbContext.MoodPods.FirstOrDefaultAsync(p => p.Id == podId, cancellationToken);
                        if (pod != null && pod.IsActive)
                        {
                            pod.ClosePod();
                            await _dbContext.SaveChangesAsync(cancellationToken);
                        }

                        await _centrifugoService.PublishAsync(channel, new
                        {
                            type = "ROOM_FINISHED",
                            podId = podId,
                            timestamp = DateTime.UtcNow
                        }, cancellationToken);
                    }
                    else if (eventType == "participant_left")
                    {
                        string? participantId = null;
                        if (root.TryGetProperty("participant", out var pElem) && pElem.TryGetProperty("identity", out var pIdent))
                        {
                            participantId = pIdent.GetString();
                        }

                        await _centrifugoService.PublishAsync(channel, new
                        {
                            type = "PARTICIPANT_LEFT",
                            podId = podId,
                            userId = participantId,
                            timestamp = DateTime.UtcNow
                        }, cancellationToken);
                    }
                    else if (eventType == "participant_joined")
                    {
                        string? participantId = null;
                        string? participantName = null;
                        if (root.TryGetProperty("participant", out var pElem))
                        {
                            if (pElem.TryGetProperty("identity", out var pIdent)) participantId = pIdent.GetString();
                            if (pElem.TryGetProperty("name", out var pName)) participantName = pName.GetString();
                        }

                        await _centrifugoService.PublishAsync(channel, new
                        {
                            type = "PARTICIPANT_JOINED",
                            podId = podId,
                            userId = participantId,
                            name = participantName,
                            timestamp = DateTime.UtcNow
                        }, cancellationToken);
                    }
                }
            }

            return Ok(new { status = "success" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing LiveKit webhook");
            return StatusCode(500, "Internal error processing webhook");
        }
    }
}

