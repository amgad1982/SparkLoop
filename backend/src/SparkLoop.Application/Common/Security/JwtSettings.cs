namespace SparkLoop.Application.Common.Security;

public class JwtSettings
{
    public const string SectionName = "JwtSettings";

    public string SecretKey { get; init; } = "SparkLoop_Super_Secret_Jwt_Signing_Key_2026_Min_256_Bits_Long_Secure!";
    public string Issuer { get; init; } = "SparkLoop.Api";
    public string Audience { get; init; } = "SparkLoop.Client";
    public int ExpiryMinutes { get; init; } = 60; // Access token validity: 1 hour default
    public int RefreshTokenExpiryDays { get; init; } = 30; // Mobile / Trusted refresh token: 30 days
    public int UntrustedRefreshTokenExpiryDays { get; init; } = 7; // Standard untrusted web: 7 days
}
