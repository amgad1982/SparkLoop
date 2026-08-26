namespace SparkLoop.Application.Interfaces;

public interface IRefreshTokenService
{
    string GenerateRefreshToken();
    string HashToken(string rawToken);
    bool VerifyToken(string rawToken, string tokenHash);
}

