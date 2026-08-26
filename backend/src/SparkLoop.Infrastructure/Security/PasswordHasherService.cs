using Microsoft.AspNetCore.Identity;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.UserAggregate;

namespace SparkLoop.Infrastructure.Security;

public class PasswordHasherService : IPasswordHasherService
{
    private readonly PasswordHasher<User> _passwordHasher = new(
        Microsoft.Extensions.Options.Options.Create(new PasswordHasherOptions
        {
            CompatibilityMode = PasswordHasherCompatibilityMode.IdentityV3,
            IterationCount = 100_000
        })
    );

    public string HashPassword(User user, string password)
    {
        return _passwordHasher.HashPassword(user, password);
    }

    public bool VerifyPassword(User user, string password, string? passwordHash)
    {
        if (string.IsNullOrWhiteSpace(passwordHash))
        {
            return false;
        }

        var result = _passwordHasher.VerifyHashedPassword(user, passwordHash, password);
        return result == PasswordVerificationResult.Success || result == PasswordVerificationResult.SuccessRehashNeeded;
    }
}

