using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SparkLoop.Application.Interfaces;

namespace SparkLoop.Infrastructure.Security.OAuth;

public class OAuthService : IOAuthService
{
    private readonly OAuthSettings _settings;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ICacheService _cacheService;
    private readonly ILogger<OAuthService> _logger;

    public OAuthService(
        IOptions<OAuthSettings> options,
        IHttpClientFactory httpClientFactory,
        ICacheService cacheService,
        ILogger<OAuthService> logger)
    {
        _settings = options.Value;
        _httpClientFactory = httpClientFactory;
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task<OAuthAuthorizationUrlResult> GenerateAuthorizationUrlAsync(
        string provider,
        string redirectUri,
        string action,
        Guid? currentUserId,
        CancellationToken cancellationToken = default)
    {
        var normalizedProvider = provider.ToLowerInvariant();
        var config = GetProviderConfig(normalizedProvider);

        var stateNonce = GenerateBase64UrlRandom(32);
        var codeVerifier = GenerateBase64UrlRandom(32);
        var codeChallenge = ComputeSha256Base64Url(codeVerifier);

        var stateData = new OAuthStateData(
            normalizedProvider,
            action,
            redirectUri,
            currentUserId,
            codeVerifier
        );

        // Store state in cache for 15 minutes
        await _cacheService.SetAsync($"oauth_state:{stateNonce}", stateData, TimeSpan.FromMinutes(15), cancellationToken);

        if (config == null || !config.IsConfigured)
        {
            if (_settings.AllowDevFallback)
            {
                _logger.LogWarning("OAuth provider {Provider} is not fully configured with real ClientId/Secret. Using interactive dev fallback.", normalizedProvider);
                var devUrl = $"{redirectUri}?code=dev_code_{Guid.NewGuid():N}&state={stateNonce}&provider={normalizedProvider}&dev_mode=true";
                return new OAuthAuthorizationUrlResult(devUrl, stateNonce);
            }

            throw new InvalidOperationException($"OAuth Provider '{provider}' is not configured in appsettings.json.");
        }

        var sb = new StringBuilder(config.AuthorizationEndpoint);
        sb.Append("?client_id=").Append(Uri.EscapeDataString(config.EffectiveClientId));
        sb.Append("&redirect_uri=").Append(Uri.EscapeDataString(redirectUri));
        sb.Append("&response_type=code");
        sb.Append("&state=").Append(Uri.EscapeDataString(stateNonce));

        var scopes = config.Scopes.Count > 0 ? string.Join(" ", config.Scopes) : "openid email profile";

        switch (normalizedProvider)
        {
            case "google":
                sb.Append("&scope=").Append(Uri.EscapeDataString(scopes));
                sb.Append("&access_type=offline&prompt=select_account");
                break;

            case "facebook":
                sb.Append("&scope=").Append(Uri.EscapeDataString(string.Join(",", config.Scopes.Count > 0 ? config.Scopes : new List<string> { "email", "public_profile" })));
                break;

            case "twitter":
                sb.Append("&scope=").Append(Uri.EscapeDataString(scopes));
                sb.Append("&code_challenge=").Append(Uri.EscapeDataString(codeChallenge));
                sb.Append("&code_challenge_method=S256");
                break;

            default:
                sb.Append("&scope=").Append(Uri.EscapeDataString(scopes));
                break;
        }

        return new OAuthAuthorizationUrlResult(sb.ToString(), stateNonce);
    }

    public async Task<OAuthUserProfile> ExchangeCodeAndGetProfileAsync(
        string provider,
        string code,
        string state,
        string redirectUri,
        CancellationToken cancellationToken = default)
    {
        var normalizedProvider = provider.ToLowerInvariant();
        var cacheKey = $"oauth_state:{state}";
        var stateData = await _cacheService.GetAsync<OAuthStateData>(cacheKey, cancellationToken);

        if (stateData == null)
        {
            throw new InvalidOperationException("OAuth state is invalid or has expired. Please try signing in again.");
        }

        // Clean up used state
        await _cacheService.RemoveAsync(cacheKey, cancellationToken);

        var config = GetProviderConfig(normalizedProvider);

        // Check if dev fallback code was used
        if (code.StartsWith("dev_code_") || (config != null && !config.IsConfigured && _settings.AllowDevFallback))
        {
            return GenerateDevFallbackProfile(normalizedProvider, stateData);
        }

        if (config == null || !config.IsConfigured)
        {
            throw new InvalidOperationException($"OAuth Provider '{provider}' credentials are missing.");
        }

        var client = _httpClientFactory.CreateClient();

        return normalizedProvider switch
        {
            "google" => await ExchangeGoogleAsync(client, config, code, redirectUri, cancellationToken),
            "facebook" => await ExchangeFacebookAsync(client, config, code, redirectUri, cancellationToken),
            "twitter" => await ExchangeTwitterAsync(client, config, code, redirectUri, stateData.CodeVerifier, cancellationToken),
            _ => throw new NotSupportedException($"Provider '{provider}' is not supported.")
        };
    }

    private async Task<OAuthUserProfile> ExchangeGoogleAsync(
        HttpClient client,
        OAuthProviderConfig config,
        string code,
        string redirectUri,
        CancellationToken cancellationToken)
    {
        var tokenReq = new Dictionary<string, string>
        {
            { "code", code },
            { "client_id", config.EffectiveClientId },
            { "client_secret", config.EffectiveClientSecret },
            { "redirect_uri", redirectUri },
            { "grant_type", "authorization_code" }
        };

        var response = await client.PostAsync(config.TokenEndpoint, new FormUrlEncodedContent(tokenReq), cancellationToken);
        var tokenJson = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Google token exchange failed: {Response}", tokenJson);
            throw new InvalidOperationException($"Google authorization failed: {response.StatusCode}");
        }

        using var doc = JsonDocument.Parse(tokenJson);
        var accessToken = doc.RootElement.GetProperty("access_token").GetString()
            ?? throw new InvalidOperationException("Missing access_token from Google.");

        // Fetch User Profile
        var userReq = new HttpRequestMessage(HttpMethod.Get, config.UserInfoEndpoint);
        userReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var userRes = await client.SendAsync(userReq, cancellationToken);
        var userJson = await userRes.Content.ReadAsStringAsync(cancellationToken);

        if (!userRes.IsSuccessStatusCode)
        {
            _logger.LogError("Google userinfo fetch failed: {Response}", userJson);
            throw new InvalidOperationException("Failed to fetch Google user profile.");
        }

        using var userDoc = JsonDocument.Parse(userJson);
        var sub = userDoc.RootElement.GetProperty("sub").GetString()!;
        var email = userDoc.RootElement.TryGetProperty("email", out var emailProp) ? emailProp.GetString() : null;
        var name = userDoc.RootElement.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;
        var picture = userDoc.RootElement.TryGetProperty("picture", out var picProp) ? picProp.GetString() : null;

        return new OAuthUserProfile("google", sub, email, name, picture);
    }

    private async Task<OAuthUserProfile> ExchangeFacebookAsync(
        HttpClient client,
        OAuthProviderConfig config,
        string code,
        string redirectUri,
        CancellationToken cancellationToken)
    {
        var tokenUrl = $"{config.TokenEndpoint}?client_id={Uri.EscapeDataString(config.EffectiveClientId)}&client_secret={Uri.EscapeDataString(config.EffectiveClientSecret)}&redirect_uri={Uri.EscapeDataString(redirectUri)}&code={Uri.EscapeDataString(code)}";

        var response = await client.GetAsync(tokenUrl, cancellationToken);
        var tokenJson = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Facebook token exchange failed: {Response}", tokenJson);
            throw new InvalidOperationException("Facebook authorization code exchange failed.");
        }

        using var doc = JsonDocument.Parse(tokenJson);
        var accessToken = doc.RootElement.GetProperty("access_token").GetString()
            ?? throw new InvalidOperationException("Missing access_token from Facebook.");

        var userUrl = $"{config.UserInfoEndpoint}&access_token={Uri.EscapeDataString(accessToken)}";
        var userRes = await client.GetAsync(userUrl, cancellationToken);
        var userJson = await userRes.Content.ReadAsStringAsync(cancellationToken);

        if (!userRes.IsSuccessStatusCode)
        {
            _logger.LogError("Facebook userinfo fetch failed: {Response}", userJson);
            throw new InvalidOperationException("Failed to fetch Facebook user profile.");
        }

        using var userDoc = JsonDocument.Parse(userJson);
        var id = userDoc.RootElement.GetProperty("id").GetString()!;
        var name = userDoc.RootElement.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;
        var email = userDoc.RootElement.TryGetProperty("email", out var emailProp) ? emailProp.GetString() : null;

        string? picture = null;
        if (userDoc.RootElement.TryGetProperty("picture", out var picObj) &&
            picObj.TryGetProperty("data", out var dataObj) &&
            dataObj.TryGetProperty("url", out var urlProp))
        {
            picture = urlProp.GetString();
        }

        return new OAuthUserProfile("facebook", id, email, name, picture);
    }

    private async Task<OAuthUserProfile> ExchangeTwitterAsync(
        HttpClient client,
        OAuthProviderConfig config,
        string code,
        string redirectUri,
        string? codeVerifier,
        CancellationToken cancellationToken)
    {
        var tokenReq = new Dictionary<string, string>
        {
            { "code", code },
            { "client_id", config.EffectiveClientId },
            { "redirect_uri", redirectUri },
            { "grant_type", "authorization_code" },
            { "code_verifier", codeVerifier ?? "" }
        };

        var reqMessage = new HttpRequestMessage(HttpMethod.Post, config.TokenEndpoint)
        {
            Content = new FormUrlEncodedContent(tokenReq)
        };

        if (!string.IsNullOrWhiteSpace(config.EffectiveClientSecret))
        {
            var basicAuth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{config.EffectiveClientId}:{config.EffectiveClientSecret}"));
            reqMessage.Headers.Authorization = new AuthenticationHeaderValue("Basic", basicAuth);
        }

        var response = await client.SendAsync(reqMessage, cancellationToken);
        var tokenJson = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Twitter token exchange failed: {Response}", tokenJson);
            throw new InvalidOperationException("Twitter authorization code exchange failed.");
        }

        using var doc = JsonDocument.Parse(tokenJson);
        var accessToken = doc.RootElement.GetProperty("access_token").GetString()
            ?? throw new InvalidOperationException("Missing access_token from Twitter.");

        var userReq = new HttpRequestMessage(HttpMethod.Get, config.UserInfoEndpoint);
        userReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var userRes = await client.SendAsync(userReq, cancellationToken);
        var userJson = await userRes.Content.ReadAsStringAsync(cancellationToken);

        if (!userRes.IsSuccessStatusCode)
        {
            _logger.LogError("Twitter userinfo fetch failed: {Response}", userJson);
            throw new InvalidOperationException("Failed to fetch Twitter/X profile.");
        }

        using var userDoc = JsonDocument.Parse(userJson);
        var data = userDoc.RootElement.GetProperty("data");
        var id = data.GetProperty("id").GetString()!;
        var username = data.TryGetProperty("username", out var uProp) ? uProp.GetString() : null;
        var name = data.TryGetProperty("name", out var nProp) ? nProp.GetString() : username;
        var picture = data.TryGetProperty("profile_image_url", out var pProp) ? pProp.GetString() : null;
        var email = $"{username ?? id}@twitter.com";

        return new OAuthUserProfile("twitter", id, email, name, picture);
    }

    private OAuthUserProfile GenerateDevFallbackProfile(string provider, OAuthStateData stateData)
    {
        var randomId = Math.Abs(stateData.StateNonce.GetHashCode());
        var suffix = (randomId % 9000) + 1000;
        var username = $"{provider}_creator_{suffix}";
        var email = $"{username}@sparkloop.app";
        var displayName = $"{char.ToUpper(provider[0])}{provider[1..]} Creator #{suffix}";
        var avatarUrl = $"https://api.dicebear.com/7.x/bottts/svg?seed={provider}_{suffix}";

        return new OAuthUserProfile(provider, $"{provider}_uid_{suffix}", email, displayName, avatarUrl);
    }

    private OAuthProviderConfig? GetProviderConfig(string provider) => provider switch
    {
        "google" => _settings.Google,
        "facebook" => _settings.Facebook,
        "twitter" => _settings.Twitter,
        _ => null
    };

    private static string GenerateBase64UrlRandom(int byteLength)
    {
        var bytes = RandomNumberGenerator.GetBytes(byteLength);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static string ComputeSha256Base64Url(string input)
    {
        var bytes = SHA256.HashData(Encoding.ASCII.GetBytes(input));
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    public record OAuthStateData(
        string Provider,
        string Action,
        string RedirectUri,
        Guid? CurrentUserId,
        string? CodeVerifier,
        string StateNonce = ""
    );
}

