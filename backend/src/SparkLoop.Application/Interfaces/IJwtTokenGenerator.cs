using SparkLoop.Domain.Aggregates.UserAggregate;

namespace SparkLoop.Application.Interfaces;

public interface IJwtTokenGenerator
{
    string GenerateToken(User user);
    string GenerateToken(Guid userId, string username, string displayName, string email, string? role = null, string? avatarUrl = null);
}


