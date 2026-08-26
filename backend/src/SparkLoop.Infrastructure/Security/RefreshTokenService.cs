using System.Security.Cryptography;
using System.Text;
using SparkLoop.Application.Interfaces;

namespace SparkLoop.Infrastructure.Security;

public class RefreshTokenService : IRefreshTokenService
{
    public string GenerateRefreshToken()
    {
        var randomBytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }

    public string HashToken(string rawToken)
    {
        if (string.IsNullOrWhiteSpace(rawToken))
        {
            return string.Empty;
        }

        var bytes = Encoding.UTF8.GetBytes(rawToken.Trim());
        var hashBytes = SHA256.HashData(bytes);
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }

    public bool VerifyToken(string rawToken, string tokenHash)
    {
        if (string.IsNullOrWhiteSpace(rawToken) || string.IsNullOrWhiteSpace(tokenHash))
        {
            return false;
        }

        var computedHash = HashToken(rawToken);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(computedHash),
            Encoding.UTF8.GetBytes(tokenHash.ToLowerInvariant())
        );
    }
}

