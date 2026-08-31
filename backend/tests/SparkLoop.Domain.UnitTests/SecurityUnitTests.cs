using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SparkLoop.Application.Common.Security;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.UserAggregate;
using SparkLoop.Infrastructure.Security;
using SparkLoop.Infrastructure.Security.OAuth;
using Xunit;

namespace SparkLoop.Domain.UnitTests;

public class SecurityUnitTests
{
    private readonly JwtSettings _jwtSettings = new()
    {
        SecretKey = "SparkLoop_Super_Secret_Jwt_Signing_Key_2026_Min_256_Bits_Long_Secure!",
        Issuer = "SparkLoop.Api",
        Audience = "SparkLoop.Client",
        ExpiryMinutes = 60,
        RefreshTokenExpiryDays = 30,
        UntrustedRefreshTokenExpiryDays = 7
    };

    [Fact]
    public void JwtTokenService_GeneratesValidSignedToken_WithStandardClaims()
    {
        // Arrange
        var service = new JwtTokenService(Options.Create(_jwtSettings));
        var userId = Guid.NewGuid();
        var user = User.Create(userId, "sarah", "sarah@sparkloop.app", "Sarah Designer", null, "Bio");

        // Act
        var tokenString = service.GenerateToken(user);

        // Assert
        tokenString.Should().NotBeNullOrWhiteSpace();

        var tokenHandler = new JwtSecurityTokenHandler();
        tokenHandler.CanReadToken(tokenString).Should().BeTrue();

        var token = tokenHandler.ReadJwtToken(tokenString);
        token.Issuer.Should().Be(_jwtSettings.Issuer);
        token.Audiences.Should().Contain(_jwtSettings.Audience);

        var subClaim = token.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Sub);
        subClaim.Should().NotBeNull();
        subClaim!.Value.Should().Be(userId.ToString());

        var nameClaim = token.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.UniqueName || c.Type == ClaimTypes.Name);
        nameClaim.Should().NotBeNull();
        nameClaim!.Value.Should().Be("sarah");
    }

    [Fact]
    public void JwtTokenService_GeneratesToken_WithAvatarUrlClaim_WhenUserHasAvatar()
    {
        // Arrange
        var service = new JwtTokenService(Options.Create(_jwtSettings));
        var userId = Guid.NewGuid();
        var user = User.Create(userId, "sarah", "sarah@sparkloop.app", "Sarah Designer", "https://cdn.sparkloop.app/avatars/sarah.jpg", "Bio");

        // Act
        var tokenString = service.GenerateToken(user);

        // Assert
        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.ReadJwtToken(tokenString);

        var avatarClaim = token.Claims.FirstOrDefault(c => c.Type == "avatar_url");
        avatarClaim.Should().NotBeNull();
        avatarClaim!.Value.Should().Be("https://cdn.sparkloop.app/avatars/sarah.jpg");
    }

    [Fact]
    public void PasswordHasherService_HashesAndVerifiesPasswordCorrectly()
    {
        // Arrange
        var hasher = new PasswordHasherService();
        var user = User.Create(Guid.NewGuid(), "kareem", "kareem@sparkloop.app", "Kareem", null, null);
        var plainPassword = "SecurePassword2026!";

        // Act
        var hash = hasher.HashPassword(user, plainPassword);
        var isValidCorrect = hasher.VerifyPassword(user, plainPassword, hash);
        var isValidWrong = hasher.VerifyPassword(user, "WrongPassword123!", hash);
        var isValidEmpty = hasher.VerifyPassword(user, "", hash);
        var isValidNullHash = hasher.VerifyPassword(user, plainPassword, null);

        // Assert
        hash.Should().NotBeNullOrWhiteSpace();
        hash.Should().NotBe(plainPassword);
        isValidCorrect.Should().BeTrue();
        isValidWrong.Should().BeFalse();
        isValidEmpty.Should().BeFalse();
        isValidNullHash.Should().BeFalse();
    }

    [Fact]
    public void RefreshTokenService_GeneratesUrlSafeToken_AndVerifiesHash()
    {
        // Arrange
        var service = new RefreshTokenService();

        // Act
        var token1 = service.GenerateRefreshToken();
        var token2 = service.GenerateRefreshToken();
        var hash1 = service.HashToken(token1);
        var isValid = service.VerifyToken(token1, hash1);
        var isInvalid = service.VerifyToken(token2, hash1);

        // Assert
        token1.Should().NotBeNullOrWhiteSpace();
        token2.Should().NotBeNullOrWhiteSpace();
        token1.Should().NotBe(token2);
        token1.Should().NotContain("+");
        token1.Should().NotContain("/");

        hash1.Should().NotBeNullOrWhiteSpace();
        isValid.Should().BeTrue();
        isInvalid.Should().BeFalse();
    }

    [Fact]
    public void UserDeviceSession_LifecycleAndRotation_BehavesCorrectly()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var initialTokenHash = "initial_hash_12345";
        var ttl = TimeSpan.FromDays(30);

        var session = UserDeviceSession.Create(
            Guid.NewGuid(),
            userId,
            initialTokenHash,
            "device-uuid-1",
            "iPhone 15 Pro",
            "flutter_ios",
            ttl,
            "192.168.1.50",
            "SparkLoop/1.0 Flutter/iOS",
            isTrusted: true
        );

        // Assert Initial
        session.UserId.Should().Be(userId);
        session.DeviceId.Should().Be("device-uuid-1");
        session.DeviceName.Should().Be("iPhone 15 Pro");
        session.DeviceType.Should().Be("flutter_ios");
        session.IsTrusted.Should().BeTrue();
        session.IsActive.Should().BeTrue();
        session.IsRevoked.Should().BeFalse();
        session.IsExpired.Should().BeFalse();

        // Rotate Token
        var newHash = "rotated_hash_67890";
        session.RotateToken(newHash, ttl, ipAddress: "192.168.1.51");
        session.RefreshTokenHash.Should().Be(newHash);
        session.IpAddress.Should().Be("192.168.1.51");
        session.IsActive.Should().BeTrue();

        // Set Trust
        session.SetTrust(false);
        session.IsTrusted.Should().BeFalse();

        // Revoke
        session.Revoke("User signed out from device");
        session.IsRevoked.Should().BeTrue();
        session.IsActive.Should().BeFalse();
        session.RevokedReason.Should().Be("User signed out from device");
        session.RevokedAtUtc.Should().NotBeNull();
    }

    [Fact]
    public void User_EmailConfirmation_FlowBehavesCorrectly()
    {
        // Arrange
        var user = User.Create(
            Guid.NewGuid(),
            "tariq",
            "tariq@sparkloop.app",
            "Tariq",
            null,
            null,
            isEmailConfirmed: false
        );

        user.IsEmailConfirmed.Should().BeFalse();

        // Generate Confirmation Code
        var code = "582914";
        user.SetEmailConfirmationCode(code, DateTime.UtcNow.AddHours(24));
        user.EmailConfirmationCode.Should().Be(code);

        // Attempt confirm with wrong code
        var wrongConfirm = user.ConfirmEmail("999999");
        wrongConfirm.Should().BeFalse();
        user.IsEmailConfirmed.Should().BeFalse();

        // Confirm with valid code
        var validConfirm = user.ConfirmEmail(code);
        validConfirm.Should().BeTrue();
        user.IsEmailConfirmed.Should().BeTrue();
        user.EmailConfirmationCode.Should().BeNull();
    }

    [Fact]
    public void User_SocialAccount_LinkAndUnlinkFlow()
    {
        // Arrange
        var user = User.Create(Guid.NewGuid(), "maya", "maya@sparkloop.app", "Maya", null, null);
        user.SocialAccounts.Should().BeEmpty();

        // Act - Link Google
        var googleAcc = user.LinkSocialAccount(
            provider: "google",
            providerUserId: "google-123456",
            providerEmail: "maya@gmail.com",
            displayName: "Maya Google",
            avatarUrl: "https://lh3.googleusercontent.com/photo.jpg"
        );

        // Assert
        user.SocialAccounts.Should().HaveCount(1);
        googleAcc.Provider.Should().Be("google");
        googleAcc.ProviderUserId.Should().Be("google-123456");

        // Link Twitter/X
        user.LinkSocialAccount("twitter", "x-987654", "maya@twitter.com", "Maya 𝕏");
        user.SocialAccounts.Should().HaveCount(2);

        // Unlink Google
        var unlinked = user.UnlinkSocialAccount("google");
        unlinked.Should().BeTrue();
        user.SocialAccounts.Should().HaveCount(1);
        user.SocialAccounts.First().Provider.Should().Be("twitter");
    }

    [Fact]
    public async Task OAuthService_GeneratesValidAuthUrl_WithStateAndPkce()
    {
        // Arrange
        var oauthSettings = new OAuthSettings
        {
            Google = new OAuthProviderConfig
            {
                ClientId = "test_google_client_id.apps.googleusercontent.com",
                ClientSecret = "test_google_client_secret",
                AuthorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth",
                TokenEndpoint = "https://oauth2.googleapis.com/token",
                UserInfoEndpoint = "https://openidconnect.googleapis.com/v1/userinfo",
                Scopes = new() { "openid", "email", "profile" }
            },
            Twitter = new OAuthProviderConfig
            {
                ClientId = "test_twitter_client_id",
                ClientSecret = "test_twitter_client_secret",
                AuthorizationEndpoint = "https://twitter.com/i/oauth2/authorize",
                TokenEndpoint = "https://api.twitter.com/2/oauth2/token",
                UserInfoEndpoint = "https://api.twitter.com/2/users/me",
                Scopes = new() { "users.read", "tweet.read" }
            },
            AllowDevFallback = true
        };

        var cacheMock = new MemoryCacheService();
        var clientFactoryMock = new TestHttpClientFactory();
        var loggerMock = new Microsoft.Extensions.Logging.Abstractions.NullLogger<OAuthService>();

        var service = new OAuthService(
            Options.Create(oauthSettings),
            clientFactoryMock,
            cacheMock,
            loggerMock
        );

        // Act - Google URL
        var googleRes = await service.GenerateAuthorizationUrlAsync("google", "http://localhost:5173/oauth-callback.html", "login", null);

        // Assert Google
        googleRes.Url.Should().Contain("accounts.google.com");
        googleRes.Url.Should().Contain("client_id=test_google_client_id");
        googleRes.Url.Should().Contain($"state={googleRes.State}");
        googleRes.State.Should().NotBeNullOrWhiteSpace();

        // Act - Twitter URL (with PKCE)
        var twitterRes = await service.GenerateAuthorizationUrlAsync("twitter", "http://localhost:5173/oauth-callback.html", "login", null);

        // Assert Twitter
        twitterRes.Url.Should().Contain("twitter.com/i/oauth2/authorize");
        twitterRes.Url.Should().Contain("code_challenge=");
        twitterRes.Url.Should().Contain("code_challenge_method=S256");

        // Act & Assert - Dev Fallback Exchange
        var profile = await service.ExchangeCodeAndGetProfileAsync("google", "dev_code_123", googleRes.State, "http://localhost:5173/oauth-callback.html");
        profile.Should().NotBeNull();
        profile.Provider.Should().Be("google");
        profile.Email.Should().Contain("@sparkloop.app");
    }

    private class MemoryCacheService : ICacheService
    {
        private readonly Dictionary<string, object> _store = new();

        public async Task<T> GetOrSetAsync<T>(
            string key,
            Func<CancellationToken, Task<T>> factory,
            TimeSpan? duration = null,
            TimeSpan? failSafeMaxDuration = null,
            CancellationToken cancellationToken = default)
        {
            if (_store.TryGetValue(key, out var val) && val is T typed) return typed;
            var fresh = await factory(cancellationToken);
            if (fresh != null) _store[key] = fresh;
            return fresh;
        }

        public Task<T?> GetOrDefaultAsync<T>(
            string key,
            T? defaultValue = default,
            CancellationToken cancellationToken = default)
        {
            if (_store.TryGetValue(key, out var val) && val is T typed) return Task.FromResult<T?>(typed);
            return Task.FromResult<T?>(defaultValue);
        }

        public Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
        {
            if (_store.TryGetValue(key, out var val) && val is T typed) return Task.FromResult<T?>(typed);
            return Task.FromResult<T?>(default);
        }
        public Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken cancellationToken = default)
        {
            if (value != null) _store[key] = value;
            return Task.CompletedTask;
        }
        public Task RemoveAsync(string key, CancellationToken cancellationToken = default)
        {
            _store.Remove(key);
            return Task.CompletedTask;
        }
        public Task<long> IncrementAsync(string key, TimeSpan? expiry = null, CancellationToken cancellationToken = default) => Task.FromResult(1L);
    }

    private class TestHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new();
    }
}
