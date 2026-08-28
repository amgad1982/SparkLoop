using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using SparkLoop.Application.Interfaces;

namespace SparkLoop.Infrastructure.RealTime;

public class CentrifugoService : ICentrifugoService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiUrl;
    private readonly string _wsUrl;
    private readonly string _apiKey;
    private readonly string _secretKey;
    private readonly ILogger<CentrifugoService> _logger;

    public CentrifugoService(HttpClient httpClient, IConfiguration configuration, ILogger<CentrifugoService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;

        _apiUrl = configuration["Centrifugo:ApiUrl"] ?? "http://localhost:8000/api";
        _wsUrl = configuration["Centrifugo:WsUrl"] ?? "ws://localhost:8000/connection/websocket";
        _apiKey = configuration["Centrifugo:ApiKey"] ?? "sparkloop_centrifugo_api_key_2026_super_secure";
        _secretKey = configuration["Centrifugo:SecretKey"] ?? "sparkloop_centrifugo_secret_jwt_key_2026_super_secure";

        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("apikey", _apiKey);
    }

    public string GetWebSocketUrl() => _wsUrl;

    public async Task PublishAsync<T>(string channel, T data, CancellationToken cancellationToken = default)
    {
        try
        {
            var url = $"{_apiUrl.TrimEnd('/')}/publish";
            var requestBody = new
            {
                channel,
                data
            };

            var json = JsonSerializer.Serialize(requestBody);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(url, content, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning("Centrifugo publish returned non-success code {StatusCode}: {Error}", response.StatusCode, error);
            }
        }
        catch (Exception ex)
        {
            // Real-time publish failure should not break DB transaction, but should be logged
            _logger.LogError(ex, "Failed to publish message to Centrifugo channel {Channel}", channel);
        }
    }

    public async Task BroadcastAsync<T>(IEnumerable<string> channels, T data, CancellationToken cancellationToken = default)
    {
        try
        {
            var url = $"{_apiUrl.TrimEnd('/')}/broadcast";
            var requestBody = new
            {
                channels = channels.ToArray(),
                data
            };

            var json = JsonSerializer.Serialize(requestBody);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(url, content, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning("Centrifugo broadcast returned non-success code {StatusCode}: {Error}", response.StatusCode, error);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to broadcast message to Centrifugo channels");
        }
    }

    public string GenerateConnectionToken(string userId, string username, TimeSpan? ttl = null)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_secretKey);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, userId),
                new Claim("name", username)
            }),
            Expires = DateTime.UtcNow.Add(ttl ?? TimeSpan.FromDays(7)),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    public string GenerateSubscriptionToken(string client, string channel, TimeSpan? ttl = null)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_secretKey);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim("client", client),
                new Claim("channel", channel)
            }),
            Expires = DateTime.UtcNow.Add(ttl ?? TimeSpan.FromDays(1)),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}
